from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.agent.service import ResumeQAService
from app.core.config import Settings
from app.ingestion.pipeline import ResumeIngestionPipeline
from app.memory.service import session_memory_service
from app.runtime.guards import BusyError, chat_guard, upload_guard
from app.uploads.service import UploadKnowledgeBaseService
from app.web.content import get_site_content

router = APIRouter()


def _error_payload(message: str, *, code: str, retryable: bool) -> dict:
    return {
        "message": message,
        "code": code,
        "retryable": retryable,
    }


def _api_http_exception(status_code: int, *, message: str, code: str, retryable: bool) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail=_error_payload(message, code=code, retryable=retryable),
    )


def _normalize_chat_error(exc: Exception) -> str:
    message = str(exc).strip() or exc.__class__.__name__
    lowered = message.lower()
    if "timed out" in lowered or "timeout" in lowered:
        return (
            "Model request timed out. "
            f"Try a shorter question, wait a moment, or increase LLM_TIMEOUT_SECONDS (current: {Settings.LLM_TIMEOUT_SECONDS}s)."
        )
    return f"Chat failed: {message}"


def _busy_http_exception(exc: BusyError, status_code: int = 429) -> HTTPException:
    code = "upload_busy" if status_code == 409 else "chat_capacity_full"
    return _api_http_exception(
        status_code,
        message=str(exc),
        code=code,
        retryable=True,
    )


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, description="Question about the resume")
    use_uploaded_docs: bool = False
    session_id: str | None = Field(default=None, max_length=128)


class ChatResponse(BaseModel):
    answer: str
    references: list["ReferenceItem"]
    source_badge: str
    used_local_context: bool
    used_web_search: bool
    retried: bool


class UploadResponse(BaseModel):
    file_name: str
    chunk_count: int
    collection_name: str


class UploadStatusResponse(BaseModel):
    has_uploaded_docs: bool
    file_count: int
    files: list[str]
    active_file: str | None


class SessionResetResponse(BaseModel):
    session_id: str
    cleared_message_count: int


class RuntimeStatusResponse(BaseModel):
    chat: "ChatRuntimeSnapshot"
    upload: "UploadRuntimeSnapshot"


class ReferenceItem(BaseModel):
    source_kind: str
    source_file: str | None
    page: str | int | None
    content: str
    doc_type: str | None
    retrieval_method: str
    score: float


class ChatRuntimeSnapshot(BaseModel):
    active: int
    max_concurrent: int
    available: int
    busy: bool


class UploadRuntimeSnapshot(BaseModel):
    busy: bool


class SiteProfileResponse(BaseModel):
    name: str
    title: str
    tagline: str
    location: str
    email: str
    phone: str


class ExperienceItemResponse(BaseModel):
    period: str
    company: str
    role: str
    summary: str


class ProjectItemResponse(BaseModel):
    name: str
    stack: str
    description: str


class SiteContentResponse(BaseModel):
    profile: SiteProfileResponse
    experience: list[ExperienceItemResponse]
    projects: list[ProjectItemResponse]
    skills: list[str]


upload_kb_service = UploadKnowledgeBaseService()


def _build_runtime_status() -> dict:
    return {
        "chat": chat_guard.snapshot(),
        "upload": upload_guard.snapshot(),
    }


@router.get("/health")
def health_check() -> dict:
    Settings.ensure_directories()
    return {
        "status": "ok",
        "environment": Settings.ENVIRONMENT,
        "self_resume_dir": str(Settings.SELF_RESUME_DIR),
        "self_resume_collection": Settings.SELF_RESUME_COLLECTION_NAME,
        "upload_dir": str(Settings.UPLOAD_DIR),
        "upload_collection": Settings.UPLOAD_COLLECTION_NAME,
        "llm_type": Settings.LLM_TYPE,
        "chat_model": Settings.CHAT_MODEL_MAP.get(Settings.LLM_TYPE),
        "embedding_model": Settings.EMBEDDING_MODEL_MAP.get(Settings.LLM_TYPE),
        "upload_status": upload_kb_service.get_status(),
        "runtime_status": _build_runtime_status(),
    }


@router.get("/ready")
def readiness_check() -> dict:
    Settings.ensure_directories()
    resume_files = sorted(Settings.SELF_RESUME_DIR.glob("*.pdf"))
    llm_ready = bool(Settings.DASHSCOPE_API_KEY) if Settings.LLM_TYPE == "qwen" else bool(Settings.OPENAI_API_KEY)
    ready = bool(resume_files) and llm_ready
    return {
        "status": "ready" if ready else "not_ready",
        "checks": {
            "has_self_resume_pdf": bool(resume_files),
            "llm_credentials_configured": llm_ready,
            "environment": Settings.ENVIRONMENT,
        },
    }


@router.get("/upload_status", response_model=UploadStatusResponse)
def upload_status() -> UploadStatusResponse:
    return UploadStatusResponse(**upload_kb_service.get_status())


@router.get("/runtime_status", response_model=RuntimeStatusResponse)
def runtime_status() -> RuntimeStatusResponse:
    return RuntimeStatusResponse(**_build_runtime_status())


@router.get("/site_content", response_model=SiteContentResponse)
def site_content() -> SiteContentResponse:
    return SiteContentResponse(**get_site_content())


@router.delete("/upload_status", response_model=UploadStatusResponse)
def clear_uploaded_docs() -> UploadStatusResponse:
    return UploadStatusResponse(**upload_kb_service.reset())


@router.delete("/session/{session_id}", response_model=SessionResetResponse)
def clear_session(session_id: str) -> SessionResetResponse:
    normalized_session_id = session_id.strip()
    cleared = session_memory_service.clear_session(normalized_session_id)
    return SessionResetResponse(session_id=normalized_session_id, cleared_message_count=cleared)


@router.post("/upload_resume", response_model=UploadResponse)
async def upload_resume(file: UploadFile = File(...)) -> UploadResponse:
    Settings.ensure_directories()

    if not file.filename:
        raise _api_http_exception(400, message="Missing file name.", code="missing_file_name", retryable=False)

    suffix = Path(file.filename).suffix.lower()
    if suffix != ".pdf":
        raise _api_http_exception(400, message="Only PDF resumes are supported.", code="unsupported_file_type", retryable=False)

    content = await file.read()
    if len(content) > Settings.get_upload_size_limit_bytes():
        raise _api_http_exception(
            413,
            message=f"Uploaded PDF exceeds {Settings.MAX_UPLOAD_SIZE_MB} MB limit.",
            code="upload_too_large",
            retryable=False,
        )

    try:
        with upload_guard.acquire():
            upload_kb_service.reset()
            target_path = Settings.UPLOAD_DIR / Path(file.filename).name
            with target_path.open("wb") as buffer:
                buffer.write(content)

            result = ResumeIngestionPipeline(
                resume_dir=Settings.UPLOAD_DIR,
                persist_directory=Settings.UPLOAD_CHROMA_DIR,
                collection_name=Settings.UPLOAD_COLLECTION_NAME,
                doc_type="uploaded_docs",
            ).ingest(target_path.name)
    except BusyError as exc:
        raise _busy_http_exception(exc, status_code=409) from exc

    return UploadResponse(**result)


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    question = payload.question.strip()
    if not question:
        raise _api_http_exception(400, message="Question cannot be empty.", code="empty_question", retryable=False)

    resume_files = list(Settings.SELF_RESUME_DIR.glob("*.pdf"))
    if not resume_files:
        raise _api_http_exception(
            400,
            message="No self resume has been ingested yet.",
            code="self_resume_missing",
            retryable=False,
        )

    session_id = (payload.session_id or "").strip() or None

    try:
        with chat_guard.acquire():
            response = ResumeQAService().ask(
                question,
                use_uploaded_docs=payload.use_uploaded_docs,
                session_id=session_id,
            )
    except BusyError as exc:
        raise _busy_http_exception(exc) from exc
    except Exception as exc:
        normalized = _normalize_chat_error(exc)
        error_code = "model_timeout" if "timed out" in normalized.lower() or "timeout" in normalized.lower() else "chat_failed"
        raise _api_http_exception(500, message=normalized, code=error_code, retryable=True) from exc

    return ChatResponse(
        answer=response.answer,
        references=response.references,
        source_badge=response.source_badge,
        used_local_context=response.used_local_context,
        used_web_search=response.used_web_search,
        retried=response.retried,
    )


@router.post("/chat_stream")
def chat_stream(payload: ChatRequest) -> StreamingResponse:
    question = payload.question.strip()
    if not question:
        raise _api_http_exception(400, message="Question cannot be empty.", code="empty_question", retryable=False)

    resume_files = list(Settings.SELF_RESUME_DIR.glob("*.pdf"))
    if not resume_files:
        raise _api_http_exception(
            400,
            message="No self resume has been ingested yet.",
            code="self_resume_missing",
            retryable=False,
        )

    session_id = (payload.session_id or "").strip() or None

    try:
        guard_context = chat_guard.acquire()
        guard_context.__enter__()
        stream = ResumeQAService().ask_stream(
            question,
            use_uploaded_docs=payload.use_uploaded_docs,
            session_id=session_id,
        )
    except Exception as exc:
        if isinstance(exc, BusyError):
            raise _busy_http_exception(exc) from exc
        try:
            guard_context.__exit__(None, None, None)
        except Exception:
            pass
        normalized = _normalize_chat_error(exc)
        error_code = "model_timeout" if "timed out" in normalized.lower() or "timeout" in normalized.lower() else "chat_failed"
        raise _api_http_exception(500, message=normalized, code=error_code, retryable=True) from exc

    def guarded_stream():
        try:
            yield from stream
        finally:
            guard_context.__exit__(None, None, None)

    return StreamingResponse(
        guarded_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
