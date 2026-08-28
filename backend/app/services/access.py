from fastapi import HTTPException, status

from app.core.api_errors import api_error
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import OwnerShop, Shop, User, UserRole


async def owned_shop_ids(session: AsyncSession, user: User) -> list[int]:
    if user.role == UserRole.super_admin:
        rows = await session.execute(select(Shop.id))
        return list(rows.scalars().all())
    if user.role == UserRole.owner:
        rows = await session.execute(
            select(OwnerShop.shop_id).where(OwnerShop.owner_id == user.id)
        )
        ids = list(rows.scalars().all())
        if user.shop_id and user.shop_id not in ids:
            ids.append(user.shop_id)
        return ids
    return [user.shop_id] if user.shop_id else []


async def assert_shop_access(
    session: AsyncSession, user: User, shop_id: int, *, write: bool = False
) -> Shop:
    shop = await session.get(Shop, shop_id)
    if shop is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "shop_not_found")
    if user.role == UserRole.super_admin:
        return shop
    allowed = await owned_shop_ids(session, user)
    if shop_id not in allowed:
        raise api_error(status.HTTP_403_FORBIDDEN, "shop_forbidden")
    if write and not shop.is_active and user.role != UserRole.super_admin:
        raise api_error(status.HTTP_403_FORBIDDEN, "shop_disabled")
    return shop


async def shop_crew(session: AsyncSession, shop_id: int) -> list[User]:
    owner_ids = select(OwnerShop.owner_id).where(OwnerShop.shop_id == shop_id)
    result = await session.execute(
        select(User)
        .where(
            User.is_active.is_(True),
            or_(
                User.id.in_(owner_ids),
                (User.shop_id == shop_id) & (User.role.in_([UserRole.barista, UserRole.owner])),
            ),
        )
        .order_by(User.full_name)
    )
    seen: dict[int, User] = {}
    for user in result.scalars().all():
        seen[user.id] = user
    return list(seen.values())


def can_receive_stock(user: User) -> bool:
    return user.role in (UserRole.super_admin, UserRole.owner) or bool(user.can_receive_stock)


def can_apply_discount(user: User) -> bool:
    return user.role in (UserRole.super_admin, UserRole.owner) or bool(user.can_apply_discount)


def require_roles(*roles: UserRole):
    async def checker(user: User) -> User:
        if user.role not in roles:
            raise api_error(status.HTTP_403_FORBIDDEN, "insufficient_role")
        return user

    return checker
