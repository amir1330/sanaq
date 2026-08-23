from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import CashMovementType, PaymentType, ShiftStatus
from app.schemas.common import ORMModel


class ShiftOpenRequest(BaseModel):
    shop_id: int
    opening_cash: Decimal = Field(ge=0)
    barista_id: int | None = None


class SellerTotal(BaseModel):
    barista_id: int
    barista_name: str
    cash_revenue: Decimal = Decimal("0")
    card_revenue: Decimal = Decimal("0")
    revenue: Decimal = Decimal("0")
    sales_count: int = 0


class ShiftCloseRequest(BaseModel):
    closing_cash: Decimal = Field(ge=0)


class CashMovementCreate(BaseModel):
    type: CashMovementType
    amount: Decimal = Field(gt=0)
    comment: str | None = None


class CashMovementOut(ORMModel):
    id: int
    shift_id: int
    type: CashMovementType
    amount: Decimal
    comment: str | None
    created_at: datetime


class ShiftOut(ORMModel):
    id: int
    shop_id: int
    barista_id: int
    barista_name: str | None = None
    status: ShiftStatus
    opening_cash: Decimal
    closing_cash: Decimal | None
    opened_at: datetime
    closed_at: datetime | None
    cash_revenue: Decimal = Decimal("0")
    card_revenue: Decimal = Decimal("0")
    sales_count: int = 0
    deposits: Decimal = Decimal("0")
    withdrawals: Decimal = Decimal("0")
    expected_cash: Decimal = Decimal("0")
    cash_difference: Decimal | None = None
    sellers: list[SellerTotal] = Field(default_factory=list)


class SaleItemIn(BaseModel):
    product_id: int
    quantity: int = Field(ge=1)


class SaleCreate(BaseModel):
    shop_id: int
    items: list[SaleItemIn] = Field(min_length=1)
    payment_type: PaymentType
    barista_id: int | None = None


class SaleItemOut(ORMModel):
    id: int
    product_id: int
    product_name: str | None = None
    quantity: int
    price_snapshot: Decimal
    cost_price_snapshot: Decimal


class StockAlert(BaseModel):
    stock_item_id: int
    name: str
    quantity: Decimal
    min_quantity: Decimal


class SaleOut(ORMModel):
    id: int
    shop_id: int
    shift_id: int
    barista_id: int
    payment_type: PaymentType
    total_amount: Decimal
    is_refunded: bool
    created_at: datetime
    items: list[SaleItemOut] = Field(default_factory=list)
    alerts: list[StockAlert] = Field(default_factory=list)
