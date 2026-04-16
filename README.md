# Resume Assistant

一个适合个人网站场景的轻量问答系统，集成了：

- 个人主页展示
- 个人简历问答
- 上传 PDF 临时知识库问答
- 流式回答
- 轻量会话记忆
- 小机器可用的基础运行时保护

项目定位不是做复杂通用 Agent 平台，而是做成“麻雀虽小，五脏俱全”的个人网站问答助手。

## 启动

启动网站和 API：

```bash
.venv\Scripts\python -m app.main
```

默认访问地址：

```text
http://127.0.0.1:8008/
```

## 安装

安装运行依赖：

```bash
.venv\Scripts\python -m pip install -r requirements.txt
```

安装开发依赖：

```bash
.venv\Scripts\python -m pip install -r requirements-dev.txt
```

## 核心能力

- 固定知识源：`self_resume`
- 临时知识源：`uploaded_docs`
- 本地 RAG + 按需联网补充
- `/chat_stream` 流式问答
- 浏览器会话级短期记忆
- 上传灌库互斥与聊天轻量限流
- 回答元信息与本地证据摘要展示
- 结构化错误返回与前端友好错误提示

## 个人简历灌库

请显式指定源 PDF 路径：

```bash
.venv\Scripts\python scripts\ingest_self_resume.py --pdf-path path\to\your_resume.pdf
```

该脚本会全量重建 `self_resume`：

- 清空 `data/self_resume/` 下旧 PDF
- 重建 `data/chroma/self_resume/`
- 将指定 PDF 作为当前唯一生效简历

## 上传知识库管理

网站会自动将上传的 PDF 灌入临时知识库。

相关接口：

- `GET /upload_status`
- `DELETE /upload_status`

## 会话记忆

当前会话记忆为浏览器会话级短期记忆：

- 前端自动生成并持有 `session_id`
- 后端按 `session_id` 保存最近几轮对话
- 支持多轮追问语义承接
- 支持清空当前会话

相关接口：

- `DELETE /session/{session_id}`

## 运行状态与接口

主要接口：

- `GET /`
- `GET /health`
- `GET /ready`
- `GET /runtime_status`
- `GET /upload_status`
- `DELETE /upload_status`
- `DELETE /session/{session_id}`
- `POST /upload_resume`
- `POST /chat`
- `POST /chat_stream`

其中：

- `/health` 返回基础健康状态、上传状态和运行时状态
- `/ready` 返回是否具备对外服务条件
- `/runtime_status` 返回聊天并发槽位和上传忙碌状态

错误响应当前统一包含：

- `detail`
- `error.code`
- `error.message`
- `error.retryable`
- `error.status_code`

## 测试

```bash
.venv\Scripts\python -m pytest
```

当前 smoke test 已覆盖：

- 健康检查与就绪检查
- 普通问答与流式问答
- 上传问答
- 自有简历灌库重建规则
- 会话记忆追问与清空
- 聊天容量保护与上传互斥保护

## 部署

本项目使用单体 FastAPI + Docker Compose 部署。

本地构建：

```bash
docker build -t resume-assistant .
```

本地运行：

```bash
docker run --rm -p 8008:8008 --env-file .env resume-assistant
```

推荐的服务器启动方式：

```bash
docker compose up -d --build
```

标准化部署脚本：

```bash
bash scripts/deploy_server.sh
```

如果已经提前 `git pull`：

```bash
bash scripts/deploy_server.sh --skip-pull
```

## 部署注意事项

- 不要提交 `.env`
- 生产环境请设置 `RESUME_ASSISTANT_ENV=production`
- 将 `CORS_ALLOWED_ORIGINS` 和 `ALLOWED_HOSTS` 收紧到真实域名
- 使用 `/ready` 作为部署就绪探针
- 如果模型调用偏慢，可调大 `LLM_TIMEOUT_SECONDS`
- 小规格机器上不建议同时处理大量聊天请求和上传灌库任务

## 文档

更完整的架构说明见：

- `docs/project_manual.md`
