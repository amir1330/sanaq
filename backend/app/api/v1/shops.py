from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, roles
from app.database import get_session
from app.models import Shop, User, UserRole
from app.schemas.common import (
    BranchCreate,
    ShopOut,
    ShopSettingsUpdate,
    WebkassaSettingsUpdate,
    WebkassaTestOut,
)
from app.services.access import assert_shop_access, owned_shop_ids
from app.services.branches import create_branch
from app.services.crypto import encrypt_secret
from app.services.shops import to_shop_out
from app.services.uploads import delete_upload, replace_upload
from app.services.webkassa import authorize

router = APIRouter(tags=["shops"])
manage = roles(UserRole.super_admin, UserRole.owner)


@router.get("/shops", response_model=list[ShopOut])
async def my_shops(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    ids = await owned_shop_ids(session, user)
    if not ids:
        return []
    result = await session.execute(select(Shop).where(Shop.id.in_(ids)).order_by(Shop.name))
    return [to_shop_out(s) for s in result.scalars().all()]


@router.post("/shops", response_model=ShopOut, status_code=201)
async def add_branch(
    body: BranchCreate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    source_id = body.copy_from_shop_id
    if source_id is not None:
        await assert_shop_access(session, user, source_id, write=True)
    elif user.role != UserRole.super_admin:
        ids = await owned_shop_ids(session, user)
        if not ids:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Нет своей точки")
    timezone = body.timezone
    if not timezone:
        if source_id:
            source = await session.get(Shop, source_id)
            timezone = source.timezone if source else "Asia/Almaty"
        else:
            timezone = "Asia/Almaty"
    shop = await create_branch(
        session,
        user=user,
        name=body.name,
        address=body.address,
        timezone=timezone,
        copy_from_shop_id=source_id,
        copy_catalog=body.copy_catalog,
    )
    await session.commit()
    await session.refresh(shop)
    return to_shop_out(shop)


@router.get("/shops/{shop_id}", response_model=ShopOut)
async def get_shop(
    shop_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    shop = await assert_shop_access(session, user, shop_id)
    return to_shop_out(shop)


@router.patch("/shops/{shop_id}", response_model=ShopOut)
async def update_shop_settings(
    shop_id: int,
    body: ShopSettingsUpdate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    shop = await assert_shop_access(session, user, shop_id, write=True)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(shop, key, value)
    await session.commit()
    await session.refresh(shop)
    return to_shop_out(shop)


@router.post("/shops/{shop_id}/logo", response_model=ShopOut)
async def upload_logo(
    shop_id: int,
    file: UploadFile = File(...),
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    shop = await assert_shop_access(session, user, shop_id, write=True)
    shop.logo = await replace_upload(
        session,
        file,
        shop_id=shop_id,
        kind="logo",
        prefix="logo",
        uploader_id=user.id,
        previous=shop.logo,
        allow_svg=True,
    )
    await session.commit()
    await session.refresh(shop)
    return to_shop_out(shop)


@router.delete("/shops/{shop_id}/logo", response_model=ShopOut)
async def delete_logo(
    shop_id: int,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    shop = await assert_shop_access(session, user, shop_id, write=True)
    await delete_upload(session, shop.logo)
    shop.logo = None
    await session.commit()
    await session.refresh(shop)
    return to_shop_out(shop)


@router.patch("/shops/{shop_id}/webkassa", response_model=ShopOut)
async def update_webkassa(
    shop_id: int,
    body: WebkassaSettingsUpdate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    shop = await assert_shop_access(session, user, shop_id, write=True)
    if body.login is not None:
        shop.webkassa_login = body.login.strip() or None
    if body.cashbox_number is not None:
        shop.webkassa_cashbox_number = body.cashbox_number.strip() or None
    if body.password:
        shop.webkassa_password_encrypted = encrypt_secret(body.password)
    if body.api_key:
        shop.webkassa_api_key_encrypted = encrypt_secret(body.api_key)
    if body.enabled is not None:
        shop.webkassa_enabled = body.enabled
        if body.enabled and not (
            shop.webkassa_login and shop.webkassa_password_encrypted and shop.webkassa_cashbox_number
        ):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Сначала сохрани логин, пароль и номер кассы")
    await session.commit()
    await session.refresh(shop)
    return to_shop_out(shop)


@router.post("/shops/{shop_id}/webkassa/test", response_model=WebkassaTestOut)
async def test_webkassa(
    shop_id: int,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    shop = await assert_shop_access(session, user, shop_id)
    if not (shop.webkassa_login and shop.webkassa_password_encrypted and shop.webkassa_cashbox_number):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Не хватает логина, пароля или номера кассы")
    try:
        await authorize(shop)
    except Exception as exc:
        return WebkassaTestOut(ok=False, message=str(exc))
    return WebkassaTestOut(ok=True, message="Касса ответила, токен получен")
