from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Product,
    ProductIngredient,
    Shop,
    StockItem,
    StockLog,
    StockLogAction,
    StockLot,
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


def pair_quantity(
    from_unit: str,
    to_unit: str,
    quantity_from: Decimal,
    quantity_to: Decimal | None,
) -> Decimal:
    if quantity_from <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Количество должно быть больше нуля")
    if quantity_to is not None:
        if quantity_to <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Сколько получается — больше нуля")
        return quantity_to.quantize(Decimal("0.001"))
    if from_unit != to_unit:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Единицы разные ({from_unit} и {to_unit}) — укажи сколько получается",
        )
    return quantity_from.quantize(Decimal("0.001"))


def to_purchase(base_qty: Decimal, purchase_to_base: Decimal) -> Decimal:
    factor = purchase_to_base if purchase_to_base > 0 else Decimal("1")
    return (base_qty / factor).quantize(Decimal("0.001"))


def fifo_consume(
    lots: list[StockLot],
    qty: Decimal,
    fallback_cost: Decimal,
) -> Decimal:
    """Take from oldest lots first. Mutates quantity_remaining. Returns COGS in ₸."""
    need = qty
    cogs = Decimal("0")
    for lot in lots:
        if need <= 0:
            break
        if lot.quantity_remaining <= 0:
            continue
        take = min(lot.quantity_remaining, need)
        cogs += take * lot.cost_per_base_unit
        lot.quantity_remaining = (lot.quantity_remaining - take).quantize(Decimal("0.001"))
        need -= take
    if need > 0:
        cogs += need * fallback_cost
    return cogs.quantize(Decimal("0.01"))


def fifo_unit_cost(lots: list[StockLot], fallback: Decimal) -> Decimal:
    live = [lot for lot in lots if lot.quantity_remaining > 0]
    total = sum((lot.quantity_remaining for lot in live), Decimal("0"))
    if total <= 0:
        return fallback
    blended = sum((lot.quantity_remaining * lot.cost_per_base_unit for lot in live), Decimal("0")) / total
    return blended.quantize(Decimal("0.0001"))


async def _open_lots(session: AsyncSession, item: StockItem) -> list[StockLot]:
    result = await session.execute(
        select(StockLot)
        .where(StockLot.stock_item_id == item.id)
        .order_by(StockLot.received_at, StockLot.id)
        .with_for_update()
    )
    lots = list(result.scalars().all())
    covered = sum((lot.quantity_remaining for lot in lots), Decimal("0"))
    gap = item.quantity - covered
    if gap > 0:
        lot = StockLot(
            shop_id=item.shop_id,
            stock_item_id=item.id,
            quantity_remaining=gap,
            cost_per_base_unit=item.cost_per_base_unit,
            received_at=datetime.now(timezone.utc),
        )
        session.add(lot)
        await session.flush()
        lots.append(lot)
    return lots


async def add_lot(
    session: AsyncSession,
    item: StockItem,
    qty_base: Decimal,
    cost_per_base: Decimal,
    movement_id: int | None = None,
) -> None:
    if qty_base <= 0:
        return
    session.add(
        StockLot(
            shop_id=item.shop_id,
            stock_item_id=item.id,
            quantity_remaining=qty_base,
            cost_per_base_unit=cost_per_base,
            received_at=datetime.now(timezone.utc),
            source_movement_id=movement_id,
        )
    )
    item.quantity = (item.quantity + qty_base).quantize(Decimal("0.001"))
    await session.flush()
    lots = await _open_lots(session, item)
    item.cost_per_base_unit = fifo_unit_cost(lots, cost_per_base)


async def consume_fifo(session: AsyncSession, item: StockItem, qty_base: Decimal) -> Decimal:
    lots = await _open_lots(session, item)
    cogs = fifo_consume(lots, qty_base, item.cost_per_base_unit)
    item.quantity = (item.quantity - qty_base).quantize(Decimal("0.001"))
    item.cost_per_base_unit = fifo_unit_cost(lots, item.cost_per_base_unit)
    return cogs


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
        unit_cost = (
            (price_total / quantity_base).quantize(Decimal("0.0001"))
            if price_total is not None and quantity_base > 0
            else item.cost_per_base_unit
        )
        await add_lot(session, item, quantity_base, unit_cost)
    elif movement_type == StockMovementType.writeoff:
        if quantity <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Write-off quantity must be positive")
        quantity_base = quantity
        await consume_fifo(session, item, quantity_base)
    elif movement_type == StockMovementType.correction:
        quantity_base = quantity
        if quantity_base > 0:
            await add_lot(session, item, quantity_base, item.cost_per_base_unit)
        elif quantity_base < 0:
            await consume_fifo(session, item, abs(quantity_base))
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


async def regrade_stock(
    session: AsyncSession,
    *,
    shop_id: int,
    from_item: StockItem,
    to_item: StockItem,
    quantity_from: Decimal,
    quantity_to: Decimal | None,
    user: User,
    comment: str | None,
) -> tuple[StockMovement, StockMovement]:
    if from_item.shop_id != shop_id or to_item.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Позиция не найдена")
    if from_item.id == to_item.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Пересорт — в другую позицию")
    qty_from = quantity_from.quantize(Decimal("0.001"))
    qty_to = pair_quantity(from_item.base_unit, to_item.base_unit, qty_from, quantity_to)
    cogs = await consume_fifo(session, from_item, qty_from)
    unit = (cogs / qty_to).quantize(Decimal("0.0001")) if qty_to else from_item.cost_per_base_unit
    note = comment.strip() if comment else None
    out_comment = f"пересорт → {to_item.name}" + (f" · {note}" if note else "")
    in_comment = f"пересорт ← {from_item.name}" + (f" · {note}" if note else "")
    outgoing = record_stock_movement(
        session,
        shop_id=shop_id,
        item=from_item,
        movement_type=StockMovementType.regrade_out,
        quantity_base=qty_from,
        price_total=cogs,
        user=user,
        comment=out_comment,
    )
    await session.flush()
    await add_lot(session, to_item, qty_to, unit, movement_id=outgoing.id)
    incoming = record_stock_movement(
        session,
        shop_id=shop_id,
        item=to_item,
        movement_type=StockMovementType.regrade_in,
        quantity_base=qty_to,
        price_total=cogs,
        user=user,
        comment=in_comment,
    )
    await session.flush()
    return outgoing, incoming


async def transfer_stock(
    session: AsyncSession,
    *,
    from_shop: Shop,
    to_shop: Shop,
    from_item: StockItem,
    to_item: StockItem,
    quantity: Decimal,
    quantity_to: Decimal | None,
    user: User,
    comment: str | None,
) -> tuple[StockMovement, StockMovement]:
    if from_shop.id == to_shop.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Перемещение — на другую точку. На этой — пересорт.")
    if from_item.shop_id != from_shop.id or to_item.shop_id != to_shop.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Позиция не найдена")
    qty_from = quantity.quantize(Decimal("0.001"))
    qty_to = pair_quantity(from_item.base_unit, to_item.base_unit, qty_from, quantity_to)
    cogs = await consume_fifo(session, from_item, qty_from)
    unit = (cogs / qty_to).quantize(Decimal("0.0001")) if qty_to else from_item.cost_per_base_unit
    note = comment.strip() if comment else None
    out_comment = f"в {to_shop.name} · {to_item.name}" + (f" · {note}" if note else "")
    in_comment = f"из {from_shop.name} · {from_item.name}" + (f" · {note}" if note else "")
    outgoing = record_stock_movement(
        session,
        shop_id=from_shop.id,
        item=from_item,
        movement_type=StockMovementType.transfer_out,
        quantity_base=qty_from,
        price_total=cogs,
        user=user,
        comment=out_comment,
    )
    await session.flush()
    await add_lot(session, to_item, qty_to, unit, movement_id=outgoing.id)
    incoming = record_stock_movement(
        session,
        shop_id=to_shop.id,
        item=to_item,
        movement_type=StockMovementType.transfer_in,
        quantity_base=qty_to,
        price_total=cogs,
        user=user,
        comment=in_comment,
    )
    await session.flush()
    return outgoing, incoming


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
