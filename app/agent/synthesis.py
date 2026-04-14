from __future__ import annotations

import json
from collections.abc import Iterator

from app.agent.models import QueryAnalysis, RetrievedEvidence, RouterDecision, WebSearchResult
from app.core.llm import get_llm_clients


LOCAL_QA_SYSTEM_PROMPT = """
你是一个基于证据回答问题的中文助手。

规则：
1. 只使用提供的本地资料证据回答，不要编造。
2. 如果证据不足，明确说明“当前本地资料中没有找到足够信息”。
3. 事实类问题优先精确回答，概括类问题保持简洁。
4. 比较类问题先分别概括，再给结论。
5. 不要暴露隐藏推理过程。
""".strip()


HYBRID_QA_SYSTEM_PROMPT = """
你是一个中文助手，需要同时参考本地资料与联网搜索结果回答。

规则：
1. 优先准确区分“基于本地资料”和“结合联网信息”的内容。
2. 不要把网络信息伪装成本地资料。
3. 回答要自然，不要写成机械报告。
4. 如果任一来源不足，可以明确说明来源边界。
5. 不要暴露隐藏推理过程。
""".strip()


class ResponseSynthesizer:
    REFUSAL_PHRASES = [
        "问题不明确",
        "无法直接回答",
        "请提供具体问题",
        "请提供更具体的问题",
        "需要更多信息",
    ]

    def __init__(self):
        self.clients = get_llm_clients()

    def synthesize(
        self,
        question: str,
        decision: RouterDecision,
        analysis: QueryAnalysis | None,
        evidences: list[RetrievedEvidence],
        web_result: WebSearchResult | None,
    ) -> str:
        if decision.route == "chat":
            return self._build_chat_reply(question)
        if decision.needs_clarification or decision.route == "out_of_scope":
            return "可以具体一点告诉我你想问什么。我可以回答简历、项目经历、技能栈、个人网站，也可以在需要时联网补充最新信息。"
        if decision.route == "web_search":
            return (web_result.summary if web_result else "") or "联网搜索暂时没有返回有效结果。"
        if decision.route == "local_rag":
            if not evidences:
                return "当前本地资料中没有找到足够信息。"
            return self._synthesize_local(question, analysis, evidences)
        if decision.route == "hybrid":
            if not evidences and not (web_result and web_result.summary):
                return "当前本地资料和联网搜索都没有提供足够信息。"
            return self._synthesize_hybrid(question, analysis, evidences, web_result)
        return "可以换个更具体的问题再试一次。"

    def stream(
        self,
        question: str,
        decision: RouterDecision,
        analysis: QueryAnalysis | None,
        evidences: list[RetrievedEvidence],
        web_result: WebSearchResult | None,
    ) -> Iterator[str]:
        if decision.route in {"chat", "web_search", "out_of_scope"} or decision.needs_clarification:
            yield self._encode_event(
                "token",
                {"content": self.synthesize(question, decision, analysis, evidences, web_result)},
            )
            return

        if decision.route == "local_rag" and not evidences:
            yield self._encode_event("token", {"content": "当前本地资料中没有找到足够信息。"})
            return

        if decision.route == "hybrid" and not evidences and not (web_result and web_result.summary):
            yield self._encode_event("token", {"content": "当前本地资料和联网搜索都没有提供足够信息。"})
            return

        chunks: list[str] = []
        messages = (
            self._build_local_messages(question, analysis, evidences)
            if decision.route == "local_rag"
            else self._build_hybrid_messages(question, analysis, evidences, web_result)
        )

        for chunk in self.clients.chat_model.stream(messages):
            content = str(chunk.content or "")
            if not content:
                continue
            chunks.append(content)
            yield self._encode_event("token", {"content": content})

        answer = "".join(chunks).strip()
        if answer and not self._is_refusal(answer):
            return

        fallback = self.synthesize(question, decision, analysis, evidences, web_result)
        if answer:
            yield self._encode_event("replace", {"content": fallback})
        else:
            yield self._encode_event("token", {"content": fallback})

    def _synthesize_local(
        self,
        question: str,
        analysis: QueryAnalysis | None,
        evidences: list[RetrievedEvidence],
    ) -> str:
        response = self.clients.chat_model.invoke(self._build_local_messages(question, analysis, evidences))
        answer = str(response.content).strip()
        if not answer or self._is_refusal(answer):
            return self._build_extractive_fallback(evidences, prefix="根据当前本地资料，相关信息如下：")
        return answer

    def _synthesize_hybrid(
        self,
        question: str,
        analysis: QueryAnalysis | None,
        evidences: list[RetrievedEvidence],
        web_result: WebSearchResult | None,
    ) -> str:
        response = self.clients.chat_model.invoke(
            self._build_hybrid_messages(question, analysis, evidences, web_result)
        )
        answer = str(response.content).strip()
        if not answer or self._is_refusal(answer):
            sections: list[str] = []
            if evidences:
                sections.append(self._build_extractive_fallback(evidences, prefix="基于本地资料："))
            if web_result and web_result.summary:
                sections.append(f"结合联网信息：{web_result.summary}")
            return "\n\n".join(section for section in sections if section) or "当前没有足够信息。"
        return answer

    def _build_local_messages(
        self,
        question: str,
        analysis: QueryAnalysis | None,
        evidences: list[RetrievedEvidence],
    ) -> list[dict[str, str]]:
        return [
            {"role": "system", "content": LOCAL_QA_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"用户问题：{question}\n\n"
                    f"本地任务类型：{analysis.task_type if analysis else 'unknown'}\n"
                    f"知识范围：{analysis.source_scope if analysis else 'unknown'}\n\n"
                    "请严格依据下面证据回答：\n\n"
                    f"{self._format_evidence(evidences)}"
                ),
            },
        ]

    def _build_hybrid_messages(
        self,
        question: str,
        analysis: QueryAnalysis | None,
        evidences: list[RetrievedEvidence],
        web_result: WebSearchResult | None,
    ) -> list[dict[str, str]]:
        web_summary = web_result.summary if web_result else "无"
        web_sources = self._format_citations(web_result.citations if web_result else [])
        return [
            {"role": "system", "content": HYBRID_QA_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"用户问题：{question}\n\n"
                    f"本地任务类型：{analysis.task_type if analysis else 'unknown'}\n\n"
                    "本地资料证据：\n"
                    f"{self._format_evidence(evidences) if evidences else '无'}\n\n"
                    "联网搜索摘要：\n"
                    f"{web_summary}\n\n"
                    "联网来源：\n"
                    f"{web_sources}"
                ),
            },
        ]

    def _format_evidence(self, evidences: list[RetrievedEvidence]) -> str:
        sections: list[str] = []
        for index, evidence in enumerate(evidences, start=1):
            header = (
                f"[Evidence {index}] method={evidence.retrieval_method} "
                f"doc_type={evidence.doc_type} source={evidence.source_file} page={evidence.page} score={evidence.score:.3f}"
            )
            sections.append(f"{header}\n{evidence.content}")
        return "\n\n".join(sections)

    def _format_citations(self, citations) -> str:
        if not citations:
            return "无"
        return "\n".join(f"- {item.title}: {item.url}" for item in citations)

    def _is_refusal(self, answer: str) -> bool:
        return any(phrase in answer for phrase in self.REFUSAL_PHRASES)

    def _build_extractive_fallback(self, evidences: list[RetrievedEvidence], *, prefix: str) -> str:
        lines: list[str] = []
        for evidence in evidences[:4]:
            snippet = " ".join(evidence.content.split())[:220]
            lines.append(f"- [{evidence.doc_type}] {evidence.source_file}: {snippet}")
        if not lines:
            return "当前没有足够信息。"
        return prefix + "\n" + "\n".join(lines)

    def _build_chat_reply(self, question: str) -> str:
        lowered = question.strip().lower()
        if any(token in lowered for token in ("谢谢", "感谢", "thanks", "thank you")):
            return "不客气。你可以继续问我简历、项目经历、技能栈、个人网站，或者让我联网查最新信息。"
        if any(token in lowered for token in ("再见", "bye")):
            return "好的，有需要随时再来。"
        return "你好，我可以回答简历、项目经历、技能栈、个人网站，也可以在需要时联网补充最新信息。"

    def _encode_event(self, event_type: str, payload: dict) -> str:
        body = {"type": event_type, **payload}
        return f"data: {json.dumps(body, ensure_ascii=False)}\n\n"
