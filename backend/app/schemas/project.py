from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ProjectStatus


class ProjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    hourly_rate: Decimal | None = Field(
        None,
        ge=0,
        description="Ставка проекта руб/час. Если null — используется ставка профиля юриста.",
    )
    currency: str = Field("RUB", max_length=3)
    status: ProjectStatus = ProjectStatus.active


class ProjectCreate(ProjectBase):
    client_id: int


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    hourly_rate: Decimal | None = Field(None, ge=0)
    currency: str | None = Field(None, max_length=3)
    status: ProjectStatus | None = None


class ProjectRead(ProjectBase):
    id: int
    client_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectStats(BaseModel):
    """Агрегированная статистика по записям времени проекта."""

    total_hours: Decimal
    """Всего часов по всем записям."""
    confirmed_hours: Decimal
    """Часов в статусе confirmed."""
    unbilled_hours: Decimal
    """Часов, ещё не выставленных в счёт (draft + confirmed)."""


class ProjectDetailRead(ProjectRead):
    stats: ProjectStats
