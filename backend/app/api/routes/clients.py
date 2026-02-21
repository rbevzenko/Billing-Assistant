
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import PaginationParams
from app.db.database import get_db
from app.models.client import Client
from app.schemas.client import ClientCreate, ClientRead, ClientUpdate
from app.schemas.common import Page

router = APIRouter()


def _get_or_404(client_id: int, db: Session) -> Client:
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Клиент с id={client_id} не найден",
        )
    return client


@router.get(
    "",
    response_model=Page[ClientRead],
    summary="Список клиентов",
)
def list_clients(
    search: str | None = Query(None, description="Поиск по названию клиента"),
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
) -> Page[ClientRead]:
    q = db.query(Client)
    if search:
        q = q.filter(Client.name.ilike(f"%{search}%"))
    total = q.count()
    items = q.order_by(Client.name).offset(pagination.offset).limit(pagination.size).all()
    return Page.create(items=items, total=total, page=pagination.page, size=pagination.size)


@router.post(
    "",
    response_model=ClientRead,
    status_code=status.HTTP_201_CREATED,
    summary="Создать клиента",
)
def create_client(data: ClientCreate, db: Session = Depends(get_db)) -> Client:
    client = Client(**data.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.get(
    "/{client_id}",
    response_model=ClientRead,
    summary="Получить клиента",
    responses={404: {"description": "Клиент не найден"}},
)
def get_client(client_id: int, db: Session = Depends(get_db)) -> Client:
    return _get_or_404(client_id, db)


@router.put(
    "/{client_id}",
    response_model=ClientRead,
    summary="Обновить клиента",
    responses={404: {"description": "Клиент не найден"}},
)
def update_client(
    client_id: int,
    data: ClientUpdate,
    db: Session = Depends(get_db),
) -> Client:
    client = _get_or_404(client_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client


@router.delete(
    "/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Удалить клиента",
    description="Клиент удаляется только при отсутствии проектов.",
    responses={
        404: {"description": "Клиент не найден"},
        409: {"description": "У клиента есть проекты"},
    },
)
def delete_client(client_id: int, db: Session = Depends(get_db)) -> None:
    client = _get_or_404(client_id, db)

    if client.projects:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Невозможно удалить клиента: у него есть {len(client.projects)} проект(а/ов). "
                "Сначала удалите или переназначьте проекты."
            ),
        )

    db.delete(client)
    db.commit()
