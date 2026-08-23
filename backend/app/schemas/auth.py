from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    login: str = Field(..., description="Email or phone")
    password: str


class PinLoginRequest(BaseModel):
    shop_id: int
    pin_code: str = Field(..., min_length=4, max_length=8)


class RefreshRequest(BaseModel):
    refresh_token: str
