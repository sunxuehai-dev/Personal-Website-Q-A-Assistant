from __future__ import annotations

from langchain_core.documents import Document

from app.retrieval.vectorstore import get_resume_vectorstore, get_uploaded_vectorstore


class ResumeRetriever:
    """Thin retrieval layer around the resume vector store."""

    def __init__(self, top_k: int = 4):
        self.top_k = top_k
        self.vectorstore = get_resume_vectorstore()

    def similarity_search(self, query: str, top_k: int | None = None) -> list[Document]:
        k = top_k or self.top_k
        return self.vectorstore.similarity_search(query, k=k)

    def similarity_search_with_scores(self, query: str, top_k: int | None = None) -> list[tuple[Document, float]]:
        k = top_k or self.top_k
        return self.vectorstore.similarity_search_with_score(query, k=k)

    def format_context(self, documents: list[Document]) -> str:
        """Convert retrieved chunks into a prompt-friendly context string."""
        sections: list[str] = []
        for index, document in enumerate(documents, start=1):
            source_file = document.metadata.get("source_file", "unknown")
            page = document.metadata.get("page_label", document.metadata.get("page", ""))
            header = f"[Chunk {index}] source={source_file}"
            if page != "":
                header += f" page={page}"
            sections.append(f"{header}\n{document.page_content}")
        return "\n\n".join(sections)


class UploadedDocumentRetriever(ResumeRetriever):
    """Thin retrieval layer around the uploaded-document vector store."""

    def __init__(self, top_k: int = 4):
        self.top_k = top_k
        self.vectorstore = get_uploaded_vectorstore()
