from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


class Settings:
    """Centralized application settings."""

    BASE_DIR = BASE_DIR
    APP_DIR = BASE_DIR / "app"
    DATA_DIR = BASE_DIR / "data"
    SELF_RESUME_DIR = DATA_DIR / "self_resume"
    UPLOAD_DIR = DATA_DIR / "uploads"
    CHROMA_DIR = DATA_DIR / "chroma"
    SELF_RESUME_CHROMA_DIR = CHROMA_DIR / "self_resume"
    UPLOAD_CHROMA_DIR = CHROMA_DIR / "uploaded_docs"

    HOST = os.getenv("RESUME_ASSISTANT_HOST", "127.0.0.1")
    PORT = int(os.getenv("RESUME_ASSISTANT_PORT", "8008"))
    API_BASE_URL = os.getenv("RESUME_ASSISTANT_API_BASE_URL", f"http://{HOST}:{PORT}")

    LLM_TYPE = os.getenv("LLM_TYPE", "qwen").lower()

    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL")

    DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")
    DASHSCOPE_BASE_URL = os.getenv(
        "DASHSCOPE_BASE_URL",
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
    )

    SELF_RESUME_COLLECTION_NAME = os.getenv("SELF_RESUME_COLLECTION_NAME", "self_resume_chunks")
    UPLOAD_COLLECTION_NAME = os.getenv("UPLOAD_COLLECTION_NAME", "uploaded_doc_chunks")

    CHAT_MODEL_MAP = {
        "qwen": "qwen-max",
        "openai": "gpt-4o-mini",
    }
    EMBEDDING_MODEL_MAP = {
        "qwen": "text-embedding-v3",
        "openai": "text-embedding-3-small",
    }

    @classmethod
    def ensure_directories(cls) -> None:
        """Create project data directories if they do not exist."""
        cls.DATA_DIR.mkdir(parents=True, exist_ok=True)
        cls.SELF_RESUME_DIR.mkdir(parents=True, exist_ok=True)
        cls.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        cls.CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        cls.SELF_RESUME_CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        cls.UPLOAD_CHROMA_DIR.mkdir(parents=True, exist_ok=True)
