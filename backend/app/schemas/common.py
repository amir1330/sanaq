from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import UserRole


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(ORMModel):
    id: int
    shop_id: int | None
    role: UserRole
    full_name: str
    phone: str | None
    email: str | None
    is_active: bool
    created_at: datetime
    owned_shop_ids: list[int] = Field(default_factory=list)
    can_receive_stock: bool = False
    can_apply_discount: bool = False


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class ShopOut(ORMModel):
    id: int
    name: str
    address: str | None
    timezone: str
    logo_url: str | None = None
    is_active: bool
    created_at: datetime
    webkassa_enabled: bool = False
    webkassa_login: str | None = None
    webkassa_cashbox_number: str | None = None
    webkassa_has_password: bool = False
    webkassa_has_api_key: bool = False


class BranchCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    address: str | None = None
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    copy_from_shop_id: int | None = None
    copy_catalog: bool = True


class ShopSettingsUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    address: str | None = None
    timezone: str | None = Field(default=None, min_length=1, max_length=64)


class WebkassaSettingsUpdate(BaseModel):
    login: str | None = None
    password: str | None = None
    cashbox_number: str | None = None
    api_key: str | None = None
    enabled: bool | None = None


class WebkassaTestOut(BaseModel):
    ok: bool
    message: str


class Money(BaseModel):
    amount: Decimal


class PageParams:
    """Shared pagination clamps."""

    @staticmethod
    def clamp(limit: int | None, offset: int | None, *, default: int = 50, max_limit: int = 100) -> tuple[int, int]:
        lim = default if limit is None else int(limit)
        off = 0 if offset is None else int(offset)
        lim = max(1, min(lim, max_limit))
        off = max(0, off)
        return lim, off
