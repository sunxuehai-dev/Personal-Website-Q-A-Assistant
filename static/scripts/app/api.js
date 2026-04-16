const apiBase = "";

function formatApiErrorMessage({ statusCode, code, retryable, detail, fallbackMessage }) {
    const suffix = retryable ? " 可稍后重试。" : "";

    if (code === "chat_capacity_full" || statusCode === 429) {
        return "当前聊天请求较多，容量已满，请稍后重试。";
    }
    if (code === "upload_busy" || statusCode === 409) {
        return "系统正在处理另一份上传文档，请稍后再试。";
    }
    if (code === "upload_too_large" || statusCode === 413) {
        return "上传文件过大，已超过当前站点限制。";
    }
    if (code === "unsupported_file_type") {
        return "当前仅支持上传 PDF 文件。";
    }
    if (code === "empty_question") {
        return "请输入问题后再发送。";
    }
    if (code === "self_resume_missing") {
        return "站点知识库尚未准备完成，暂时无法回答该问题。";
    }
    if (code === "validation_failed" || statusCode === 422) {
        return "请求参数不完整或格式不正确。";
    }
    if (code === "model_timeout") {
        return "模型响应超时，请稍后重试，或改成更短的问题。";
    }
    if (statusCode >= 500) {
        return `服务暂时异常。${detail || ""}${suffix}`.trim();
    }
    return `${detail || fallbackMessage}${suffix}`.trim();
}

export async function parseApiError(response, fallbackMessage) {
    const payload = await response.json().catch(() => ({}));
    const error = payload.error || {};
    const detail = payload.detail || error.message || fallbackMessage;
    const statusCode = error.status_code || response.status;
    const code = error.code || "request_failed";
    const retryable = Boolean(error.retryable);

    return {
        statusCode,
        code,
        retryable,
        message: formatApiErrorMessage({ statusCode, code, retryable, detail, fallbackMessage }),
    };
}

async function requestJson(path, options, fallbackMessage) {
    const response = await fetch(`${apiBase}${path}`, options);
    if (!response.ok) {
        const error = await parseApiError(response, fallbackMessage);
        throw new Error(error.message);
    }
    return response.json();
}

export function fetchUploadStatus() {
    return requestJson("/upload_status", undefined, "无法获取上传状态");
}

export function fetchSiteContent() {
    return requestJson("/site_content", undefined, "无法获取站点内容");
}

export function fetchRuntimeStatus() {
    return requestJson("/runtime_status", undefined, "无法获取运行时状态");
}

export function clearUploadedDocs() {
    return requestJson("/upload_status", { method: "DELETE" }, "无法清空上传文档");
}

export function clearSession(sessionId) {
    return requestJson(`/session/${encodeURIComponent(sessionId)}`, { method: "DELETE" }, "无法清空会话");
}

export function askQuestion(question, useUploadedDocs, sessionId) {
    return requestJson(
        "/chat",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question,
                use_uploaded_docs: useUploadedDocs,
                session_id: sessionId,
            }),
        },
        "问答请求失败"
    );
}

export async function uploadDocument(file, onUploadStart) {
    const formData = new FormData();
    formData.append("file", file);
    onUploadStart?.(file);

    const response = await fetch(`${apiBase}/upload_resume`, {
        method: "POST",
        body: formData,
    });
    if (!response.ok) {
        const error = await parseApiError(response, "上传失败");
        throw new Error(error.message);
    }
    return response.json();
}

export async function startChatStream(question, useUploadedDocs, sessionId) {
    const response = await fetch(`${apiBase}/chat_stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            question,
            use_uploaded_docs: useUploadedDocs,
            session_id: sessionId,
        }),
    });
    if (!response.ok) {
        const error = await parseApiError(response, "问答请求失败");
        throw new Error(error.message);
    }
    return response;
}
