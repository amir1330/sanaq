from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class ShopCreate(BaseModel):
    name: str
    address: str | None = None
    timezone: str = "Europe/Helsinki"
    is_active: bool = True


class ShopUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    timezone: str | None = None
    is_active: bool | None = None


class OwnerCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(min_length=6)
    phone: str | None = None


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
