from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import UserRole


class OwnerShop(Base):
    __tablename__ = "owner_shops"

    owner_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    shop_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("shops.id", ondelete="CASCADE"), primary_key=True
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    shop_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("shops.id", ondelete="CASCADE")
    )
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", native_enum=True), nullable=False
    )
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str | None] = mapped_column(Text, unique=True)
    email: Mapped[str | None] = mapped_column(Text, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    pin_code: Mapped[str | None] = mapped_column(String(128))
    can_receive_stock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    shop: Mapped["Shop | None"] = relationship(back_populates="users")  # noqa: F821
    owned_shops: Mapped[list["Shop"]] = relationship(  # noqa: F821
        secondary="owner_shops",
        primaryjoin="User.id==OwnerShop.owner_id",
        secondaryjoin="Shop.id==OwnerShop.shop_id",
        viewonly=True,
    )
