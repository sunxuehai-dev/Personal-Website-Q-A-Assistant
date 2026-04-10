from __future__ import annotations

from pathlib import Path
import shutil

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.agent.service import ResumeQAService
from app.core.config import Settings
from app.ingestion.pipeline import ResumeIngestionPipeline

router = APIRouter()


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, description="Question about the resume")
    use_uploaded_docs: bool = False


class ChatResponse(BaseModel):
    answer: str
    references: list[dict]
    route_target: str
    route_reason: str


class UploadResponse(BaseModel):
    file_name: str
    chunk_count: int
    collection_name: str


@router.get("/health")
def health_check() -> dict:
    Settings.ensure_directories()
    return {
        "status": "ok",
        "self_resume_dir": str(Settings.SELF_RESUME_DIR),
        "self_resume_collection": Settings.SELF_RESUME_COLLECTION_NAME,
        "upload_dir": str(Settings.UPLOAD_DIR),
        "upload_collection": Settings.UPLOAD_COLLECTION_NAME,
        "llm_type": Settings.LLM_TYPE,
        "chat_model": Settings.CHAT_MODEL_MAP.get(Settings.LLM_TYPE),
        "embedding_model": Settings.EMBEDDING_MODEL_MAP.get(Settings.LLM_TYPE),
    }


@router.post("/upload_resume", response_model=UploadResponse)
async def upload_resume(file: UploadFile = File(...)) -> UploadResponse:
    Settings.ensure_directories()

    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name.")

    suffix = Path(file.filename).suffix.lower()
    if suffix != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF resumes are supported.")

    target_path = Settings.UPLOAD_DIR / Path(file.filename).name
    with target_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

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
        raise HTTPException(status_code=500, detail=f"Chat failed: {exc}") from exc

    return ChatResponse(
        answer=response.answer,
        references=response.references,
        route_target=response.route_target,
        route_reason=response.route_reason,
    )
