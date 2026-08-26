from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, roles
from app.database import get_session
from app.models import (
    CashMovementType,
    FiscalStatus,
    Sale,
    Shift,
    ShiftCashMovement,
    ShiftStatus,
    Shop,
    User,
    UserRole,
)
from app.schemas.shift import (
    CashMovementCreate,
    CashMovementOut,
    ShiftCloseRequest,
    ShiftOpenRequest,
    ShiftOut,
    ShiftSaleOut,
)
from app.services.access import assert_shop_access, shop_crew
from app.services.revisions import open_revision_id
from app.services.sales import get_open_shift, resolve_cash_register, seller_totals, shift_totals
from app.services.webkassa import send_z_report, shop_ready

router = APIRouter(tags=["shifts"])
pos_roles = roles(UserRole.super_admin, UserRole.owner, UserRole.barista)
manage = roles(UserRole.super_admin, UserRole.owner)


def _shift_out(
    shift: Shift,
    sales: list[Sale],
    movements: list[ShiftCashMovement],
    *,
    stock_revision_id: int | None = None,
) -> ShiftOut:
    totals = shift_totals(shift, sales, movements)
    pending = sum(
        1
        for s in sales
        if not s.is_refunded and s.fiscal_status in (FiscalStatus.pending, FiscalStatus.failed)
    )
    return ShiftOut(
        id=shift.id,
        shop_id=shift.shop_id,
        cash_register_id=shift.cash_register_id,
        cash_register_name=shift.cash_register.name if shift.cash_register else None,
        barista_id=shift.barista_id,
        barista_name=shift.barista.full_name if shift.barista else None,
        status=shift.status,
        opening_cash=shift.opening_cash,
        closing_cash=shift.closing_cash,
        opened_at=shift.opened_at,
        closed_at=shift.closed_at,
        sellers=seller_totals(sales),
        fiscal_pending_count=pending,
        stock_revision_id=stock_revision_id,
        z_report_number=shift.z_report_number,
        z_report_sent_at=shift.z_report_sent_at,
        sales=[
            ShiftSaleOut(
                id=sale.id,
                total_amount=sale.total_amount,
                payment_type=sale.payment_type,
                is_refunded=sale.is_refunded,
                created_at=sale.created_at,
                barista_name=sale.barista.full_name if sale.barista else None,
                discount_amount=getattr(sale, "discount_amount", None) or 0,
            )
            for sale in sorted(sales, key=lambda row: row.created_at, reverse=True)[:40]
        ],
        **totals,
    )


async def _load_shift(session: AsyncSession, shift_id: int) -> Shift:
    result = await session.execute(
        select(Shift)
        .options(
            selectinload(Shift.barista),
            selectinload(Shift.cash_register),
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
    cash_register_id: int | None = None,
):
    await assert_shop_access(session, user, shop_id)
    query = (
        select(Shift)
        .options(
            selectinload(Shift.barista),
            selectinload(Shift.cash_register),
            selectinload(Shift.sales).selectinload(Sale.barista),
            selectinload(Shift.cash_movements),
        )
        .where(Shift.shop_id == shop_id)
    )
    if cash_register_id is not None:
        query = query.where(Shift.cash_register_id == cash_register_id)
    result = await session.execute(query.order_by(Shift.opened_at.desc()).limit(limit))
    shifts = result.scalars().unique().all()
    return [_shift_out(s, s.sales, s.cash_movements) for s in shifts]


@router.get("/shifts/current", response_model=ShiftOut | None)
async def current_shift(
    shop_id: int,
    cash_register_id: int | None = None,
    user: User = Depends(pos_roles),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    register = await resolve_cash_register(session, shop_id, cash_register_id)
    open_shift = await get_open_shift(session, shop_id, register.id)
    if open_shift is None:
        return None
    shift = await _load_shift(session, open_shift.id)
    revision_id = await open_revision_id(session, shop_id)
    return _shift_out(shift, shift.sales, shift.cash_movements, stock_revision_id=revision_id)


@router.post("/shifts/open", response_model=ShiftOut, status_code=201)
async def open_shift(
    body: ShiftOpenRequest,
    user: User = Depends(pos_roles),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, body.shop_id, write=True)
    register = await resolve_cash_register(session, body.shop_id, body.cash_register_id)
    existing = await get_open_shift(session, body.shop_id, register.id)
    if existing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "На этой кассе смена уже открыта")
    opener_id = user.id
    if body.barista_id and body.barista_id != user.id:
        crew = {member.id for member in await shop_crew(session, body.shop_id)}
        if body.barista_id not in crew:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Этого человека нет на точке")
        opener_id = body.barista_id
    shift = Shift(
        shop_id=body.shop_id,
        cash_register_id=register.id,
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
    shop = await session.get(Shop, shift.shop_id)
    pending = [
        s
        for s in shift.sales
        if not s.is_refunded and s.fiscal_status in (FiscalStatus.pending, FiscalStatus.failed)
    ]
    if shop and shop_ready(shop) and pending and not body.force:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Нельзя закрыть смену: {len(pending)} чеков не ушли в Webkassa. "
            "Подожди повтор или закрой принудительно.",
        )
    if shop and shop_ready(shop):
        try:
            await send_z_report(session, shift)
        except Exception as exc:
            if not body.force:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    f"Z-отчёт не ушёл в ОФД: {exc}. Смену можно закрыть принудительно.",
                ) from exc
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
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Смена уже закрыта — изъятие и внесение только пока открыта")
    if body.type == CashMovementType.withdrawal:
        shift = await _load_shift(session, shift_id)
        totals = shift_totals(shift, shift.sales, shift.cash_movements)
        expected = Decimal(str(totals["expected_cash"]))
        if body.amount > expected:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"В ящике сейчас {expected} ₸ — нельзя изъять больше",
            )
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
