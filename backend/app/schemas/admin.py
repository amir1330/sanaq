from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class OwnerCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(min_length=6)
    phone: str | None = None


class AdminUserCreate(BaseModel):
    shop_id: int
    role: Literal["owner", "barista"]
    full_name: str = Field(min_length=1, max_length=200)
    email: EmailStr | None = None
    phone: str | None = None
    password: str | None = Field(default=None, min_length=6)
    can_receive_stock: bool = False


class AdminUserOut(ORMModel):
    id: int
    shop_id: int | None
    shop_name: str | None = None
    role: str
    full_name: str
    phone: str | None
    email: str | None
    is_active: bool
    created_at: datetime
    can_receive_stock: bool = False
    has_pin: bool = False


class ShopCreate(BaseModel):
    name: str
    address: str | None = None
    timezone: str = "Asia/Almaty"
    is_active: bool = True
    owner: OwnerCreate | None = None
    existing_owner_email: EmailStr | None = None


class ShopUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    timezone: str | None = None
    is_active: bool | None = None


class AdminShopStats(ORMModel):
    shop_id: int
    shop_name: str
    is_active: bool
    revenue: float
    sales_count: int
    profit: float


class AdminStatsOut(BaseModel):
    shops_count: int
    active_shops: int
    users_count: int
    shops: list[AdminShopStats]
