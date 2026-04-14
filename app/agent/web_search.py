from __future__ import annotations

from app.agent.models import WebCitation, WebSearchResult
from app.core.config import Settings
from app.core.llm import get_llm_clients


class WebSearchService:
    def __init__(self):
        self.clients = get_llm_clients()

    def search(self, question: str) -> WebSearchResult:
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
                return self._parse_response(response)
            except Exception as exc:  # pragma: no cover - network/provider dependent
                last_error = exc

        if last_error is None:  # pragma: no cover - defensive
            raise RuntimeError("Web search failed without provider error.")
        raise last_error

    def _parse_response(self, response) -> WebSearchResult:
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

        seen: set[str] = set()
        deduped: list[WebCitation] = []
        for citation in citations:
            if citation.url in seen:
                continue
            seen.add(citation.url)
            deduped.append(citation)

        return WebSearchResult(
            summary=summary or "联网搜索未返回有效结果。",
            citations=deduped[:5],
        )

    def _get_attr(self, obj, name: str, default=None):
        if isinstance(obj, dict):
            return obj.get(name, default)
        return getattr(obj, name, default)
