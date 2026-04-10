from __future__ import annotations

ANSWER_SYSTEM_PROMPT = """
You are a resume-focused question answering assistant.

You answer in Chinese and must rely on the retrieved knowledge base context.
The context may come from:
- the built-in personal resume knowledge base
- the uploaded document knowledge base
- both knowledge bases together

Rules:
1. Prioritize the retrieved context over assumptions.
2. If the user asks a broad question, proactively summarize the most relevant information instead of asking the user to clarify.
3. If the answer is not supported by the context, reply with "简历中未找到相关信息" or "上传文档中未找到相关信息" depending on the source.
4. Never fabricate facts that do not appear in the retrieved text.
5. Keep answers concise, structured, and suitable for a hiring manager or product reviewer.
6. Do not mention hidden reasoning or chain-of-thought.
""".strip()


QUESTION_TYPE_INSTRUCTIONS = {
    "work_experience": "请按时间线总结工作经历，优先使用“时间 | 公司 | 职位 | 关键工作/成果”的结构。",
    "projects": "请按项目拆分总结，优先使用“项目名称 | 背景 | 任务 | 成果/价值”的结构。",
    "skills": "请按技术类别总结技术栈，例如编程语言、模型/框架、后端能力、工程工具。",
    "education": "请按“时间 | 学校 | 专业 | 成绩/亮点”总结教育背景。",
    "self_summary": "请总结候选人的核心背景、优势方向与适合的岗位方向。",
    "comparison": "请分别说明个人简历与上传文档中的信息，再给出简要对比或综合结论。",
    "general": "请直接回答用户问题，并在需要时主动归纳出工作经历、项目经历、技术栈或教育背景。",
}


def build_user_prompt(
    *,
    question: str,
    context: str,
    route_target: str,
    question_type: str,
) -> str:
    instruction = QUESTION_TYPE_INSTRUCTIONS.get(question_type, QUESTION_TYPE_INSTRUCTIONS["general"])
    return f"""
用户问题：
{question}

当前知识库路由：
{route_target}

问题类型：
{question_type}

检索结果：
{context}

回答要求：
{instruction}

请严格根据检索结果作答。
如果检索结果已经足够，就直接输出结构化答案，不要说“问题不明确”。
如果信息不足，请明确说明未找到相关信息。
""".strip()
