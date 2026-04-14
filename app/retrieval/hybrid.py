from __future__ import annotations

from collections import defaultdict

from app.agent.models import RetrievedEvidence


def merge_evidences(
    evidence_groups: list[list[RetrievedEvidence]],
    *,
    final_limit: int,
    merge_mode: str,
) -> list[RetrievedEvidence]:
    if merge_mode == "balanced":
        return _balanced_merge(evidence_groups, final_limit)
    return _union_merge(evidence_groups, final_limit)


def _union_merge(evidence_groups: list[list[RetrievedEvidence]], final_limit: int) -> list[RetrievedEvidence]:
    deduped: dict[tuple[str | None, str | int | None, str | None, str], RetrievedEvidence] = {}
    for group in evidence_groups:
        for evidence in group:
            key = _build_key(evidence)
            current = deduped.get(key)
            if current is None or evidence.score > current.score:
                deduped[key] = evidence

    ranked = sorted(deduped.values(), key=lambda item: item.score, reverse=True)
    return ranked[:final_limit]


def _balanced_merge(evidence_groups: list[list[RetrievedEvidence]], final_limit: int) -> list[RetrievedEvidence]:
    grouped: dict[str, list[RetrievedEvidence]] = defaultdict(list)
    for group in evidence_groups:
        for evidence in group:
            grouped[str(evidence.doc_type)].append(evidence)

    for doc_type in grouped:
        grouped[doc_type] = _union_merge([grouped[doc_type]], final_limit)

    ordered_doc_types = sorted(grouped.keys())
    merged: list[RetrievedEvidence] = []
    index = 0
    while len(merged) < final_limit:
        added = False
        for doc_type in ordered_doc_types:
            bucket = grouped[doc_type]
            if index < len(bucket):
                merged.append(bucket[index])
                added = True
                if len(merged) >= final_limit:
                    break
        if not added:
            break
        index += 1
    return merged


def _build_key(evidence: RetrievedEvidence) -> tuple[str | None, str | int | None, str | None, str]:
    snippet = " ".join(evidence.content.split())[:200]
    return (evidence.source_file, evidence.page, evidence.doc_type, snippet)
