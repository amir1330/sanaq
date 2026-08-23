from fastapi import APIRouter, Depends, HTTPException, status
from jwt import InvalidTokenError
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, user_out_payload
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_secret,
)
from app.database import get_session
from app.models import User, UserRole
from app.schemas.auth import LoginRequest, PinLoginRequest, RefreshRequest
from app.schemas.common import TokenPair, UserOut
from app.schemas.staff import CrewMember
from app.services.access import assert_shop_access

router = APIRouter(prefix="/auth", tags=["auth"])


async def _tokens(session: AsyncSession, user: User) -> TokenPair:
    payload = await user_out_payload(session, user)
    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=UserOut.model_validate(payload),
    )


@router.post("/login", response_model=TokenPair)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(User).where(or_(User.email == body.login, User.phone == body.login))
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active or not verify_secret(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    return await _tokens(session, user)


@router.post("/login-pin", response_model=TokenPair)
async def login_pin(body: PinLoginRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(User).where(
            User.shop_id == body.shop_id,
            User.role == UserRole.barista,
            User.is_active.is_(True),
            User.pin_code.is_not(None),
        )
    )
    for user in result.scalars().all():
        if user.pin_code and verify_secret(body.pin_code, user.pin_code):
            return await _tokens(session, user)
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid PIN")


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest, session: AsyncSession = Depends(get_session)):
    try:
        payload = decode_token(body.refresh_token, "refresh")
        user_id = int(payload["sub"])
    except (InvalidTokenError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User inactive")
    return await _tokens(session, user)


@router.post("/identify-pin", response_model=CrewMember)
async def identify_pin(
    body: PinLoginRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, body.shop_id)
    result = await session.execute(
        select(User).where(
            User.shop_id == body.shop_id,
            User.is_active.is_(True),
            User.pin_code.is_not(None),
        )
    )
    for candidate in result.scalars().all():
        if candidate.pin_code and verify_secret(body.pin_code, candidate.pin_code):
            return CrewMember(
                id=candidate.id,
                full_name=candidate.full_name,
                role=candidate.role.value,
                can_receive_stock=candidate.role != UserRole.barista or bool(candidate.can_receive_stock),
            )
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный PIN")


@router.get("/me", response_model=UserOut)
async def me(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return UserOut.model_validate(await user_out_payload(session, user))
