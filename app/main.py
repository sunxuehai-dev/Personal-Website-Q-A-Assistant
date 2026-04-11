from __future__ import annotations

import uvicorn
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
        debug=Settings.DEBUG,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=Settings.CORS_ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=Settings.ALLOWED_HOSTS if Settings.is_production() else ["*"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "detail": "Request validation failed.",
                "errors": exc.errors(),
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request, exc: Exception):
        message = str(exc) if Settings.DEBUG else "Internal server error."
        return JSONResponse(
            status_code=500,
            content={"detail": message},
        )

    app.include_router(api_router)
    app.include_router(web_router)
    app.mount("/static", StaticFiles(directory=str(Settings.BASE_DIR / "static")), name="static")
    return app


app = create_app()


if __name__ == "__main__":
    uvicorn.run("app.main:app", host=Settings.HOST, port=Settings.PORT, reload=False)
