import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.config import settings
from app.services.uploads import uploads_root
from app.services.webkassa import fiscal_retry_loop


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(fiscal_retry_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix="/api/v1")
uploads_root()
app.mount("/uploads", StaticFiles(directory=Path(settings.upload_dir)), name="uploads")


@app.get("/health")
async def health():
    return {"status": "ok"}
