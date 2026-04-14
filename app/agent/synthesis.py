from __future__ import annotations

from app.agent.models import QueryAnalysis, RetrievedEvidence
from app.core.llm import get_llm_clients


SYNTHESIS_SYSTEM_PROMPT = """
You are a document-grounded question answering assistant.

Rules:
1. Answer in Chinese.
2. Only use the provided evidence chunks.
3. If the evidence is insufficient, reply with "当前知识库中未找到相关信息。"
4. Prefer precise factual answers for fact questions.
5. Prefer concise structured summaries for summary questions.
6. For compare questions, separately summarize each source before giving a combined conclusion.
7. Do not fabricate facts or mention hidden reasoning.
""".strip()


class ResponseSynthesizer:
    REFUSAL_PHRASES = [
        "问题不明确",
        "无法直接回答",
        "请提供具体问题",
        "请提供更具体的问题",
        "需要更具体",
    ]

    def __init__(self):
        self.clients = get_llm_clients()

    def synthesize(self, question: str, analysis: QueryAnalysis, evidences: list[RetrievedEvidence]) -> str:
        if not evidences:
            return "当前知识库中未找到相关信息。"

        response = self.clients.chat_model.invoke(
            [
                {"role": "system", "content": SYNTHESIS_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"用户问题：{question}\n\n"
                        f"任务类型：{analysis.task_type}\n"
                        f"知识源范围：{analysis.source_scope}\n\n"
                        "请严格依据下面证据作答：\n\n"
                        f"{self._format_evidence(evidences)}"
                    ),
                },
            ]
        )
        answer = str(response.content).strip()
        if not answer or self._is_refusal(answer):
            return self._build_extractive_fallback(evidences)
        return answer

    def _format_evidence(self, evidences: list[RetrievedEvidence]) -> str:
        sections: list[str] = []
        for index, evidence in enumerate(evidences, start=1):
            header = (
                f"[Evidence {index}] method={evidence.retrieval_method} "
                f"doc_type={evidence.doc_type} source={evidence.source_file} page={evidence.page} score={evidence.score:.3f}"
            )
            sections.append(f"{header}\n{evidence.content}")
        return "\n\n".join(sections)

    def _is_refusal(self, answer: str) -> bool:
        return any(phrase in answer for phrase in self.REFUSAL_PHRASES)

    def _build_extractive_fallback(self, evidences: list[RetrievedEvidence]) -> str:
        lines: list[str] = []
        for evidence in evidences[:4]:
            snippet = " ".join(evidence.content.split())[:220]
            lines.append(f"- [{evidence.doc_type}] {evidence.source_file}: {snippet}")
        if not lines:
            return "当前知识库中未找到相关信息。"
        return "根据当前检索到的证据，相关信息如下：\n" + "\n".join(lines)
