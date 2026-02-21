
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import PaginationParams  # noqa: F401 (imported for consistency)
from app.db.database import get_db
from app.models.lawyer_profile import LawyerProfile
from app.schemas.profile import LawyerProfileRead, LawyerProfileUpdate

router = APIRouter()

_REQUIRED_FIELDS = [
    "full_name",
    "company_name",
    "inn",
    "address",
    "bank_name",
    "bik",
    "checking_account",
    "correspondent_account",
    "email",
    "phone",
    "default_hourly_rate",
]


@router.get(
    "",
    response_model=LawyerProfileRead,
    summary="Получить профиль юриста",
    responses={404: {"description": "Профиль ещё не создан"}},
)
def get_profile(db: Session = Depends(get_db)) -> LawyerProfile:
    profile = db.query(LawyerProfile).first()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Профиль не найден. Создайте его через PUT /profile",
        )
    return profile


@router.put(
    "",
    response_model=LawyerProfileRead,
    summary="Создать или обновить профиль юриста",
    description=(
        "Если профиль не существует — создаёт новый (все обязательные поля должны быть переданы). "
        "Если профиль существует — обновляет только переданные поля."
    ),
)
def upsert_profile(
    data: LawyerProfileUpdate,
    db: Session = Depends(get_db),
) -> LawyerProfile:
    profile = db.query(LawyerProfile).first()

    if profile is None:
        # Creating for the first time — validate all required fields are present
        payload = data.model_dump(exclude_unset=True)
        missing = [f for f in _REQUIRED_FIELDS if f not in payload or payload[f] is None]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"При создании профиля обязательны поля: {', '.join(missing)}",
            )
        profile = LawyerProfile(**payload)
        db.add(profile)
    else:
        # Partial update — apply only provided fields
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile
