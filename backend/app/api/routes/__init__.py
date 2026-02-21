from fastapi import APIRouter

from app.api.routes.hello import router as hello_router

router = APIRouter()
router.include_router(hello_router, prefix="/hello", tags=["hello"])
