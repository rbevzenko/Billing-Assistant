from __future__ import annotations

import math
from typing import Generic, Sequence, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Универсальный paginated-ответ."""

    items: list[T]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def create(
        cls,
        items: Sequence,
        total: int,
        page: int,
        size: int,
    ) -> "Page[T]":
        return cls(
            items=list(items),
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total else 0,
        )
