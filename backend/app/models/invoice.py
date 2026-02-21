from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, String, Text, func
from sqlalchemy import event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.enums import InvoiceStatus

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.invoice_item import InvoiceItem


class Invoice(Base):
    """Счёт на оплату, выставляемый клиенту."""

    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )

    # Формат "INV-0001"; заполняется автоматически после INSERT
    invoice_number: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True
    )

    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)

    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus, name="invoicestatus", create_constraint=True),
        nullable=False,
        default=InvoiceStatus.draft,
        server_default=InvoiceStatus.draft.value,
        index=True,
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), server_default=func.now(), nullable=False
    )

    # Relationships
    client: Mapped["Client"] = relationship("Client", back_populates="invoices")
    items: Mapped[list["InvoiceItem"]] = relationship(
        "InvoiceItem", back_populates="invoice", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_invoices_client_id", "client_id"),
        Index("ix_invoices_status", "status"),
        Index("ix_invoices_issue_date", "issue_date"),
        Index("ix_invoices_due_date", "due_date"),
    )

    def __repr__(self) -> str:
        return f"<Invoice id={self.id} number='{self.invoice_number}' status={self.status}>"


@event.listens_for(Invoice, "init")
def _set_invoice_number_placeholder(target: Invoice, args: tuple, kwargs: dict) -> None:
    """
    Временный placeholder до получения реального id.
    Настоящий номер формируется в after_insert.
    """
    if "invoice_number" not in kwargs:
        target.invoice_number = "__PENDING__"


@event.listens_for(Invoice, "after_insert")
def _generate_invoice_number(mapper, connection, target: Invoice) -> None:
    """
    После вставки строки формируем номер вида INV-0001 на основе id.
    SQLite не поддерживает GENERATED ALWAYS AS с последовательностями,
    поэтому обновляем строку сразу же в той же транзакции.
    """
    invoice_number = f"INV-{target.id:04d}"
    connection.execute(
        Invoice.__table__.update()
        .where(Invoice.__table__.c.id == target.id)
        .values(invoice_number=invoice_number)
    )
    # Синхронизируем атрибут в памяти без повторного SELECT
    target.__dict__["invoice_number"] = invoice_number
