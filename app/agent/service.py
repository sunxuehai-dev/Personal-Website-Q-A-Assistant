from __future__ import annotations

import json
from collections.abc import Iterator

from langchain_core.documents import Document

from app.agent.analysis import QueryAnalyzer
from app.agent.models import QAResponse, QueryAnalysis, RetrievedEvidence, RouterDecision, WebSearchResult
from app.agent.planning import RetrievalPlanner
from app.agent.router import QueryRouter
from app.agent.synthesis import ResponseSynthesizer
from app.agent.web_search import WebSearchService
from app.core.config import Settings
from app.retrieval.hybrid import merge_evidences
from app.retrieval.keyword import KeywordRetriever
from app.retrieval.retriever import ResumeRetriever, UploadedDocumentRetriever


class ResumeQAService:
    """Lightweight orchestrated assistant for local RAG and web search."""

    def __init__(self, top_k: int = 4):
        self.self_retriever = ResumeRetriever(top_k=top_k)
        self.upload_retriever = UploadedDocumentRetriever(top_k=top_k)
        self.self_keyword_retriever = KeywordRetriever(Settings.SELF_RESUME_DIR, "self_resume")
        self.upload_keyword_retriever = KeywordRetriever(Settings.UPLOAD_DIR, "uploaded_docs")
        self.router = QueryRouter()
        self.query_analyzer = QueryAnalyzer()
        self.retrieval_planner = RetrievalPlanner()
        self.web_search = WebSearchService()
        self.response_synthesizer = ResponseSynthesizer()

    def ask(self, question: str, use_uploaded_docs: bool = False) -> QAResponse:
        decision, analysis, evidences, web_result = self._prepare(question, use_uploaded_docs=use_uploaded_docs)
        answer = self.response_synthesizer.synthesize(question, decision, analysis, evidences, web_result)

        return QAResponse(
            answer=answer,
            references=self._build_references(evidences, web_result),
            route=decision.route,
            route_reason=decision.reason,
            response_mode=decision.response_mode,
            source_badge=self._build_source_badge(decision, analysis),
            local_task_type=analysis.task_type if analysis else None,
            local_task_reason=analysis.task_reason if analysis else None,
        )

    def ask_stream(self, question: str, use_uploaded_docs: bool = False) -> Iterator[str]:
        decision, analysis, evidences, web_result = self._prepare(question, use_uploaded_docs=use_uploaded_docs)
        for event in self.response_synthesizer.stream(question, decision, analysis, evidences, web_result):
            yield event
        yield self._encode_stream_event(
            "meta",
            {
                "route": decision.route,
                "route_reason": decision.reason,
                "response_mode": decision.response_mode,
                "source_badge": self._build_source_badge(decision, analysis),
                "references": self._build_references(evidences, web_result),
                "local_task_type": analysis.task_type if analysis else None,
                "local_task_reason": analysis.task_reason if analysis else None,
            },
        )
        yield self._encode_stream_event("done", {})

    def _prepare(self, question: str, *, use_uploaded_docs: bool):
        has_uploaded_docs = self._has_uploaded_docs(use_uploaded_docs)
        decision = self.router.route(question, has_uploaded_docs=has_uploaded_docs)

        analysis: QueryAnalysis | None = None
        evidences: list[RetrievedEvidence] = []
        web_result: WebSearchResult | None = None

        if decision.use_local_rag:
            analysis = self.query_analyzer.analyze(
                question,
                use_uploaded_docs=use_uploaded_docs,
                has_uploaded_docs=has_uploaded_docs,
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

        if decision.use_web_search:
            web_result = self.web_search.search(question)

        return decision, analysis, evidences, web_result

    def _build_references(
        self,
        evidences: list[RetrievedEvidence],
        web_result: WebSearchResult | None,
    ) -> list[dict]:
        references: list[dict] = []
        for evidence in evidences:
            references.append(
                {
                    "source_kind": "local",
                    "source_file": evidence.source_file,
                    "page": evidence.page,
                    "content": evidence.content,
                    "doc_type": evidence.doc_type,
                    "retrieval_method": evidence.retrieval_method,
                    "score": round(evidence.score, 4),
                }
            )
        if web_result:
            for citation in web_result.citations:
                references.append(
                    {
                        "source_kind": "web",
                        "title": citation.title,
                        "url": citation.url,
                    }
                )
        return references

    def _build_source_badge(self, decision: RouterDecision, analysis: QueryAnalysis | None) -> str:
        if decision.route == "chat":
            return "直接对话"
        if decision.route == "web_search":
            return "已联网搜索"
        if decision.route == "hybrid":
            return "本地资料 + 联网分析"
        if analysis is None:
            return "需要澄清"
        if analysis.source_scope == "uploaded_docs":
            return "基于上传文档"
        if analysis.source_scope == "both":
            return "基于本地双知识源"
        return "基于本地资料"

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
