from fastapi import APIRouter

from app.api.routes.hello import router as hello_router
from app.api.routes.profile import router as profile_router
from app.api.routes.clients import router as clients_router
from app.api.routes.projects import router as projects_router
from app.api.routes.time_entries import router as time_entries_router
from app.api.routes.invoices import router as invoices_router

router = APIRouter()

router.include_router(hello_router, prefix="/hello", tags=["hello"])
router.include_router(profile_router, prefix="/profile", tags=["Профиль юриста"])
router.include_router(clients_router, prefix="/clients", tags=["Клиенты"])
router.include_router(projects_router, prefix="/projects", tags=["Проекты"])
router.include_router(time_entries_router, prefix="/time-entries", tags=["Записи времени"])
router.include_router(invoices_router, prefix="/invoices", tags=["Счета"])
