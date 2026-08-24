from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import UserOut


class StaffCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=6)
    phone: str | None = None
    can_receive_stock: bool = False


class StaffUpdate(BaseModel):
    full_name: str | None = None
    password: str | None = Field(default=None, min_length=6)
    phone: str | None = None
    email: EmailStr | None = None
    is_active: bool | None = None
    can_receive_stock: bool | None = None


class StaffOut(UserOut):
    has_pin: bool = False


class CrewMember(BaseModel):
    id: int
    full_name: str
    role: str
    can_receive_stock: bool = False
