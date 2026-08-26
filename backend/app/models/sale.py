from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, Sequence, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import DiscountType, FiscalStatus, PaymentType

sales_id_seq = Sequence("sales_id_seq")


class Sale(Base):
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(
        BigInteger, sales_id_seq, primary_key=True, autoincrement=True, server_default=sales_id_seq.next_value()
    )
    shop_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    shift_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("shifts.id"), nullable=False)
    barista_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    payment_type: Mapped[PaymentType] = mapped_column(
        Enum(PaymentType, name="payment_type", native_enum=True), nullable=False
    )
    subtotal_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    discount_type: Mapped[DiscountType | None] = mapped_column(
        Enum(DiscountType, name="discount_type", native_enum=True), nullable=True
    )
    discount_value: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    is_refunded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    fiscal_status: Mapped[FiscalStatus] = mapped_column(
        Enum(FiscalStatus, name="fiscal_status", native_enum=True),
        nullable=False,
        default=FiscalStatus.pending,
    )
    fiscal_receipt_number: Mapped[str | None] = mapped_column(Text)
    fiscal_receipt_url: Mapped[str | None] = mapped_column(Text)
    fiscal_error: Mapped[str | None] = mapped_column(Text)
    fiscal_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), primary_key=True
    )

    shift: Mapped["Shift"] = relationship(back_populates="sales")  # noqa: F821
    barista: Mapped["User"] = relationship()  # noqa: F821
    items: Mapped[list["SaleItem"]] = relationship(
        "SaleItem",
        primaryjoin="Sale.id==foreign(SaleItem.sale_id)",
        viewonly=True,
    )


class SaleItem(Base):
    __tablename__ = "sale_items"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    sale_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    price_snapshot: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    cost_price_snapshot: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount_type: Mapped[DiscountType | None] = mapped_column(
        Enum(DiscountType, name="discount_type", native_enum=True), nullable=True
    )
    discount_value: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))

    product: Mapped["Product"] = relationship()  # noqa: F821
