from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CashRegister(Base):
    """Physical till / cash drawer inside a shop. Each has its own open shift."""

    __tablename__ = "cash_registers"
    __table_args__ = (UniqueConstraint("shop_id", "name", name="uq_cash_registers_shop_name"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    shop: Mapped["Shop"] = relationship()  # noqa: F821
    shifts: Mapped[list["Shift"]] = relationship(back_populates="cash_register")  # noqa: F821
