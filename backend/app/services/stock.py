from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import StockItem, StockMovement, StockMovementType, User


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

    if movement_type == StockMovementType.income:
        if quantity <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Income quantity must be positive")
        old_qty = item.quantity
        old_cost = item.cost_per_unit
        new_qty = old_qty + quantity
        if price_total is not None and new_qty > 0:
            item.cost_per_unit = ((old_qty * old_cost) + price_total) / new_qty
        item.quantity = new_qty
    elif movement_type == StockMovementType.writeoff:
        if quantity <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Write-off quantity must be positive")
        item.quantity = item.quantity - quantity
    elif movement_type == StockMovementType.correction:
        item.quantity = item.quantity + quantity
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown movement type")

    movement = StockMovement(
        shop_id=shop_id,
        stock_item_id=item.id,
        type=movement_type,
        quantity=quantity,
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
        total += (ing.quantity * ing.stock_item.cost_per_unit) * qty
    return total.quantize(Decimal("0.01"))
