from __future__ import annotations

import chromadb
from langchain_chroma import Chroma
from langchain_core.documents import Document

from app.core.config import Settings
from app.core.llm import get_llm_clients
from app.ingestion.loader import ResumeLoader
from app.ingestion.splitter import split_resume_documents


class ResumeIngestionPipeline:
    """End-to-end resume ingestion: load, split, and store in Chroma."""

    def __init__(
        self,
        resume_dir=None,
        persist_directory=None,
        collection_name: str | None = None,
        doc_type: str = "self_resume",
    ):
        Settings.ensure_directories()
        self.loader = ResumeLoader(resume_dir=resume_dir, doc_type=doc_type)
        self.persist_directory = persist_directory or Settings.SELF_RESUME_CHROMA_DIR
        self.collection_name = collection_name or Settings.SELF_RESUME_COLLECTION_NAME

    def load_and_split(self, file_name: str) -> list[Document]:
        documents = self.loader.load_pdf(file_name)
        return split_resume_documents(documents)

    def ingest(self, file_name: str) -> dict:
        chunks = self.load_and_split(file_name)
        clients = get_llm_clients()

        chroma_client = chromadb.PersistentClient(path=str(self.persist_directory))
        try:
            chroma_client.delete_collection(self.collection_name)
        except Exception:
            pass

        vectorstore = Chroma(
            persist_directory=str(self.persist_directory),
            collection_name=self.collection_name,
            embedding_function=clients.embedding_model,
        )
        vectorstore.add_documents(chunks)

        return {
            "file_name": file_name,
            "chunk_count": len(chunks),
            "collection_name": self.collection_name,
        }
