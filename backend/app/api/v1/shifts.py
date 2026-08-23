from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, roles
from app.database import get_session
from app.models import Sale, Shift, ShiftCashMovement, ShiftStatus, User, UserRole
from app.schemas.shift import (
    CashMovementCreate,
    CashMovementOut,
    ShiftCloseRequest,
    ShiftOpenRequest,
    ShiftOut,
)
from app.services.access import assert_shop_access, shop_crew
from app.services.sales import get_open_shift, seller_totals, shift_totals

router = APIRouter(tags=["shifts"])
pos_roles = roles(UserRole.super_admin, UserRole.owner, UserRole.barista)
manage = roles(UserRole.super_admin, UserRole.owner)


def _shift_out(shift: Shift, sales: list[Sale], movements: list[ShiftCashMovement]) -> ShiftOut:
    totals = shift_totals(shift, sales, movements)
    return ShiftOut(
        id=shift.id,
        shop_id=shift.shop_id,
        barista_id=shift.barista_id,
        barista_name=shift.barista.full_name if shift.barista else None,
        status=shift.status,
        opening_cash=shift.opening_cash,
        closing_cash=shift.closing_cash,
        opened_at=shift.opened_at,
        closed_at=shift.closed_at,
        sellers=seller_totals(sales),
        **totals,
    )


async def _load_shift(session: AsyncSession, shift_id: int) -> Shift:
    result = await session.execute(
        select(Shift)
        .options(
            selectinload(Shift.barista),
            selectinload(Shift.sales).selectinload(Sale.barista),
            selectinload(Shift.cash_movements),
        )
        .where(Shift.id == shift_id)
    )
    shift = result.scalar_one_or_none()
    if shift is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shift not found")
    return shift


@router.get("/shops/{shop_id}/shifts", response_model=list[ShiftOut])
async def list_shifts(
    shop_id: int,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
    limit: int = Query(50, le=200),
):
    await assert_shop_access(session, user, shop_id)
    result = await session.execute(
        select(Shift)
        .options(
            selectinload(Shift.barista),
            selectinload(Shift.sales).selectinload(Sale.barista),
            selectinload(Shift.cash_movements),
        )
        .where(Shift.shop_id == shop_id)
        .order_by(Shift.opened_at.desc())
        .limit(limit)
    )
    shifts = result.scalars().unique().all()
    return [_shift_out(s, s.sales, s.cash_movements) for s in shifts]


@router.get("/shifts/current", response_model=ShiftOut | None)
async def current_shift(
    shop_id: int,
    user: User = Depends(pos_roles),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    open_shift = await get_open_shift(session, shop_id)
    if open_shift is None:
        return None
    shift = await _load_shift(session, open_shift.id)
    return _shift_out(shift, shift.sales, shift.cash_movements)


@router.post("/shifts/open", response_model=ShiftOut, status_code=201)
async def open_shift(
    body: ShiftOpenRequest,
    user: User = Depends(pos_roles),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, body.shop_id, write=True)
    existing = await get_open_shift(session, body.shop_id)
    if existing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A shift is already open")
    opener_id = user.id
    if body.barista_id and body.barista_id != user.id:
        crew = {member.id for member in await shop_crew(session, body.shop_id)}
        if body.barista_id not in crew:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Этого человека нет на точке")
        opener_id = body.barista_id
    shift = Shift(
        shop_id=body.shop_id,
        barista_id=opener_id,
        opening_cash=body.opening_cash,
        status=ShiftStatus.open,
    )
    session.add(shift)
    await session.commit()
    shift = await _load_shift(session, shift.id)
    return _shift_out(shift, shift.sales, shift.cash_movements)


@router.get("/shifts/{shift_id}", response_model=ShiftOut)
async def get_shift(
    shift_id: int,
    user: User = Depends(pos_roles),
    session: AsyncSession = Depends(get_session),
):
    shift = await _load_shift(session, shift_id)
    await assert_shop_access(session, user, shift.shop_id)
    return _shift_out(shift, shift.sales, shift.cash_movements)


@router.post("/shifts/{shift_id}/close", response_model=ShiftOut)
async def close_shift(
    shift_id: int,
    body: ShiftCloseRequest,
    user: User = Depends(pos_roles),
    session: AsyncSession = Depends(get_session),
):
    shift = await _load_shift(session, shift_id)
    await assert_shop_access(session, user, shift.shop_id, write=True)
    if shift.status != ShiftStatus.open:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Shift already closed")
    shift.status = ShiftStatus.closed
    shift.closing_cash = body.closing_cash
    shift.closed_at = datetime.now(timezone.utc)
    await session.commit()
    shift = await _load_shift(session, shift_id)
    return _shift_out(shift, shift.sales, shift.cash_movements)


@router.post("/shifts/{shift_id}/cash-movements", response_model=CashMovementOut, status_code=201)
async def add_cash_movement(
    shift_id: int,
    body: CashMovementCreate,
    user: User = Depends(pos_roles),
    session: AsyncSession = Depends(get_session),
):
    shift = await session.get(Shift, shift_id)
    if shift is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shift not found")
    await assert_shop_access(session, user, shift.shop_id, write=True)
    if shift.status != ShiftStatus.open:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Shift is closed")
    movement = ShiftCashMovement(
        shift_id=shift.id,
        type=body.type,
        amount=body.amount,
        comment=body.comment,
    )
    session.add(movement)
    await session.commit()
    await session.refresh(movement)
    return movement
