from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


def _split_env_list(value: str | None, default: list[str]) -> list[str]:
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    """Centralized application settings."""

    BASE_DIR = BASE_DIR
    APP_DIR = BASE_DIR / "app"
    FRONTEND_DIR = BASE_DIR / "frontend"
    FRONTEND_DIST_DIR = FRONTEND_DIR / "dist"
    HOME_RENDER_MODE = os.getenv("HOME_RENDER_MODE", "legacy").lower()
    DATA_DIR = BASE_DIR / "data"
    SELF_RESUME_DIR = DATA_DIR / "self_resume"
    UPLOAD_DIR = DATA_DIR / "uploads"
    CHROMA_DIR = DATA_DIR / "chroma"
    SELF_RESUME_CHROMA_DIR = CHROMA_DIR / "self_resume"
    UPLOAD_CHROMA_DIR = CHROMA_DIR / "uploaded_docs"

    HOST = os.getenv("RESUME_ASSISTANT_HOST", "127.0.0.1")
    PORT = int(os.getenv("RESUME_ASSISTANT_PORT", "8008"))
    API_BASE_URL = os.getenv("RESUME_ASSISTANT_API_BASE_URL", f"http://{HOST}:{PORT}")
    ENVIRONMENT = os.getenv("RESUME_ASSISTANT_ENV", "development").lower()
    DEBUG = ENVIRONMENT != "production"
    MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "15"))
    LLM_TIMEOUT_SECONDS = int(os.getenv("LLM_TIMEOUT_SECONDS", "180"))
    LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "3"))
    SESSION_MEMORY_MAX_TURNS = int(os.getenv("SESSION_MEMORY_MAX_TURNS", "4"))

    LLM_TYPE = os.getenv("LLM_TYPE", "qwen").lower()

    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL")

    DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")
    DASHSCOPE_BASE_URL = os.getenv(
        "DASHSCOPE_BASE_URL",
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
    )
    QWEN_CHAT_MODEL = os.getenv("QWEN_CHAT_MODEL", "qwen-plus")
    QWEN_EMBEDDING_MODEL = os.getenv("QWEN_EMBEDDING_MODEL", "text-embedding-v3")
    OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
    OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

    SELF_RESUME_COLLECTION_NAME = os.getenv("SELF_RESUME_COLLECTION_NAME", "self_resume_chunks")
    UPLOAD_COLLECTION_NAME = os.getenv("UPLOAD_COLLECTION_NAME", "uploaded_doc_chunks")

    CHAT_MODEL_MAP = {
        "qwen": QWEN_CHAT_MODEL,
        "openai": OPENAI_CHAT_MODEL,
    }
    EMBEDDING_MODEL_MAP = {
        "qwen": QWEN_EMBEDDING_MODEL,
        "openai": OPENAI_EMBEDDING_MODEL,
    }

    CORS_ALLOWED_ORIGINS = _split_env_list(
        os.getenv("CORS_ALLOWED_ORIGINS"),
        ["http://127.0.0.1:8008", "http://localhost:8008"],
    )
    ALLOWED_HOSTS = _split_env_list(
        os.getenv("ALLOWED_HOSTS"),
        ["127.0.0.1", "localhost"],
    )

    @classmethod
    def ensure_directories(cls) -> None:
        """Create project data directories if they do not exist."""
        cls.DATA_DIR.mkdir(parents=True, exist_ok=True)
        cls.SELF_RESUME_DIR.mkdir(parents=True, exist_ok=True)
        cls.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        cls.CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        cls.SELF_RESUME_CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        cls.UPLOAD_CHROMA_DIR.mkdir(parents=True, exist_ok=True)

    @classmethod
    def get_upload_size_limit_bytes(cls) -> int:
        return cls.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    @classmethod
    def is_production(cls) -> bool:
        return cls.ENVIRONMENT == "production"

    @classmethod
    def use_frontend_as_home(cls) -> bool:
        return cls.HOME_RENDER_MODE == "frontend"
