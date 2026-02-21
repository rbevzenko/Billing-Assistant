from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.invoice import Invoice
    from app.models.project import Project


class Client(Base):
    """Клиент — физическое или юридическое лицо."""

    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    contact_person: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    inn: Mapped[str | None] = mapped_column(String(12), nullable=True)

    # Bank details (optional — клиент может быть физлицом)
    bank_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bik: Mapped[str | None] = mapped_column(String(9), nullable=True)
    checking_account: Mapped[str | None] = mapped_column(String(20), nullable=True)
    correspondent_account: Mapped[str | None] = mapped_column(String(20), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), server_default=func.now(), nullable=False
    )

    # Relationships
    projects: Mapped[list["Project"]] = relationship(
        "Project", back_populates="client", cascade="all, delete-orphan"
    )
    invoices: Mapped[list["Invoice"]] = relationship(
        "Invoice", back_populates="client", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_clients_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Client id={self.id} name='{self.name}'>"
