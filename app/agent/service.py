from __future__ import annotations

import json
from collections.abc import Iterator

from langchain_core.documents import Document

from app.agent.analysis import QueryAnalyzer
from app.agent.evaluation import AnswerEvaluator
from app.agent.models import QAResponse, QueryAnalysis, RetrievedEvidence, RetrievalBundle
from app.agent.planning import RetrievalPlanner
from app.agent.rewrite import RetryRewriter
from app.agent.router import LocalRelevanceJudge
from app.agent.synthesis import ResponseSynthesizer
from app.core.config import Settings
from app.retrieval.hybrid import merge_evidences
from app.retrieval.keyword import KeywordRetriever
from app.retrieval.retriever import ResumeRetriever, UploadedDocumentRetriever


class ResumeQAService:
    """Unified assistant with optional local RAG and single retry."""

    def __init__(self, top_k: int = 4):
        self.self_retriever = ResumeRetriever(top_k=top_k)
        self.upload_retriever = UploadedDocumentRetriever(top_k=top_k)
        self.self_keyword_retriever = KeywordRetriever(Settings.SELF_RESUME_DIR, "self_resume")
        self.upload_keyword_retriever = KeywordRetriever(Settings.UPLOAD_DIR, "uploaded_docs")
        self.relevance_judge = LocalRelevanceJudge()
        self.query_analyzer = QueryAnalyzer()
        self.retrieval_planner = RetrievalPlanner()
        self.response_synthesizer = ResponseSynthesizer()
        self.answer_evaluator = AnswerEvaluator()
        self.retry_rewriter = RetryRewriter()

    def ask(self, question: str, use_uploaded_docs: bool = False) -> QAResponse:
        result = self._run_pipeline(question, use_uploaded_docs=use_uploaded_docs)
        return QAResponse(
            answer=result["answer"],
            references=result["references"],
            source_badge=result["source_badge"],
            used_local_context=result["used_local_context"],
            used_web_search=result["used_web_search"],
            retried=result["retried"],
        )

    def ask_stream(self, question: str, use_uploaded_docs: bool = False) -> Iterator[str]:
        result = self._run_pipeline(question, use_uploaded_docs=use_uploaded_docs)
        yield self._encode_stream_event("token", {"content": result["answer"]})
        yield self._encode_stream_event(
            "meta",
            {
                "references": result["references"],
                "source_badge": result["source_badge"],
                "used_local_context": result["used_local_context"],
                "used_web_search": result["used_web_search"],
                "retried": result["retried"],
            },
        )
        yield self._encode_stream_event("done", {})

    def _run_pipeline(self, question: str, *, use_uploaded_docs: bool):
        has_uploaded_docs = self._has_uploaded_docs(use_uploaded_docs)
        relevance = self.relevance_judge.judge(question, has_uploaded_docs=has_uploaded_docs)

        retrieval = self._retrieve(
            question,
            relevance=relevance.relevance,
            use_uploaded_docs=use_uploaded_docs,
            has_uploaded_docs=has_uploaded_docs,
            retry=False,
        )
        draft = self.response_synthesizer.synthesize(
            question=question,
            relevance=relevance.relevance,
            evidences=retrieval.evidences,
            retry=False,
        )
        evaluation = self.answer_evaluator.evaluate(
            question=question,
            relevance=relevance.relevance,
            retrieval_quality=retrieval.retrieval_quality,
            answer=draft.answer,
            retry=False,
        )

        final_question = question
        final_retrieval = retrieval
        final_draft = draft
        retried = False

        if evaluation.decision == "retry":
            retried = True
            final_question = self.retry_rewriter.rewrite(question, relevance=relevance.relevance)
            final_retrieval = self._retrieve(
                final_question,
                relevance=relevance.relevance,
                use_uploaded_docs=use_uploaded_docs,
                has_uploaded_docs=has_uploaded_docs,
                retry=True,
            )
            final_draft = self.response_synthesizer.synthesize(
                question=question,
                relevance=relevance.relevance,
                evidences=final_retrieval.evidences,
                retry=True,
            )

        return {
            "answer": final_draft.answer,
            "references": self._build_references(final_retrieval.evidences, final_draft.web_result),
            "source_badge": final_draft.source_badge,
            "used_local_context": final_draft.used_local_context,
            "used_web_search": final_draft.used_web_search,
            "retried": retried,
        }

    def _retrieve(
        self,
        question: str,
        *,
        relevance: str,
        use_uploaded_docs: bool,
        has_uploaded_docs: bool,
        retry: bool,
    ) -> RetrievalBundle:
        if relevance == "low":
            return RetrievalBundle(evidences=[], retrieval_quality="empty")

        analysis = self.query_analyzer.analyze(
            question,
            use_uploaded_docs=use_uploaded_docs,
            has_uploaded_docs=has_uploaded_docs,
        )
        plan = self.retrieval_planner.plan(analysis)
        if retry:
            plan.final_limit = max(plan.final_limit + 2, 6)
            for step in plan.steps:
                step.limit += 2

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
        return RetrievalBundle(
            evidences=evidences,
            retrieval_quality=self._assess_retrieval_quality(evidences),
        )

    def _build_references(self, evidences: list[RetrievedEvidence], web_result) -> list[dict]:
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

    def _assess_retrieval_quality(self, evidences: list[RetrievedEvidence]) -> str:
        if not evidences:
            return "empty"
        if len(evidences) >= 3 and evidences[0].score >= 0.45:
            return "strong"
        return "weak"

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
