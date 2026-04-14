from __future__ import annotations

import json
import re

from app.core.llm import get_llm_clients


class RetryRewriter:
    def __init__(self):
        self.clients = get_llm_clients()

    def rewrite(self, question: str, *, relevance: str) -> str:
        prompt = f"""
请把下面的问题重写成更适合本地知识库检索的一句话。
要求：
1. 保持原意，不要扩写成多问句。
2. 如果问题和个人经历、项目、技能、个人网站有关，可以显式补足主题。
3. 只输出 JSON。

{{
  "rewritten_question": "..."
}}

相关度：{relevance}
原问题：{question}
""".strip()

        try:
            response = self.clients.chat_model.invoke(prompt)
            cleaned = str(response.content).strip()
            if cleaned.startswith("```"):
                cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.DOTALL)
            payload = json.loads(cleaned)
            rewritten = str(payload.get("rewritten_question", "")).strip()
            return rewritten or question
        except Exception:
            return question
