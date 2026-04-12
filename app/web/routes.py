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
            "name": "\u5b59\u96ea\u6d77",
            "title": "AI \u5e94\u7528\u5f00\u53d1\u5de5\u7a0b\u5e08",
            "tagline": "\u4e13\u6ce8\u4e8e RAG\u3001Agent \u4e0e\u5927\u6a21\u578b\u5e94\u7528\u5f00\u53d1",
            "location": "\u5b89\u5fbd",
            "email": "2902066338@qq.com",
            "phone": "13989403674",
        },
        "experience": [
            {
                "period": "2025.07 - 2026.03",
                "company": "\u5b89\u5fbd\u5170\u667a\u5927\u6570\u636e\u79d1\u6280\u6709\u9650\u516c\u53f8",
                "role": "AI \u5e94\u7528\u5f00\u53d1\u5de5\u7a0b\u5e08",
                "summary": "\u53c2\u4e0e\u5927\u6a21\u578b\u8bad\u63a8\u6559\u4e00\u4f53\u673a\u4e0e\u8bfe\u5802\u8bc4\u4ef7\u5206\u6790\u7cfb\u7edf\uff0c\u8d1f\u8d23 API \u670d\u52a1\u5316\u3001\u4efb\u52a1\u7ba1\u7406\u4e0e\u6a21\u578b\u80fd\u529b\u63a5\u5165\u3002",
            },
            {
                "period": "2024.07 - 2024.09",
                "company": "\u5408\u80a5\u6570\u6a21\u667a\u80fd\u79d1\u6280\u6709\u9650\u516c\u53f8",
                "role": "\u89c6\u89c9\u5f00\u53d1\u5de5\u7a0b\u5e08",
                "summary": "\u53c2\u4e0e\u5de5\u4e1a\u7f3a\u9677\u68c0\u6d4b\u4e0e OCR \u6807\u7b7e\u8bc6\u522b\u7cfb\u7edf\uff0c\u5b8c\u6210\u68c0\u6d4b\u6a21\u578b\u3001\u8bc6\u522b\u6a21\u5757\u548c\u53ef\u89c6\u5316\u754c\u9762\u5f00\u53d1\u3002",
            },
        ],
        "projects": [
            {
                "name": "\u5927\u6a21\u578b\u8bad\u63a8\u6559\u4e00\u4f53\u673a",
                "stack": "FastAPI / LLaMA-Factory / SQLAlchemy / OpenAI-Compatible API",
                "description": "\u628a\u539f\u672c\u4f9d\u8d56\u547d\u4ee4\u884c\u7684\u5927\u6a21\u578b\u8bad\u7ec3\u4e0e\u63a8\u7406\u80fd\u529b\uff0c\u6539\u9020\u6210\u53ef\u7f16\u6392\u3001\u53ef\u76d1\u63a7\u3001\u53ef\u4ee3\u7406\u7684\u540e\u7aef\u670d\u52a1\u94fe\u8def\u3002",
            },
            {
                "name": "\u6570\u5b66\u8bfe\u5802\u8bc4\u4ef7\u5206\u6790\u7cfb\u7edf",
                "stack": "Python / ASR / DeepSeek-V3 / Qwen-Plus",
                "description": "\u56f4\u7ed5\u8bfe\u5802\u89c6\u9891\u5206\u6790\uff0c\u5b8c\u6210\u97f3\u9891\u8f6c\u5199\u3001\u6587\u672c\u4fee\u590d\u3001\u8bdd\u8bed\u5206\u7c7b\u4e0e\u5206\u6790\u62a5\u544a\u751f\u6210\u3002",
            },
            {
                "name": "\u6c7d\u8f66\u673a\u6cb9\u6ee4\u82af\u7f3a\u9677\u68c0\u6d4b\u7cfb\u7edf",
                "stack": "YOLO / PaddleOCR / OpenCV / PyQt5",
                "description": "\u9762\u5411\u5de5\u4e1a\u573a\u666f\u6784\u5efa\u81ea\u52a8\u5316\u7f3a\u9677\u68c0\u6d4b\u548c\u6807\u7b7e\u8bc6\u522b\u7cfb\u7edf\uff0c\u63d0\u5347\u68c0\u6d4b\u51c6\u786e\u7387\u4e0e\u751f\u4ea7\u6548\u7387\u3002",
            },
            {
                "name": "Resume Assistant",
                "stack": "FastAPI / Chroma / LangChain / RAG",
                "description": "\u5c06\u4e2a\u4eba\u7b80\u5386\u4e0e\u4e0a\u4f20\u6587\u6863\u62c6\u5206\u4e3a\u53cc\u77e5\u8bc6\u5e93\uff0c\u901a\u8fc7\u8def\u7531\u68c0\u7d22\u5b9e\u73b0\u201c\u95ee\u6211\u81ea\u5df1\u201d\u548c\u201c\u95ee\u4e0a\u4f20\u6587\u6863\u201d\u7684\u7edf\u4e00\u95ee\u7b54\u4f53\u9a8c\u3002",
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
    }
    return templates.TemplateResponse(request, "index.html", context)
