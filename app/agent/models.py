from __future__ import annotations

from dataclasses import dataclass


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
class QAResponse:
    answer: str
    references: list[dict]
    route_target: str
    route_reason: str
    question_type: str
    question_type_reason: str
