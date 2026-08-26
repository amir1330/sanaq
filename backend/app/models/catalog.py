from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    name_kk: Mapped[str | None] = mapped_column(Text)
    name_en: Mapped[str | None] = mapped_column(Text)

    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("categories.id", ondelete="SET NULL")
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    name_kk: Mapped[str | None] = mapped_column(Text)
    name_en: Mapped[str | None] = mapped_column(Text)
    sku: Mapped[str | None] = mapped_column(Text)
    sale_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_service: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    image_upload_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("uploads.id", ondelete="SET NULL", use_alter=True, name="fk_products_image_upload_id"),
    )
    fiscal_position_code: Mapped[str | None] = mapped_column(Text)
    tax_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0"))
    tax_type: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    category: Mapped[Category | None] = relationship(back_populates="products")
    ingredients: Mapped[list["ProductIngredient"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    image: Mapped["Upload | None"] = relationship(  # noqa: F821
        "Upload",
        foreign_keys=[image_upload_id],
        lazy="selectin",
        post_update=True,
    )

    @property
    def image_url(self) -> str | None:
        return self.image.file_path if self.image is not None else None


class ProductIngredient(Base):
    __tablename__ = "product_ingredients"

    product_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("products.id", ondelete="CASCADE"), primary_key=True
    )
    stock_item_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("stock_items.id", ondelete="RESTRICT"), primary_key=True
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)

    product: Mapped[Product] = relationship(back_populates="ingredients")
    stock_item: Mapped["StockItem"] = relationship()  # noqa: F821
