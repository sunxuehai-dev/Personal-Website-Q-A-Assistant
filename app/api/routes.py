from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.agent.service import ResumeQAService
from app.core.config import Settings
from app.ingestion.pipeline import ResumeIngestionPipeline
from app.uploads.service import UploadKnowledgeBaseService

router = APIRouter()


def _normalize_chat_error(exc: Exception) -> str:
    message = str(exc).strip() or exc.__class__.__name__
    lowered = message.lower()
    if "timed out" in lowered or "timeout" in lowered:
        return (
            "Model request timed out. "
            f"Try a shorter question, wait a moment, or increase LLM_TIMEOUT_SECONDS (current: {Settings.LLM_TIMEOUT_SECONDS}s)."
        )
    return f"Chat failed: {message}"


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, description="Question about the resume")
    use_uploaded_docs: bool = False


class ChatResponse(BaseModel):
    answer: str
    references: list[dict]
    route: str
    route_reason: str
    response_mode: str
    source_badge: str
    local_task_type: str | None = None
    local_task_reason: str | None = None


class UploadResponse(BaseModel):
    file_name: str
    chunk_count: int
    collection_name: str


class UploadStatusResponse(BaseModel):
    has_uploaded_docs: bool
    file_count: int
    files: list[str]
    active_file: str | None


upload_kb_service = UploadKnowledgeBaseService()


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


@router.delete("/upload_status", response_model=UploadStatusResponse)
def clear_uploaded_docs() -> UploadStatusResponse:
    return UploadStatusResponse(**upload_kb_service.reset())


@router.post("/upload_resume", response_model=UploadResponse)
async def upload_resume(file: UploadFile = File(...)) -> UploadResponse:
    Settings.ensure_directories()

    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name.")

    suffix = Path(file.filename).suffix.lower()
    if suffix != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF resumes are supported.")

    content = await file.read()
    if len(content) > Settings.get_upload_size_limit_bytes():
        raise HTTPException(
            status_code=413,
            detail=f"Uploaded PDF exceeds {Settings.MAX_UPLOAD_SIZE_MB} MB limit.",
        )

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
    return UploadResponse(**result)


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    resume_files = list(Settings.SELF_RESUME_DIR.glob("*.pdf"))
    if not resume_files:
        raise HTTPException(status_code=400, detail="No self resume has been ingested yet.")

    try:
        response = ResumeQAService().ask(question, use_uploaded_docs=payload.use_uploaded_docs)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=_normalize_chat_error(exc)) from exc

    return ChatResponse(
        answer=response.answer,
        references=response.references,
        route=response.route,
        route_reason=response.route_reason,
        response_mode=response.response_mode,
        source_badge=response.source_badge,
        local_task_type=response.local_task_type,
        local_task_reason=response.local_task_reason,
    )


@router.post("/chat_stream")
def chat_stream(payload: ChatRequest) -> StreamingResponse:
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    resume_files = list(Settings.SELF_RESUME_DIR.glob("*.pdf"))
    if not resume_files:
        raise HTTPException(status_code=400, detail="No self resume has been ingested yet.")

    try:
        stream = ResumeQAService().ask_stream(question, use_uploaded_docs=payload.use_uploaded_docs)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=_normalize_chat_error(exc)) from exc

    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
