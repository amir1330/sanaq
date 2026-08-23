from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ExpenseCreate(BaseModel):
    category: str
    amount: Decimal = Field(gt=0)
    comment: str | None = None


class ExpenseOut(ORMModel):
    id: int
    shop_id: int
    category: str
    amount: Decimal
    comment: str | None
    created_by: int | None
    created_at: datetime
