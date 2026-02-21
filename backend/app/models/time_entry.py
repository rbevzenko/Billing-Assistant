from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.enums import TimeEntryStatus

if TYPE_CHECKING:
    from app.models.invoice_item import InvoiceItem
    from app.models.project import Project


class TimeEntry(Base):
    """Запись о потраченном времени на проект."""

    __tablename__ = "time_entries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )

    # Дата выполнения работы
    date: Mapped[date] = mapped_column(Date, nullable=False)

    # Длительность с точностью до 0.1 ч (NUMERIC(5,1) — до 9999.9 часов)
    duration_hours: Mapped[Decimal] = mapped_column(
        Numeric(5, 1), nullable=False
    )

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[TimeEntryStatus] = mapped_column(
        Enum(TimeEntryStatus, name="timeentrystatus", create_constraint=True),
        nullable=False,
        default=TimeEntryStatus.draft,
        server_default=TimeEntryStatus.draft.value,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="time_entries")
    invoice_items: Mapped[list["InvoiceItem"]] = relationship(
        "InvoiceItem", back_populates="time_entry"
    )

    __table_args__ = (
        Index("ix_time_entries_project_id", "project_id"),
        Index("ix_time_entries_date", "date"),
        Index("ix_time_entries_status", "status"),
        # Составной индекс для типичного запроса «все записи проекта за период»
        Index("ix_time_entries_project_date", "project_id", "date"),
    )

    def __repr__(self) -> str:
        return (
            f"<TimeEntry id={self.id} project_id={self.project_id} "
            f"date={self.date} hours={self.duration_hours}>"
        )
