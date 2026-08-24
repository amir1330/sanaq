from pathlib import Path
from shutil import copy2
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.upload import Upload

ALLOWED_LOGO = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
}
ALLOWED_PHOTO = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}
ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".webp", ".svg"}
ALLOWED_PHOTO_EXT = {".png", ".jpg", ".jpeg", ".webp"}
MAX_IMAGE_BYTES = 2 * 1024 * 1024

KIND_FOLDER = {
    "logo": None,
    "product": "products",
    "stock": "stock",
}


def guess_logo_ext(filename: str | None, content_type: str) -> str | None:
    if content_type in ALLOWED_LOGO:
        return ALLOWED_LOGO[content_type]
    suffix = Path(filename or "").suffix.lower()
    if suffix in ALLOWED_EXT:
        return ".jpg" if suffix == ".jpeg" else suffix
    return None


def guess_photo_ext(filename: str | None, content_type: str) -> str | None:
    if content_type in ALLOWED_PHOTO:
        return ALLOWED_PHOTO[content_type]
    suffix = Path(filename or "").suffix.lower()
    if suffix in ALLOWED_PHOTO_EXT:
        return ".jpg" if suffix == ".jpeg" else suffix
    return None


def uploads_root() -> Path:
    root = Path(settings.upload_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def shop_kind_dir(shop_id: int, kind: str) -> Path:
    folder = KIND_FOLDER.get(kind)
    path = uploads_root() / "shops" / str(shop_id)
    if folder:
        path = path / folder
    path.mkdir(parents=True, exist_ok=True)
    return path


def disk_path(file_path: str) -> Path:
    rel = file_path.removeprefix("/uploads/")
    return Path(settings.upload_dir) / rel


def unlink_shop_file(url: str | None, shop_id: int) -> None:
    prefix = f"/uploads/shops/{shop_id}/"
    if not url or not url.startswith(prefix) or ".." in url:
        return
    disk_path(url).unlink(missing_ok=True)


async def delete_upload(session: AsyncSession, upload: Upload | None) -> None:
    if upload is None:
        return
    unlink_shop_file(upload.file_path, upload.shop_id)
    await session.delete(upload)


def copy_upload(
    session: AsyncSession,
    source: Upload | None,
    dest_shop_id: int,
    *,
    prefix: str,
    uploader_id: int | None = None,
) -> Upload | None:
    if source is None:
        return None
    src = disk_path(source.file_path)
    if not src.is_file():
        return None
    folder = shop_kind_dir(dest_shop_id, source.kind)
    name = f"{prefix}-{uuid4().hex[:10]}{source.extension}"
    dest = folder / name
    copy2(src, dest)
    rel = dest.relative_to(uploads_root()).as_posix()
    upload = Upload(
        shop_id=dest_shop_id,
        kind=source.kind,
        original_name=source.original_name,
        size_bytes=source.size_bytes,
        content_type=source.content_type,
        extension=source.extension,
        file_path=f"/uploads/{rel}",
        uploader_id=uploader_id,
    )
    session.add(upload)
    return upload


async def replace_upload(
    session: AsyncSession,
    file: UploadFile,
    *,
    shop_id: int,
    kind: str,
    prefix: str,
    uploader_id: int | None,
    previous: Upload | None = None,
    allow_svg: bool = False,
) -> Upload:
    if kind not in KIND_FOLDER:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Неизвестный тип файла")
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    ext = guess_logo_ext(file.filename, content_type) if allow_svg else guess_photo_ext(file.filename, content_type)
    if ext is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Нужен файл PNG, JPG, WEBP или SVG" if allow_svg else "Нужен файл PNG, JPG или WEBP",
        )
    data = await file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Пустой файл")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Файл больше 2 МБ")
    folder = shop_kind_dir(shop_id, kind)
    name = f"{prefix}-{uuid4().hex[:10]}{ext}"
    (folder / name).write_bytes(data)
    rel = (folder / name).relative_to(uploads_root()).as_posix()
    upload = Upload(
        shop_id=shop_id,
        kind=kind,
        original_name=(Path(file.filename or name).name)[:200],
        size_bytes=len(data),
        content_type=content_type or "application/octet-stream",
        extension=ext,
        file_path=f"/uploads/{rel}",
        uploader_id=uploader_id,
    )
    session.add(upload)
    await session.flush()
    await delete_upload(session, previous)
    return upload
