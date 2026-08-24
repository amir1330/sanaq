from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Product,
    ProductIngredient,
    StockItem,
    StockLog,
    StockLogAction,
    StockMovement,
    StockMovementType,
    User,
)
from app.services.uploads import delete_upload

_UPDATE_LABELS = {
    "name": "название",
    "purchase_unit": "закупка",
    "purchase_to_base": "сколько в базовой",
    "min_quantity": "минимум",
    "cost_per_base_unit": "себестоимость",
}


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
    revision_id: int | None = None,
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

    movement = record_stock_movement(
        session,
        shop_id=shop_id,
        item=item,
        movement_type=movement_type,
        quantity_base=quantity_base,
        quantity_purchase=quantity_purchase,
        price_total=price_total,
        user=user,
        comment=comment,
        revision_id=revision_id,
    )
    await session.flush()
    return movement


def record_stock_movement(
    session: AsyncSession,
    *,
    shop_id: int,
    item: StockItem,
    movement_type: StockMovementType,
    quantity_base: Decimal,
    user: User,
    quantity_purchase: Decimal | None = None,
    price_total: Decimal | None = None,
    comment: str | None = None,
    revision_id: int | None = None,
) -> StockMovement:
    movement = StockMovement(
        shop_id=shop_id,
        stock_item_id=item.id,
        stock_item_name=item.name,
        base_unit=item.base_unit,
        purchase_unit=item.purchase_unit,
        type=movement_type,
        quantity_purchase=quantity_purchase,
        quantity_base=quantity_base,
        price_total=price_total,
        comment=comment,
        revision_id=revision_id,
        created_by=user.id,
    )
    session.add(movement)
    return movement


def write_stock_log(
    session: AsyncSession,
    *,
    item: StockItem,
    action: StockLogAction,
    user: User,
    detail: str | None = None,
) -> None:
    session.add(
        StockLog(
            shop_id=item.shop_id,
            stock_item_id=item.id,
            stock_item_name=item.name,
            action=action,
            detail=detail,
            created_by=user.id,
        )
    )


def item_create_detail(item: StockItem) -> str:
    return f"{item.base_unit}, 1 {item.purchase_unit} = {item.purchase_to_base} {item.base_unit}"


def item_update_detail(item: StockItem, changes: dict) -> str | None:
    bits: list[str] = []
    for key, value in changes.items():
        if getattr(item, key) == value:
            continue
        bits.append(f"{_UPDATE_LABELS.get(key, key)} → {value}")
    return ", ".join(bits) or None


async def remove_stock_item(session: AsyncSession, item: StockItem, user: User) -> None:
    used = (
        await session.execute(
            select(Product.name)
            .join(ProductIngredient, ProductIngredient.product_id == Product.id)
            .where(ProductIngredient.stock_item_id == item.id)
            .order_by(Product.name)
        )
    ).scalars().all()
    if used:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Сначала уберите из состава: {', '.join(used)}",
        )
    write_stock_log(session, item=item, action=StockLogAction.deleted, user=user)
    await delete_upload(session, item.image)
    await session.delete(item)


async def list_stock_journal(
    session: AsyncSession,
    *,
    shop_id: int,
    item_id: int | None,
    hide_cost: bool,
    limit: int = 200,
) -> list[dict]:
    move_q = (
        select(StockMovement, User.full_name)
        .outerjoin(User, User.id == StockMovement.created_by)
        .where(StockMovement.shop_id == shop_id)
    )
    log_q = (
        select(StockLog, User.full_name)
        .outerjoin(User, User.id == StockLog.created_by)
        .where(StockLog.shop_id == shop_id)
    )
    if item_id is not None:
        move_q = move_q.where(StockMovement.stock_item_id == item_id)
        log_q = log_q.where(StockLog.stock_item_id == item_id)
    move_q = move_q.order_by(StockMovement.created_at.desc()).limit(limit)
    log_q = log_q.order_by(StockLog.created_at.desc()).limit(limit)

    moves = (await session.execute(move_q)).all()
    logs = (await session.execute(log_q)).all()
    rows: list[dict] = []
    for movement, actor in moves:
        rows.append(
            {
                "id": f"m-{movement.id}",
                "kind": movement.type.value,
                "stock_item_id": movement.stock_item_id,
                "item_name": movement.stock_item_name or "—",
                "base_unit": movement.base_unit,
                "purchase_unit": movement.purchase_unit,
                "quantity_base": movement.quantity_base,
                "quantity_purchase": movement.quantity_purchase,
                "price_total": None if hide_cost else movement.price_total,
                "actor_name": actor,
                "comment": movement.comment,
                "created_at": movement.created_at,
            }
        )
    for log, actor in logs:
        rows.append(
            {
                "id": f"l-{log.id}",
                "kind": log.action.value,
                "stock_item_id": log.stock_item_id,
                "item_name": log.stock_item_name,
                "base_unit": None,
                "purchase_unit": None,
                "quantity_base": None,
                "quantity_purchase": None,
                "price_total": None,
                "actor_name": actor,
                "comment": log.detail,
                "created_at": log.created_at,
            }
        )
    rows.sort(key=lambda r: r["created_at"], reverse=True)
    return rows[:limit]


def product_cost(ingredients: list, qty: int = 1) -> Decimal:
    total = Decimal("0")
    for ing in ingredients:
        total += (ing.quantity * ing.stock_item.cost_per_base_unit) * qty
    return total.quantize(Decimal("0.01"))
