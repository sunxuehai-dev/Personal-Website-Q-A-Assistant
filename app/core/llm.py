from __future__ import annotations

from dataclasses import dataclass

from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from app.core.config import Settings


class LLMConfigurationError(RuntimeError):
    """Raised when required model configuration is missing or invalid."""


@dataclass
class LLMClients:
    chat_model: ChatOpenAI
    embedding_model: OpenAIEmbeddings


def _resolve_provider_settings() -> tuple[str, str, str]:
    provider = Settings.LLM_TYPE

    if provider == "qwen":
        if not Settings.DASHSCOPE_API_KEY:
            raise LLMConfigurationError("DASHSCOPE_API_KEY is required when LLM_TYPE=qwen.")
        return (
            Settings.DASHSCOPE_BASE_URL,
            Settings.DASHSCOPE_API_KEY,
            provider,
        )

    if provider == "openai":
        if not Settings.OPENAI_API_KEY:
            raise LLMConfigurationError("OPENAI_API_KEY is required when LLM_TYPE=openai.")
        return (
            Settings.OPENAI_BASE_URL or "https://api.openai.com/v1",
            Settings.OPENAI_API_KEY,
            provider,
        )

    raise LLMConfigurationError(f"Unsupported LLM_TYPE: {provider}")


def get_llm_clients() -> LLMClients:
    """Create chat and embedding clients for the configured provider."""
    base_url, api_key, provider = _resolve_provider_settings()

    chat_model = ChatOpenAI(
        base_url=base_url,
        api_key=api_key,
        model=Settings.CHAT_MODEL_MAP[provider],
        temperature=0.0,
        timeout=Settings.LLM_TIMEOUT_SECONDS,
        max_retries=Settings.LLM_MAX_RETRIES,
    )

    embedding_model = OpenAIEmbeddings(
        base_url=base_url,
        api_key=api_key,
        model=Settings.EMBEDDING_MODEL_MAP[provider],
        deployment=Settings.EMBEDDING_MODEL_MAP[provider],
        check_embedding_ctx_length=False,
    )

    return LLMClients(
        chat_model=chat_model,
        embedding_model=embedding_model,
    )
