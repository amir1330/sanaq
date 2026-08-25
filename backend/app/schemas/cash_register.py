from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class CashRegisterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class CashRegisterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    is_active: bool | None = None
    sort_order: int | None = None


class CashRegisterOut(ORMModel):
    id: int
    shop_id: int
    name: str
    sort_order: int
    is_active: bool
    has_open_shift: bool = False
