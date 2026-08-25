from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import roles
from app.database import get_session
from app.models import CashRegister, User, UserRole
from app.schemas.cash_register import CashRegisterCreate, CashRegisterOut, CashRegisterUpdate
from app.services.access import assert_shop_access
from app.services.sales import get_open_shift

router = APIRouter(tags=["cash-registers"])
pos_roles = roles(UserRole.super_admin, UserRole.owner, UserRole.barista)
manage = roles(UserRole.super_admin, UserRole.owner)


async def _register_out(session: AsyncSession, reg: CashRegister) -> CashRegisterOut:
    open_shift = await get_open_shift(session, reg.shop_id, reg.id)
    return CashRegisterOut(
        id=reg.id,
        shop_id=reg.shop_id,
        name=reg.name,
        sort_order=reg.sort_order,
        is_active=reg.is_active,
        has_open_shift=open_shift is not None,
    )


@router.get("/shops/{shop_id}/cash-registers", response_model=list[CashRegisterOut])
async def list_cash_registers(
    shop_id: int,
    user: User = Depends(pos_roles),
    session: AsyncSession = Depends(get_session),
    include_inactive: bool = False,
):
    await assert_shop_access(session, user, shop_id)
    query = select(CashRegister).where(CashRegister.shop_id == shop_id)
    if not include_inactive:
        query = query.where(CashRegister.is_active.is_(True))
    result = await session.execute(query.order_by(CashRegister.sort_order, CashRegister.id))
    regs = result.scalars().all()
    return [await _register_out(session, r) for r in regs]


@router.post("/shops/{shop_id}/cash-registers", response_model=CashRegisterOut, status_code=201)
async def create_cash_register(
    shop_id: int,
    body: CashRegisterCreate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    name = body.name.strip()
    existing = (
        await session.execute(
            select(CashRegister).where(CashRegister.shop_id == shop_id, CashRegister.name == name)
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Касса с таким названием уже есть")
    max_order = (
        await session.execute(
            select(CashRegister.sort_order)
            .where(CashRegister.shop_id == shop_id)
            .order_by(CashRegister.sort_order.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    reg = CashRegister(
        shop_id=shop_id,
        name=name,
        sort_order=(max_order or 0) + 1,
        is_active=True,
    )
    session.add(reg)
    await session.commit()
    await session.refresh(reg)
    return await _register_out(session, reg)


@router.patch("/shops/{shop_id}/cash-registers/{register_id}", response_model=CashRegisterOut)
async def update_cash_register(
    shop_id: int,
    register_id: int,
    body: CashRegisterUpdate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    reg = await session.get(CashRegister, register_id)
    if reg is None or reg.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Касса не найдена")
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        clash = (
            await session.execute(
                select(CashRegister).where(
                    CashRegister.shop_id == shop_id,
                    CashRegister.name == name,
                    CashRegister.id != register_id,
                )
            )
        ).scalar_one_or_none()
        if clash:
            raise HTTPException(status.HTTP_409_CONFLICT, "Касса с таким названием уже есть")
        reg.name = name
    if "is_active" in data and data["is_active"] is not None:
        if data["is_active"] is False:
            open_shift = await get_open_shift(session, shop_id, reg.id)
            if open_shift:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Нельзя выключить кассу с открытой сменой — сначала закрой смену",
                )
            active_count = (
                await session.execute(
                    select(CashRegister.id).where(
                        CashRegister.shop_id == shop_id,
                        CashRegister.is_active.is_(True),
                        CashRegister.id != register_id,
                    )
                )
            ).scalars().all()
            if not active_count:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Нужна хотя бы одна активная касса",
                )
        reg.is_active = data["is_active"]
    if "sort_order" in data and data["sort_order"] is not None:
        reg.sort_order = data["sort_order"]
    await session.commit()
    await session.refresh(reg)
    return await _register_out(session, reg)
