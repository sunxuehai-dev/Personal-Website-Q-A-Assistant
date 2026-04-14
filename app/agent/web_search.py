from __future__ import annotations

from app.agent.models import WebCitation, WebSearchResult
from app.core.config import Settings
from app.core.llm import get_llm_clients


class WebSearchService:
    def __init__(self):
        self.clients = get_llm_clients()

    def search(self, question: str) -> WebSearchResult:
        if Settings.LLM_TYPE == "qwen":
            return self._search_with_qwen(question)
        return self._search_with_responses(question)

    def _search_with_qwen(self, question: str) -> WebSearchResult:
        completion = self.clients.response_client.chat.completions.create(
            model=Settings.CHAT_MODEL_MAP[Settings.LLM_TYPE],
            messages=[
                {
                    "role": "system",
                    "content": (
                        "你是一个中文联网搜索助手。请基于联网结果回答，保持简洁准确。"
                        "如果信息存在时效性，优先采用更近期的结果。"
                    ),
                },
                {
                    "role": "user",
                    "content": question,
                },
            ],
            extra_body={"enable_search": True},
        )

        message = completion.choices[0].message
        summary = str(message.content or "").strip()
        citations = self._extract_citations_from_message(message)
        return WebSearchResult(
            summary=summary or "联网搜索未返回有效结果。",
            citations=citations[:5],
        )

    def _search_with_responses(self, question: str) -> WebSearchResult:
        prompt = (
            "请使用联网搜索回答用户问题。"
            "回答使用中文，保持简洁准确；如果结果存在时效性，请优先参考更近期来源。"
            f"\n\n用户问题：{question}"
        )

        last_error: Exception | None = None
        for tool_type in ("web_search", "web_search_preview"):
            try:
                response = self.clients.response_client.responses.create(
                    model=Settings.CHAT_MODEL_MAP[Settings.LLM_TYPE],
                    tools=[{"type": tool_type}],
                    input=prompt,
                )
                return self._parse_responses_api_output(response)
            except Exception as exc:  # pragma: no cover - network/provider dependent
                last_error = exc

        if last_error is None:  # pragma: no cover - defensive
            raise RuntimeError("Web search failed without provider error.")
        raise last_error

    def _parse_responses_api_output(self, response) -> WebSearchResult:
        summary = str(getattr(response, "output_text", "") or "").strip()
        citations: list[WebCitation] = []

        for item in getattr(response, "output", []) or []:
            if self._get_attr(item, "type") != "message":
                continue
            for content in self._get_attr(item, "content", []) or []:
                if self._get_attr(content, "type") != "output_text":
                    continue
                for annotation in self._get_attr(content, "annotations", []) or []:
                    url = self._get_attr(annotation, "url")
                    if not url:
                        continue
                    citations.append(
                        WebCitation(
                            title=self._get_attr(annotation, "title") or url,
                            url=url,
                        )
                    )

        return WebSearchResult(
            summary=summary or "联网搜索未返回有效结果。",
            citations=self._dedupe_citations(citations)[:5],
        )

    def _extract_citations_from_message(self, message) -> list[WebCitation]:
        citations: list[WebCitation] = []

        for annotation in self._get_attr(message, "annotations", []) or []:
            url = self._get_attr(annotation, "url") or self._get_attr(annotation, "link")
            if not url:
                continue
            citations.append(
                WebCitation(
                    title=self._get_attr(annotation, "title") or url,
                    url=url,
                )
            )

        for tool_call in self._get_attr(message, "tool_calls", []) or []:
            search_result = self._get_attr(tool_call, "search_result")
            if not search_result:
                continue
            for item in self._get_attr(search_result, "items", []) or []:
                url = self._get_attr(item, "link") or self._get_attr(item, "url")
                if not url:
                    continue
                citations.append(
                    WebCitation(
                        title=self._get_attr(item, "title") or url,
                        url=url,
                    )
                )

        return self._dedupe_citations(citations)

    def _dedupe_citations(self, citations: list[WebCitation]) -> list[WebCitation]:
        seen: set[str] = set()
        deduped: list[WebCitation] = []
        for citation in citations:
            if citation.url in seen:
                continue
            seen.add(citation.url)
            deduped.append(citation)
        return deduped

    def _get_attr(self, obj, name: str, default=None):
        if isinstance(obj, dict):
            return obj.get(name, default)
        return getattr(obj, name, default)
