from __future__ import annotations

import json
import re

from app.agent.models import RouterDecision
from app.core.llm import get_llm_clients


class QueryRouter:
    GREETING_PATTERNS = {
        "你好",
        "您好",
        "哈喽",
        "嗨",
        "hi",
        "hello",
        "在吗",
        "在不在",
    }
    SOCIAL_PATTERNS = {
        "谢谢",
        "感谢",
        "好的",
        "明白了",
        "收到",
        "再见",
        "bye",
    }
    STRONG_WEB_HINTS = [
        "最新",
        "最近",
        "今天",
        "当前",
        "目前",
        "主流",
        "官网",
        "发布",
        "新闻",
        "趋势",
        "现状",
    ]
    STRONG_LOCAL_HINTS = [
        "你的简历",
        "你的项目",
        "你的网站",
        "你的个人网站",
        "你的经历",
        "你的技能",
        "你的工作经历",
        "你的教育经历",
        "上传的pdf",
        "上传的文档",
        "这份pdf",
        "这份文档",
        "这份简历",
    ]

    def __init__(self):
        self.clients = get_llm_clients()

    def route(self, question: str, *, has_uploaded_docs: bool) -> RouterDecision:
        normalized = self._normalize(question)
        direct_hit = self._rule_route(question, normalized, has_uploaded_docs=has_uploaded_docs)
        if direct_hit is not None:
            return direct_hit

        decision = self._llm_route(question, has_uploaded_docs=has_uploaded_docs)
        return self._validate_decision(question, normalized, decision, has_uploaded_docs=has_uploaded_docs)

    def _rule_route(
        self,
        question: str,
        normalized: str,
        *,
        has_uploaded_docs: bool,
    ) -> RouterDecision | None:
        if normalized in self.GREETING_PATTERNS:
            return RouterDecision(
                route="chat",
                use_local_rag=False,
                use_web_search=False,
                response_mode="direct",
                needs_clarification=False,
                reason="rule_greeting",
            )

        if normalized in self.SOCIAL_PATTERNS:
            return RouterDecision(
                route="chat",
                use_local_rag=False,
                use_web_search=False,
                response_mode="direct",
                needs_clarification=False,
                reason="rule_social",
            )

        local_hit = any(hint in question.lower() or hint in normalized for hint in self.STRONG_LOCAL_HINTS)
        web_hit = any(hint in question.lower() or hint in normalized for hint in self.STRONG_WEB_HINTS)

        if local_hit and web_hit:
            return None

        if web_hit:
            return RouterDecision(
                route="web_search",
                use_local_rag=False,
                use_web_search=True,
                response_mode="grounded_answer",
                needs_clarification=False,
                reason="rule_strong_web_signal",
            )

        if local_hit:
            return RouterDecision(
                route="local_rag",
                use_local_rag=True,
                use_web_search=False,
                response_mode="grounded_answer",
                needs_clarification=False,
                reason="rule_strong_local_signal",
            )

        if has_uploaded_docs and any(token in normalized for token in ("上传", "pdf", "文档", "附件")):
            return RouterDecision(
                route="local_rag",
                use_local_rag=True,
                use_web_search=False,
                response_mode="grounded_answer",
                needs_clarification=False,
                reason="rule_uploaded_doc_signal",
            )

        return None

    def _llm_route(self, question: str, *, has_uploaded_docs: bool) -> RouterDecision:
        prompt = f"""
你是一个问答路由器。请把用户问题分类为固定路由，不要回答问题本身。

可选 route:
- chat: 打招呼、感谢、结束语、轻闲聊
- local_rag: 主要依赖本地资料，例如个人简历、项目经历、上传PDF
- web_search: 主要依赖外部最新信息、行业现状、官网/发布信息
- hybrid: 同时需要本地资料和外部最新信息
- out_of_scope: 过于模糊，或不适合直接回答

可选 response_mode:
- direct
- grounded_answer
- comparison
- clarify

当前是否存在上传文档: {"yes" if has_uploaded_docs else "no"}

只返回 JSON，不要加解释，不要使用 Markdown 代码块。
JSON 字段必须完整:
{{
  "route": "...",
  "use_local_rag": true,
  "use_web_search": false,
  "response_mode": "...",
  "needs_clarification": false,
  "reason": "..."
}}

用户问题: {question}
""".strip()

        response = self.clients.chat_model.invoke(prompt)
        return self._parse_router_payload(str(response.content))

    def _parse_router_payload(self, content: str) -> RouterDecision:
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.DOTALL)

        payload = json.loads(cleaned)
        return RouterDecision(
            route=str(payload.get("route", "")).strip(),
            use_local_rag=bool(payload.get("use_local_rag")),
            use_web_search=bool(payload.get("use_web_search")),
            response_mode=str(payload.get("response_mode", "")).strip(),
            needs_clarification=bool(payload.get("needs_clarification")),
            reason=str(payload.get("reason", "")).strip() or "llm_router",
        )

    def _validate_decision(
        self,
        question: str,
        normalized: str,
        decision: RouterDecision,
        *,
        has_uploaded_docs: bool,
    ) -> RouterDecision:
        valid_routes = {"chat", "local_rag", "web_search", "hybrid", "out_of_scope"}
        valid_modes = {"direct", "grounded_answer", "comparison", "clarify"}

        if decision.route not in valid_routes:
            return self._fallback_decision(question, normalized, has_uploaded_docs=has_uploaded_docs)

        if decision.response_mode not in valid_modes:
            decision.response_mode = "clarify" if decision.needs_clarification else "grounded_answer"

        if decision.route == "chat":
            decision.use_local_rag = False
            decision.use_web_search = False
            decision.response_mode = "direct"

        if decision.route == "local_rag":
            decision.use_local_rag = True
            decision.use_web_search = False
            if decision.response_mode == "direct":
                decision.response_mode = "grounded_answer"

        if decision.route == "web_search":
            decision.use_local_rag = False
            decision.use_web_search = True
            if decision.response_mode == "direct":
                decision.response_mode = "grounded_answer"

        if decision.route == "hybrid":
            decision.use_local_rag = True
            decision.use_web_search = True
            if decision.response_mode == "direct":
                decision.response_mode = "comparison"

        if decision.route == "out_of_scope":
            decision.use_local_rag = False
            decision.use_web_search = False
            decision.response_mode = "clarify"
            decision.needs_clarification = True

        if decision.use_local_rag and not has_uploaded_docs and "上传" in normalized:
            decision.reason = f"{decision.reason}|router_upload_not_available"

        return decision

    def _fallback_decision(
        self,
        question: str,
        normalized: str,
        *,
        has_uploaded_docs: bool,
    ) -> RouterDecision:
        del question, has_uploaded_docs
        if any(hint in normalized for hint in self.STRONG_WEB_HINTS):
            return RouterDecision(
                route="web_search",
                use_local_rag=False,
                use_web_search=True,
                response_mode="grounded_answer",
                needs_clarification=False,
                reason="fallback_web_signal",
            )
        if any(hint in normalized for hint in ("简历", "项目", "网站", "经历", "技能", "pdf", "文档")):
            return RouterDecision(
                route="local_rag",
                use_local_rag=True,
                use_web_search=False,
                response_mode="grounded_answer",
                needs_clarification=False,
                reason="fallback_local_signal",
            )
        return RouterDecision(
            route="out_of_scope",
            use_local_rag=False,
            use_web_search=False,
            response_mode="clarify",
            needs_clarification=True,
            reason="fallback_clarify",
        )

    def _normalize(self, question: str) -> str:
        return re.sub(r"\s+", "", question.lower())
