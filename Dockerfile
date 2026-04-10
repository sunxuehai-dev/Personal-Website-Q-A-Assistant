FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts
COPY static ./static
COPY templates ./templates
COPY .env.example ./.env.example
COPY README.md ./README.md

ENV RESUME_ASSISTANT_HOST=0.0.0.0
ENV RESUME_ASSISTANT_PORT=8008

EXPOSE 8008

CMD ["python", "-m", "app.main"]
