from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import StockMovementType
from app.schemas.common import ORMModel


class StockItemCreate(BaseModel):
    name: str
    unit: str
    quantity: Decimal = Decimal("0")
    min_quantity: Decimal = Decimal("0")
    cost_per_unit: Decimal = Decimal("0")


class StockItemUpdate(BaseModel):
    name: str | None = None
    unit: str | None = None
    min_quantity: Decimal | None = None
    cost_per_unit: Decimal | None = None


class StockItemOut(ORMModel):
    id: int
    shop_id: int
    name: str
    unit: str
    quantity: Decimal
    min_quantity: Decimal
    cost_per_unit: Decimal
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
    quantity: Decimal
    price_total: Decimal | None
    comment: str | None
    created_by: int | None
    created_at: datetime
