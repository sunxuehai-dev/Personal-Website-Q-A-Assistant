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
        "我",
        "我的",
        "本人",
        "孙雪海",
        "个人简历",
        "简历",
    ]
    UPLOAD_HINTS = [
        "上传",
        "上传的",
        "文件",
        "文档",
        "附件",
        "材料",
        "pdf",
        "这份pdf",
        "这个pdf",
        "知识库",
    ]
    BOTH_HINTS = [
        "综合",
        "一起",
        "对比",
        "结合",
        "同时",
    ]

    def __init__(self):
        self.clients = get_llm_clients()

    def route(self, question: str, has_uploaded_docs: bool) -> RouteDecision:
        if not has_uploaded_docs:
            return RouteDecision(target=self.SELF_TARGET, reason="no_uploaded_docs")

        lowered = question.lower()
        self_hit = any(hint in question for hint in self.SELF_HINTS)
        upload_hit = any(hint in lowered or hint in question for hint in self.UPLOAD_HINTS)
        both_hit = any(hint in question for hint in self.BOTH_HINTS)

        if both_hit and self_hit and upload_hit:
            return RouteDecision(target=self.BOTH_TARGET, reason="keyword_both")
        if both_hit and upload_hit:
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
                    "你是知识库路由器。"
                    "你只能输出以下三个标签之一：self_resume、uploaded_docs、both。"
                    "如果问题更像在问系统内置的个人简历，输出 self_resume。"
                    "如果问题明确指向用户上传文档，输出 uploaded_docs。"
                    "如果指代不清或两个知识库都可能相关，输出 both。"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"问题：{question}\n"
                    "可选知识库：\n"
                    "- self_resume：系统内置的个人简历\n"
                    "- uploaded_docs：用户上传的文档\n\n"
                    "只输出一个标签。"
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
