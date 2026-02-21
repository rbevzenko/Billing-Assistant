from decimal import Decimal

from sqlalchemy import Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class LawyerProfile(Base):
    """Реквизиты и настройки юриста/компании (одна запись на инсталляцию)."""

    __tablename__ = "lawyer_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Personal / company info
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    inn: Mapped[str] = mapped_column(String(12), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)

    # Bank details
    bank_name: Mapped[str] = mapped_column(String(255), nullable=False)
    bik: Mapped[str] = mapped_column(String(9), nullable=False)
    checking_account: Mapped[str] = mapped_column(String(20), nullable=False)
    correspondent_account: Mapped[str] = mapped_column(String(20), nullable=False)

    # Contacts
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)

    # Billing defaults
    default_hourly_rate: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False
    )
    logo_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    def __repr__(self) -> str:
        return f"<LawyerProfile id={self.id} company='{self.company_name}'>"
