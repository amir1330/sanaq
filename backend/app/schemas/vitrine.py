from pydantic import BaseModel, Field

from app.schemas.catalog import ProductOut
from app.schemas.common import ORMModel


class VitrineItemIn(BaseModel):
    product_id: int
    sort_order: int = 0


class VitrineColumnIn(BaseModel):
    title: str
    sort_order: int = 0
    header_style: str = "ornament"
    items: list[VitrineItemIn] = Field(default_factory=list)


class VitrineLayoutUpdate(BaseModel):
    columns: list[VitrineColumnIn] = Field(default_factory=list)


class VitrineItemOut(ORMModel):
    id: int
    product_id: int
    sort_order: int = 0
    product: ProductOut


class VitrineColumnOut(ORMModel):
    id: int
    title: str
    sort_order: int = 0
    header_style: str = "ornament"
    items: list[VitrineItemOut] = Field(default_factory=list)


class VitrineLayoutOut(BaseModel):
    columns: list[VitrineColumnOut] = Field(default_factory=list)
