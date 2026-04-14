from __future__ import annotations

import json
from collections.abc import Iterator

from langchain_core.documents import Document

from app.agent.analysis import QueryAnalyzer
from app.agent.models import QAResponse, QueryAnalysis, RetrievedEvidence
from app.agent.planning import RetrievalPlanner
from app.agent.synthesis import ResponseSynthesizer
from app.core.config import Settings
from app.retrieval.hybrid import merge_evidences
from app.retrieval.keyword import KeywordRetriever
from app.retrieval.retriever import ResumeRetriever, UploadedDocumentRetriever


class ResumeQAService:
    """Single-document lightweight Agentic RAG service."""

    def __init__(self, top_k: int = 4):
        self.self_retriever = ResumeRetriever(top_k=top_k)
        self.upload_retriever = UploadedDocumentRetriever(top_k=top_k)
        self.self_keyword_retriever = KeywordRetriever(Settings.SELF_RESUME_DIR, "self_resume")
        self.upload_keyword_retriever = KeywordRetriever(Settings.UPLOAD_DIR, "uploaded_docs")
        self.query_analyzer = QueryAnalyzer()
        self.retrieval_planner = RetrievalPlanner()
        self.response_synthesizer = ResponseSynthesizer()

    def ask(self, question: str, use_uploaded_docs: bool = False) -> QAResponse:
        analysis, _, evidences = self._prepare(question, use_uploaded_docs=use_uploaded_docs)
        answer = self.response_synthesizer.synthesize(question, analysis, evidences)

        return QAResponse(
            answer=answer,
            references=self._build_references(evidences),
            route_target=analysis.source_scope,
            route_reason=analysis.source_reason,
            question_type=analysis.task_type,
            question_type_reason=analysis.task_reason,
        )

    def ask_stream(self, question: str, use_uploaded_docs: bool = False) -> Iterator[str]:
        analysis, _, evidences = self._prepare(question, use_uploaded_docs=use_uploaded_docs)
        for event in self.response_synthesizer.stream(question, analysis, evidences):
            yield event
        yield self._encode_stream_event(
            "meta",
            {
                "route_target": analysis.source_scope,
                "route_reason": analysis.source_reason,
                "question_type": analysis.task_type,
                "question_type_reason": analysis.task_reason,
                "references": self._build_references(evidences),
            },
        )
        yield self._encode_stream_event("done", {})

    def _prepare(self, question: str, *, use_uploaded_docs: bool):
        analysis = self.query_analyzer.analyze(
            question,
            use_uploaded_docs=use_uploaded_docs,
            has_uploaded_docs=self._has_uploaded_docs(use_uploaded_docs),
        )
        plan = self.retrieval_planner.plan(analysis)
        evidence_groups = [
            self._retrieve_for_step(
                analysis,
                source_scope=step.source_scope,
                method=step.method,
                limit=step.limit,
            )
            for step in plan.steps
        ]
        evidences = merge_evidences(
            evidence_groups,
            final_limit=plan.final_limit,
            merge_mode=plan.merge_mode,
        )
        return analysis, plan, evidences

    def _build_references(self, evidences: list[RetrievedEvidence]) -> list[dict]:
        references: list[dict] = []
        for evidence in evidences:
            references.append(
                {
                    "source_file": evidence.source_file,
                    "page": evidence.page,
                    "content": evidence.content,
                    "doc_type": evidence.doc_type,
                    "retrieval_method": evidence.retrieval_method,
                    "score": round(evidence.score, 4),
                }
            )
        return references

    def _has_uploaded_docs(self, use_uploaded_docs: bool) -> bool:
        return use_uploaded_docs and any(Settings.UPLOAD_DIR.glob("*.pdf"))

    def _dense_to_evidences(
        self,
        documents_with_scores: list[tuple[Document, float]],
        *,
        retrieval_method: str,
    ) -> list[RetrievedEvidence]:
        evidences: list[RetrievedEvidence] = []
        for document, distance in documents_with_scores:
            score = 1.0 / (1.0 + max(distance, 0.0))
            evidences.append(
                RetrievedEvidence(
                    content=document.page_content.strip(),
                    source_file=document.metadata.get("source_file"),
                    page=document.metadata.get("page_label", document.metadata.get("page")),
                    doc_type=document.metadata.get("doc_type"),
                    retrieval_method=retrieval_method,
                    score=score,
                )
            )
        return evidences

    def _retrieve_for_step(
        self,
        analysis: QueryAnalysis,
        *,
        source_scope: str,
        method: str,
        limit: int,
    ) -> list[RetrievedEvidence]:
        if source_scope == "self_resume":
            if method == "dense":
                return self._dense_to_evidences(
                    self.self_retriever.similarity_search_with_scores(analysis.question, top_k=limit),
                    retrieval_method="dense",
                )
            return self.self_keyword_retriever.search(analysis.question, analysis.query_terms, top_k=limit)

        if method == "dense":
            return self._dense_to_evidences(
                self.upload_retriever.similarity_search_with_scores(analysis.question, top_k=limit),
                retrieval_method="dense",
            )
        return self.upload_keyword_retriever.search(analysis.question, analysis.query_terms, top_k=limit)

    def _encode_stream_event(self, event_type: str, payload: dict) -> str:
        return f"data: {json.dumps({'type': event_type, **payload}, ensure_ascii=False)}\n\n"
