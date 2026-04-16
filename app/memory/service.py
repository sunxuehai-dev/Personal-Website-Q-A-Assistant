from __future__ import annotations

import re
from collections import deque
from datetime import datetime, timezone
from threading import Lock

from app.core.config import Settings
from app.memory.models import ConversationMessage, ConversationSession


class SessionMemoryService:
    """In-process short-term memory for recent chat turns."""

    FOLLOW_UP_HINTS = (
        "这个",
        "那个",
        "它",
        "他",
        "她",
        "那",
        "再",
        "继续",
        "展开",
        "详细",
        "具体",
        "然后",
        "部署",
        "接口",
        "实现",
        "方案",
        "what about",
        "how about",
        "that",
        "it",
        "more",
        "continue",
    )

    def __init__(self, max_turns: int | None = None):
        turns = max_turns or Settings.SESSION_MEMORY_MAX_TURNS
        self.max_messages = max(2, turns * 2)
        self._sessions: dict[str, ConversationSession] = {}
        self._lock = Lock()

    def get_recent_messages(self, session_id: str | None) -> list[ConversationMessage]:
        if not session_id:
            return []
        with self._lock:
            session = self._sessions.get(session_id)
            return [] if session is None else list(session.messages)

    def append_message(self, session_id: str | None, role: str, content: str) -> None:
        if not session_id:
            return
        content = content.strip()
        if not content:
            return

        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                session = ConversationSession(session_id=session_id)
                self._sessions[session_id] = session

            messages = deque(session.messages, maxlen=self.max_messages)
            messages.append(ConversationMessage(role=role, content=content))
            session.messages = list(messages)
            session.updated_at = datetime.now(timezone.utc)

    def clear_session(self, session_id: str | None) -> int:
        if not session_id:
            return 0
        with self._lock:
            session = self._sessions.pop(session_id, None)
            return 0 if session is None else len(session.messages)

    def format_recent_context(self, messages: list[ConversationMessage], max_messages: int = 4) -> str:
        if not messages:
            return ""
        lines: list[str] = []
        for item in messages[-max_messages:]:
            role = "user" if item.role == "user" else "assistant"
            lines.append(f"{role}: {item.content}")
        return "\n".join(lines)

    def build_contextual_question(self, question: str, messages: list[ConversationMessage]) -> str:
        question = question.strip()
        if not question or not messages or not self._looks_like_follow_up(question):
            return question

        recent_context = self.format_recent_context(messages, max_messages=3)
        if not recent_context:
            return question

        return (
            "Conversation context:\n"
            f"{recent_context}\n\n"
            "Current user question:\n"
            f"{question}"
        )

    def _looks_like_follow_up(self, question: str) -> bool:
        normalized = re.sub(r"\s+", "", question.lower())
        if len(normalized) <= 18:
            return True
        return any(hint in normalized for hint in self.FOLLOW_UP_HINTS)


session_memory_service = SessionMemoryService()
