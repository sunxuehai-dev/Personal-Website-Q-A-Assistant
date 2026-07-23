from __future__ import annotations

from dataclasses import dataclass

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from openai import OpenAI

from app.core.config import Settings


class LLMConfigurationError(RuntimeError):
    """Raised when required model configuration is missing or invalid."""


@dataclass
class LLMClients:
    chat_model: ChatOpenAI
    embedding_model: OpenAIEmbeddings
    response_client: OpenAI


def _resolve_chat_provider_settings() -> tuple[str, str, str]:
    provider = Settings.LLM_TYPE

    if provider == "qwen":
        if not Settings.DASHSCOPE_API_KEY:
            raise LLMConfigurationError("DASHSCOPE_API_KEY is required when LLM_TYPE=qwen.")
        return (
            Settings.DASHSCOPE_BASE_URL,
            Settings.DASHSCOPE_API_KEY,
            provider,
        )

    if provider == "deepseek":
        if not Settings.DEEPSEEK_API_KEY:
            raise LLMConfigurationError("DEEPSEEK_API_KEY is required when LLM_TYPE=deepseek.")
        return (
            Settings.DEEPSEEK_BASE_URL,
            Settings.DEEPSEEK_API_KEY,
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


def _resolve_embedding_provider_settings() -> tuple[str, str, str]:
    provider = Settings.EMBEDDING_TYPE

    if provider == "qwen":
        if not Settings.DASHSCOPE_API_KEY:
            raise LLMConfigurationError("DASHSCOPE_API_KEY is required when EMBEDDING_TYPE=qwen.")
        return (
            Settings.DASHSCOPE_BASE_URL,
            Settings.DASHSCOPE_API_KEY,
            provider,
        )

    if provider == "openai":
        if not Settings.OPENAI_API_KEY:
            raise LLMConfigurationError("OPENAI_API_KEY is required when EMBEDDING_TYPE=openai.")
        return (
            Settings.OPENAI_BASE_URL or "https://api.openai.com/v1",
            Settings.OPENAI_API_KEY,
            provider,
        )

    raise LLMConfigurationError(f"Unsupported EMBEDDING_TYPE: {provider}")


def get_llm_clients() -> LLMClients:
    """Create chat, embedding, and responses clients for the configured provider."""
    chat_base_url, chat_api_key, chat_provider = _resolve_chat_provider_settings()
    embedding_base_url, embedding_api_key, embedding_provider = _resolve_embedding_provider_settings()
    chat_extra_body = {"thinking": {"type": "disabled"}} if chat_provider == "deepseek" else None

    chat_model = ChatOpenAI(
        base_url=chat_base_url,
        api_key=chat_api_key,
        model=Settings.CHAT_MODEL_MAP[chat_provider],
        temperature=0.0,
        timeout=Settings.LLM_TIMEOUT_SECONDS,
        max_retries=Settings.LLM_MAX_RETRIES,
        extra_body=chat_extra_body,
    )

    embedding_model = OpenAIEmbeddings(
        base_url=embedding_base_url,
        api_key=embedding_api_key,
        model=Settings.EMBEDDING_MODEL_MAP[embedding_provider],
        deployment=Settings.EMBEDDING_MODEL_MAP[embedding_provider],
        check_embedding_ctx_length=False,
    )

    response_client = OpenAI(
        base_url=chat_base_url,
        api_key=chat_api_key,
        timeout=Settings.LLM_TIMEOUT_SECONDS,
        max_retries=Settings.LLM_MAX_RETRIES,
    )

    return LLMClients(
        chat_model=chat_model,
        embedding_model=embedding_model,
        response_client=response_client,
    )
