from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import CashMovementType, ShiftStatus


class Shift(Base):
    __tablename__ = "shifts"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False
    )
    barista_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    status: Mapped[ShiftStatus] = mapped_column(
        Enum(ShiftStatus, name="shift_status", native_enum=True),
        nullable=False,
        default=ShiftStatus.open,
    )
    opening_cash: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0")
    )
    closing_cash: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    z_report_number: Mapped[str | None] = mapped_column(Text)
    z_report_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    barista: Mapped["User"] = relationship()  # noqa: F821
    cash_movements: Mapped[list["ShiftCashMovement"]] = relationship(
        back_populates="shift", cascade="all, delete-orphan"
    )
    sales: Mapped[list["Sale"]] = relationship(back_populates="shift")  # noqa: F821


class ShiftCashMovement(Base):
    __tablename__ = "shift_cash_movements"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    shift_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[CashMovementType] = mapped_column(
        Enum(CashMovementType, name="cash_movement_type", native_enum=True), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    shift: Mapped[Shift] = relationship(back_populates="cash_movements")
