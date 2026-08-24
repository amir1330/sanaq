from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import roles
from app.core.security import hash_secret
from app.database import get_session
from app.models import User, UserRole
from app.schemas.staff import CrewMember, StaffCreate, StaffOut, StaffUpdate
from app.services.access import assert_shop_access, shop_crew

router = APIRouter(tags=["staff"])
manage = roles(UserRole.super_admin, UserRole.owner)
pos_roles = roles(UserRole.super_admin, UserRole.owner, UserRole.barista)


def _staff_out(user: User) -> StaffOut:
    return StaffOut(
        id=user.id,
        shop_id=user.shop_id,
        role=user.role,
        full_name=user.full_name,
        phone=user.phone,
        email=user.email,
        is_active=user.is_active,
        created_at=user.created_at,
        owned_shop_ids=[],
        can_receive_stock=bool(user.can_receive_stock),
        has_pin=bool(user.pin_code),
    )


@router.get("/shops/{shop_id}/crew", response_model=list[CrewMember])
async def list_crew(
    shop_id: int,
    user: User = Depends(pos_roles),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    return [
        CrewMember(
            id=u.id,
            full_name=u.full_name,
            role=u.role.value,
            can_receive_stock=u.role != UserRole.barista or bool(u.can_receive_stock),
        )
        for u in await shop_crew(session, shop_id)
    ]


@router.get("/shops/{shop_id}/staff", response_model=list[StaffOut])
async def list_staff(
    shop_id: int,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    result = await session.execute(
        select(User)
        .where(User.shop_id == shop_id, User.role == UserRole.barista)
        .order_by(User.full_name)
    )
    return [_staff_out(u) for u in result.scalars().all()]


@router.post("/shops/{shop_id}/staff", response_model=StaffOut, status_code=201)
async def create_staff(
    shop_id: int,
    body: StaffCreate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    barista = User(
        shop_id=shop_id,
        role=UserRole.barista,
        full_name=body.full_name.strip(),
        phone=body.phone or None,
        email=str(body.email).strip().lower(),
        password_hash=hash_secret(body.password),
        can_receive_stock=body.can_receive_stock,
    )
    session.add(barista)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Такая почта или телефон уже заняты")
    await session.refresh(barista)
    return _staff_out(barista)


@router.patch("/shops/{shop_id}/staff/{staff_id}", response_model=StaffOut)
async def update_staff(
    shop_id: int,
    staff_id: int,
    body: StaffUpdate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    barista = await session.get(User, staff_id)
    if barista is None or barista.shop_id != shop_id or barista.role != UserRole.barista:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Barista not found")
    data = body.model_dump(exclude_unset=True)
    if data.get("password"):
        barista.password_hash = hash_secret(data.pop("password"))
    if "phone" in data:
        data["phone"] = data["phone"] or None
    if "email" in data and data["email"] is not None:
        data["email"] = str(data["email"]).strip().lower()
    if "full_name" in data and isinstance(data["full_name"], str):
        data["full_name"] = data["full_name"].strip()
    for key, value in data.items():
        setattr(barista, key, value)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Такая почта или телефон уже заняты")
    await session.refresh(barista)
    return _staff_out(barista)
