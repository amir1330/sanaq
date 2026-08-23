from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


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
    net_profit: Decimal


class TopProduct(BaseModel):
    product_id: int
    name: str
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


class DailyPoint(BaseModel):
    day: datetime
    cash_revenue: Decimal
    card_revenue: Decimal
    revenue: Decimal
    cost: Decimal
    profit: Decimal
    sales_count: int
