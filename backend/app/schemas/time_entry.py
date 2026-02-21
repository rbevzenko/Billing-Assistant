from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import TimeEntryStatus

# Alias to prevent field-name / type-name collision in Pydantic's localns resolution:
# when `date` is both a field name AND a type, Pydantic's class __dict__ shadows the
# module-level `date` import with the field's default value (None), causing a TypeError.
_Date = date


class TimeEntryBase(BaseModel):
    date: _Date
    duration_hours: Decimal = Field(
        gt=0,
        description="Длительность в часах с точностью до 0.1",
    )
    description: str | None = None


class TimeEntryCreate(TimeEntryBase):
    project_id: int


class TimeEntryUpdate(BaseModel):
    date: _Date | None = None
    duration_hours: Decimal | None = Field(None, gt=0)
    description: str | None = None


class TimeEntryRead(TimeEntryBase):
    id: int
    project_id: int
    status: TimeEntryStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BulkConfirmRequest(BaseModel):
    time_entry_ids: list[int] = Field(min_length=1, description="Список id записей для подтверждения")


class BulkConfirmResponse(BaseModel):
    confirmed_count: int
    skipped_count: int
    skipped_ids: list[int] = Field(
        description="Id записей, пропущенных (не в статусе draft)"
    )
