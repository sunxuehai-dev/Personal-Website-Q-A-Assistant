from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient
from langchain_core.documents import Document

from app.agent import service as agent_service
from app.api import routes as api_routes
from app.core.config import Settings
from app.main import create_app
from app.uploads.service import UploadKnowledgeBaseService
from scripts import ingest_self_resume


STORE: dict[str, list[Document]] = {
    "self": [],
    "upload": [],
}


class FakeMessage:
    def __init__(self, content: str):
        self.content = content


class FakeChoice:
    def __init__(self, content: str):
        self.message = type("Message", (), {"content": content})()


class FakeDeltaChoice:
    def __init__(self, content: str):
        self.delta = type("Delta", (), {"content": content})()


class FakeChatCompletionResponse:
    def __init__(self, content: str):
        self.choices = [FakeChoice(content)]


class FakeChatCompletionChunk:
    def __init__(self, content: str):
        self.choices = [FakeDeltaChoice(content)]


class FakeChatModel:
    def invoke(self, messages):
        if isinstance(messages, str):
            return FakeMessage(self._json_response(messages))

        payload = messages[1]["content"]
        if "本地资料证据" in payload and "无" not in payload:
            return FakeMessage("根据本地资料，孙雪海有 AI 应用开发、RAG 和个人网站相关项目经验。")
        return FakeMessage("这是通用回答。")

    def stream(self, messages):
        content = str(self.invoke(messages).content)
        midpoint = max(1, len(content) // 2)
        yield FakeMessage(content[:midpoint])
        yield FakeMessage(content[midpoint:])

    def _json_response(self, prompt: str) -> str:
        if "本地资料是否有助于回答这个问题" in prompt:
            if "你的个人网站是什么" in prompt:
                payload = {"relevance": "high", "reason": "asking personal profile info"}
            elif "现在主流的 agent 框架有哪些" in prompt:
                payload = {"relevance": "low", "reason": "external latest topic"}
            else:
                payload = {"relevance": "medium", "reason": "project topic may benefit from local context"}
            return json.dumps(payload, ensure_ascii=False)

        if "重写成更适合本地知识库检索的一句话" in prompt:
            payload = {"rewritten_question": "孙雪海个人项目的技术方案、工程实现和亮点是什么"}
            return json.dumps(payload, ensure_ascii=False)

        return json.dumps({"relevance": "medium", "reason": "default"}, ensure_ascii=False)


class FakeEmbeddings:
    def embed_documents(self, texts):
        return [[0.0, 0.0, 0.0] for _ in texts]

    def embed_query(self, text):
        return [0.0, 0.0, 0.0]


class FakeResponseClient:
    def __init__(self):
        self.chat = self
        self.completions = self

    def create(self, *args, **kwargs):
        del args
        messages = kwargs.get("messages", [])
        payload = messages[1]["content"] if len(messages) > 1 else ""
        if kwargs.get("stream") is True:
            if "现在主流的 agent 框架有哪些" in payload:
                chunks = ["当前主流 Agent 框架包括", " LangGraph、AutoGen、CrewAI 等。"]
            elif "无" in payload:
                chunks = ["我目前没有可靠的本地资料证据，", "但可以先给你一个通用回答。"]
            else:
                chunks = ["根据本地资料，", "孙雪海有 AI 应用开发、RAG 和个人网站相关项目经验。"]
            return iter(FakeChatCompletionChunk(chunk) for chunk in chunks)
        if "现在主流的 agent 框架有哪些" in payload:
            return FakeChatCompletionResponse("当前主流 Agent 框架包括 LangGraph、AutoGen、CrewAI 等。")
        if "无" in payload:
            return FakeChatCompletionResponse("我目前没有可靠的本地资料证据，但可以先给你一个通用回答。")
        return FakeChatCompletionResponse("根据本地资料，孙雪海有 AI 应用开发、RAG 和个人网站相关项目经验。")


class FakeClients:
    def __init__(self):
        self.chat_model = FakeChatModel()
        self.embedding_model = FakeEmbeddings()
        self.response_client = FakeResponseClient()


class FakeResumeRetriever:
    def __init__(self, top_k: int = 4):
        self.top_k = top_k

    def similarity_search(self, query: str, top_k: int | None = None):
        limit = top_k or self.top_k
        return STORE["self"][:limit]

    def similarity_search_with_scores(self, query: str, top_k: int | None = None):
        limit = top_k or self.top_k
        return [(doc, 0.1) for doc in STORE["self"][:limit]]


class FakeUploadedRetriever(FakeResumeRetriever):
    def similarity_search(self, query: str, top_k: int | None = None):
        limit = top_k or self.top_k
        return STORE["upload"][:limit]

    def similarity_search_with_scores(self, query: str, top_k: int | None = None):
        limit = top_k or self.top_k
        return [(doc, 0.1) for doc in STORE["upload"][:limit]]


class FakeKeywordRetriever:
    def __init__(self, *args, doc_type: str = "self_resume", **kwargs):
        self.doc_type = doc_type

    def search(self, question: str, query_terms: list[str], top_k: int = 4):
        del question, query_terms
        key = "upload" if self.doc_type == "uploaded_docs" else "self"
        docs = STORE[key][:top_k]
        results = []
        for doc in docs:
            results.append(
                agent_service.RetrievedEvidence(
                    content=doc.page_content,
                    source_file=doc.metadata.get("source_file"),
                    page=doc.metadata.get("page_label", doc.metadata.get("page")),
                    doc_type=doc.metadata.get("doc_type"),
                    retrieval_method="keyword",
                    score=0.8,
                )
            )
        return results


class FakePipeline:
    def __init__(self, *args, collection_name: str | None = None, doc_type: str = "self_resume", **kwargs):
        self.collection_name = collection_name or Settings.UPLOAD_COLLECTION_NAME
        self.doc_type = doc_type

    def ingest(self, file_name: str) -> dict:
        STORE["upload"] = [
            Document(
                page_content="这是上传文档的测试内容，包含项目说明和候选人信息。",
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


def patch_fake_llm(monkeypatch):
    fake_clients = FakeClients()
    monkeypatch.setattr("app.agent.router.get_llm_clients", lambda: fake_clients)
    monkeypatch.setattr("app.agent.synthesis.get_llm_clients", lambda: fake_clients)
    monkeypatch.setattr("app.agent.rewrite.get_llm_clients", lambda: fake_clients)
    return fake_clients


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
            page_content="孙雪海有 AI 应用开发、检索增强和个人网站相关项目经验。",
            metadata={
                "source_file": resume_pdf.name,
                "page": 1,
                "page_label": "1",
                "doc_type": "self_resume",
            },
        )
    ]
    STORE["upload"] = []

    patch_fake_llm(monkeypatch)
    Settings.DASHSCOPE_API_KEY = "test-key"
    Settings.MAX_UPLOAD_SIZE_MB = 1

    monkeypatch.setattr(api_routes, "ResumeIngestionPipeline", FakePipeline)
    monkeypatch.setattr(api_routes, "upload_kb_service", UploadKnowledgeBaseService())
    monkeypatch.setattr(agent_service, "ResumeRetriever", FakeResumeRetriever)
    monkeypatch.setattr(agent_service, "UploadedDocumentRetriever", FakeUploadedRetriever)
    monkeypatch.setattr(agent_service, "KeywordRetriever", FakeKeywordRetriever)
    monkeypatch.setattr("app.uploads.service.chromadb.PersistentClient", FakePersistentClient)

    client = TestClient(create_app())

    health_response = client.get("/health")
    assert health_response.status_code == 200
    assert health_response.json()["status"] == "ok"

    ready_response = client.get("/ready")
    assert ready_response.status_code == 200
    assert ready_response.json()["status"] == "ready"

    local_response = client.post(
        "/chat",
        json={"question": "你的个人网站是什么", "use_uploaded_docs": False},
    )
    assert local_response.status_code == 200
    assert local_response.json()["used_local_context"] is True
    assert local_response.json()["source_badge"] == "结合本地资料"

    web_response = client.post(
        "/chat",
        json={"question": "现在主流的 agent 框架有哪些", "use_uploaded_docs": False},
    )
    assert web_response.status_code == 200
    assert web_response.json()["used_web_search"] is True
    assert web_response.json()["source_badge"] == "结合联网信息"

    upload_response = client.post(
        "/upload_resume",
        files={"file": ("uploaded.pdf", b"%PDF-1.4 uploaded", "application/pdf")},
    )
    assert upload_response.status_code == 200

    upload_chat_response = client.post(
        "/chat",
        json={"question": "总结一下这份简历的内容", "use_uploaded_docs": True},
    )
    assert upload_chat_response.status_code == 200
    assert upload_chat_response.json()["used_local_context"] is True
    assert any(
        item.get("source_file") == "uploaded.pdf"
        for item in upload_chat_response.json()["references"]
        if item.get("source_kind") == "local"
    )


def test_chat_stream_returns_sse_events(tmp_path, monkeypatch):
    configure_temp_settings(tmp_path)

    resume_pdf = Settings.SELF_RESUME_DIR / "self_resume.pdf"
    resume_pdf.write_bytes(b"%PDF-1.4 self")
    STORE["self"] = [
        Document(
            page_content="孙雪海有 AI 应用开发、检索增强和个人网站相关项目经验。",
            metadata={
                "source_file": resume_pdf.name,
                "page": 1,
                "page_label": "1",
                "doc_type": "self_resume",
            },
        )
    ]

    patch_fake_llm(monkeypatch)
    Settings.DASHSCOPE_API_KEY = "test-key"

    monkeypatch.setattr(agent_service, "ResumeRetriever", FakeResumeRetriever)
    monkeypatch.setattr(agent_service, "UploadedDocumentRetriever", FakeUploadedRetriever)
    monkeypatch.setattr(agent_service, "KeywordRetriever", FakeKeywordRetriever)

    client = TestClient(create_app())
    response = client.post(
        "/chat_stream",
        json={"question": "你的个人网站是什么", "use_uploaded_docs": False},
    )

    assert response.status_code == 200
    assert 'data: {"type": "token"' in response.text
    assert '"type": "meta"' in response.text
    assert '"source_badge": "结合本地资料"' in response.text
    assert '"type": "done"' in response.text


def test_retry_can_expand_local_retrieval(tmp_path, monkeypatch):
    configure_temp_settings(tmp_path)

    resume_pdf = Settings.SELF_RESUME_DIR / "self_resume.pdf"
    resume_pdf.write_bytes(b"%PDF-1.4 self")
    STORE["self"] = []

    patch_fake_llm(monkeypatch)
    monkeypatch.setattr(agent_service, "ResumeRetriever", FakeResumeRetriever)
    monkeypatch.setattr(agent_service, "UploadedDocumentRetriever", FakeUploadedRetriever)
    monkeypatch.setattr(agent_service, "KeywordRetriever", FakeKeywordRetriever)

    service = agent_service.ResumeQAService()
    response = service.ask("你的个人网站是什么")

    assert response.retried is True
    assert response.used_local_context is False


def test_upload_rejects_oversized_pdf(tmp_path, monkeypatch):
    configure_temp_settings(tmp_path)
    Settings.MAX_UPLOAD_SIZE_MB = 1

    monkeypatch.setattr("app.uploads.service.chromadb.PersistentClient", FakePersistentClient)
    monkeypatch.setattr(api_routes, "upload_kb_service", UploadKnowledgeBaseService())

    client = TestClient(create_app())
    oversized = b"x" * (Settings.get_upload_size_limit_bytes() + 1)

    response = client.post(
        "/upload_resume",
        files={"file": ("large.pdf", oversized, "application/pdf")},
    )

    assert response.status_code == 413
    assert "limit" in response.json()["detail"].lower()


def test_ingest_self_resume_resets_pdf_and_chroma_directories(tmp_path):
    configure_temp_settings(tmp_path)

    old_pdf = Settings.SELF_RESUME_DIR / "old_resume.pdf"
    old_pdf.write_bytes(b"%PDF-1.4 old")

    stale_dir = Settings.SELF_RESUME_CHROMA_DIR / "stale-vector-dir"
    stale_dir.mkdir(parents=True, exist_ok=True)
    stale_file = stale_dir / "data_level0.bin"
    stale_file.write_bytes(b"stale")

    source_pdf = tmp_path / "new_resume.pdf"
    source_pdf.write_bytes(b"%PDF-1.4 new")

    target_pdf = ingest_self_resume.resolve_target_pdf(str(source_pdf))

    assert target_pdf == Settings.SELF_RESUME_DIR / "new_resume.pdf"
    assert target_pdf.exists()
    assert not old_pdf.exists()
    assert not stale_dir.exists()


def test_ingest_self_resume_requires_pdf_path_argument():
    try:
        ingest_self_resume.parse_args([])
    except SystemExit as exc:
        assert exc.code == 2
    else:
        raise AssertionError("parse_args should require --pdf-path")
