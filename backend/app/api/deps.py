
import math

from fastapi import Query


class PaginationParams:
    """Dependency для пагинации: ?page=1&size=20."""

    def __init__(
        self,
        page: int = Query(1, ge=1, description="Номер страницы (начиная с 1)"),
        size: int = Query(20, ge=1, le=100, description="Размер страницы (макс. 100)"),
    ):
        self.page = page
        self.size = size
        self.offset = (page - 1) * size

    def pages(self, total: int) -> int:
        return math.ceil(total / self.size) if total else 0
