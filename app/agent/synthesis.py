from __future__ import annotations

import json
from collections.abc import Iterator

from app.agent.models import AnswerDraft, RetrievedEvidence
from app.core.config import Settings
from app.core.llm import get_llm_clients


ANSWER_SYSTEM_PROMPT = """
你是个人网站的中文问答助手。

回答原则：
1. 如果提供了本地资料证据，优先用这些证据回答与站长本人、项目、技能、经历、个人网站相关的问题。
2. 如果本地资料不足，而问题需要外部最新信息，可以直接结合联网信息补充。
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
    ) -> AnswerDraft:
        if Settings.LLM_TYPE == "qwen":
            answer = self._synthesize_with_qwen(question, relevance, evidences, retry)
            return AnswerDraft(
                answer=answer,
                used_local_context=bool(evidences),
                used_web_search=self._infer_used_web_search(question, answer, relevance, evidences),
                source_badge=self._build_source_badge(
                    bool(evidences),
                    self._infer_used_web_search(question, answer, relevance, evidences),
                ),
            )

        response = self.clients.chat_model.invoke(
            self._build_messages(question=question, relevance=relevance, evidences=evidences, retry=retry)
        )
        answer = str(response.content or "").strip() or "当前没有足够信息。"
        return AnswerDraft(
            answer=answer,
            used_local_context=bool(evidences),
            used_web_search=False,
            source_badge=self._build_source_badge(bool(evidences), False),
        )

    def stream(
        self,
        *,
        question: str,
        relevance: str,
        evidences: list[RetrievedEvidence],
        retry: bool,
    ) -> Iterator[str]:
        draft = self.synthesize(
            question=question,
            relevance=relevance,
            evidences=evidences,
            retry=retry,
        )
        yield self._encode_event("token", {"content": draft.answer})

    def _synthesize_with_qwen(
        self,
        question: str,
        relevance: str,
        evidences: list[RetrievedEvidence],
        retry: bool,
    ) -> str:
        completion = self.clients.response_client.chat.completions.create(
            model=Settings.CHAT_MODEL_MAP[Settings.LLM_TYPE],
            messages=self._build_messages(
                question=question,
                relevance=relevance,
                evidences=evidences,
                retry=retry,
            ),
            extra_body={"enable_search": True},
        )
        return str(completion.choices[0].message.content or "").strip() or "当前没有足够信息。"

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

    def _infer_used_web_search(
        self,
        question: str,
        answer: str,
        relevance: str,
        evidences: list[RetrievedEvidence],
    ) -> bool:
        normalized_question = question.lower()
        web_hints = ("最新", "最近", "今天", "当前", "主流", "官网", "趋势", "现状", "news", "latest")
        if any(hint in normalized_question for hint in web_hints):
            return True
        if relevance == "low":
            return True
        if not evidences and len(answer) > 24:
            return True
        return False

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
