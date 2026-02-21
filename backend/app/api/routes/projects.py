
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.api.deps import PaginationParams
from app.db.database import get_db
from app.models.client import Client
from app.models.enums import ProjectStatus, TimeEntryStatus
from app.models.project import Project
from app.models.time_entry import TimeEntry
from app.schemas.common import Page
from app.schemas.project import (
    ProjectCreate,
    ProjectDetailRead,
    ProjectRead,
    ProjectStats,
    ProjectUpdate,
)

router = APIRouter()


def _get_or_404(project_id: int, db: Session) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Проект с id={project_id} не найден",
        )
    return project


def _compute_stats(project_id: int, db: Session) -> ProjectStats:
    zero = Decimal("0")
    row = db.query(
        func.coalesce(func.sum(TimeEntry.duration_hours), zero).label("total_hours"),
        func.coalesce(
            func.sum(
                case(
                    (TimeEntry.status == TimeEntryStatus.confirmed, TimeEntry.duration_hours),
                    else_=zero,
                )
            ),
            zero,
        ).label("confirmed_hours"),
        func.coalesce(
            func.sum(
                case(
                    (TimeEntry.status != TimeEntryStatus.billed, TimeEntry.duration_hours),
                    else_=zero,
                )
            ),
            zero,
        ).label("unbilled_hours"),
    ).filter(TimeEntry.project_id == project_id).one()

    return ProjectStats(
        total_hours=row.total_hours,
        confirmed_hours=row.confirmed_hours,
        unbilled_hours=row.unbilled_hours,
    )


@router.get(
    "",
    response_model=Page[ProjectRead],
    summary="Список проектов",
)
def list_projects(
    client_id: int | None = Query(None, description="Фильтр по клиенту"),
    status_filter: ProjectStatus | None = Query(None, alias="status", description="Фильтр по статусу"),
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
) -> Page[ProjectRead]:
    q = db.query(Project)
    if client_id is not None:
        q = q.filter(Project.client_id == client_id)
    if status_filter is not None:
        q = q.filter(Project.status == status_filter)
    total = q.count()
    items = (
        q.order_by(Project.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.size)
        .all()
    )
    return Page.create(items=items, total=total, page=pagination.page, size=pagination.size)


@router.post(
    "",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
    summary="Создать проект",
    responses={404: {"description": "Клиент не найден"}},
)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)) -> Project:
    if db.get(Client, data.client_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Клиент с id={data.client_id} не найден",
        )
    project = Project(**data.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get(
    "/{project_id}",
    response_model=ProjectDetailRead,
    summary="Получить проект с статистикой",
    responses={404: {"description": "Проект не найден"}},
)
def get_project(project_id: int, db: Session = Depends(get_db)) -> ProjectDetailRead:
    project = _get_or_404(project_id, db)
    stats = _compute_stats(project_id, db)
    return ProjectDetailRead.model_validate(
        {**project.__dict__, "stats": stats}
    )


@router.put(
    "/{project_id}",
    response_model=ProjectRead,
    summary="Обновить проект",
    responses={404: {"description": "Проект не найден"}},
)
def update_project(
    project_id: int,
    data: ProjectUpdate,
    db: Session = Depends(get_db),
) -> Project:
    project = _get_or_404(project_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Удалить проект",
    description="Проект удаляется только при отсутствии записей времени.",
    responses={
        404: {"description": "Проект не найден"},
        409: {"description": "У проекта есть записи времени"},
    },
)
def delete_project(project_id: int, db: Session = Depends(get_db)) -> None:
    project = _get_or_404(project_id, db)

    entry_count = (
        db.query(func.count(TimeEntry.id))
        .filter(TimeEntry.project_id == project_id)
        .scalar()
    )
    if entry_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Невозможно удалить проект: существует {entry_count} запис(ь/и/ей) времени. "
                "Сначала удалите записи."
            ),
        )

    db.delete(project)
    db.commit()
