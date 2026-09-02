from fastapi import APIRouter

from app.api.v1.bills import router as bills_router
from app.api.v1.contracts import router as contracts_router
from app.api.v1.despatches import router as despatches_router
from app.api.v1.masters import router as masters_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(masters_router)
api_router.include_router(contracts_router)
api_router.include_router(despatches_router)
api_router.include_router(bills_router)
