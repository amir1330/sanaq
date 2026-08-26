from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.database import get_session
from app.models import User, UserRole
from app.services.access import assert_shop_access, owned_shop_ids

bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    session: AsyncSession = Depends(get_session),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_token(creds.credentials, "access")
        user_id = int(payload["sub"])
    except (InvalidTokenError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User inactive")
    return user


def roles(*allowed: UserRole):
    async def _inner(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role")
        return user

    return _inner


async def user_out_payload(session: AsyncSession, user: User) -> dict:
    shop_ids = await owned_shop_ids(session, user)
    return {
        "id": user.id,
        "shop_id": user.shop_id,
        "role": user.role,
        "full_name": user.full_name,
        "phone": user.phone,
        "email": user.email,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "owned_shop_ids": shop_ids,
        "can_receive_stock": user.role != UserRole.barista or bool(user.can_receive_stock),
        "can_apply_discount": user.role != UserRole.barista or bool(user.can_apply_discount),
    }


async def shop_for_user(
    shop_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await assert_shop_access(session, user, shop_id)
