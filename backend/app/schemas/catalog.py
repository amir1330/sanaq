from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class CategoryCreate(BaseModel):
    name: str


class CategoryUpdate(BaseModel):
    name: str | None = None


class CategoryOut(ORMModel):
    id: int
    shop_id: int
    name: str


class IngredientIn(BaseModel):
    stock_item_id: int
    quantity: Decimal = Field(gt=0)


class IngredientOut(ORMModel):
    stock_item_id: int
    quantity: Decimal
    stock_item_name: str | None = None
    unit: str | None = None


class ProductCreate(BaseModel):
    name: str
    sale_price: Decimal = Field(gt=0)
    category_id: int | None = None
    is_active: bool = True
    image_url: str | None = None
    fiscal_position_code: str | None = None
    tax_percent: Decimal = Decimal("0")
    tax_type: int = 0
    ingredients: list[IngredientIn] = Field(default_factory=list)


class ProductUpdate(BaseModel):
    name: str | None = None
    sale_price: Decimal | None = Field(default=None, gt=0)
    category_id: int | None = None
    is_active: bool | None = None
    image_url: str | None = None
    fiscal_position_code: str | None = None
    tax_percent: Decimal | None = None
    tax_type: int | None = None


class ProductOut(ORMModel):
    id: int
    shop_id: int
    category_id: int | None
    name: str
    sale_price: Decimal
    is_active: bool
    image_url: str | None
    created_at: datetime
    category_name: str | None = None
    cost_price: Decimal | None = None
    fiscal_position_code: str | None = None
    tax_percent: Decimal = Decimal("0")
    tax_type: int = 0
    ingredients: list[IngredientOut] = Field(default_factory=list)
