import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.config import settings
from app.database import SessionLocal, init_db
from app.services.seed_service import seed_masters

logger = logging.getLogger("uvicorn.error")


def _log(line: str) -> None:
    """Always visible in the uvicorn terminal (Windows --reload safe)."""
    print(line, file=sys.stderr, flush=True)
    logger.info(line)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        seed_masters(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Tradeswift Commodity ERP API",
    description="Masters module — physical commodity trading",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    response = await call_next(request)
    _log(f"API {request.method} {request.url.path} -> {response.status_code}")
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    _log(f"API error {exc.status_code}: {exc.detail}")
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


app.include_router(api_router)


@app.get("/")
def root():
    return {"app": settings.app_name, "docs": "/docs", "health": "/api/v1/health"}


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}
