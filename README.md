# Resume Assistant

A personal website with an embedded resume-focused question answering assistant.

## Run

Website + API:

```bash
.venv\Scripts\python -m app.main
```

Open:

```text
http://127.0.0.1:8008/
```

## Install

Runtime dependencies:

```bash
.venv\Scripts\python -m pip install -r requirements.txt
```

Development dependencies:

```bash
.venv\Scripts\python -m pip install -r requirements-dev.txt
```

## Core Capabilities

- Built-in personal resume knowledge base (`self_resume`)
- Uploaded PDF knowledge base (`uploaded_docs`)
- Query routing between personal resume, uploaded docs, or both
- Single-page website with embedded "Ask My Resume" assistant
- Manual self-resume ingestion for versioned resume updates

## Self Resume Ingestion

Place your own resume PDF in `data/self_resume/`, then run:

```bash
.venv\Scripts\python scripts\ingest_self_resume.py
```

You can also specify a source file explicitly:

```bash
.venv\Scripts\python scripts\ingest_self_resume.py --pdf-path path\to\your_resume.pdf
```

## Upload Knowledge Base Management

The website automatically ingests uploaded PDFs into the temporary upload knowledge base.

API helpers:

- `GET /upload_status`
- `DELETE /upload_status`

## Endpoints

- `GET /`
- `GET /health`
- `GET /ready`
- `GET /upload_status`
- `DELETE /upload_status`
- `POST /upload_resume`
- `POST /chat`

## Test

```bash
.venv\Scripts\python -m pytest
```

## Deploy

This repository includes a `Dockerfile` and `compose.yaml` for container deployment.

Example:

```bash
docker build -t resume-assistant .
docker run --rm -p 8008:8008 --env-file .env resume-assistant
```

Recommended server workflow:

```bash
docker compose up -d --build
```

For repeatable server deployment, use:

```bash
./scripts/deploy_server.sh
```

If you have already pulled the latest code and only want to rebuild/restart:

```bash
./scripts/deploy_server.sh --skip-pull
```

`compose.yaml` versions the current deployment shape:

- container name: `resume-assistant`
- port mapping: `8008:8008`
- env file: `.env`
- data mount: `./data:/app/data`
- restart policy: `always`

### Build With ACR / Domestic Mirrors

The `Dockerfile` supports a configurable base image and pip index so the server can build without talking directly to Docker Hub or the default PyPI index.

Use the default build locally:

```bash
docker build -t resume-assistant .
```

Use a custom registry-hosted base image and a domestic pip mirror on the server:

```bash
docker build ^
  --build-arg BASE_IMAGE=<your-acr-registry>/python:3.11-slim ^
  --build-arg PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/ ^
  --build-arg PIP_TRUSTED_HOST=mirrors.aliyun.com ^
  -t resume-assistant .
```

Recommended ACR-oriented deployment strategy:

1. Sync or push the Python base image into your own ACR namespace.
2. Set `BASE_IMAGE`, `PIP_INDEX_URL`, and `PIP_TRUSTED_HOST` in the server `.env`.
3. On the server, `git pull` the latest code.
4. Rebuild and restart with `docker compose up -d --build`.

This keeps both the base image path and the application image path under your own registry control.

Deployment notes:

- Do not commit `.env`
- Recreate `data/self_resume/` and run `scripts/ingest_self_resume.py` in the deployment environment
- Set secrets through your hosting provider's environment variable settings
- For production, set `RESUME_ASSISTANT_ENV=production`
- Restrict `CORS_ALLOWED_ORIGINS` and `ALLOWED_HOSTS` to your real domain
- Use `/ready` as the deployment readiness probe
- If model calls are slow, increase `LLM_TIMEOUT_SECONDS`
