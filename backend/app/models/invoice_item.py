from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.invoice import Invoice
    from app.models.time_entry import TimeEntry


class InvoiceItem(Base):
    """Строка счёта — ссылается на конкретную запись времени."""

    __tablename__ = "invoice_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    # Nullable: позволяет добавлять строки вручную без привязки к TimeEntry
    time_entry_id: Mapped[int | None] = mapped_column(
        ForeignKey("time_entries.id", ondelete="SET NULL"), nullable=True
    )

    # Количество часов (копируется из TimeEntry или задаётся вручную)
    hours: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False)
    # Ставка руб/час на момент выставления счёта (фиксируется)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # Сумма = hours * rate; хранится явно для защиты от изменения ставки
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    # Relationships
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="items")
    time_entry: Mapped["TimeEntry | None"] = relationship(
        "TimeEntry", back_populates="invoice_items"
    )

    __table_args__ = (
        Index("ix_invoice_items_invoice_id", "invoice_id"),
        Index("ix_invoice_items_time_entry_id", "time_entry_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<InvoiceItem id={self.id} invoice_id={self.invoice_id} "
            f"hours={self.hours} rate={self.rate} amount={self.amount}>"
        )
