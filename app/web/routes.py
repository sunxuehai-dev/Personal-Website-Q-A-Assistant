from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.templating import Jinja2Templates

from app.core.config import Settings


router = APIRouter()
templates = Jinja2Templates(directory=str(Settings.BASE_DIR / "templates"))


def _frontend_dist_file(path: str = "index.html") -> Path:
    return Settings.FRONTEND_DIST_DIR / path


def _frontend_index_response() -> FileResponse:
    index_file = _frontend_dist_file()
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Frontend build not found.")
    return FileResponse(index_file)


@router.get("/", response_class=HTMLResponse)
def home(request: Request) -> HTMLResponse:
    if Settings.use_frontend_as_home():
        return _frontend_index_response()
    return templates.TemplateResponse(
        request,
        "index.html",
        {
            "request": request,
        },
    )


@router.get("/frontend", response_class=HTMLResponse)
def frontend_home() -> FileResponse:
    return _frontend_index_response()


@router.get("/frontend/{asset_path:path}")
def frontend_assets(asset_path: str) -> FileResponse:
    requested = _frontend_dist_file(asset_path)
    if requested.is_file():
        return FileResponse(requested)

    return _frontend_index_response()
