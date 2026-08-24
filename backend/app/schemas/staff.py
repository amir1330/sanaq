from pydantic import BaseModel, Field

from app.schemas.common import UserOut


class StaffCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    pin_code: str = Field(min_length=4, max_length=8, pattern=r"^\d{4,8}$")
    password: str | None = Field(default=None, min_length=4)
    phone: str | None = None
    email: str | None = None
    can_receive_stock: bool = False


class StaffUpdate(BaseModel):
    full_name: str | None = None
    pin_code: str | None = Field(default=None, min_length=4, max_length=8, pattern=r"^\d{4,8}$")
    password: str | None = Field(default=None, min_length=4)
    phone: str | None = None
    email: str | None = None
    is_active: bool | None = None
    can_receive_stock: bool | None = None


class StaffOut(UserOut):
    has_pin: bool = False


class CrewMember(BaseModel):
    id: int
    full_name: str
    role: str
    can_receive_stock: bool = False
