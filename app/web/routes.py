from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.core.config import Settings


router = APIRouter()
templates = Jinja2Templates(directory=str(Settings.BASE_DIR / "templates"))


@router.get("/", response_class=HTMLResponse)
def home(request: Request) -> HTMLResponse:
    context = {
        "request": request,
        "profile": {
            "name": "孙雪海",
            "title": "AI应用开发工程师",
            "tagline": "专注于 RAG、Agent 与大模型应用开发",
            "location": "安徽",
            "email": "2902066338@qq.com",
            "phone": "13989403674",
        },
        "experience": [
            {
                "period": "2025.07 - 2026.03",
                "company": "安徽兰智大数据科技有限公司",
                "role": "AI应用开发工程师",
                "summary": "参与大模型训推教一体机与课堂评价分析系统，负责 API 服务化、任务管理与模型能力接入。",
            },
            {
                "period": "2024.07 - 2024.09",
                "company": "合肥数模智能科技有限公司",
                "role": "视觉开发工程师",
                "summary": "参与工业缺陷检测与 OCR 标签识别系统，完成检测模型、识别模块和可视化界面开发。",
            },
        ],
        "projects": [
            {
                "name": "大模型训推教一体机",
                "stack": "FastAPI / LLaMA-Factory / SQLAlchemy / OpenAI-Compatible API",
                "description": "把原本依赖命令行的大模型训练与推理能力，改造成可编排、可监控、可代理的后端服务链路。",
            },
            {
                "name": "数学课堂评价分析系统",
                "stack": "Python / ASR / DeepSeek-V3 / Qwen-Plus",
                "description": "围绕课堂视频分析，完成音频转写、文本修复、话语分类与分析报告生成。",
            },
            {
                "name": "汽车机油滤芯缺陷检测系统",
                "stack": "YOLO / PaddleOCR / OpenCV / PyQt5",
                "description": "面向工业场景构建自动化缺陷检测和标签识别系统，提升检测准确率与生产效率。",
            },
            {
                "name": "Resume Assistant",
                "stack": "FastAPI / Chroma / LangChain / RAG",
                "description": "将个人简历与上传文档拆分为双知识库，通过路由检索实现“问我自己”和“问上传文档”的统一问答体验。",
            },
        ],
        "skills": [
            "Python",
            "FastAPI",
            "LangChain",
            "LangGraph",
            "RAG",
            "Agent",
            "PyTorch",
            "OpenCV",
            "Docker",
            "MySQL",
        ],
        "api_base_url": Settings.API_BASE_URL,
    }
    return templates.TemplateResponse(request, "index.html", context)
