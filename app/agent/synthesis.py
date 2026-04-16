from __future__ import annotations

import json
from collections.abc import Iterator

from app.agent.models import AnswerDraft, RetrievedEvidence
from app.core.config import Settings
from app.core.llm import get_llm_clients


ANSWER_SYSTEM_PROMPT = """
你是个人网站中的中文问答助手。
回答原则：
1. 如果提供了本地资料证据，优先基于这些证据回答与站长本人、项目、技能、经历、个人网站相关的问题。
2. 如果本地资料不足，而问题需要外部最新信息，可以结合联网信息补充。
3. 不要把外部信息伪装成本地资料。
4. 回答保持自然，不要写成机械报告。
5. 如果信息不足，要明确说明边界。
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
        conversation_context: str = "",
        retry: bool,
    ) -> AnswerDraft:
        if Settings.LLM_TYPE == "qwen":
            answer = self._synthesize_with_qwen(
                question,
                relevance,
                evidences,
                conversation_context,
                retry,
            )
            used_web_search = self._infer_used_web_search(question, relevance, evidences, answer)
            return AnswerDraft(
                answer=answer,
                used_local_context=bool(evidences),
                used_web_search=used_web_search,
                source_badge=self._build_source_badge(bool(evidences), used_web_search),
            )

        response = self.clients.chat_model.invoke(
            self._build_messages(
                question=question,
                relevance=relevance,
                evidences=evidences,
                conversation_context=conversation_context,
                retry=retry,
            )
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
        conversation_context: str = "",
        retry: bool,
    ) -> Iterator[str]:
        if Settings.LLM_TYPE == "qwen":
            yield from self._stream_with_qwen(
                question,
                relevance,
                evidences,
                conversation_context,
                retry,
            )
            return

        for chunk in self.clients.chat_model.stream(
            self._build_messages(
                question=question,
                relevance=relevance,
                evidences=evidences,
                conversation_context=conversation_context,
                retry=retry,
            )
        ):
            content = str(chunk.content or "")
            if not content:
                continue
            yield self._encode_event("token", {"content": content})

    def build_stream_meta(
        self,
        *,
        question: str,
        relevance: str,
        evidences: list[RetrievedEvidence],
    ) -> dict:
        used_web_search = self._infer_used_web_search(question, relevance, evidences, "")
        return {
            "source_badge": self._build_source_badge(bool(evidences), used_web_search),
            "used_local_context": bool(evidences),
            "used_web_search": used_web_search,
        }

    def _synthesize_with_qwen(
        self,
        question: str,
        relevance: str,
        evidences: list[RetrievedEvidence],
        conversation_context: str,
        retry: bool,
    ) -> str:
        completion = self.clients.response_client.chat.completions.create(
            model=Settings.CHAT_MODEL_MAP[Settings.LLM_TYPE],
            messages=self._build_messages(
                question=question,
                relevance=relevance,
                evidences=evidences,
                conversation_context=conversation_context,
                retry=retry,
            ),
            extra_body={"enable_search": True},
        )
        return str(completion.choices[0].message.content or "").strip() or "当前没有足够信息。"

    def _stream_with_qwen(
        self,
        question: str,
        relevance: str,
        evidences: list[RetrievedEvidence],
        conversation_context: str,
        retry: bool,
    ) -> Iterator[str]:
        stream = self.clients.response_client.chat.completions.create(
            model=Settings.CHAT_MODEL_MAP[Settings.LLM_TYPE],
            messages=self._build_messages(
                question=question,
                relevance=relevance,
                evidences=evidences,
                conversation_context=conversation_context,
                retry=retry,
            ),
            extra_body={"enable_search": True},
            stream=True,
        )

        emitted = False
        for chunk in stream:
            choices = getattr(chunk, "choices", None) or []
            if not choices:
                continue
            delta = getattr(choices[0], "delta", None)
            content = getattr(delta, "content", None) if delta is not None else None
            if content is None and isinstance(delta, dict):
                content = delta.get("content")
            if not content:
                continue
            emitted = True
            yield self._encode_event("token", {"content": str(content)})

        if not emitted:
            yield self._encode_event("token", {"content": "当前没有足够信息。"})

    def _build_messages(
        self,
        *,
        question: str,
        relevance: str,
        evidences: list[RetrievedEvidence],
        conversation_context: str,
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
                    "Recent conversation context:\n"
                    f"{conversation_context or 'none'}\n\n"
                    "本地资料证据：\n"
                    f"{self._format_evidence(evidences) if evidences else '无'}"
                ),
            },
        ]

    def _infer_used_web_search(
        self,
        question: str,
        relevance: str,
        evidences: list[RetrievedEvidence],
        answer: str,
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
