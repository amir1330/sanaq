from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Shop(Base):
    __tablename__ = "shops"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Europe/Helsinki")
    logo_upload_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("uploads.id", ondelete="SET NULL", use_alter=True, name="fk_shops_logo_upload_id"),
    )
    webkassa_login: Mapped[str | None] = mapped_column(Text)
    webkassa_password_encrypted: Mapped[str | None] = mapped_column(Text)
    webkassa_cashbox_number: Mapped[str | None] = mapped_column(Text)
    webkassa_api_key_encrypted: Mapped[str | None] = mapped_column(Text)
    webkassa_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    users: Mapped[list["User"]] = relationship(back_populates="shop")  # noqa: F821
    logo: Mapped["Upload | None"] = relationship(  # noqa: F821
        "Upload",
        foreign_keys=[logo_upload_id],
        lazy="selectin",
        post_update=True,
    )

    @property
    def logo_url(self) -> str | None:
        return self.logo.file_path if self.logo is not None else None
