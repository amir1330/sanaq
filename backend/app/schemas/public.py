from pydantic import BaseModel, Field

from app.schemas.catalog import CategoryOut, ProductOut
from app.schemas.vitrine import VitrineLayoutOut


class PublicShopOut(BaseModel):
    id: int
    name: str
    logo_url: str | None = None


class PublicVitrineMenuOut(BaseModel):
    shop: PublicShopOut
    layout: VitrineLayoutOut
    categories: list[CategoryOut] = Field(default_factory=list)
    products: list[ProductOut] = Field(default_factory=list)
