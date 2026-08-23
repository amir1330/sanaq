from pathlib import Path

from app.config import settings

ALLOWED_LOGO = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
}
ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".webp", ".svg"}


def guess_logo_ext(filename: str | None, content_type: str) -> str | None:
    if content_type in ALLOWED_LOGO:
        return ALLOWED_LOGO[content_type]
    suffix = Path(filename or "").suffix.lower()
    if suffix in ALLOWED_EXT:
        return ".jpg" if suffix == ".jpeg" else suffix
    return None


def uploads_root() -> Path:
    root = Path(settings.upload_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def shop_logo_dir(shop_id: int) -> Path:
    path = uploads_root() / "shops" / str(shop_id)
    path.mkdir(parents=True, exist_ok=True)
    return path
