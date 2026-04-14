from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class RouterDecision:
    route: str
    use_local_rag: bool
    use_web_search: bool
    response_mode: str
    needs_clarification: bool
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
class WebCitation:
    title: str
    url: str


@dataclass
class WebSearchResult:
    summary: str
    citations: list[WebCitation] = field(default_factory=list)


@dataclass
class QAResponse:
    answer: str
    references: list[dict]
    route: str
    route_reason: str
    response_mode: str
    source_badge: str
    local_task_type: str | None = None
    local_task_reason: str | None = None
