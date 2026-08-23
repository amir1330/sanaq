from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import StockItem, StockMovement, StockMovementType, User


def to_base(purchase_qty: Decimal, purchase_to_base: Decimal) -> Decimal:
    if purchase_to_base <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "purchase_to_base must be positive")
    return (purchase_qty * purchase_to_base).quantize(Decimal("0.001"))


def to_purchase(base_qty: Decimal, purchase_to_base: Decimal) -> Decimal:
    factor = purchase_to_base if purchase_to_base > 0 else Decimal("1")
    return (base_qty / factor).quantize(Decimal("0.001"))


def moving_average_cost(
    old_qty: Decimal,
    old_cost: Decimal,
    add_qty: Decimal,
    price_total: Decimal | None,
) -> Decimal:
    new_qty = old_qty + add_qty
    if price_total is None or new_qty <= 0:
        return old_cost
    return ((old_qty * old_cost) + price_total) / new_qty


async def apply_stock_movement(
    session: AsyncSession,
    *,
    shop_id: int,
    item: StockItem,
    movement_type: StockMovementType,
    quantity: Decimal,
    price_total: Decimal | None,
    user: User,
    comment: str | None,
) -> StockMovement:
    if item.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stock item not found")

    quantity_purchase: Decimal | None = None
    quantity_base: Decimal

    if movement_type == StockMovementType.income:
        if quantity <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Income quantity must be positive")
        quantity_purchase = quantity
        quantity_base = to_base(quantity, item.purchase_to_base)
        old_qty = item.quantity
        item.cost_per_base_unit = moving_average_cost(
            old_qty, item.cost_per_base_unit, quantity_base, price_total
        )
        item.quantity = old_qty + quantity_base
    elif movement_type == StockMovementType.writeoff:
        if quantity <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Write-off quantity must be positive")
        quantity_base = quantity
        item.quantity = item.quantity - quantity_base
    elif movement_type == StockMovementType.correction:
        quantity_base = quantity
        item.quantity = item.quantity + quantity_base
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown movement type")

    movement = StockMovement(
        shop_id=shop_id,
        stock_item_id=item.id,
        type=movement_type,
        quantity_purchase=quantity_purchase,
        quantity_base=quantity_base,
        price_total=price_total,
        comment=comment,
        created_by=user.id,
    )
    session.add(movement)
    await session.flush()
    return movement


def product_cost(ingredients: list, qty: int = 1) -> Decimal:
    total = Decimal("0")
    for ing in ingredients:
        total += (ing.quantity * ing.stock_item.cost_per_base_unit) * qty
    return total.quantize(Decimal("0.01"))
