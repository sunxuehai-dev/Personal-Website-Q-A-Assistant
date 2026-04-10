from __future__ import annotations

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router as api_router
from app.core.config import Settings
from app.web.routes import router as web_router


def create_app() -> FastAPI:
    Settings.ensure_directories()

    app = FastAPI(
        title="Resume Assistant API",
        description="A resume-focused retrieval QA backend.",
        version="0.1.0",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)
    app.include_router(web_router)
    app.mount("/static", StaticFiles(directory=str(Settings.BASE_DIR / "static")), name="static")
    return app


app = create_app()


if __name__ == "__main__":
    uvicorn.run("app.main:app", host=Settings.HOST, port=Settings.PORT, reload=False)
