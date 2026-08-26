from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import StockLogAction, StockMovementType, StockRevisionStatus


class StockItem(Base):
    __tablename__ = "stock_items"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    sku: Mapped[str | None] = mapped_column(Text)
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
    is_ingredient: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    image_upload_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("uploads.id", ondelete="SET NULL", use_alter=True, name="fk_stock_items_image_upload_id"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    movements: Mapped[list["StockMovement"]] = relationship(back_populates="stock_item")
    lots: Mapped[list["StockLot"]] = relationship(
        back_populates="stock_item", cascade="all, delete-orphan"
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


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False
    )
    stock_item_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("stock_items.id", ondelete="SET NULL")
    )
    stock_item_name: Mapped[str | None] = mapped_column(Text)
    base_unit: Mapped[str | None] = mapped_column(Text)
    purchase_unit: Mapped[str | None] = mapped_column(Text)
    type: Mapped[StockMovementType] = mapped_column(
        Enum(StockMovementType, name="stock_movement_type", native_enum=True), nullable=False
    )
    quantity_purchase: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    quantity_base: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    price_total: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    comment: Mapped[str | None] = mapped_column(Text)
    revision_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("stock_revisions.id", ondelete="SET NULL")
    )
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    stock_item: Mapped[StockItem | None] = relationship(back_populates="movements")
    revision: Mapped["StockRevision | None"] = relationship(back_populates="movements")


class StockLot(Base):
    """One purchase batch. Sales consume oldest lots first (FIFO)."""

    __tablename__ = "stock_lots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stock_item_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("stock_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quantity_remaining: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    cost_per_base_unit: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("0")
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    source_movement_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("stock_movements.id", ondelete="SET NULL")
    )

    stock_item: Mapped[StockItem] = relationship(back_populates="lots")


class StockLog(Base):
    __tablename__ = "stock_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False
    )
    stock_item_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("stock_items.id", ondelete="SET NULL")
    )
    stock_item_name: Mapped[str] = mapped_column(Text, nullable=False)
    action: Mapped[StockLogAction] = mapped_column(
        Enum(StockLogAction, name="stock_log_action", native_enum=True), nullable=False
    )
    detail: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class StockRevision(Base):
    __tablename__ = "stock_revisions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[StockRevisionStatus] = mapped_column(
        Enum(StockRevisionStatus, name="stock_revision_status", native_enum=True),
        nullable=False,
        default=StockRevisionStatus.draft,
    )
    comment: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id"))
    posted_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    lines: Mapped[list["StockRevisionLine"]] = relationship(
        back_populates="revision",
        cascade="all, delete-orphan",
    )
    movements: Mapped[list["StockMovement"]] = relationship(back_populates="revision")


class StockRevisionLine(Base):
    __tablename__ = "stock_revision_lines"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    revision_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("stock_revisions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stock_item_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("stock_items.id", ondelete="SET NULL")
    )
    stock_item_name: Mapped[str] = mapped_column(Text, nullable=False)
    base_unit: Mapped[str] = mapped_column(Text, nullable=False)
    expected_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    counted_quantity: Mapped[Decimal | None] = mapped_column(Numeric(14, 3))
    difference_quantity: Mapped[Decimal | None] = mapped_column(Numeric(14, 3))
    cost_per_base_unit: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("0")
    )
    comment: Mapped[str | None] = mapped_column(Text)

    revision: Mapped["StockRevision"] = relationship(back_populates="lines")
