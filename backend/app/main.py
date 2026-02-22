from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import router
from app.db.database import engine, Base


def _create_tables() -> None:
    """Import all models so SQLAlchemy registers them, then create tables."""
    import app.models.client  # noqa: F401
    import app.models.lawyer_profile  # noqa: F401
    import app.models.project  # noqa: F401
    import app.models.time_entry  # noqa: F401
    import app.models.invoice  # noqa: F401
    import app.models.invoice_item  # noqa: F401
    Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _create_tables()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Billing Assistant — учёт рабочего времени и биллинг юриста",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/health")
def health_check():
    return {"status": "ok", "service": settings.PROJECT_NAME}
