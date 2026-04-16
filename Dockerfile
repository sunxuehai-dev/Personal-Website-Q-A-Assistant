ARG BASE_IMAGE=python:3.11-slim

FROM ${BASE_IMAGE}

ARG PIP_INDEX_URL=https://pypi.org/simple
ARG PIP_TRUSTED_HOST=

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_INDEX_URL=${PIP_INDEX_URL}
ENV PIP_TRUSTED_HOST=${PIP_TRUSTED_HOST}

WORKDIR /app

COPY requirements.txt .
RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY frontend/dist ./frontend/dist
COPY scripts ./scripts
COPY static ./static
COPY templates ./templates
COPY .env.example ./.env.example
COPY README.md ./README.md

ENV RESUME_ASSISTANT_HOST=0.0.0.0
ENV RESUME_ASSISTANT_PORT=8008

EXPOSE 8008

CMD ["python", "-m", "app.main"]
