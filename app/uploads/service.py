from __future__ import annotations

from pathlib import Path

import chromadb

from app.core.config import Settings


class UploadKnowledgeBaseService:
    """Manage uploaded PDFs and their vector store lifecycle."""

    def __init__(self):
        Settings.ensure_directories()

    def list_uploaded_files(self) -> list[Path]:
        return sorted(Settings.UPLOAD_DIR.glob("*.pdf"))

    def has_uploaded_files(self) -> bool:
        return any(Settings.UPLOAD_DIR.glob("*.pdf"))

    def get_status(self) -> dict:
        files = self.list_uploaded_files()
        return {
            "has_uploaded_docs": bool(files),
            "file_count": len(files),
            "files": [file.name for file in files],
            "active_file": files[-1].name if files else None,
        }

    def clear_files(self) -> None:
        for file in self.list_uploaded_files():
            file.unlink(missing_ok=True)

    def clear_vectorstore(self) -> None:
        chroma_client = chromadb.PersistentClient(path=str(Settings.UPLOAD_CHROMA_DIR))
        try:
            chroma_client.delete_collection(Settings.UPLOAD_COLLECTION_NAME)
        except Exception:
            pass

    def reset(self) -> dict:
        self.clear_files()
        self.clear_vectorstore()
        return self.get_status()
