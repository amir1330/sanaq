from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.enums import FiscalStatus


class ReportSummary(BaseModel):
    from_date: date
    to_date: date
    cash_revenue: Decimal
    card_revenue: Decimal
    revenue: Decimal
    cost: Decimal
    profit: Decimal
    sales_count: int
    expenses: Decimal
    revision_shortage: Decimal = Decimal("0")
    net_profit: Decimal
    fiscal_sent_count: int = 0
    fiscal_failed_count: int = 0
    fiscal_pending_count: int = 0
    fiscal_skipped_count: int = 0


class TopProduct(BaseModel):
    product_id: int
    variant_id: int | None = None
    name: str
    name_kk: str | None = None
    name_en: str | None = None
    variant_name: str | None = None
    quantity: int
    revenue: Decimal
    profit: Decimal


class SellerPoint(BaseModel):
    barista_id: int
    barista_name: str
    cash_revenue: Decimal
    card_revenue: Decimal
    revenue: Decimal
    sales_count: int


class FiscalReceipt(BaseModel):
    id: int
    created_at: datetime
    total_amount: Decimal
    payment_type: str
    fiscal_status: FiscalStatus
    fiscal_receipt_number: str | None
    fiscal_receipt_url: str | None
    fiscal_error: str | None
    fiscal_attempts: int
    barista_name: str | None = None


class DailyPoint(BaseModel):
    day: datetime
    cash_revenue: Decimal
    card_revenue: Decimal
    revenue: Decimal
    cost: Decimal
    profit: Decimal
    sales_count: int
    unfiscalized_count: int = 0
