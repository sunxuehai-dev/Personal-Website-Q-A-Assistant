from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient
from langchain_core.documents import Document

from app.agent import service as agent_service
from app.agent.router import QueryRouter
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


class FakeAnnotation:
    def __init__(self, title: str, url: str):
        self.title = title
        self.url = url


class FakeOutputText:
    def __init__(self, annotations):
        self.type = "output_text"
        self.annotations = annotations


class FakeOutputMessage:
    def __init__(self, content):
        self.type = "message"
        self.content = content


class FakeWebResponse:
    def __init__(self, summary: str):
        self.output_text = summary
        self.output = [
            FakeOutputMessage(
                [
                    FakeOutputText(
                        [FakeAnnotation("OpenAI", "https://openai.com/index/new-tools-for-building-agents/")]
                    )
                ]
            )
        ]


class FakeChatModel:
    def invoke(self, messages):
        if isinstance(messages, str):
            return FakeMessage(self._route_response(messages))

        payload = messages[1]["content"]
        if "联网搜索摘要" in payload:
            return FakeMessage("从我的项目经历来看，这个方向契合轻量 Agent。结合当前公开信息，这也是主流做法。")
        return FakeMessage("这是 smoke test 的本地回答。")

    def stream(self, messages):
        content = str(self.invoke(messages).content)
        midpoint = max(1, len(content) // 2)
        yield FakeMessage(content[:midpoint])
        yield FakeMessage(content[midpoint:])

    def _route_response(self, prompt: str) -> str:
        if "这个项目放在现在行业里怎么样" in prompt:
            return json.dumps(
                {
                    "route": "hybrid",
                    "use_local_rag": True,
                    "use_web_search": True,
                    "response_mode": "comparison",
                    "needs_clarification": False,
                    "reason": "fake_hybrid_route",
                },
                ensure_ascii=False,
            )
        return json.dumps(
            {
                "route": "out_of_scope",
                "use_local_rag": False,
                "use_web_search": False,
                "response_mode": "clarify",
                "needs_clarification": True,
                "reason": "fake_clarify_route",
            },
            ensure_ascii=False,
        )


class FakeEmbeddings:
    def embed_documents(self, texts):
        return [[0.0, 0.0, 0.0] for _ in texts]

    def embed_query(self, text):
        return [0.0, 0.0, 0.0]


class FakeResponseClient:
    def __init__(self):
        self.responses = self

    def create(self, model, tools, input):
        del model, tools, input
        return FakeWebResponse("联网搜索显示，当前主流 Agent 通常采用路由加工具调用的轻量编排。")


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
                    score=5.0,
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
    monkeypatch.setattr("app.agent.web_search.get_llm_clients", lambda: fake_clients)
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

    greeting_response = client.post(
        "/chat",
        json={"question": "你好", "use_uploaded_docs": False},
    )
    assert greeting_response.status_code == 200
    assert greeting_response.json()["route"] == "chat"
    assert greeting_response.json()["source_badge"] == "直接对话"

    upload_response = client.post(
        "/upload_resume",
        files={"file": ("uploaded.pdf", b"%PDF-1.4 uploaded", "application/pdf")},
    )
    assert upload_response.status_code == 200
    assert upload_response.json()["chunk_count"] == 1

    self_chat_response = client.post(
        "/chat",
        json={"question": "你的个人网站是什么", "use_uploaded_docs": False},
    )
    assert self_chat_response.status_code == 200
    assert self_chat_response.json()["route"] == "local_rag"
    assert self_chat_response.json()["response_mode"] == "grounded_answer"

    web_chat_response = client.post(
        "/chat",
        json={"question": "现在主流的 agent 框架有哪些", "use_uploaded_docs": False},
    )
    assert web_chat_response.status_code == 200
    assert web_chat_response.json()["route"] == "web_search"
    assert any(item["source_kind"] == "web" for item in web_chat_response.json()["references"])

    clear_response = client.delete("/upload_status")
    assert clear_response.status_code == 200
    assert clear_response.json()["has_uploaded_docs"] is False


def test_chat_stream_returns_sse_events(tmp_path, monkeypatch):
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
    assert '"source_badge": "基于本地资料"' in response.text
    assert '"type": "done"' in response.text


def test_llm_router_can_choose_hybrid(tmp_path, monkeypatch):
    configure_temp_settings(tmp_path)

    resume_pdf = Settings.SELF_RESUME_DIR / "self_resume.pdf"
    resume_pdf.write_bytes(b"%PDF-1.4 self")
    STORE["self"] = [
        Document(
            page_content="项目里包含轻量 Agent、RAG 和前后端联调经验。",
            metadata={
                "source_file": resume_pdf.name,
                "page": 1,
                "page_label": "1",
                "doc_type": "self_resume",
            },
        )
    ]

    patch_fake_llm(monkeypatch)
    monkeypatch.setattr(agent_service, "ResumeRetriever", FakeResumeRetriever)
    monkeypatch.setattr(agent_service, "UploadedDocumentRetriever", FakeUploadedRetriever)
    monkeypatch.setattr(agent_service, "KeywordRetriever", FakeKeywordRetriever)

    service = agent_service.ResumeQAService()
    response = service.ask("你做的这个项目放在现在行业里怎么样")

    assert response.route == "hybrid"
    assert response.response_mode == "comparison"
    assert response.source_badge == "本地资料 + 联网分析"
    assert any(item["source_kind"] == "local" for item in response.references)
    assert any(item["source_kind"] == "web" for item in response.references)


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
