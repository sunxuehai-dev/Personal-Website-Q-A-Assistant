from __future__ import annotations

import json
from collections.abc import Iterator

from app.agent.models import AnswerDraft, RetrievedEvidence, WebSearchResult
from app.core.llm import get_llm_clients


ANSWER_SYSTEM_PROMPT = """
你是个人网站的中文问答助手。

回答原则：
1. 如果提供了本地资料证据，优先用这些证据回答与站长本人、项目、技能、经历、个人网站相关的问题。
2. 如果本地资料不足，而问题需要外部最新信息，可以联网补充。
3. 不要把外部信息伪装成本地资料。
4. 回答自然，不要写成机械报告。
5. 如果信息不足，明确说明边界。
""".strip()


class ResponseSynthesizer:
    def __init__(self):
        self.clients = get_llm_clients()

    def synthesize(
        self,
        *,
        question: str,
        relevance: str,
        evidences: list[RetrievedEvidence],
        retry: bool,
        web_result: WebSearchResult | None = None,
    ) -> AnswerDraft:
        used_local_context = bool(evidences)
        messages = self._build_messages(
            question=question,
            relevance=relevance,
            evidences=evidences,
            retry=retry,
        )
        response = self.clients.chat_model.invoke(messages)
        answer = str(response.content or "").strip() or "当前没有足够信息。"

        if not self._needs_web_search(question, answer, relevance, used_local_context):
            return AnswerDraft(
                answer=answer,
                used_local_context=used_local_context,
                used_web_search=False,
                source_badge=self._build_source_badge(used_local_context, False),
                web_result=None,
            )

        web_result = self._ensure_web_result(question, web_result)
        if web_result and web_result.summary:
            web_answer = self._merge_with_web_answer(
                question=question,
                base_answer=answer,
                evidences=evidences,
                web_result=web_result,
            )
            return AnswerDraft(
                answer=web_answer,
                used_local_context=used_local_context,
                used_web_search=True,
                source_badge=self._build_source_badge(used_local_context, True),
                web_result=web_result,
            )

        return AnswerDraft(
            answer=answer,
            used_local_context=used_local_context,
            used_web_search=False,
            source_badge=self._build_source_badge(used_local_context, False),
            web_result=web_result,
        )

    def stream(
        self,
        *,
        question: str,
        relevance: str,
        evidences: list[RetrievedEvidence],
        retry: bool,
        web_result: WebSearchResult | None = None,
    ) -> Iterator[str]:
        draft = self.synthesize(
            question=question,
            relevance=relevance,
            evidences=evidences,
            retry=retry,
            web_result=web_result,
        )
        yield self._encode_event("token", {"content": draft.answer})
        return

    def _build_messages(
        self,
        *,
        question: str,
        relevance: str,
        evidences: list[RetrievedEvidence],
        retry: bool,
    ) -> list[dict[str, str]]:
        return [
            {"role": "system", "content": ANSWER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"用户问题：{question}\n\n"
                    f"本地相关度：{relevance}\n"
                    f"是否为重试回答：{'yes' if retry else 'no'}\n\n"
                    "本地资料证据：\n"
                    f"{self._format_evidence(evidences) if evidences else '无'}"
                ),
            },
        ]

    def _merge_with_web_answer(
        self,
        *,
        question: str,
        base_answer: str,
        evidences: list[RetrievedEvidence],
        web_result: WebSearchResult,
    ) -> str:
        prompt = [
            {"role": "system", "content": ANSWER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"用户问题：{question}\n\n"
                    f"第一版回答：{base_answer}\n\n"
                    "本地资料证据：\n"
                    f"{self._format_evidence(evidences) if evidences else '无'}\n\n"
                    f"联网补充信息：{web_result.summary}\n\n"
                    "请把本地资料和联网信息自然整合成最终回答，明确来源边界。"
                ),
            },
        ]
        response = self.clients.chat_model.invoke(prompt)
        return str(response.content or "").strip() or base_answer

    def _needs_web_search(
        self,
        question: str,
        answer: str,
        relevance: str,
        used_local_context: bool,
    ) -> bool:
        normalized_question = question.lower()
        web_hints = ("最新", "最近", "今天", "当前", "主流", "官网", "趋势", "现状", "news", "latest")
        if any(hint in normalized_question for hint in web_hints):
            return True
        if relevance == "low":
            return True
        if not used_local_context and len(answer) < 28:
            return True
        return False

    def _ensure_web_result(self, question: str, web_result: WebSearchResult | None) -> WebSearchResult | None:
        if web_result is not None:
            return web_result

        from app.agent.web_search import WebSearchService

        return WebSearchService().search(question)

    def _build_source_badge(self, used_local_context: bool, used_web_search: bool) -> str:
        if used_local_context and used_web_search:
            return "结合本地资料与联网信息"
        if used_local_context:
            return "结合本地资料"
        if used_web_search:
            return "结合联网信息"
        return "通用回答"

    def _format_evidence(self, evidences: list[RetrievedEvidence]) -> str:
        sections: list[str] = []
        for index, evidence in enumerate(evidences, start=1):
            header = (
                f"[Evidence {index}] method={evidence.retrieval_method} "
                f"doc_type={evidence.doc_type} source={evidence.source_file} page={evidence.page} score={evidence.score:.3f}"
            )
            sections.append(f"{header}\n{evidence.content}")
        return "\n\n".join(sections)

    def _encode_event(self, event_type: str, payload: dict) -> str:
        body = {"type": event_type, **payload}
        return f"data: {json.dumps(body, ensure_ascii=False)}\n\n"
