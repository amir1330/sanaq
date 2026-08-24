from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal
from time import monotonic
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import SessionLocal
from app.models import FiscalStatus, PaymentType, Product, Sale, SaleItem, Shop, Shift
from app.services.crypto import decrypt_secret

log = logging.getLogger(__name__)

_token_cache: dict[int, tuple[str, float]] = {}
AUTH_RETRY_CODES = {1, 2, 3}
SHIFT_FULL_CODE = 11


def money_float(value: Decimal | int | float | str) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01")))


def tax_amount(price: Decimal, tax_percent: Decimal) -> float:
    percent = Decimal(str(tax_percent or 0))
    if percent <= 0:
        return 0.0
    raw = Decimal(str(price)) - (Decimal(str(price)) * Decimal("100")) / (percent + Decimal("100"))
    return money_float(raw)


def build_check_payload(
    *,
    shop: Shop,
    sale: Sale,
    items: list[SaleItem],
    products: dict[int, Product],
    token: str,
    operation_type: int,
) -> dict[str, Any]:
    positions = []
    for item in items:
        product = products.get(item.product_id)
        tax_percent = product.tax_percent if product else Decimal("0")
        tax_type = product.tax_type if product else 0
        name = product.name if product else f"Товар #{item.product_id}"
        code = (product.fiscal_position_code if product and product.fiscal_position_code else None) or str(
            item.product_id
        )
        positions.append(
            {
                "Count": item.quantity,
                "Price": money_float(item.price_snapshot),
                "TaxPercent": money_float(tax_percent),
                "TaxType": int(tax_type),
                "Tax": tax_amount(item.price_snapshot, tax_percent),
                "PositionName": name,
                "PositionCode": code,
                "UnitCode": settings.webkassa_unit_code,
                "SectionCode": "1",
                "Discount": 0,
                "Markup": 0,
            }
        )
    pay_type = (
        settings.webkassa_payment_cash
        if sale.payment_type == PaymentType.cash
        else settings.webkassa_payment_card
    )
    return {
        "Token": token,
        "CashboxUniqueNumber": shop.webkassa_cashbox_number,
        "OperationType": operation_type,
        "Positions": positions,
        "Payments": [{"Sum": money_float(sale.total_amount), "PaymentType": pay_type}],
        "RoundType": 0,
        "ExternalCheckNumber": str(sale.id),
        "ExternalOrderNumber": str(sale.id),
    }


def shop_ready(shop: Shop) -> bool:
    return bool(
        shop.webkassa_enabled
        and shop.webkassa_login
        and shop.webkassa_password_encrypted
        and shop.webkassa_cashbox_number
    )


def _api_key(shop: Shop) -> str:
    if shop.webkassa_api_key_encrypted:
        return decrypt_secret(shop.webkassa_api_key_encrypted)
    return settings.webkassa_api_key


def _headers(shop: Shop) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    key = _api_key(shop)
    if key:
        headers["X-API-KEY"] = key
    return headers


def _format_errors(payload: dict[str, Any]) -> str:
    errors = payload.get("Errors") or []
    if not errors:
        return str(payload)
    bits = []
    for err in errors:
        if isinstance(err, dict):
            bits.append(f"{err.get('Code', '?')}: {err.get('Text') or err}")
        else:
            bits.append(str(err))
    return "; ".join(bits)


class WebkassaError(Exception):
    def __init__(self, message: str, *, codes: list[int] | None = None):
        super().__init__(message)
        self.codes = codes or []


async def authorize(shop: Shop) -> str:
    password = decrypt_secret(shop.webkassa_password_encrypted or "")
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{settings.webkassa_url.rstrip('/')}/api/Authorize",
            json={"Login": shop.webkassa_login, "Password": password},
            headers=_headers(shop),
        )
        data = resp.json() if resp.content else {}
        if resp.status_code >= 400 or "Data" not in data:
            raise WebkassaError(_format_errors(data) or f"Authorize HTTP {resp.status_code}")
        token = data["Data"]["Token"]
        _token_cache[shop.id] = (token, monotonic() + settings.webkassa_token_ttl_seconds)
        return token


async def get_token(shop: Shop, *, force: bool = False) -> str:
    cached = _token_cache.get(shop.id)
    if not force and cached and cached[1] > monotonic():
        return cached[0]
    return await authorize(shop)


async def _post(shop: Shop, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{settings.webkassa_url.rstrip('/')}{path}",
            json=payload,
            headers=_headers(shop),
        )
        try:
            data = resp.json()
        except ValueError as exc:
            raise WebkassaError(f"Webkassa ответила не JSON ({resp.status_code})") from exc
        if resp.status_code >= 400 and "Errors" not in data:
            raise WebkassaError(f"HTTP {resp.status_code}: {data}")
        return data


async def send_check(shop: Shop, payload: dict[str, Any], *, retried: bool = False) -> dict[str, Any]:
    data = await _post(shop, "/api/Check", payload)
    if data.get("Data"):
        return data["Data"]
    errors = data.get("Errors") or []
    codes = [int(err.get("Code")) for err in errors if isinstance(err, dict) and str(err.get("Code", "")).isdigit()]
    if not retried and AUTH_RETRY_CODES.intersection(codes):
        token = await get_token(shop, force=True)
        payload = {**payload, "Token": token}
        return await send_check(shop, payload, retried=True)
    if not retried and SHIFT_FULL_CODE in codes:
        await close_shift_report(shop)
        token = await get_token(shop, force=True)
        payload = {**payload, "Token": token}
        return await send_check(shop, payload, retried=True)
    raise WebkassaError(_format_errors(data), codes=codes)


async def close_shift_report(shop: Shop) -> dict[str, Any]:
    token = await get_token(shop)
    data = await _post(
        shop,
        "/api/ZReport",
        {"Token": token, "CashboxUniqueNumber": shop.webkassa_cashbox_number},
    )
    if data.get("Data"):
        return data["Data"]
    errors = data.get("Errors") or []
    codes = [int(err.get("Code")) for err in errors if isinstance(err, dict) and str(err.get("Code", "")).isdigit()]
    if AUTH_RETRY_CODES.intersection(codes):
        token = await get_token(shop, force=True)
        data = await _post(
            shop,
            "/api/ZReport",
            {"Token": token, "CashboxUniqueNumber": shop.webkassa_cashbox_number},
        )
        if data.get("Data"):
            return data["Data"]
    raise WebkassaError(_format_errors(data), codes=codes)


async def _load_sale(session: AsyncSession, sale_id: int) -> Sale | None:
    result = await session.execute(
        select(Sale).options(selectinload(Sale.items)).where(Sale.id == sale_id)
    )
    return result.scalar_one_or_none()


async def fiscalize_sale(sale_id: int, *, refund: bool = False) -> None:
    async with SessionLocal() as session:
        sale = await _load_sale(session, sale_id)
        if sale is None:
            return
        shop = await session.get(Shop, sale.shop_id)
        if shop is None or not shop_ready(shop):
            sale.fiscal_status = FiscalStatus.skipped
            await session.commit()
            return
        if not refund and sale.fiscal_status == FiscalStatus.sent:
            return
        sale.fiscal_attempts = (sale.fiscal_attempts or 0) + 1
        product_ids = [item.product_id for item in sale.items]
        products: dict[int, Product] = {}
        if product_ids:
            rows = await session.execute(select(Product).where(Product.id.in_(product_ids)))
            products = {p.id: p for p in rows.scalars().all()}
        try:
            token = await get_token(shop)
            payload = build_check_payload(
                shop=shop,
                sale=sale,
                items=list(sale.items),
                products=products,
                token=token,
                operation_type=(
                    settings.webkassa_operation_refund if refund else settings.webkassa_operation_sale
                ),
            )
            ticket = await send_check(shop, payload)
            sale.fiscal_status = FiscalStatus.sent
            sale.fiscal_receipt_number = str(
                ticket.get("CheckNumber") or ticket.get("TicketId") or ticket.get("CheckOrderNumber") or ""
            ) or None
            sale.fiscal_receipt_url = ticket.get("TicketUrl") or ticket.get("TicketPrintUrl")
            sale.fiscal_error = None
        except Exception as exc:
            sale.fiscal_status = FiscalStatus.failed
            sale.fiscal_error = str(exc)[:1000]
            log.warning("webkassa fiscalize failed sale=%s: %s", sale_id, exc)
        await session.commit()


async def retry_failed_sales() -> None:
    async with SessionLocal() as session:
        rows = (
            await session.execute(
                select(Sale.id)
                .where(
                    Sale.fiscal_status.in_([FiscalStatus.pending, FiscalStatus.failed]),
                    Sale.fiscal_attempts < settings.webkassa_max_attempts,
                    Sale.is_refunded.is_(False),
                )
                .order_by(Sale.created_at)
                .limit(20)
            )
        ).all()
        ids = [row[0] for row in rows]
    for sale_id in ids:
        try:
            await fiscalize_sale(sale_id)
        except Exception as exc:
            log.warning("webkassa retry failed sale=%s: %s", sale_id, exc)


async def fiscal_retry_loop() -> None:
    await asyncio.sleep(15)
    while True:
        try:
            await retry_failed_sales()
        except Exception as exc:
            log.warning("webkassa retry loop: %s", exc)
        await asyncio.sleep(settings.webkassa_retry_seconds)


async def send_z_report(session: AsyncSession, shift: Shift) -> None:
    shop = await session.get(Shop, shift.shop_id)
    if shop is None or not shop_ready(shop):
        return
    data = await close_shift_report(shop)
    shift.z_report_number = str(data.get("ReportNumber") or data.get("ShiftNumber") or data.get("Number") or "") or None
    shift.z_report_sent_at = datetime.now(timezone.utc)
