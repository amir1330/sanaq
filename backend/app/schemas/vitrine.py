from pydantic import BaseModel, Field

from app.schemas.catalog import ProductOut, VariantOut
from app.schemas.common import ORMModel


class VitrineItemIn(BaseModel):
    product_id: int
    variant_id: int | None = None
    sort_order: int = 0


class VitrineColumnIn(BaseModel):
    title: str
    title_kk: str | None = None
    title_en: str | None = None
    sort_order: int = 0
    items: list[VitrineItemIn] = Field(default_factory=list)


class VitrineLayoutUpdate(BaseModel):
    columns: list[VitrineColumnIn] = Field(default_factory=list)


class VitrineItemOut(ORMModel):
    id: int
    product_id: int
    variant_id: int | None = None
    sort_order: int = 0
    product: ProductOut
    variant: VariantOut | None = None


class VitrineColumnOut(ORMModel):
    id: int
    title: str
    title_kk: str | None = None
    title_en: str | None = None
    sort_order: int = 0
    items: list[VitrineItemOut] = Field(default_factory=list)


class VitrineLayoutOut(BaseModel):
    columns: list[VitrineColumnOut] = Field(default_factory=list)
