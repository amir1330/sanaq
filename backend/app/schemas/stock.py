from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import StockMovementType, StockRevisionStatus
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
    stock_item_id: int | None
    type: StockMovementType
    quantity_purchase: Decimal | None
    quantity_base: Decimal
    price_total: Decimal | None
    comment: str | None
    created_by: int | None
    created_at: datetime


class StockJournalEntry(ORMModel):
    id: str
    kind: str
    stock_item_id: int | None
    item_name: str
    base_unit: str | None
    purchase_unit: str | None
    quantity_base: Decimal | None
    quantity_purchase: Decimal | None
    price_total: Decimal | None
    actor_name: str | None
    comment: str | None
    created_at: datetime


class StockRevisionLineIn(BaseModel):
    stock_item_id: int
    counted_quantity: Decimal | None = None
    comment: str | None = None


class StockRevisionCreate(BaseModel):
    comment: str | None = None


class StockRevisionUpdate(BaseModel):
    comment: str | None = None
    lines: list[StockRevisionLineIn] = Field(default_factory=list)


class StockRevisionLineOut(ORMModel):
    id: int
    stock_item_id: int | None
    stock_item_name: str
    base_unit: str
    expected_quantity: Decimal
    counted_quantity: Decimal | None
    difference_quantity: Decimal | None
    cost_per_base_unit: Decimal
    value: Decimal | None
    comment: str | None


class StockRevisionOut(ORMModel):
    id: int
    shop_id: int
    status: StockRevisionStatus
    comment: str | None
    created_by: int | None
    created_by_name: str | None = None
    posted_by: int | None
    posted_by_name: str | None = None
    created_at: datetime
    posted_at: datetime | None
    cancelled_at: datetime | None
    line_count: int
    counted_count: int
    shortage_count: int
    surplus_count: int
    difference_value: Decimal
    lines: list[StockRevisionLineOut]
