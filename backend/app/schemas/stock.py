from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import StockMovementType
from app.schemas.common import ORMModel


class StockItemCreate(BaseModel):
    name: str
    base_unit: str
    purchase_unit: str
    purchase_to_base: Decimal = Field(default=Decimal("1"), gt=0)
    quantity: Decimal = Decimal("0")
    min_quantity: Decimal = Decimal("0")
    cost_per_base_unit: Decimal = Decimal("0")


class StockItemUpdate(BaseModel):
    name: str | None = None
    base_unit: str | None = None
    purchase_unit: str | None = None
    purchase_to_base: Decimal | None = Field(default=None, gt=0)
    min_quantity: Decimal | None = None
    cost_per_base_unit: Decimal | None = None


class StockItemOut(ORMModel):
    id: int
    shop_id: int
    name: str
    base_unit: str
    purchase_unit: str
    purchase_to_base: Decimal
    quantity: Decimal
    quantity_in_purchase: Decimal
    min_quantity: Decimal
    cost_per_base_unit: Decimal
    updated_at: datetime
    is_low: bool = False


class StockMovementCreate(BaseModel):
    type: StockMovementType
    quantity: Decimal
    price_total: Decimal | None = None
    comment: str | None = None


class StockMovementOut(ORMModel):
    id: int
    shop_id: int
    stock_item_id: int
    type: StockMovementType
    quantity_purchase: Decimal | None
    quantity_base: Decimal
    price_total: Decimal | None
    comment: str | None
    created_by: int | None
    created_at: datetime
