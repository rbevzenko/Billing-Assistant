from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ClientBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    contact_person: str | None = Field(None, max_length=255)
    email: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=20)
    address: str | None = None
    inn: str | None = Field(None, max_length=12)
    bank_name: str | None = Field(None, max_length=255)
    bik: str | None = Field(None, max_length=9)
    checking_account: str | None = Field(None, max_length=20)
    correspondent_account: str | None = Field(None, max_length=20)
    notes: str | None = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    """Все поля опциональны — частичное обновление."""

    name: str | None = Field(None, min_length=1, max_length=255)
    contact_person: str | None = Field(None, max_length=255)
    email: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=20)
    address: str | None = None
    inn: str | None = Field(None, max_length=12)
    bank_name: str | None = Field(None, max_length=255)
    bik: str | None = Field(None, max_length=9)
    checking_account: str | None = Field(None, max_length=20)
    correspondent_account: str | None = Field(None, max_length=20)
    notes: str | None = None


class ClientRead(ClientBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
