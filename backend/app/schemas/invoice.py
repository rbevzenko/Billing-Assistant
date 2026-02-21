from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from app.models.enums import InvoiceStatus


class InvoiceItemRead(BaseModel):
    id: int
    time_entry_id: int | None
    hours: Decimal
    rate: Decimal
    amount: Decimal

    model_config = ConfigDict(from_attributes=True)


class InvoiceRead(BaseModel):
    id: int
    client_id: int
    invoice_number: str
    issue_date: date
    due_date: date
    status: InvoiceStatus
    notes: str | None
    created_at: datetime
    items: list[InvoiceItemRead] = []

    @computed_field(description="Итоговая сумма счёта (сумма строк)")
    @property
    def total_amount(self) -> Decimal:
        return sum((item.amount for item in self.items), Decimal("0"))

    model_config = ConfigDict(from_attributes=True)


class InvoiceCreateRequest(BaseModel):
    client_id: int
    time_entry_ids: list[int] = Field(
        min_length=1,
        description="Список id записей времени (должны быть в статусе confirmed)",
    )
    issue_date: date
    due_date: date
    notes: str | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> "InvoiceCreateRequest":
        if self.due_date < self.issue_date:
            raise ValueError("Срок оплаты не может быть раньше даты выставления")
        return self


class InvoiceUpdate(BaseModel):
    """Только draft-счёт можно изменить."""

    issue_date: date | None = None
    due_date: date | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> "InvoiceUpdate":
        if self.issue_date and self.due_date and self.due_date < self.issue_date:
            raise ValueError("Срок оплаты не может быть раньше даты выставления")
        return self
