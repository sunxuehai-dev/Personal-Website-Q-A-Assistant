from __future__ import annotations

import re

from app.agent.models import QueryAnalysis


class QueryAnalyzer:
    SELF_SCOPE = "self_resume"
    UPLOAD_SCOPE = "uploaded_docs"
    BOTH_SCOPE = "both"

    COMPARE_HINTS = [
        "对比",
        "比较",
        "结合",
        "综合",
        "一起",
        "对照",
        "compare",
        "comparison",
        "both",
        "together",
    ]
    SUMMARY_HINTS = [
        "总结",
        "概括",
        "介绍",
        "聊聊",
        "说说",
        "概述",
        "主要讲了什么",
        "summary",
        "summarize",
        "introduce",
    ]
    LOCATE_HINTS = [
        "提到",
        "哪里",
        "哪一页",
        "哪部分",
        "在哪",
        "有没有",
        "有吗",
        "是否有",
        "有没有写",
        "locate",
        "mention",
    ]
    FACT_HINTS = [
        "是什么",
        "多少",
        "谁",
        "哪个",
        "地址",
        "邮箱",
        "电话",
        "网站",
        "网址",
        "链接",
        "域名",
        "ip",
        "email",
        "phone",
        "where",
        "what",
    ]
    SELF_HINTS = [
        "我",
        "我的",
        "本人",
        "孙雪海",
        "你自己",
        "你的经历",
        "你的项目",
        "你的简历",
        "你的个人网站",
        "your resume",
        "sun xuehai",
    ]
    UPLOAD_HINTS = [
        "上传",
        "上传的",
        "文档",
        "文件",
        "附件",
        "材料",
        "这个pdf",
        "这份pdf",
        "这份简历",
        "uploaded",
        "upload",
        "attachment",
        "pdf",
    ]
    QUESTION_FILLERS = [
        "请问",
        "请",
        "一个",
        "有吗",
        "有没有",
        "是否",
        "呢",
        "啊",
        "呀",
        "是什么",
        "多少",
        "哪个",
        "什么",
    ]
    TERM_EXPANSIONS = {
        "网站": ["个人网站", "网站", "网址", "链接", "域名", "问答助手", "ip"],
        "网址": ["个人网站", "网站", "网址", "链接", "域名", "问答助手", "ip"],
        "邮箱": ["邮箱", "邮件", "email"],
        "电话": ["电话", "手机号", "联系方式", "phone"],
        "地址": ["地址", "地点", "location"],
    }

    def analyze(
        self,
        question: str,
        *,
        use_uploaded_docs: bool,
        has_uploaded_docs: bool,
    ) -> QueryAnalysis:
        normalized_question = self._normalize(question)
        source_scope, source_reason = self._determine_source_scope(
            question,
            normalized_question=normalized_question,
            use_uploaded_docs=use_uploaded_docs,
            has_uploaded_docs=has_uploaded_docs,
        )
        task_type, task_reason = self._determine_task_type(question, normalized_question)
        query_terms = self._extract_query_terms(question, normalized_question)
        needs_keyword = task_type in {"fact", "locate"} or any(len(term) <= 8 for term in query_terms)
        top_k = 6 if task_type in {"fact", "locate"} else 4
        if task_type == "compare":
            top_k = 3

        return QueryAnalysis(
            question=question,
            normalized_question=normalized_question,
            task_type=task_type,
            task_reason=task_reason,
            source_scope=source_scope,
            source_reason=source_reason,
            query_terms=query_terms,
            needs_keyword=needs_keyword,
            top_k=top_k,
        )

    def _determine_source_scope(
        self,
        question: str,
        *,
        normalized_question: str,
        use_uploaded_docs: bool,
        has_uploaded_docs: bool,
    ) -> tuple[str, str]:
        if not use_uploaded_docs or not has_uploaded_docs:
            return self.SELF_SCOPE, "session_self_only"

        self_hit = any(hint in question.lower() or hint in normalized_question for hint in self.SELF_HINTS)
        upload_hit = any(hint in question.lower() or hint in normalized_question for hint in self.UPLOAD_HINTS)
        compare_hit = any(hint in question.lower() or hint in normalized_question for hint in self.COMPARE_HINTS)

        if compare_hit or (self_hit and upload_hit):
            return self.BOTH_SCOPE, "analysis_compare_scope"
        if self_hit and not upload_hit:
            return self.SELF_SCOPE, "analysis_explicit_self_scope"
        if upload_hit:
            return self.UPLOAD_SCOPE, "analysis_upload_scope"
        return self.UPLOAD_SCOPE, "analysis_default_upload_scope"

    def _determine_task_type(self, question: str, normalized_question: str) -> tuple[str, str]:
        if any(hint in question.lower() or hint in normalized_question for hint in self.COMPARE_HINTS):
            return "compare", "analysis_compare"
        if any(hint in question.lower() or hint in normalized_question for hint in self.LOCATE_HINTS):
            return "locate", "analysis_locate"
        if any(hint in question.lower() or hint in normalized_question for hint in self.FACT_HINTS):
            return "fact", "analysis_fact"
        if any(hint in question.lower() or hint in normalized_question for hint in self.SUMMARY_HINTS):
            return "summary", "analysis_summary"
        return "summary", "analysis_default_summary"

    def _extract_query_terms(self, question: str, normalized_question: str) -> list[str]:
        terms: list[str] = []

        special_tokens = re.findall(
            r"(?:\b\d{1,3}(?:\.\d{1,3}){3}\b|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|https?://\S+)",
            question,
        )
        terms.extend(token.lower() for token in special_tokens)

        english_terms = re.findall(r"\b[a-zA-Z][a-zA-Z0-9_-]{1,}\b", question.lower())
        terms.extend(english_terms)

        cleaned = normalized_question
        for filler in self.QUESTION_FILLERS:
            cleaned = cleaned.replace(filler, "")
        cleaned = re.sub(r"[^\u4e00-\u9fffA-Za-z0-9]", "", cleaned)

        if len(cleaned) >= 2:
            terms.append(cleaned)
            max_ngram = min(6, len(cleaned))
            min_ngram = 2 if len(cleaned) <= 6 else 3
            for size in range(max_ngram, min_ngram - 1, -1):
                for start in range(0, len(cleaned) - size + 1):
                    terms.append(cleaned[start:start + size])

        for anchor, expanded in self.TERM_EXPANSIONS.items():
            if anchor in question or anchor in normalized_question:
                terms.extend(expanded)

        unique_terms: list[str] = []
        seen: set[str] = set()
        for term in terms:
            normalized_term = term.strip().lower()
            if len(normalized_term) < 2 or normalized_term in seen:
                continue
            seen.add(normalized_term)
            unique_terms.append(normalized_term)
        return unique_terms[:12]

    def _normalize(self, question: str) -> str:
        return re.sub(r"\s+", "", question.lower())
