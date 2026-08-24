from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import roles
from app.core.security import hash_secret, verify_secret
from app.database import get_session
from app.models import Expense, OwnerShop, Sale, SaleItem, Shop, User, UserRole
from app.schemas.admin import (
    AdminShopStats,
    AdminStatsOut,
    AdminUserCreate,
    AdminUserOut,
    ShopCreate,
    ShopUpdate,
)
from app.schemas.common import ShopOut, UserOut

router = APIRouter(prefix="/admin", tags=["admin"])
admin_only = roles(UserRole.super_admin)


async def _assert_pin_free(
    session: AsyncSession, shop_id: int, pin_code: str, exclude_id: int | None = None
) -> None:
    query = select(User).where(
        User.shop_id == shop_id,
        User.role == UserRole.barista,
        User.pin_code.is_not(None),
    )
    if exclude_id is not None:
        query = query.where(User.id != exclude_id)
    result = await session.execute(query)
    for other in result.scalars().all():
        if other.pin_code and verify_secret(pin_code, other.pin_code):
            raise HTTPException(status.HTTP_409_CONFLICT, "Этот PIN уже занят")


def _admin_user_out(user: User, shop_name: str | None = None) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        shop_id=user.shop_id,
        shop_name=shop_name,
        role=user.role.value,
        full_name=user.full_name,
        phone=user.phone,
        email=user.email,
        is_active=user.is_active,
        created_at=user.created_at,
        can_receive_stock=bool(user.can_receive_stock),
        has_pin=bool(user.pin_code),
    )


@router.get("/shops", response_model=list[ShopOut])
async def list_shops(
    _: User = Depends(admin_only),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Shop).order_by(Shop.id))
    return result.scalars().all()


@router.post("/shops", response_model=ShopOut, status_code=201)
async def create_shop(
    body: ShopCreate,
    _: User = Depends(admin_only),
    session: AsyncSession = Depends(get_session),
):
    if body.owner and body.existing_owner_email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Укажи нового владельца или почту существующего, не обоих")
    data = body.model_dump(exclude={"owner", "existing_owner_email"})
    shop = Shop(**data)
    session.add(shop)
    await session.flush()
    if body.existing_owner_email:
        owner = (
            await session.execute(
                select(User).where(
                    User.email == str(body.existing_owner_email),
                    User.role == UserRole.owner,
                )
            )
        ).scalar_one_or_none()
        if owner is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Владелец с такой почтой не найден")
        session.add(OwnerShop(owner_id=owner.id, shop_id=shop.id))
    elif body.owner:
        owner = User(
            shop_id=shop.id,
            role=UserRole.owner,
            full_name=body.owner.full_name,
            email=body.owner.email,
            phone=body.owner.phone,
            password_hash=hash_secret(body.owner.password),
        )
        session.add(owner)
        await session.flush()
        session.add(OwnerShop(owner_id=owner.id, shop_id=shop.id))
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Такая почта или телефон уже есть") from exc
    await session.refresh(shop)
    return shop


@router.patch("/shops/{shop_id}", response_model=ShopOut)
async def update_shop(
    shop_id: int,
    body: ShopUpdate,
    _: User = Depends(admin_only),
    session: AsyncSession = Depends(get_session),
):
    shop = await session.get(Shop, shop_id)
    if shop is None:
        from fastapi import HTTPException, status

        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shop not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(shop, key, value)
    await session.commit()
    await session.refresh(shop)
    return shop


@router.post("/shops/{shop_id}/owners", response_model=UserOut, status_code=201)
async def create_owner(
    shop_id: int,
    body: OwnerCreate,
    _: User = Depends(admin_only),
    session: AsyncSession = Depends(get_session),
):
    from fastapi import HTTPException, status

    shop = await session.get(Shop, shop_id)
    if shop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shop not found")

    owner = User(
        shop_id=shop_id,
        role=UserRole.owner,
        full_name=body.full_name,
        email=body.email,
        phone=body.phone,
        password_hash=hash_secret(body.password),
    )
    session.add(owner)
    await session.flush()
    session.add(OwnerShop(owner_id=owner.id, shop_id=shop_id))
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Такая почта или телефон уже есть") from exc
    await session.refresh(owner)
    return UserOut(
        id=owner.id,
        shop_id=owner.shop_id,
        role=owner.role,
        full_name=owner.full_name,
        phone=owner.phone,
        email=owner.email,
        is_active=owner.is_active,
        created_at=owner.created_at,
        owned_shop_ids=[shop_id],
    )


@router.get("/users", response_model=list[AdminUserOut])
async def list_users(
    _: User = Depends(admin_only),
    session: AsyncSession = Depends(get_session),
):
    rows = (
        await session.execute(
            select(User, Shop.name)
            .outerjoin(Shop, Shop.id == User.shop_id)
            .where(User.role != UserRole.super_admin)
            .order_by(User.created_at.desc())
        )
    ).all()
    return [_admin_user_out(user, shop_name) for user, shop_name in rows]


@router.post("/users", response_model=AdminUserOut, status_code=201)
async def create_user(
    body: AdminUserCreate,
    _: User = Depends(admin_only),
    session: AsyncSession = Depends(get_session),
):
    shop = await session.get(Shop, body.shop_id)
    if shop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Точка не найдена")

    full_name = body.full_name.strip()
    email = str(body.email).strip().lower() if body.email else None
    phone = body.phone.strip() if body.phone else None

    if body.role == "owner":
        if not email:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Владельцу нужна почта")
        if not body.password or len(body.password) < 6:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Пароль от 6 символов")
        user = User(
            shop_id=shop.id,
            role=UserRole.owner,
            full_name=full_name,
            email=email,
            phone=phone,
            password_hash=hash_secret(body.password),
        )
        session.add(user)
        await session.flush()
        session.add(OwnerShop(owner_id=user.id, shop_id=shop.id))
    else:
        if not email:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Кассиру нужна почта")
        if not body.password or len(body.password) < 6:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Пароль от 6 символов")
        user = User(
            shop_id=shop.id,
            role=UserRole.barista,
            full_name=full_name,
            email=email,
            phone=phone,
            password_hash=hash_secret(body.password),
            can_receive_stock=body.can_receive_stock,
        )
        session.add(user)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Такая почта или телефон уже есть") from exc
    await session.refresh(user)
    return _admin_user_out(user, shop.name)


@router.get("/stats", response_model=AdminStatsOut)
async def admin_stats(
    _: User = Depends(admin_only),
    session: AsyncSession = Depends(get_session),
):
    shops = (await session.execute(select(Shop))).scalars().all()
    users_count = (await session.execute(select(func.count(User.id)))).scalar_one()
    since = datetime.now(timezone.utc) - timedelta(days=30)

    shop_stats: list[AdminShopStats] = []
    for shop in shops:
        rev = (
            await session.execute(
                select(func.coalesce(func.sum(Sale.total_amount), 0)).where(
                    Sale.shop_id == shop.id,
                    Sale.is_refunded.is_(False),
                    Sale.created_at >= since,
                )
            )
        ).scalar_one()
        cnt = (
            await session.execute(
                select(func.count(Sale.id)).where(
                    Sale.shop_id == shop.id,
                    Sale.is_refunded.is_(False),
                    Sale.created_at >= since,
                )
            )
        ).scalar_one()
        cost = (
            await session.execute(
                select(func.coalesce(func.sum(SaleItem.cost_price_snapshot * SaleItem.quantity), 0))
                .select_from(SaleItem)
                .join(Sale, Sale.id == SaleItem.sale_id)
                .where(
                    Sale.shop_id == shop.id,
                    Sale.is_refunded.is_(False),
                    Sale.created_at >= since,
                )
            )
        ).scalar_one()
        expenses = (
            await session.execute(
                select(func.coalesce(func.sum(Expense.amount), 0)).where(
                    Expense.shop_id == shop.id, Expense.created_at >= since
                )
            )
        ).scalar_one()
        shop_stats.append(
            AdminShopStats(
                shop_id=shop.id,
                shop_name=shop.name,
                is_active=shop.is_active,
                revenue=float(rev or 0),
                sales_count=int(cnt or 0),
                profit=float(Decimal(str(rev or 0)) - Decimal(str(cost or 0)) - Decimal(str(expenses or 0))),
            )
        )

    return AdminStatsOut(
        shops_count=len(shops),
        active_shops=sum(1 for s in shops if s.is_active),
        users_count=int(users_count or 0),
        shops=shop_stats,
    )
