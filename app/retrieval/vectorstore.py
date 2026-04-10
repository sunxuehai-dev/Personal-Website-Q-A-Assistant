from __future__ import annotations

from langchain_chroma import Chroma

from app.core.config import Settings
from app.core.llm import get_llm_clients


def build_vectorstore(persist_directory, collection_name: str) -> Chroma:
    Settings.ensure_directories()
    clients = get_llm_clients()
    return Chroma(
        persist_directory=str(persist_directory),
        collection_name=collection_name,
        embedding_function=clients.embedding_model,
    )


def get_resume_vectorstore() -> Chroma:
    """Return the persisted Chroma vector store for resume retrieval."""
    return build_vectorstore(Settings.SELF_RESUME_CHROMA_DIR, Settings.SELF_RESUME_COLLECTION_NAME)


def get_uploaded_vectorstore() -> Chroma:
    """Return the persisted Chroma vector store for uploaded document retrieval."""
    return build_vectorstore(Settings.UPLOAD_CHROMA_DIR, Settings.UPLOAD_COLLECTION_NAME)
