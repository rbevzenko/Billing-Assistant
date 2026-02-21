from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.enums import ProjectStatus

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.time_entry import TimeEntry


class Project(Base):
    """Проект, привязанный к клиенту."""

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Индивидуальная ставка; если NULL — используется LawyerProfile.default_hourly_rate
    hourly_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="RUB", server_default="RUB"
    )

    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus, name="projectstatus", create_constraint=True),
        nullable=False,
        default=ProjectStatus.active,
        server_default=ProjectStatus.active.value,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), server_default=func.now(), nullable=False
    )

    # Relationships
    client: Mapped["Client"] = relationship("Client", back_populates="projects")
    time_entries: Mapped[list["TimeEntry"]] = relationship(
        "TimeEntry", back_populates="project", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_projects_client_id", "client_id"),
        Index("ix_projects_status", "status"),
        Index("ix_projects_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Project id={self.id} name='{self.name}' status={self.status}>"
