from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import CashMovementType, DiscountType, FiscalStatus, PaymentType, ShiftStatus
from app.schemas.common import ORMModel


class ShiftOpenRequest(BaseModel):
    shop_id: int
    opening_cash: Decimal = Field(ge=0)
    barista_id: int | None = None
    cash_register_id: int | None = None


class SellerTotal(BaseModel):
    barista_id: int
    barista_name: str
    cash_revenue: Decimal = Decimal("0")
    card_revenue: Decimal = Decimal("0")
    revenue: Decimal = Decimal("0")
    sales_count: int = 0


class ShiftCloseRequest(BaseModel):
    closing_cash: Decimal = Field(ge=0)
    force: bool = False


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


class ShiftSaleOut(ORMModel):
    id: int
    total_amount: Decimal
    payment_type: PaymentType
    is_refunded: bool
    created_at: datetime
    barista_name: str | None = None
    discount_amount: Decimal = Decimal("0")


class ShiftOut(ORMModel):
    id: int
    shop_id: int
    cash_register_id: int
    cash_register_name: str | None = None
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
    fiscal_pending_count: int = 0
    stock_revision_id: int | None = None
    z_report_number: str | None = None
    z_report_sent_at: datetime | None = None
    sales: list[ShiftSaleOut] = Field(default_factory=list)


class DiscountIn(BaseModel):
    type: DiscountType
    value: Decimal = Field(ge=0)


class SaleItemIn(BaseModel):
    product_id: int
    quantity: int = Field(ge=1)
    discount: DiscountIn | None = None


class SaleCreate(BaseModel):
    shop_id: int
    items: list[SaleItemIn] = Field(min_length=1)
    payment_type: PaymentType
    barista_id: int | None = None
    cash_register_id: int | None = None
    discount: DiscountIn | None = None


class SaleRefundIn(BaseModel):
    shop_id: int
    restore_stock: bool = False


class SaleItemOut(ORMModel):
    id: int
    product_id: int
    product_name: str | None = None
    quantity: int
    price_snapshot: Decimal
    cost_price_snapshot: Decimal
    discount_type: DiscountType | None = None
    discount_value: Decimal | None = None
    discount_amount: Decimal = Decimal("0")
    line_total: Decimal = Decimal("0")


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
    subtotal_amount: Decimal = Decimal("0")
    discount_type: DiscountType | None = None
    discount_value: Decimal | None = None
    discount_amount: Decimal = Decimal("0")
    total_amount: Decimal
    is_refunded: bool
    created_at: datetime
    fiscal_status: FiscalStatus = FiscalStatus.skipped
    fiscal_receipt_number: str | None = None
    fiscal_receipt_url: str | None = None
    fiscal_error: str | None = None
    items: list[SaleItemOut] = Field(default_factory=list)
    alerts: list[StockAlert] = Field(default_factory=list)
