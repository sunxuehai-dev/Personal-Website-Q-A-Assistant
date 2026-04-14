from __future__ import annotations

import re
from pathlib import Path

from app.agent.models import RetrievedEvidence
from app.ingestion.loader import ResumeLoader
from app.ingestion.splitter import split_resume_documents


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", "", value).lower()


class KeywordRetriever:
    def __init__(self, resume_dir: Path, doc_type: str):
        self.loader = ResumeLoader(resume_dir=resume_dir, doc_type=doc_type)
        self.resume_dir = resume_dir

    def search(self, question: str, query_terms: list[str], top_k: int = 4) -> list[RetrievedEvidence]:
        chunks = self._load_chunks()
        normalized_question = _normalize_text(question)
        scored: list[RetrievedEvidence] = []

        for chunk in chunks:
            score = self._score_chunk(chunk.page_content, normalized_question, query_terms)
            if score <= 0:
                continue
            scored.append(
                RetrievedEvidence(
                    content=chunk.page_content.strip(),
                    source_file=chunk.metadata.get("source_file"),
                    page=chunk.metadata.get("page_label", chunk.metadata.get("page")),
                    doc_type=chunk.metadata.get("doc_type"),
                    retrieval_method="keyword",
                    score=score,
                )
            )

        scored.sort(key=lambda item: item.score, reverse=True)
        return scored[:top_k]

    def _load_chunks(self):
        documents = []
        for pdf_path in sorted(self.resume_dir.glob("*.pdf")):
            documents.extend(self.loader.load_pdf(pdf_path.name))
        return split_resume_documents(documents)

    def _score_chunk(self, content: str, normalized_question: str, query_terms: list[str]) -> float:
        normalized_content = _normalize_text(content)
        if not normalized_content:
            return 0.0

        score = 0.0
        if normalized_question and normalized_question in normalized_content:
            score += 12.0

        for term in query_terms:
            normalized_term = _normalize_text(term)
            if not normalized_term:
                continue
            occurrences = normalized_content.count(normalized_term)
            if occurrences == 0:
                continue
            score += (2.0 if len(normalized_term) <= 4 else 3.0) * occurrences

        return score
