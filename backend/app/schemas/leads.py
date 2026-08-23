from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORMModel


class LeadCreate(BaseModel):
    shop_name: str = Field(min_length=2, max_length=200)
    city: str = Field(min_length=2, max_length=80)
    contact_name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=8, max_length=32)
    email: str | None = Field(default=None, max_length=200)
    comment: str | None = Field(default=None, max_length=1000)
    website: str | None = None

    @field_validator("email", "comment", mode="before")
    @classmethod
    def empty_to_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value


class LeadOut(ORMModel):
    id: int
    shop_name: str
    city: str
    contact_name: str
    phone: str
    email: str | None
    comment: str | None
    status: str
    created_at: datetime


class LeadStatusUpdate(BaseModel):
    status: str = Field(pattern="^(new|contacted|closed)$")
