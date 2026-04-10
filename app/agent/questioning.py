from __future__ import annotations

from dataclasses import dataclass

from app.core.llm import get_llm_clients


@dataclass
class QuestionTypeDecision:
    question_type: str
    reason: str


class QuestionTypeClassifier:
    """Classify questions so answers can use more stable structured prompts."""

    TYPES = {
        "work_experience",
        "projects",
        "skills",
        "education",
        "self_summary",
        "comparison",
        "general",
    }

    WORK_HINTS = [
        "\u5de5\u4f5c\u7ecf\u5386",
        "\u5b9e\u4e60",
        "\u4efb\u804c",
        "\u516c\u53f8",
        "\u5c97\u4f4d",
        "\u804c\u4f4d",
        "career",
        "experience",
    ]
    PROJECT_HINTS = [
        "\u9879\u76ee",
        "\u505a\u8fc7\u54ea\u4e9b",
        "\u6848\u4f8b",
        "\u9879\u76ee\u7ecf\u5386",
        "project",
        "projects",
    ]
    SKILL_HINTS = [
        "\u6280\u672f\u6808",
        "\u6280\u80fd",
        "\u4f1a\u4ec0\u4e48",
        "\u64c5\u957f",
        "\u6846\u67b6",
        "\u5de5\u5177",
        "skill",
        "skills",
        "tech stack",
    ]
    EDUCATION_HINTS = [
        "\u6559\u80b2",
        "\u5b66\u6821",
        "\u5b66\u5386",
        "\u4e13\u4e1a",
        "gpa",
        "education",
        "college",
        "university",
    ]
    COMPARISON_HINTS = [
        "\u7efc\u5408",
        "\u5bf9\u6bd4",
        "\u7ed3\u5408",
        "\u4e00\u8d77\u770b",
        "\u5bf9\u7167",
        "compare",
        "comparison",
    ]
    SUMMARY_HINTS = [
        "\u9002\u5408",
        "\u4f18\u52bf",
        "\u8bc4\u4ef7",
        "\u4ecb\u7ecd\u4e00\u4e0b\u4f60\u81ea\u5df1",
        "\u603b\u7ed3\u4e00\u4e0b\u4f60",
        "\u81ea\u6211\u4ecb\u7ecd",
        "summary",
        "introduce yourself",
        "strength",
    ]

    def __init__(self):
        self.clients = get_llm_clients()

    def classify(self, question: str, route_target: str) -> QuestionTypeDecision:
        lowered = question.lower()

        if any(token in question or token in lowered for token in self.WORK_HINTS):
            return QuestionTypeDecision("work_experience", "keyword_work")
        if any(token in question or token in lowered for token in self.PROJECT_HINTS):
            return QuestionTypeDecision("projects", "keyword_project")
        if any(token in question or token in lowered for token in self.SKILL_HINTS):
            return QuestionTypeDecision("skills", "keyword_skills")
        if any(token in question or token in lowered for token in self.EDUCATION_HINTS):
            return QuestionTypeDecision("education", "keyword_education")
        if route_target == "both" or any(token in question or token in lowered for token in self.COMPARISON_HINTS):
            return QuestionTypeDecision("comparison", "keyword_comparison")
        if any(token in question or token in lowered for token in self.SUMMARY_HINTS):
            return QuestionTypeDecision("self_summary", "keyword_summary")

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a question classifier. "
                    "Return only one label from: work_experience, projects, skills, education, self_summary, comparison, general."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Question: {question}\n"
                    f"Route target: {route_target}\n"
                    "Return one label only."
                ),
            },
        ]
        response = self.clients.chat_model.invoke(messages)
        label = str(response.content).strip().lower()
        for item in self.TYPES:
            if item in label:
                return QuestionTypeDecision(item, "llm")
        return QuestionTypeDecision("general", "fallback_general")
