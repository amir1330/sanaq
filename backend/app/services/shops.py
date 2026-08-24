from app.models import Shop
from app.schemas.common import ShopOut


def to_shop_out(shop: Shop) -> ShopOut:
    return ShopOut(
        id=shop.id,
        name=shop.name,
        address=shop.address,
        timezone=shop.timezone,
        logo_url=shop.logo_url,
        is_active=shop.is_active,
        created_at=shop.created_at,
        webkassa_enabled=bool(shop.webkassa_enabled),
        webkassa_login=shop.webkassa_login,
        webkassa_cashbox_number=shop.webkassa_cashbox_number,
        webkassa_has_password=bool(shop.webkassa_password_encrypted),
        webkassa_has_api_key=bool(shop.webkassa_api_key_encrypted),
    )
