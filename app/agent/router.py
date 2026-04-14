from __future__ import annotations

import json
import re

from app.agent.models import RelevanceDecision
from app.core.llm import get_llm_clients


class LocalRelevanceJudge:
    VALID_RELEVANCE = {"high", "medium", "low"}

    def __init__(self):
        self.clients = get_llm_clients()

    def judge(self, question: str, *, has_uploaded_docs: bool) -> RelevanceDecision:
        prompt = f"""
请判断“本地资料是否有助于回答这个问题”。

本地资料包括：
- 站长个人简历
- 项目经历
- 技能与工作经历
- 上传文档（如果存在）

输出 JSON：
{{
  "relevance": "high|medium|low",
  "reason": "..."
}}

判断标准：
- high：本地资料直接相关，强烈建议检索
- medium：本地资料可能有帮助，建议作为补充上下文
- low：本地资料基本无帮助，可直接回答或联网补充

当前是否存在上传文档：{"yes" if has_uploaded_docs else "no"}
用户问题：{question}
""".strip()

        try:
            response = self.clients.chat_model.invoke(prompt)
            return self._validate(self._parse_payload(str(response.content)), question)
        except Exception:
            return self._fallback(question)

    def _parse_payload(self, content: str) -> RelevanceDecision:
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.DOTALL)
        payload = json.loads(cleaned)
        return RelevanceDecision(
            relevance=str(payload.get("relevance", "")).strip().lower(),
            reason=str(payload.get("reason", "")).strip() or "llm_relevance",
        )

    def _validate(self, decision: RelevanceDecision, question: str) -> RelevanceDecision:
        if decision.relevance in self.VALID_RELEVANCE:
            return decision
        return self._fallback(question)

    def _fallback(self, question: str) -> RelevanceDecision:
        normalized = re.sub(r"\s+", "", question.lower())
        high_hints = ("你", "你的", "简历", "项目", "网站", "经历", "技能", "上传", "pdf", "文档")
        low_hints = ("最新", "最近", "今天", "新闻", "天气", "股价", "黄金", "汇率")
        if any(hint in normalized for hint in high_hints):
            return RelevanceDecision(relevance="high", reason="fallback_high_signal")
        if any(hint in normalized for hint in low_hints):
            return RelevanceDecision(relevance="low", reason="fallback_low_signal")
        return RelevanceDecision(relevance="medium", reason="fallback_medium_default")
