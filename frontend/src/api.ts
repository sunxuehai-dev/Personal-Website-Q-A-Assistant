import type { ApiErrorPayload, ChatResponse, RuntimeStatus, SiteContent, UploadStatus } from "./types";

type RequestOptions = RequestInit & {
  fallbackMessage: string;
};

function formatApiError(payload: ApiErrorPayload, status: number, fallbackMessage: string): Error {
  const error = payload.error ?? {};
  const code = error.code ?? "request_failed";
  const detail = payload.detail ?? error.message ?? fallbackMessage;

  if (code === "chat_capacity_full" || status === 429) {
    return new Error("当前聊天请求较多，容量已满，请稍后重试。");
  }
  if (code === "upload_busy" || status === 409) {
    return new Error("系统正在处理另一份上传文档，请稍后再试。");
  }
  if (code === "upload_too_large" || status === 413) {
    return new Error("上传文件过大，已超过当前站点限制。");
  }
  if (code === "unsupported_file_type") {
    return new Error("当前仅支持上传 PDF 文件。");
  }
  if (code === "empty_question") {
    return new Error("请输入问题后再发送。");
  }
  if (code === "model_timeout") {
    return new Error("模型响应超时，请稍后重试，或改成更短的问题。");
  }
  return new Error(detail);
}

async function requestJson<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw formatApiError(payload, response.status, options?.fallbackMessage ?? "请求失败");
  }
  return response.json() as Promise<T>;
}

export function fetchSiteContent() {
  return requestJson<SiteContent>("/site_content", { fallbackMessage: "无法获取站点内容" });
}

export function fetchUploadStatus() {
  return requestJson<UploadStatus>("/upload_status", { fallbackMessage: "无法获取上传状态" });
}

export function fetchRuntimeStatus() {
  return requestJson<RuntimeStatus>("/runtime_status", { fallbackMessage: "无法获取运行时状态" });
}

export function clearUploadedDocs() {
  return requestJson<UploadStatus>("/upload_status", {
    method: "DELETE",
    fallbackMessage: "无法清空上传文档"
  });
}

export function clearSession(sessionId: string) {
  return requestJson<{ session_id: string; cleared_message_count: number }>(`/session/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    fallbackMessage: "无法清空会话"
  });
}

export function askQuestion(question: string, useUploadedDocs: boolean, sessionId: string) {
  return requestJson<ChatResponse>("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      use_uploaded_docs: useUploadedDocs,
      session_id: sessionId
    }),
    fallbackMessage: "问答请求失败"
  });
}

export async function startChatStream(question: string, useUploadedDocs: boolean, sessionId: string) {
  const response = await fetch("/chat_stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      use_uploaded_docs: useUploadedDocs,
      session_id: sessionId
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw formatApiError(payload, response.status, "问答请求失败");
  }

  return response;
}

export async function uploadResume(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return requestJson<{ file_name: string; chunk_count: number; collection_name: string }>("/upload_resume", {
    method: "POST",
    body: formData,
    fallbackMessage: "上传失败"
  });
}
