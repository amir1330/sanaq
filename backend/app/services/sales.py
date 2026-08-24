from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    CashMovementType,
    FiscalStatus,
    PaymentType,
    Product,
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
from app.schemas.shift import SaleItemIn, SellerTotal, StockAlert
from app.services.access import shop_crew
from app.services.stock import add_lot, consume_fifo, record_stock_movement


async def get_open_shift(session: AsyncSession, shop_id: int) -> Shift | None:
    result = await session.execute(
        select(Shift).where(Shift.shop_id == shop_id, Shift.status == ShiftStatus.open)
    )
    return result.scalar_one_or_none()


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
) -> tuple[Sale, list[StockAlert]]:
    shift = await get_open_shift(session, shop_id)
    if shift is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No open shift")
    seller = await resolve_seller(session, shop_id, user, barista_id)

    qty_by_product: dict[int, int] = defaultdict(int)
    for line in items:
        qty_by_product[line.product_id] += line.quantity

    result = await session.execute(
        select(Product)
        .options(selectinload(Product.ingredients))
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

    stock_need: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    for product_id, qty in qty_by_product.items():
        for ing in products[product_id].ingredients:
            stock_need[ing.stock_item_id] += ing.quantity * qty

    locked: dict[int, StockItem] = {}
    if stock_need:
        locked_rows = await session.execute(
            select(StockItem)
            .where(StockItem.id.in_(stock_need.keys()), StockItem.shop_id == shop_id)
            .with_for_update()
        )
        locked = {row.id: row for row in locked_rows.scalars().all()}

    cost_by_product: dict[int, Decimal] = {}
    for product_id, qty in qty_by_product.items():
        line_cogs = Decimal("0")
        for ing in products[product_id].ingredients:
            item = locked.get(ing.stock_item_id)
            if item is None:
                continue
            need = ing.quantity * qty
            line_cogs += await consume_fifo(session, item, need)
        cost_by_product[product_id] = (line_cogs / qty).quantize(Decimal("0.01")) if qty else Decimal("0")

    total = Decimal("0")
    sale_items: list[SaleItem] = []
    for product_id, qty in qty_by_product.items():
        product = products[product_id]
        line_total = (product.sale_price * qty).quantize(Decimal("0.01"))
        total += line_total
        sale_items.append(
            SaleItem(
                product_id=product_id,
                quantity=qty,
                price_snapshot=product.sale_price,
                cost_price_snapshot=cost_by_product[product_id],
            )
        )

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

    await session.refresh(sale, attribute_names=["items"])
    restore: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    if restore_stock:
        product_ids = [i.product_id for i in sale.items]
        result = await session.execute(
            select(Product)
            .options(selectinload(Product.ingredients))
            .where(Product.id.in_(product_ids))
        )
        products = {p.id: p for p in result.scalars().unique().all()}
        for line in sale.items:
            product = products.get(line.product_id)
            if not product:
                continue
            for ing in product.ingredients:
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
