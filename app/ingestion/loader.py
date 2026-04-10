from __future__ import annotations

from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document

from app.core.config import Settings


class ResumeLoader:
    """Load resume PDFs from the local resume data directory."""

    def __init__(self, resume_dir: Path | None = None, doc_type: str = "self_resume"):
        self.resume_dir = resume_dir or Settings.SELF_RESUME_DIR
        self.doc_type = doc_type

    def resolve_path(self, file_name: str) -> Path:
        path = self.resume_dir / file_name
        if not path.exists():
            raise FileNotFoundError(f"Resume file not found: {path}")
        return path

    def load_pdf(self, file_name: str) -> list[Document]:
        path = self.resolve_path(file_name)
        documents = PyPDFLoader(str(path)).load()
        for document in documents:
            metadata = dict(document.metadata or {})
            metadata["source_file"] = path.name
            metadata["doc_type"] = self.doc_type
            document.metadata = metadata
        return documents
