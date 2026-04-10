from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
from langchain_core.documents import Document

from app.api import routes as api_routes
from app.agent import questioning, routing, service as agent_service
from app.core.config import Settings
from app.main import create_app
from app.uploads.service import UploadKnowledgeBaseService


STORE: dict[str, list[Document]] = {
    "self": [],
    "upload": [],
}


class FakeMessage:
    def __init__(self, content: str):
        self.content = content


class FakeChatModel:
    def invoke(self, messages):
        user_content = messages[-1]["content"]
        if "Return one label only." in user_content:
            if "Route target:" in user_content:
                if "工作经历" in user_content:
                    return FakeMessage("work_experience")
                return FakeMessage("general")
            if "uploaded PDF document" in user_content:
                if "上传" in user_content or "pdf" in user_content.lower():
                    return FakeMessage("uploaded_docs")
                return FakeMessage("self_resume")
        return FakeMessage("这是 smoke test 的 mock 回答。")


class FakeEmbeddings:
    def embed_documents(self, texts):
        return [[0.0, 0.0, 0.0] for _ in texts]

    def embed_query(self, text):
        return [0.0, 0.0, 0.0]


class FakeClients:
    def __init__(self):
        self.chat_model = FakeChatModel()
        self.embedding_model = FakeEmbeddings()


class FakeResumeRetriever:
    def __init__(self, top_k: int = 4):
        self.top_k = top_k

    def similarity_search(self, query: str, top_k: int | None = None):
        limit = top_k or self.top_k
        return STORE["self"][:limit]


class FakeUploadedRetriever(FakeResumeRetriever):
    def similarity_search(self, query: str, top_k: int | None = None):
        limit = top_k or self.top_k
        return STORE["upload"][:limit]


class FakePipeline:
    def __init__(self, *args, collection_name: str | None = None, doc_type: str = "self_resume", **kwargs):
        self.collection_name = collection_name or Settings.UPLOAD_COLLECTION_NAME
        self.doc_type = doc_type

    def ingest(self, file_name: str) -> dict:
        STORE["upload"] = [
            Document(
                page_content="这是一份上传文档的测试内容，包含项目说明和候选人信息。",
                metadata={
                    "source_file": file_name,
                    "page": 1,
                    "page_label": "1",
                    "doc_type": "uploaded_docs",
                },
            )
        ]
        return {
            "file_name": file_name,
            "chunk_count": 1,
            "collection_name": self.collection_name,
        }


class FakePersistentClient:
    def __init__(self, path: str):
        self.path = path

    def delete_collection(self, name: str) -> None:
        STORE["upload"] = []


def configure_temp_settings(tmp_path: Path) -> None:
    Settings.DATA_DIR = tmp_path / "data"
    Settings.SELF_RESUME_DIR = Settings.DATA_DIR / "self_resume"
    Settings.UPLOAD_DIR = Settings.DATA_DIR / "uploads"
    Settings.CHROMA_DIR = Settings.DATA_DIR / "chroma"
    Settings.SELF_RESUME_CHROMA_DIR = Settings.CHROMA_DIR / "self_resume"
    Settings.UPLOAD_CHROMA_DIR = Settings.CHROMA_DIR / "uploaded_docs"
    Settings.ensure_directories()


def test_upload_reset_keeps_chroma_files_but_clears_upload_state(tmp_path, monkeypatch):
    configure_temp_settings(tmp_path)

    uploaded_pdf = Settings.UPLOAD_DIR / "uploaded.pdf"
    uploaded_pdf.write_bytes(b"%PDF-1.4 mock")
    sqlite_file = Settings.UPLOAD_CHROMA_DIR / "chroma.sqlite3"
    sqlite_file.write_text("locked placeholder", encoding="utf-8")

    monkeypatch.setattr("app.uploads.service.chromadb.PersistentClient", FakePersistentClient)

    service = UploadKnowledgeBaseService()
    status = service.reset()

    assert status["has_uploaded_docs"] is False
    assert not uploaded_pdf.exists()
    assert sqlite_file.exists()


def test_api_smoke_without_network(tmp_path, monkeypatch):
    configure_temp_settings(tmp_path)

    resume_pdf = Settings.SELF_RESUME_DIR / "self_resume.pdf"
    resume_pdf.write_bytes(b"%PDF-1.4 self")
    STORE["self"] = [
        Document(
            page_content="孙雪海有 AI 应用开发、检索增强和智能体开发经验。",
            metadata={
                "source_file": resume_pdf.name,
                "page": 1,
                "page_label": "1",
                "doc_type": "self_resume",
            },
        )
    ]
    STORE["upload"] = []

    fake_clients = FakeClients()

    monkeypatch.setattr(api_routes, "ResumeIngestionPipeline", FakePipeline)
    monkeypatch.setattr(api_routes, "upload_kb_service", UploadKnowledgeBaseService())
    monkeypatch.setattr(agent_service, "ResumeRetriever", FakeResumeRetriever)
    monkeypatch.setattr(agent_service, "UploadedDocumentRetriever", FakeUploadedRetriever)
    monkeypatch.setattr(agent_service, "get_llm_clients", lambda: fake_clients)
    monkeypatch.setattr(routing, "get_llm_clients", lambda: fake_clients)
    monkeypatch.setattr(questioning, "get_llm_clients", lambda: fake_clients)
    monkeypatch.setattr("app.uploads.service.chromadb.PersistentClient", FakePersistentClient)

    client = TestClient(create_app())

    health_response = client.get("/health")
    assert health_response.status_code == 200
    assert health_response.json()["status"] == "ok"

    upload_status_before = client.get("/upload_status")
    assert upload_status_before.status_code == 200
    assert upload_status_before.json()["has_uploaded_docs"] is False

    upload_response = client.post(
        "/upload_resume",
        files={"file": ("uploaded.pdf", b"%PDF-1.4 uploaded", "application/pdf")},
    )
    assert upload_response.status_code == 200
    assert upload_response.json()["chunk_count"] == 1

    self_chat_response = client.post(
        "/chat",
        json={"question": "请介绍孙雪海的工作经历", "use_uploaded_docs": False},
    )
    assert self_chat_response.status_code == 200
    assert self_chat_response.json()["route_target"] == "self_resume"
    assert self_chat_response.json()["question_type"] == "work_experience"

    upload_chat_response = client.post(
        "/chat",
        json={"question": "这份上传的pdf讲了什么", "use_uploaded_docs": True},
    )
    assert upload_chat_response.status_code == 200
    assert upload_chat_response.json()["route_target"] == "uploaded_docs"
    assert upload_chat_response.json()["references"]

    clear_response = client.delete("/upload_status")
    assert clear_response.status_code == 200
    assert clear_response.json()["has_uploaded_docs"] is False
