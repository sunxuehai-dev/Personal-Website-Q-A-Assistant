from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class RelevanceDecision:
    relevance: str
    reason: str


@dataclass
class QueryAnalysis:
    question: str
    normalized_question: str
    task_type: str
    task_reason: str
    source_scope: str
    source_reason: str
    query_terms: list[str]
    needs_keyword: bool
    top_k: int


@dataclass
class RetrievalStep:
    source_scope: str
    method: str
    limit: int


@dataclass
class RetrievalPlan:
    steps: list[RetrievalStep]
    merge_mode: str
    final_limit: int
    reason: str


@dataclass
class RetrievedEvidence:
    content: str
    source_file: str | None
    page: str | int | None
    doc_type: str | None
    retrieval_method: str
    score: float


@dataclass
class RetrievalBundle:
    evidences: list[RetrievedEvidence]
    retrieval_quality: str


@dataclass
class WebCitation:
    title: str
    url: str


@dataclass
class WebSearchResult:
    summary: str
    citations: list[WebCitation] = field(default_factory=list)


@dataclass
class AnswerDraft:
    answer: str
    used_local_context: bool
    used_web_search: bool
    source_badge: str
    web_result: WebSearchResult | None = None


@dataclass
class EvaluationDecision:
    decision: str
    reason: str


@dataclass
class QAResponse:
    answer: str
    references: list[dict]
    source_badge: str
    used_local_context: bool
    used_web_search: bool
    retried: bool
