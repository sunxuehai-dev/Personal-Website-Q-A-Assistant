from __future__ import annotations

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router as api_router
from app.core.config import Settings
from app.web.routes import router as web_router


def _infer_error_code(status_code: int, message: str) -> str:
    lowered = message.lower()
    if status_code == 400:
        return "bad_request"
    if status_code == 404:
        return "not_found"
    if status_code == 409:
        return "conflict"
    if status_code == 413:
        return "payload_too_large"
    if status_code == 422:
        return "validation_failed"
    if status_code == 429:
        return "rate_limited"
    if status_code >= 500 and ("timeout" in lowered or "timed out" in lowered):
        return "model_timeout"
    if status_code >= 500:
        return "internal_error"
    return "request_failed"


def _is_retryable(status_code: int) -> bool:
    return status_code in {409, 429} or status_code >= 500


def _error_response(status_code: int, message: str, *, code: str | None = None, retryable: bool | None = None, errors=None):
    error_code = code or _infer_error_code(status_code, message)
    should_retry = _is_retryable(status_code) if retryable is None else retryable
    payload = {
        "detail": message,
        "error": {
            "code": error_code,
            "message": message,
            "retryable": should_retry,
            "status_code": status_code,
        },
    }
    if errors is not None:
        payload["errors"] = errors
    return JSONResponse(status_code=status_code, content=payload)


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
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return _error_response(
            422,
            "Request validation failed.",
            code="validation_failed",
            retryable=False,
            errors=exc.errors(),
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        detail = exc.detail
        if isinstance(detail, dict):
            message = str(detail.get("message") or detail.get("detail") or "Request failed.")
            code = detail.get("code")
            retryable = detail.get("retryable")
        else:
            message = str(detail or "Request failed.")
            code = None
            retryable = None
        return _error_response(exc.status_code, message, code=code, retryable=retryable)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        message = str(exc) if Settings.DEBUG else "Internal server error."
        return _error_response(500, message, code="internal_error", retryable=True)

    app.include_router(api_router)
    app.include_router(web_router)
    app.mount("/static", StaticFiles(directory=str(Settings.BASE_DIR / "static")), name="static")
    return app


app = create_app()


if __name__ == "__main__":
    uvicorn.run("app.main:app", host=Settings.HOST, port=Settings.PORT, reload=False)
