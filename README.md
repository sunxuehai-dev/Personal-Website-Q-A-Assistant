# Resume Assistant

A standalone resume question-answering assistant built step by step.

## Run

Website + API:

```bash
.venv\Scripts\python -m app.main
```

Open:

```text
http://127.0.0.1:8008/
```

## Self Resume Ingestion

Place your own resume PDF in `data/self_resume/`, then run:

```bash
.venv\Scripts\python scripts\ingest_self_resume.py
```

You can also specify a source file explicitly:

```bash
.venv\Scripts\python scripts\ingest_self_resume.py --pdf-path path\to\your_resume.pdf
```

## Endpoints

- `GET /health`
- `POST /upload_resume`
- `POST /chat`
