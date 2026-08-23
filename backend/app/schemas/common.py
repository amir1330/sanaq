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


class ShopSettingsUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    address: str | None = None
    timezone: str | None = Field(default=None, min_length=1, max_length=64)


class Money(BaseModel):
    amount: Decimal
