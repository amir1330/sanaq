from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    StockItem,
    StockMovementType,
    StockRevision,
    StockRevisionLine,
    StockRevisionStatus,
    User,
)
from app.services.stock import apply_stock_movement


def line_difference(counted: Decimal | None, expected: Decimal) -> Decimal | None:
    if counted is None:
        return None
    return (counted - expected).quantize(Decimal("0.001"))


def line_value(difference: Decimal | None, cost: Decimal) -> Decimal | None:
    if difference is None:
        return None
    return (difference * cost).quantize(Decimal("0.01"))


async def load_revision(session: AsyncSession, shop_id: int, revision_id: int) -> StockRevision:
    revision = (
        await session.execute(
            select(StockRevision)
            .options(selectinload(StockRevision.lines))
            .where(StockRevision.id == revision_id, StockRevision.shop_id == shop_id)
        )
    ).scalar_one_or_none()
    if revision is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ревизия не найдена")
    return revision


async def list_revisions(session: AsyncSession, shop_id: int) -> list[StockRevision]:
    result = await session.execute(
        select(StockRevision)
        .options(selectinload(StockRevision.lines))
        .where(StockRevision.shop_id == shop_id)
        .order_by(StockRevision.created_at.desc())
        .limit(50)
    )
    return list(result.scalars().unique().all())


async def _shop_items(session: AsyncSession, shop_id: int) -> dict[int, StockItem]:
    rows = (
        await session.execute(select(StockItem).where(StockItem.shop_id == shop_id).order_by(StockItem.name))
    ).scalars().all()
    return {item.id: item for item in rows}


async def _append_missing_items(session: AsyncSession, revision: StockRevision) -> None:
    if revision.status != StockRevisionStatus.draft:
        return
    items = await _shop_items(session, revision.shop_id)
    existing = {line.stock_item_id for line in revision.lines if line.stock_item_id}
    for item in items.values():
        if item.id in existing:
            continue
        revision.lines.append(
            StockRevisionLine(
                stock_item_id=item.id,
                stock_item_name=item.name,
                base_unit=item.base_unit,
                expected_quantity=item.quantity,
                cost_per_base_unit=item.cost_per_base_unit,
            )
        )
    await session.flush()


async def sync_live_expected(session: AsyncSession, revision: StockRevision) -> None:
    """Expected = live remainder, so sales during the count don't fake a shortage."""
    if revision.status != StockRevisionStatus.draft:
        return
    await _append_missing_items(session, revision)
    items = await _shop_items(session, revision.shop_id)
    for line in revision.lines:
        item = items.get(line.stock_item_id) if line.stock_item_id else None
        if item is None:
            continue
        line.expected_quantity = item.quantity
        line.cost_per_base_unit = item.cost_per_base_unit
    await session.flush()


async def create_revision(
    session: AsyncSession,
    *,
    shop_id: int,
    user: User,
    comment: str | None,
) -> StockRevision:
    open_id = (
        await session.execute(
            select(StockRevision.id).where(
                StockRevision.shop_id == shop_id,
                StockRevision.status == StockRevisionStatus.draft,
            )
        )
    ).scalar_one_or_none()
    if open_id is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Уже есть открытая ревизия")

    items = (
        await session.execute(
            select(StockItem).where(StockItem.shop_id == shop_id).order_by(StockItem.name)
        )
    ).scalars().all()
    if not items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Сначала добавьте сырьё")

    revision = StockRevision(
        shop_id=shop_id,
        status=StockRevisionStatus.draft,
        comment=comment,
        created_by=user.id,
        lines=[
            StockRevisionLine(
                stock_item_id=item.id,
                stock_item_name=item.name,
                base_unit=item.base_unit,
                expected_quantity=item.quantity,
                cost_per_base_unit=item.cost_per_base_unit,
            )
            for item in items
        ],
    )
    session.add(revision)
    await session.flush()
    return await load_revision(session, shop_id, revision.id)


async def save_revision(
    session: AsyncSession,
    revision: StockRevision,
    *,
    comment: str | None,
    lines: list[dict] | None,
) -> StockRevision:
    if revision.status != StockRevisionStatus.draft:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ревизия уже закрыта")
    await sync_live_expected(session, revision)
    if comment is not None:
        revision.comment = comment.strip() or None
    if lines:
        by_item = {line.stock_item_id: line for line in revision.lines if line.stock_item_id}
        for row in lines:
            line = by_item.get(row["stock_item_id"])
            if line is None:
                continue
            counted = row.get("counted_quantity")
            if counted is not None and counted < 0:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Факт не может быть меньше нуля")
            line.counted_quantity = counted
            if "comment" in row:
                line.comment = (row.get("comment") or "").strip() or None
    await session.flush()
    return revision


async def post_revision(session: AsyncSession, revision: StockRevision, user: User) -> StockRevision:
    if revision.status != StockRevisionStatus.draft:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ревизия уже закрыта")
    await sync_live_expected(session, revision)

    counted_lines = [line for line in revision.lines if line.counted_quantity is not None]
    if not counted_lines:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нет ни одной посчитанной позиции")

    for line in counted_lines:
        line.difference_quantity = line_difference(line.counted_quantity, line.expected_quantity)
        if line.stock_item_id is None:
            continue
        item = await session.get(StockItem, line.stock_item_id)
        if item is None or item.shop_id != revision.shop_id:
            continue
        delta = line.difference_quantity or Decimal("0")
        if delta == 0:
            continue
        await apply_stock_movement(
            session,
            shop_id=revision.shop_id,
            item=item,
            movement_type=StockMovementType.correction,
            quantity=delta,
            price_total=None,
            user=user,
            comment=f"Ревизия №{revision.id}",
            revision_id=revision.id,
        )

    revision.status = StockRevisionStatus.posted
    revision.posted_by = user.id
    revision.posted_at = datetime.now(timezone.utc)
    await session.flush()
    return revision


async def cancel_revision(session: AsyncSession, revision: StockRevision, user: User) -> StockRevision:
    if revision.status != StockRevisionStatus.draft:
        raise HTTPException(status.HTTP_409_CONFLICT, "Отменить можно только черновик")
    revision.status = StockRevisionStatus.cancelled
    revision.posted_by = user.id
    revision.cancelled_at = datetime.now(timezone.utc)
    await session.flush()
    return revision


def revision_summary(revision: StockRevision, *, hide_cost: bool) -> dict:
    counted = 0
    shortage = 0
    surplus = 0
    total_value = Decimal("0")
    for line in revision.lines:
        diff = line.difference_quantity
        if line.counted_quantity is not None and diff is None:
            diff = line_difference(line.counted_quantity, line.expected_quantity)
        if line.counted_quantity is None:
            continue
        counted += 1
        if diff is not None and diff < 0:
            shortage += 1
        elif diff is not None and diff > 0:
            surplus += 1
        value = line_value(diff, line.cost_per_base_unit)
        if value is not None:
            total_value += value
    return {
        "line_count": len(revision.lines),
        "counted_count": counted,
        "shortage_count": shortage,
        "surplus_count": surplus,
        "difference_value": Decimal("0") if hide_cost else total_value,
    }
