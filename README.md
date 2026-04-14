# Resume Assistant

一个集成了个人主页与简历问答助手的项目。

## 启动

启动网站和 API：

```bash
.venv\Scripts\python -m app.main
```

访问地址：

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

- 内置个人简历知识库 `self_resume`
- 上传 PDF 临时知识库 `uploaded_docs`
- 支持在个人简历、上传文档或双知识库之间进行问答路由
- 单页个人网站，内嵌 “Ask My Resume” 助手
- 支持手动重建个人简历知识库

## 个人简历灌库

请显式指定源文件路径执行：

```bash
.venv\Scripts\python scripts\ingest_self_resume.py --pdf-path path\to\your_resume.pdf
```

`ingest_self_resume.py` 的行为是全量重建：

- 会清空 `data/self_resume/` 中已有的旧 PDF
- 会重建 `data/chroma/self_resume/`
- 指定的新简历会成为唯一生效的 `self_resume` 知识库

不再支持“先把 PDF 放进 `data/self_resume/` 再直接执行脚本”的旧用法。

## 上传知识库管理

网站会自动把上传的 PDF 灌入临时上传知识库。

相关接口：

- `GET /upload_status`
- `DELETE /upload_status`

## 接口列表

- `GET /`
- `GET /health`
- `GET /ready`
- `GET /upload_status`
- `DELETE /upload_status`
- `POST /upload_resume`
- `POST /chat`

## 测试

```bash
.venv\Scripts\python -m pytest
```

## 部署

仓库内置了 `Dockerfile` 和 `compose.yaml`，可直接用于容器化部署。

示例：

```bash
docker build -t resume-assistant .
docker run --rm -p 8008:8008 --env-file .env resume-assistant
```

推荐的服务器启动方式：

```bash
docker compose up -d --build
```

需要可重复执行的服务器部署流程时，使用：

```bash
bash scripts/deploy_server.sh
```

如果你已经提前 `git pull`，只想重建并重启服务：

```bash
bash scripts/deploy_server.sh --skip-pull
```

当前 `compose.yaml` 约定的部署形态：

- 容器名：`resume-assistant`
- 端口映射：`8008:8008`
- 环境变量文件：`.env`
- 数据挂载：`./data:/app/data`
- 重启策略：`always`

### 使用 ACR / 国内镜像源构建

`Dockerfile` 支持自定义基础镜像和 pip 源，这样服务器构建时不必直接依赖 Docker Hub 或默认 PyPI。

本地默认构建：

```bash
docker build -t resume-assistant .
```

服务器上使用自定义镜像仓库基础镜像和国内 pip 源：

```bash
docker build ^
  --build-arg BASE_IMAGE=<your-acr-registry>/python:3.11-slim ^
  --build-arg PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/ ^
  --build-arg PIP_TRUSTED_HOST=mirrors.aliyun.com ^
  -t resume-assistant .
```

推荐的 ACR 部署思路：

1. 先把 Python 基础镜像同步或推送到你自己的 ACR 命名空间。
2. 在服务器 `.env` 中配置 `BASE_IMAGE`、`PIP_INDEX_URL`、`PIP_TRUSTED_HOST`。
3. 在服务器执行 `git pull` 拉取最新代码。
4. 通过 `docker compose up -d --build` 重建并重启服务。

这样可以把基础镜像来源和应用镜像构建链路都收敛到你自己的环境中。

## 部署说明

- 不要提交 `.env`
- 在部署环境中准备 `data/self_resume/`，然后执行 `scripts/ingest_self_resume.py`
- 通过托管平台或服务器环境变量管理密钥
- 生产环境请设置 `RESUME_ASSISTANT_ENV=production`
- 将 `CORS_ALLOWED_ORIGINS` 和 `ALLOWED_HOSTS` 收紧到真实域名
- 使用 `/ready` 作为部署就绪探针
- 如果模型调用较慢，可调大 `LLM_TIMEOUT_SECONDS`
