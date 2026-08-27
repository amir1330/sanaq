from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    CashMovementType,
    DiscountType,
    FiscalStatus,
    PaymentType,
    Product,
    ProductVariant,
    Sale,
    SaleItem,
    Shift,
    ShiftCashMovement,
    ShiftStatus,
    Shop,
    StockItem,
    StockMovementType,
    User,
)
from app.schemas.shift import DiscountIn, SaleItemIn, SellerTotal, StockAlert
from app.services.access import can_apply_discount, shop_crew
from app.services.revisions import assert_no_open_revision
from app.services.stock import add_lot, consume_fifo, record_stock_movement


def _discount_amount(base: Decimal, discount: DiscountIn | None) -> Decimal:
    if discount is None:
        return Decimal("0")
    value = Decimal(str(discount.value))
    if value <= 0 or base <= 0:
        return Decimal("0")
    if discount.type == DiscountType.percent:
        pct = min(value, Decimal("100"))
        return (base * pct / Decimal("100")).quantize(Decimal("0.01"))
    return min(value, base).quantize(Decimal("0.01"))


def _has_discount(discount: DiscountIn | None) -> bool:
    return discount is not None and Decimal(str(discount.value)) > 0


async def get_open_shift(
    session: AsyncSession, shop_id: int, cash_register_id: int | None = None
) -> Shift | None:
    query = select(Shift).where(Shift.shop_id == shop_id, Shift.status == ShiftStatus.open)
    if cash_register_id is not None:
        query = query.where(Shift.cash_register_id == cash_register_id)
    result = await session.execute(query.order_by(Shift.id.desc()).limit(1))
    return result.scalar_one_or_none()


async def resolve_cash_register(
    session: AsyncSession, shop_id: int, cash_register_id: int | None
) -> "CashRegister":
    from app.models import CashRegister

    if cash_register_id is not None:
        reg = await session.get(CashRegister, cash_register_id)
        if reg is None or reg.shop_id != shop_id or not reg.is_active:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Касса не найдена")
        return reg
    result = await session.execute(
        select(CashRegister)
        .where(CashRegister.shop_id == shop_id, CashRegister.is_active.is_(True))
        .order_by(CashRegister.sort_order, CashRegister.id)
        .limit(1)
    )
    reg = result.scalar_one_or_none()
    if reg is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "У точки нет кассы — добавь в настройках")
    return reg


async def ensure_default_cash_register(session: AsyncSession, shop_id: int) -> "CashRegister":
    from app.models import CashRegister

    existing = (
        await session.execute(
            select(CashRegister)
            .where(CashRegister.shop_id == shop_id)
            .order_by(CashRegister.sort_order, CashRegister.id)
            .limit(1)
        )
    ).scalar_one_or_none()
    if existing:
        return existing
    reg = CashRegister(shop_id=shop_id, name="Касса 1", sort_order=0, is_active=True)
    session.add(reg)
    await session.flush()
    return reg


async def resolve_seller(session: AsyncSession, shop_id: int, user: User, barista_id: int | None) -> User:
    seller_id = barista_id or user.id
    if seller_id == user.id:
        return user
    crew = {member.id: member for member in await shop_crew(session, shop_id)}
    seller = crew.get(seller_id)
    if seller is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Этого человека нет в смене точки")
    return seller


async def create_sale(
    session: AsyncSession,
    *,
    shop_id: int,
    user: User,
    items: list[SaleItemIn],
    payment_type: PaymentType,
    barista_id: int | None = None,
    cash_register_id: int | None = None,
    discount: DiscountIn | None = None,
) -> tuple[Sale, list[StockAlert]]:
    register = await resolve_cash_register(session, shop_id, cash_register_id)
    shift = await get_open_shift(session, shop_id, register.id)
    if shift is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Смена на этой кассе не открыта")
    await assert_no_open_revision(session, shop_id)
    seller = await resolve_seller(session, shop_id, user, barista_id)

    wants_discount = _has_discount(discount) or any(_has_discount(line.discount) for line in items)
    if wants_discount and not can_apply_discount(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Нет права применять скидки")

    qty_by_product: dict[int, int] = defaultdict(int)
    for line in items:
        qty_by_product[line.product_id] += line.quantity

    result = await session.execute(
        select(Product)
        .options(
            selectinload(Product.ingredients),
            selectinload(Product.variants).selectinload(ProductVariant.ingredients),
        )
        .where(Product.id.in_(qty_by_product.keys()), Product.shop_id == shop_id)
    )
    products = {p.id: p for p in result.scalars().unique().all()}
    if len(products) != len(qty_by_product):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown product in cart")

    for product in products.values():
        if not product.is_active:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"Product '{product.name}' is not on the menu"
            )

    # Resolve variant per cart line
    resolved: list[tuple[SaleItemIn, Product, ProductVariant | None]] = []
    for line in items:
        product = products[line.product_id]
        active_variants = [v for v in product.variants if v.is_active]
        variant: ProductVariant | None = None
        if active_variants:
            if line.variant_id is None:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Выбери размер для «{product.name}»",
                )
            variant = next((v for v in active_variants if v.id == line.variant_id), None)
            if variant is None:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Вариант не найден для «{product.name}»",
                )
        elif line.variant_id is not None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"У «{product.name}» нет вариантов",
            )
        resolved.append((line, product, variant))

    stock_need: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    for line, product, variant in resolved:
        bom = variant.ingredients if variant is not None else product.ingredients
        for ing in bom:
            stock_need[ing.stock_item_id] += ing.quantity * line.quantity

    locked: dict[int, StockItem] = {}
    if stock_need:
        locked_rows = await session.execute(
            select(StockItem)
            .where(StockItem.id.in_(stock_need.keys()), StockItem.shop_id == shop_id)
            .with_for_update()
        )
        locked = {row.id: row for row in locked_rows.scalars().all()}

    # COGS per (product_id, variant_id) key
    cost_by_key: dict[tuple[int, int | None], Decimal] = {}
    for line, product, variant in resolved:
        key = (product.id, variant.id if variant else None)
        if key in cost_by_key:
            continue
        bom = variant.ingredients if variant is not None else product.ingredients
        qty = sum(
            l.quantity
            for l, p, v in resolved
            if p.id == product.id and (v.id if v else None) == (variant.id if variant else None)
        )
        line_cogs = Decimal("0")
        for ing in bom:
            item = locked.get(ing.stock_item_id)
            if item is None:
                continue
            need = ing.quantity * qty
            line_cogs += await consume_fifo(session, item, need)
        cost_by_key[key] = (line_cogs / qty).quantize(Decimal("0.01")) if qty else Decimal("0")

    subtotal = Decimal("0")
    items_discount_total = Decimal("0")
    sale_items: list[SaleItem] = []
    for line, product, variant in resolved:
        unit_price = variant.sale_price if variant is not None else product.sale_price
        gross = (unit_price * line.quantity).quantize(Decimal("0.01"))
        item_disc = _discount_amount(gross, line.discount)
        line_total = (gross - item_disc).quantize(Decimal("0.01"))
        subtotal += gross
        items_discount_total += item_disc
        key = (product.id, variant.id if variant else None)
        sale_items.append(
            SaleItem(
                product_id=line.product_id,
                variant_id=variant.id if variant else None,
                variant_name_snapshot=variant.name if variant else None,
                quantity=line.quantity,
                price_snapshot=unit_price,
                cost_price_snapshot=cost_by_key[key],
                discount_type=line.discount.type if _has_discount(line.discount) else None,
                discount_value=line.discount.value if _has_discount(line.discount) else None,
                discount_amount=item_disc,
                line_total=line_total,
            )
        )

    after_items = (subtotal - items_discount_total).quantize(Decimal("0.01"))
    receipt_disc = _discount_amount(after_items, discount)
    total = (after_items - receipt_disc).quantize(Decimal("0.01"))
    total_discount = (items_discount_total + receipt_disc).quantize(Decimal("0.01"))

    shop = await session.get(Shop, shop_id)
    fiscal = (
        FiscalStatus.pending
        if shop
        and shop.webkassa_enabled
        and shop.webkassa_login
        and shop.webkassa_password_encrypted
        and shop.webkassa_cashbox_number
        else FiscalStatus.skipped
    )
    sale = Sale(
        shop_id=shop_id,
        shift_id=shift.id,
        barista_id=seller.id,
        payment_type=payment_type,
        subtotal_amount=subtotal,
        discount_type=discount.type if _has_discount(discount) else None,
        discount_value=discount.value if _has_discount(discount) else None,
        discount_amount=total_discount,
        total_amount=total,
        created_at=datetime.now(timezone.utc),
        fiscal_status=fiscal,
    )
    session.add(sale)
    await session.flush()
    if sale.id is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to create sale")

    for line in sale_items:
        line.sale_id = sale.id
        session.add(line)

    alerts: list[StockAlert] = []
    for stock_id, need in stock_need.items():
        item = locked.get(stock_id)
        if item is None:
            continue
        record_stock_movement(
            session,
            shop_id=shop_id,
            item=item,
            movement_type=StockMovementType.sale,
            quantity_base=need,
            user=seller,
            comment=f"чек #{sale.id}",
        )
        if item.quantity <= item.min_quantity:
            alerts.append(
                StockAlert(
                    stock_item_id=item.id,
                    name=item.name,
                    quantity=item.quantity,
                    min_quantity=item.min_quantity,
                )
            )

    await session.flush()
    return sale, alerts


async def refund_sale(
    session: AsyncSession,
    sale: Sale,
    shop_id: int,
    user: User,
    *,
    restore_stock: bool = False,
) -> Sale:
    if sale.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sale not found")
    if sale.is_refunded:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sale already refunded")
    await assert_no_open_revision(session, shop_id)

    await session.refresh(sale, attribute_names=["items"])
    restore: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    if restore_stock:
        product_ids = [i.product_id for i in sale.items]
        variant_ids = [i.variant_id for i in sale.items if i.variant_id]
        result = await session.execute(
            select(Product)
            .options(
                selectinload(Product.ingredients),
                selectinload(Product.variants).selectinload(ProductVariant.ingredients),
            )
            .where(Product.id.in_(product_ids))
        )
        products = {p.id: p for p in result.scalars().unique().all()}
        variants: dict[int, ProductVariant] = {}
        for p in products.values():
            for v in p.variants:
                variants[v.id] = v
        for line in sale.items:
            product = products.get(line.product_id)
            if not product:
                continue
            if line.variant_id and line.variant_id in variants:
                bom = variants[line.variant_id].ingredients
            else:
                bom = product.ingredients
            for ing in bom:
                restore[ing.stock_item_id] += ing.quantity * line.quantity

    if restore:
        locked_rows = await session.execute(
            select(StockItem)
            .where(StockItem.id.in_(restore.keys()), StockItem.shop_id == shop_id)
            .with_for_update()
        )
        locked = {row.id: row for row in locked_rows.scalars().all()}
        for stock_id, qty in restore.items():
            item = locked.get(stock_id)
            if item:
                await add_lot(session, item, qty, item.cost_per_base_unit)
                record_stock_movement(
                    session,
                    shop_id=shop_id,
                    item=item,
                    movement_type=StockMovementType.refund,
                    quantity_base=qty,
                    user=user,
                    comment=f"возврат чека #{sale.id}",
                )

    sale.is_refunded = True
    await session.flush()
    return sale


def shift_totals(
    shift: Shift,
    sales: list[Sale],
    movements: list[ShiftCashMovement],
) -> dict:
    cash = Decimal("0")
    card = Decimal("0")
    count = 0
    for sale in sales:
        if sale.is_refunded:
            continue
        count += 1
        if sale.payment_type == PaymentType.cash:
            cash += sale.total_amount
        else:
            card += sale.total_amount

    deposits = sum(
        (m.amount for m in movements if m.type == CashMovementType.deposit), Decimal("0")
    )
    withdrawals = sum(
        (m.amount for m in movements if m.type == CashMovementType.withdrawal), Decimal("0")
    )
    expected = shift.opening_cash + cash + deposits - withdrawals
    diff = None
    if shift.closing_cash is not None:
        diff = (shift.closing_cash - expected).quantize(Decimal("0.01"))

    return {
        "cash_revenue": cash,
        "card_revenue": card,
        "sales_count": count,
        "deposits": deposits,
        "withdrawals": withdrawals,
        "expected_cash": expected,
        "cash_difference": diff,
    }


def seller_totals(sales: list[Sale]) -> list[SellerTotal]:
    buckets: dict[int, dict] = {}
    for sale in sales:
        if sale.is_refunded:
            continue
        row = buckets.setdefault(
            sale.barista_id,
            {
                "barista_id": sale.barista_id,
                "barista_name": getattr(getattr(sale, "barista", None), "full_name", None) or "Кассир",
                "cash": Decimal("0"),
                "card": Decimal("0"),
                "count": 0,
            },
        )
        row["count"] += 1
        if sale.payment_type == PaymentType.cash:
            row["cash"] += sale.total_amount
        else:
            row["card"] += sale.total_amount
    return [
        SellerTotal(
            barista_id=row["barista_id"],
            barista_name=row["barista_name"],
            cash_revenue=row["cash"],
            card_revenue=row["card"],
            revenue=row["cash"] + row["card"],
            sales_count=row["count"],
        )
        for row in sorted(buckets.values(), key=lambda r: r["cash"] + r["card"], reverse=True)
    ]
