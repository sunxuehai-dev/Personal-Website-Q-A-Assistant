from __future__ import annotations

from dataclasses import dataclass

from langchain_core.documents import Document

from app.agent.prompts import ANSWER_SYSTEM_PROMPT, build_user_prompt
from app.agent.questioning import QuestionTypeClassifier, QuestionTypeDecision
from app.agent.routing import KnowledgeRouter, RouteDecision
from app.core.config import Settings
from app.core.llm import get_llm_clients
from app.retrieval.retriever import ResumeRetriever, UploadedDocumentRetriever


@dataclass
class QAResponse:
    answer: str
    references: list[dict]
    route_target: str
    route_reason: str
    question_type: str
    question_type_reason: str


class ResumeQAService:
    """Resume question-answering service built on retrieval + generation."""

    REFUSAL_PHRASES = [
        "问题不明确",
        "无法直接回答",
        "请提供具体问题",
        "请提供更具体的问题",
        "需要更具体",
    ]

    def __init__(self, top_k: int = 4):
        self.self_retriever = ResumeRetriever(top_k=top_k)
        self.upload_retriever = UploadedDocumentRetriever(top_k=top_k)
        self.router = KnowledgeRouter()
        self.question_classifier = QuestionTypeClassifier()
        self.clients = get_llm_clients()

    def _build_references(self, documents: list[Document]) -> list[dict]:
        references: list[dict] = []
        for document in documents:
            content = document.page_content.strip()
            references.append(
                {
                    "source_file": document.metadata.get("source_file"),
                    "page": document.metadata.get("page_label", document.metadata.get("page")),
                    "content": content,
                    "doc_type": document.metadata.get("doc_type"),
                }
            )
        return references

    def _get_documents(self, question: str, route: RouteDecision) -> list[Document]:
        if route.target == KnowledgeRouter.SELF_TARGET:
            return self.self_retriever.similarity_search(question)
        if route.target == KnowledgeRouter.UPLOAD_TARGET:
            return self.upload_retriever.similarity_search(question)

        self_docs = self.self_retriever.similarity_search(question, top_k=2)
        upload_docs = self.upload_retriever.similarity_search(question, top_k=2)
        return self_docs + upload_docs

    def _deduplicate_documents(self, documents: list[Document]) -> list[Document]:
        seen: set[tuple[str, str, str]] = set()
        unique_documents: list[Document] = []
        for document in documents:
            key = (
                str(document.metadata.get("doc_type")),
                str(document.metadata.get("source_file")),
                " ".join(document.page_content.split())[:200],
            )
            if key in seen:
                continue
            seen.add(key)
            unique_documents.append(document)
        return unique_documents

    def _format_context(self, documents: list[Document]) -> str:
        sections: list[str] = []
        for index, document in enumerate(documents, start=1):
            source_file = document.metadata.get("source_file", "unknown")
            page = document.metadata.get("page_label", document.metadata.get("page", ""))
            doc_type = document.metadata.get("doc_type", "unknown")
            header = f"[Chunk {index}] doc_type={doc_type} source={source_file}"
            if page != "":
                header += f" page={page}"
            sections.append(f"{header}\n{document.page_content}")
        return "\n\n".join(sections)

    def _has_uploaded_docs(self, use_uploaded_docs: bool) -> bool:
        return use_uploaded_docs and any(Settings.UPLOAD_DIR.glob("*.pdf"))

    def _normalize_answer(self, answer: str) -> str:
        normalized = answer.strip()
        prefixes = [
            "\u7528\u6237\u7684\u95ee\u9898\u4e0d\u660e\u786e\uff0c\u4f46\u6839\u636e\u63d0\u4f9b\u7684\u7b80\u5386\u5185\u5bb9\uff0c\u6211\u53ef\u4ee5\u603b\u7ed3\u51fa\u4ee5\u4e0b\u4fe1\u606f\uff1a",
            "\u6839\u636e\u63d0\u4f9b\u7684\u7b80\u5386\u5185\u5bb9\uff0c\u6211\u53ef\u4ee5\u603b\u7ed3\u51fa\u4ee5\u4e0b\u4fe1\u606f\uff1a",
            "\u6839\u636e\u7b80\u5386\u5185\u5bb9\uff0c",
            "\u6839\u636e\u63d0\u4f9b\u7684\u7b80\u5386\u5185\u5bb9\uff0c",
        ]
        for prefix in prefixes:
            if normalized.startswith(prefix):
                normalized = normalized[len(prefix):].lstrip()
        return normalized

    def _is_refusal(self, answer: str) -> bool:
        return any(phrase in answer for phrase in self.REFUSAL_PHRASES)

    def _build_fallback_instruction(self, question_type: str) -> str:
        mapping = {
            "work_experience": "请只提取工作经历，按“时间 | 公司 | 职位 | 关键工作/成果”分点输出。",
            "projects": "请只提取项目经历，按“项目名称 | 背景 | 任务 | 成果”分点输出。",
            "skills": "请只提取技术栈，按类别分点输出。",
            "education": "请只提取教育背景，按“时间 | 学校 | 专业 | 成绩/亮点”输出。",
            "self_summary": "请总结核心背景、优势方向与适合岗位。",
            "comparison": "请分别说明个人简历和上传文档中的要点，再给出综合结论。",
            "general": "请直接总结与问题最相关的信息。",
        }
        return mapping.get(question_type, mapping["general"])

    def _force_answer(self, question: str, context: str, question_type: str, route_target: str) -> str:
        instruction = self._build_fallback_instruction(question_type)
        messages = [
            {
                "role": "system",
                "content": (
                    "你是简历信息抽取助手。"
                    "你必须直接从给定文本中提取答案，禁止说问题不明确，禁止要求用户补充信息。"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"用户问题：{question}\n\n"
                    f"知识库来源：{route_target}\n\n"
                    f"问题类型：{question_type}\n\n"
                    f"任务要求：{instruction}\n\n"
                    "只允许依据下面的简历片段作答，不要编造信息；如果信息不足，就回答“简历中未找到相关信息”。\n\n"
                    f"简历片段：\n{context}"
                ),
            },
        ]
        response = self.clients.chat_model.invoke(messages)
        return self._normalize_answer(str(response.content))

    def _build_extractive_fallback(self, documents: list[Document]) -> str:
        lines: list[str] = []
        for document in documents:
            content = " ".join(document.page_content.split())
            if content:
                source_file = document.metadata.get("source_file", "unknown")
                doc_type = document.metadata.get("doc_type", "unknown")
                lines.append(f"- [{doc_type}] {source_file}: {content[:220]}")
        if not lines:
            return "简历中未找到相关信息。"
        return "根据检索到的简历片段，相关信息如下：\n" + "\n".join(lines[:4])

    def ask(self, question: str, use_uploaded_docs: bool = False) -> QAResponse:
        route = self.router.route(question, has_uploaded_docs=self._has_uploaded_docs(use_uploaded_docs))
        question_type = self.question_classifier.classify(question, route.target)
        documents = self._deduplicate_documents(self._get_documents(question, route))
        context = self._format_context(documents)

        messages = [
            {"role": "system", "content": ANSWER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": build_user_prompt(
                    question=question,
                    context=context,
                    route_target=route.target,
                    question_type=question_type.question_type,
                ),
            },
        ]
        response = self.clients.chat_model.invoke(messages)
        answer = self._normalize_answer(str(response.content))

        if self._is_refusal(answer):
            answer = self._force_answer(
                question,
                context,
                question_type=question_type.question_type,
                route_target=route.target,
            )

        if self._is_refusal(answer):
            answer = self._build_extractive_fallback(documents)

        return QAResponse(
            answer=answer,
            references=self._build_references(documents),
            route_target=route.target,
            route_reason=route.reason,
            question_type=question_type.question_type,
            question_type_reason=question_type.reason,
        )
