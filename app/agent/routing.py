from __future__ import annotations

from dataclasses import dataclass

from app.core.llm import get_llm_clients


@dataclass
class RouteDecision:
    target: str
    reason: str


class KnowledgeRouter:
    """Route questions between self resume and uploaded knowledge bases."""

    SELF_TARGET = "self_resume"
    UPLOAD_TARGET = "uploaded_docs"
    BOTH_TARGET = "both"

    SELF_HINTS = [
        "\u6211",
        "\u6211\u7684",
        "\u672c\u4eba",
        "\u5b59\u96ea\u6d77",
        "\u4e2a\u4eba\u7b80\u5386",
        "\u4f60\u81ea\u5df1",
        "\u4f60\u7684\u7ecf\u5386",
        "\u4f60\u7684\u9879\u76ee",
        "sun xuehai",
        "your resume",
    ]
    UPLOAD_HINTS = [
        "\u4e0a\u4f20",
        "\u4e0a\u4f20\u7684",
        "\u6587\u4ef6",
        "\u6587\u6863",
        "\u9644\u4ef6",
        "\u6750\u6599",
        "\u8fd9\u4efdpdf",
        "\u8fd9\u4e2apdf",
        "\u4e0a\u4f20\u6587\u6863",
        "upload",
        "uploaded",
        "attachment",
        "pdf",
    ]
    BOTH_HINTS = [
        "\u7efc\u5408",
        "\u5bf9\u6bd4",
        "\u7ed3\u5408",
        "\u4e00\u8d77",
        "\u540c\u65f6",
        "\u5bf9\u7167",
        "both",
        "compare",
        "together",
    ]

    def __init__(self):
        self.clients = get_llm_clients()

    def route(self, question: str, has_uploaded_docs: bool) -> RouteDecision:
        if not has_uploaded_docs:
            return RouteDecision(target=self.SELF_TARGET, reason="no_uploaded_docs")

        lowered = question.lower()
        self_hit = any(hint in question or hint in lowered for hint in self.SELF_HINTS)
        upload_hit = any(hint in question or hint in lowered for hint in self.UPLOAD_HINTS)
        both_hit = any(hint in question or hint in lowered for hint in self.BOTH_HINTS)

        if both_hit:
            return RouteDecision(target=self.BOTH_TARGET, reason="keyword_both")
        if upload_hit and not self_hit:
            return RouteDecision(target=self.UPLOAD_TARGET, reason="keyword_upload")
        if self_hit and not upload_hit:
            return RouteDecision(target=self.SELF_TARGET, reason="keyword_self")
        if self_hit and upload_hit:
            return RouteDecision(target=self.BOTH_TARGET, reason="keyword_both")

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a routing classifier. "
                    "Return only one label from: self_resume, uploaded_docs, both. "
                    "Use self_resume for the built-in personal resume, "
                    "uploaded_docs for the currently uploaded document, "
                    "both when the question should combine or compare both sources."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Question: {question}\n"
                    "Available sources:\n"
                    "- self_resume: built-in personal resume\n"
                    "- uploaded_docs: uploaded PDF document\n"
                    "Return one label only."
                ),
            },
        ]
        response = self.clients.chat_model.invoke(messages)
        label = str(response.content).strip().lower()
        if self.SELF_TARGET in label and self.UPLOAD_TARGET in label:
            return RouteDecision(target=self.BOTH_TARGET, reason="llm_both")
        if self.SELF_TARGET in label:
            return RouteDecision(target=self.SELF_TARGET, reason="llm_self")
        if self.UPLOAD_TARGET in label:
            return RouteDecision(target=self.UPLOAD_TARGET, reason="llm_upload")
        return RouteDecision(target=self.BOTH_TARGET, reason="fallback_both")
