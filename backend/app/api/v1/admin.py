from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import roles
from app.core.security import hash_secret
from app.database import get_session
from app.models import Expense, OwnerShop, Sale, SaleItem, Shop, User, UserRole
from app.schemas.admin import AdminShopStats, AdminStatsOut, OwnerCreate, ShopCreate, ShopUpdate
from app.schemas.common import ShopOut, UserOut

router = APIRouter(prefix="/admin", tags=["admin"])
admin_only = roles(UserRole.super_admin)


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
    data = body.model_dump(exclude={"owner"})
    shop = Shop(**data)
    session.add(shop)
    await session.flush()
    if body.owner:
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
