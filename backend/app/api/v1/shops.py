from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, roles
from app.config import settings
from app.database import get_session
from app.models import Shop, User, UserRole
from app.schemas.common import ShopOut, ShopSettingsUpdate
from app.services.access import assert_shop_access, owned_shop_ids
from app.services.uploads import guess_logo_ext, shop_logo_dir

router = APIRouter(tags=["shops"])
manage = roles(UserRole.super_admin, UserRole.owner)
MAX_LOGO_BYTES = 2 * 1024 * 1024


@router.get("/shops", response_model=list[ShopOut])
async def my_shops(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    ids = await owned_shop_ids(session, user)
    if not ids:
        return []
    result = await session.execute(select(Shop).where(Shop.id.in_(ids)).order_by(Shop.name))
    return result.scalars().all()


@router.get("/shops/{shop_id}", response_model=ShopOut)
async def get_shop(
    shop_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await assert_shop_access(session, user, shop_id)


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
    return shop


@router.post("/shops/{shop_id}/logo", response_model=ShopOut)
async def upload_logo(
    shop_id: int,
    file: UploadFile = File(...),
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    shop = await assert_shop_access(session, user, shop_id, write=True)
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    ext = guess_logo_ext(file.filename, content_type)
    if ext is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Нужен файл PNG, JPG, WEBP или SVG",
        )
    data = await file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Пустой файл")
    if len(data) > MAX_LOGO_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Логотип больше 2 МБ")

    folder = shop_logo_dir(shop_id)
    for old in folder.glob("logo-*"):
        old.unlink(missing_ok=True)
    name = f"logo-{uuid4().hex[:10]}{ext}"
    (folder / name).write_bytes(data)
    shop.logo_url = f"/uploads/shops/{shop_id}/{name}"
    await session.commit()
    await session.refresh(shop)
    return shop


@router.delete("/shops/{shop_id}/logo", response_model=ShopOut)
async def delete_logo(
    shop_id: int,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    shop = await assert_shop_access(session, user, shop_id, write=True)
    if shop.logo_url:
        path = Path(settings.upload_dir) / shop.logo_url.removeprefix("/uploads/")
        path.unlink(missing_ok=True)
    shop.logo_url = None
    await session.commit()
    await session.refresh(shop)
    return shop
