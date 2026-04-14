from __future__ import annotations

from app.agent.models import EvaluationDecision


class AnswerEvaluator:
    FAILURE_PHRASES = (
        "当前本地资料中没有找到足够信息",
        "当前没有足够信息",
        "未找到相关内容",
        "无法判断",
        "没有找到",
        "信息不足",
    )
    VAGUE_QUESTION_HINTS = (
        "这个怎么样",
        "展开说说",
        "详细一点",
        "还有呢",
        "继续",
        "细说",
    )

    def evaluate(
        self,
        *,
        question: str,
        relevance: str,
        retrieval_quality: str,
        answer: str,
        retry: bool,
    ) -> EvaluationDecision:
        if retry:
            return EvaluationDecision(decision="pass", reason="retry_already_used")

        normalized_question = question.strip().lower()
        normalized_answer = answer.strip()

        if any(hint in normalized_question for hint in self.VAGUE_QUESTION_HINTS):
            return EvaluationDecision(decision="pass", reason="question_is_vague")

        answer_failed = (
            len(normalized_answer) < 18
            or any(phrase in normalized_answer for phrase in self.FAILURE_PHRASES)
        )

        if relevance == "high" and retrieval_quality == "empty":
            return EvaluationDecision(decision="retry", reason="high_relevance_requires_local_retry")

        if relevance in {"high", "medium"} and retrieval_quality in {"weak", "empty"} and answer_failed:
            return EvaluationDecision(decision="retry", reason="weak_local_retrieval_and_failed_answer")

        if relevance == "high" and answer_failed:
            return EvaluationDecision(decision="retry", reason="high_relevance_but_answer_failed")

        return EvaluationDecision(decision="pass", reason="answer_accepted")
