
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import PaginationParams
from app.db.database import get_db
from app.models.enums import TimeEntryStatus
from app.models.project import Project
from app.models.time_entry import TimeEntry
from app.schemas.common import Page
from app.schemas.time_entry import (
    BulkConfirmRequest,
    BulkConfirmResponse,
    TimeEntryCreate,
    TimeEntryRead,
    TimeEntryUpdate,
)

router = APIRouter()


def _get_or_404(entry_id: int, db: Session) -> TimeEntry:
    entry = db.get(TimeEntry, entry_id)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Запись времени с id={entry_id} не найдена",
        )
    return entry


# ──────────────────────────────────────────────────────────────────────────────
# NOTE: bulk-confirm is registered BEFORE /{id}/confirm to avoid routing
# ambiguity (though FastAPI resolves by type, this is cleaner).
# ──────────────────────────────────────────────────────────────────────────────


@router.post(
    "/bulk-confirm",
    response_model=BulkConfirmResponse,
    summary="Массовое подтверждение записей времени",
    description="Переводит все записи из статуса **draft** в **confirmed**. Записи в других статусах пропускаются.",
)
def bulk_confirm(
    data: BulkConfirmRequest,
    db: Session = Depends(get_db),
) -> BulkConfirmResponse:
    entries = (
        db.query(TimeEntry)
        .filter(TimeEntry.id.in_(data.time_entry_ids))
        .all()
    )

    found_ids = {e.id for e in entries}
    missing = set(data.time_entry_ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Записи не найдены: {sorted(missing)}",
        )

    confirmed, skipped = [], []
    for entry in entries:
        if entry.status == TimeEntryStatus.draft:
            entry.status = TimeEntryStatus.confirmed
            confirmed.append(entry.id)
        else:
            skipped.append(entry.id)

    db.commit()
    return BulkConfirmResponse(
        confirmed_count=len(confirmed),
        skipped_count=len(skipped),
        skipped_ids=skipped,
    )


@router.get(
    "",
    response_model=Page[TimeEntryRead],
    summary="Список записей времени",
)
def list_time_entries(
    client_id: int | None = Query(None, description="Фильтр по клиенту (через проект)"),
    project_id: int | None = Query(None, description="Фильтр по проекту"),
    date_from: date | None = Query(None, description="Дата начала периода (включительно)"),
    date_to: date | None = Query(None, description="Дата конца периода (включительно)"),
    entry_status: TimeEntryStatus | None = Query(None, alias="status", description="Фильтр по статусу"),
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
) -> Page[TimeEntryRead]:
    q = db.query(TimeEntry)

    if client_id is not None:
        q = q.join(Project).filter(Project.client_id == client_id)
    if project_id is not None:
        q = q.filter(TimeEntry.project_id == project_id)
    if date_from is not None:
        q = q.filter(TimeEntry.date >= date_from)
    if date_to is not None:
        q = q.filter(TimeEntry.date <= date_to)
    if entry_status is not None:
        q = q.filter(TimeEntry.status == entry_status)

    total = q.count()
    items = (
        q.order_by(TimeEntry.date.desc(), TimeEntry.id.desc())
        .offset(pagination.offset)
        .limit(pagination.size)
        .all()
    )
    return Page.create(items=items, total=total, page=pagination.page, size=pagination.size)


@router.post(
    "",
    response_model=TimeEntryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Создать запись времени",
    responses={404: {"description": "Проект не найден"}},
)
def create_time_entry(data: TimeEntryCreate, db: Session = Depends(get_db)) -> TimeEntry:
    if db.get(Project, data.project_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Проект с id={data.project_id} не найден",
        )
    entry = TimeEntry(**data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put(
    "/{entry_id}",
    response_model=TimeEntryRead,
    summary="Обновить запись времени",
    description="Обновление доступно только для записей со статусом **draft** или **confirmed**.",
    responses={
        404: {"description": "Запись не найдена"},
        409: {"description": "Запись уже выставлена в счёт (billed)"},
    },
)
def update_time_entry(
    entry_id: int,
    data: TimeEntryUpdate,
    db: Session = Depends(get_db),
) -> TimeEntry:
    entry = _get_or_404(entry_id, db)

    if entry.status == TimeEntryStatus.billed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Запись уже включена в счёт (billed) и не может быть изменена",
        )

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete(
    "/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Удалить запись времени",
    description="Удаление доступно только для записей со статусом **draft**.",
    responses={
        404: {"description": "Запись не найдена"},
        409: {"description": "Запись не в статусе draft"},
    },
)
def delete_time_entry(entry_id: int, db: Session = Depends(get_db)) -> None:
    entry = _get_or_404(entry_id, db)

    if entry.status != TimeEntryStatus.draft:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Можно удалить только запись в статусе draft. Текущий статус: {entry.status.value}",
        )

    db.delete(entry)
    db.commit()


@router.post(
    "/{entry_id}/confirm",
    response_model=TimeEntryRead,
    summary="Подтвердить запись времени",
    description="Переводит запись из статуса **draft** в **confirmed**.",
    responses={
        404: {"description": "Запись не найдена"},
        409: {"description": "Запись не в статусе draft"},
    },
)
def confirm_time_entry(entry_id: int, db: Session = Depends(get_db)) -> TimeEntry:
    entry = _get_or_404(entry_id, db)

    if entry.status != TimeEntryStatus.draft:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Подтвердить можно только запись в статусе draft. Текущий статус: {entry.status.value}",
        )

    entry.status = TimeEntryStatus.confirmed
    db.commit()
    db.refresh(entry)
    return entry
