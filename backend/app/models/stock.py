from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import StockMovementType


class StockItem(Base):
    __tablename__ = "stock_items"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    base_unit: Mapped[str] = mapped_column(Text, nullable=False)
    purchase_unit: Mapped[str] = mapped_column(Text, nullable=False)
    purchase_to_base: Mapped[Decimal] = mapped_column(
        Numeric(12, 3), nullable=False, default=Decimal("1")
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False, default=Decimal("0"))
    min_quantity: Mapped[Decimal] = mapped_column(
        Numeric(14, 3), nullable=False, default=Decimal("0")
    )
    cost_per_base_unit: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("0")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    movements: Mapped[list["StockMovement"]] = relationship(back_populates="stock_item")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False
    )
    stock_item_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("stock_items.id"), nullable=False
    )
    type: Mapped[StockMovementType] = mapped_column(
        Enum(StockMovementType, name="stock_movement_type", native_enum=True), nullable=False
    )
    quantity_purchase: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    quantity_base: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    price_total: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    comment: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    stock_item: Mapped[StockItem] = relationship(back_populates="movements")
