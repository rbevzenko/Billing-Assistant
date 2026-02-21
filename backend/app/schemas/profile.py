from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class LawyerProfileRead(BaseModel):
    id: int
    full_name: str
    company_name: str
    inn: str
    address: str
    bank_name: str
    bik: str
    checking_account: str
    correspondent_account: str
    email: str
    phone: str
    default_hourly_rate: Decimal
    logo_path: str | None

    model_config = ConfigDict(from_attributes=True)


class LawyerProfileUpdate(BaseModel):
    """
    PUT работает как PATCH: обновляет только переданные поля.
    При первом обращении (профиль не создан) все обязательные поля
    должны быть переданы — валидация выполняется в роуте.
    """

    full_name: str | None = Field(None, max_length=255)
    company_name: str | None = Field(None, max_length=255)
    inn: str | None = Field(None, max_length=12)
    address: str | None = None
    bank_name: str | None = Field(None, max_length=255)
    bik: str | None = Field(None, max_length=9)
    checking_account: str | None = Field(None, max_length=20)
    correspondent_account: str | None = Field(None, max_length=20)
    email: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=20)
    default_hourly_rate: Decimal | None = Field(None, ge=0)
    logo_path: str | None = Field(None, max_length=500)
