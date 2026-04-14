from __future__ import annotations

from app.agent.models import QueryAnalysis, RetrievalPlan, RetrievalStep


class RetrievalPlanner:
    def plan(self, analysis: QueryAnalysis) -> RetrievalPlan:
        steps: list[RetrievalStep] = []

        if analysis.source_scope == "both":
            steps.append(RetrievalStep("self_resume", "dense", analysis.top_k))
            steps.append(RetrievalStep("uploaded_docs", "dense", analysis.top_k))
            if analysis.needs_keyword:
                steps.append(RetrievalStep("self_resume", "keyword", analysis.top_k + 1))
                steps.append(RetrievalStep("uploaded_docs", "keyword", analysis.top_k + 1))
            return RetrievalPlan(
                steps=steps,
                merge_mode="balanced",
                final_limit=6,
                reason="plan_both_sources",
            )

        steps.append(RetrievalStep(analysis.source_scope, "dense", analysis.top_k))
        if analysis.needs_keyword:
            steps.append(RetrievalStep(analysis.source_scope, "keyword", analysis.top_k + 2))

        return RetrievalPlan(
            steps=steps,
            merge_mode="union",
            final_limit=5 if analysis.task_type in {"fact", "locate"} else 4,
            reason=f"plan_{analysis.task_type}_{analysis.source_scope}",
        )
