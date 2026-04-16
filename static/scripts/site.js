const apiBase = "";
const chatLog = document.getElementById("chat-log");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const sendButton = document.getElementById("send-button");
const uploadInput = document.getElementById("resume-upload");
const uploadChip = uploadInput?.closest(".upload-chip");
const knowledgeStatus = document.getElementById("knowledge-status");
const sessionStatus = document.getElementById("session-status");
const runtimeStatus = document.getElementById("runtime-status");
const clearUploadButton = document.getElementById("clear-upload");
const clearSessionButton = document.getElementById("clear-session");
const suggestionChips = document.querySelectorAll(".suggestion-chip");

const sessionId = getOrCreateSessionId();

const appState = {
    hasUploadedDocs: false,
    activeUploadFile: null,
    runtimeChat: null,
    runtimeUpload: null,
    isSending: false,
    isUploading: false,
    lastSessionResetAt: null,
};

function appendMessage(role, content) {
    const wrapper = document.createElement("div");
    wrapper.className = `message ${role}`;
    const body = document.createElement("div");
    body.className = "message-body";
    body.textContent = content;
    wrapper.appendChild(body);
    chatLog.appendChild(wrapper);
    chatLog.scrollTop = chatLog.scrollHeight;
    return wrapper;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOrCreateSessionId() {
    const storageKey = "resume_assistant_session_id";
    const existing = window.localStorage.getItem(storageKey);
    if (existing) {
        return existing;
    }

    const generated = window.crypto?.randomUUID?.() || `session-${Date.now()}`;
    window.localStorage.setItem(storageKey, generated);
    return generated;
}

function setPillState(element, text, variant = "subtle") {
    if (!element) {
        return;
    }
    element.textContent = text;
    element.classList.remove("subtle", "busy", "ready");
    element.classList.add(variant);
}

async function parseApiError(response, fallbackMessage) {
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

function refreshStatusView() {
    if (appState.isUploading) {
        setPillState(knowledgeStatus, "当前模式：正在处理上传文档", "busy");
    } else if (appState.hasUploadedDocs) {
        const fileLabel = appState.activeUploadFile ? `（${appState.activeUploadFile}）` : "";
        setPillState(knowledgeStatus, `当前模式：上传文档问答${fileLabel}`, "ready");
    } else {
        setPillState(knowledgeStatus, "当前模式：个人简历问答", "ready");
    }

    if (appState.lastSessionResetAt) {
        setPillState(sessionStatus, "会话记忆：已清空，后续对话将重新积累", "subtle");
    } else {
        setPillState(sessionStatus, "会话记忆：当前浏览器会话已启用", "subtle");
    }

    if (appState.isSending) {
        setPillState(runtimeStatus, "运行状态：正在生成回答", "busy");
    } else if (appState.runtimeUpload?.busy) {
        setPillState(runtimeStatus, "运行状态：上传灌库处理中", "busy");
    } else if (appState.runtimeChat?.busy) {
        const active = appState.runtimeChat.active ?? 0;
        const total = appState.runtimeChat.max_concurrent ?? 0;
        setPillState(runtimeStatus, `运行状态：聊天容量已满（${active}/${total}）`, "busy");
    } else {
        setPillState(runtimeStatus, "运行状态：空闲", "ready");
    }

    const disableChat = appState.isSending || appState.isUploading || Boolean(appState.runtimeUpload?.busy);
    const disableUpload = appState.isUploading || appState.isSending || Boolean(appState.runtimeUpload?.busy);
    const disableSessionClear = appState.isSending || appState.isUploading;

    if (sendButton) {
        sendButton.disabled = disableChat;
        sendButton.textContent = appState.isSending ? "发送中..." : "发送";
    }
    if (chatInput) {
        chatInput.disabled = disableChat;
    }
    if (uploadInput) {
        uploadInput.disabled = disableUpload;
    }
    if (uploadChip) {
        uploadChip.classList.toggle("is-disabled", disableUpload);
    }
    if (clearUploadButton) {
        clearUploadButton.disabled = disableUpload || !appState.hasUploadedDocs;
    }
    if (clearSessionButton) {
        clearSessionButton.disabled = disableSessionClear;
    }
}

function createTypewriter(targetNode) {
    let queue = [];
    let answerText = "";
    let isFlushing = false;

    async function flush() {
        if (isFlushing) {
            return;
        }
        isFlushing = true;

        while (queue.length > 0) {
            answerText += queue.shift();
            targetNode.textContent = answerText;
            chatLog.scrollTop = chatLog.scrollHeight;
            await sleep(16);
        }

        isFlushing = false;
    }

    return {
        push(text) {
            queue.push(...Array.from(text || ""));
            flush();
        },
        replace(text) {
            queue = [];
            answerText = "";
            targetNode.textContent = "";
            this.push(text || "");
        },
        async waitForIdle() {
            while (queue.length > 0 || isFlushing) {
                await sleep(20);
            }
        },
        getText() {
            return answerText;
        },
        setFinalText(text) {
            queue = [];
            answerText = text;
            targetNode.textContent = text;
            chatLog.scrollTop = chatLog.scrollHeight;
        },
    };
}

function getMessageBody(node) {
    return node?.querySelector(".message-body") || node;
}

function truncateText(text, maxLength = 140) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }
    return `${normalized.slice(0, maxLength)}...`;
}

function buildReferenceLabel(reference) {
    const file = reference.source_file || "未知来源";
    const page = reference.page ? `P${reference.page}` : null;
    const method = reference.retrieval_method || null;
    return [file, page, method].filter(Boolean).join(" · ");
}

function renderAnswerMeta(messageNode, meta) {
    if (!messageNode || !meta) {
        return;
    }

    messageNode.querySelector(".message-meta")?.remove();

    const metaNode = document.createElement("div");
    metaNode.className = "message-meta";

    const badges = document.createElement("div");
    badges.className = "meta-badges";

    const badgeTexts = [meta.source_badge || "回答完成"];
    if (meta.used_local_context) {
        badgeTexts.push("已使用本地资料");
    }
    if (meta.used_web_search) {
        badgeTexts.push("已使用联网补充");
    }
    if (meta.retried) {
        badgeTexts.push("已执行一次重试");
    }

    badgeTexts.forEach((text) => {
        const chip = document.createElement("span");
        chip.className = "meta-chip";
        chip.textContent = text;
        badges.appendChild(chip);
    });

    metaNode.appendChild(badges);

    const references = Array.isArray(meta.references) ? meta.references : [];
    if (references.length > 0) {
        const list = document.createElement("div");
        list.className = "reference-list";

        references.slice(0, 3).forEach((reference) => {
            const card = document.createElement("div");
            card.className = "reference-card";

            const head = document.createElement("div");
            head.className = "reference-head";
            head.textContent = buildReferenceLabel(reference);

            const snippet = document.createElement("div");
            snippet.className = "reference-snippet";
            snippet.textContent = truncateText(reference.content, 180);

            card.appendChild(head);
            card.appendChild(snippet);
            list.appendChild(card);
        });

        metaNode.appendChild(list);
    }

    messageNode.appendChild(metaNode);
}

async function uploadDocument(file) {
    const formData = new FormData();
    formData.append("file", file);

    appState.isUploading = true;
    appState.activeUploadFile = file.name;
    refreshStatusView();

    try {
        const response = await fetch(`${apiBase}/upload_resume`, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const error = await parseApiError(response, "上传失败");
            throw new Error(error.message);
        }

        const payload = await response.json();
        appState.hasUploadedDocs = true;
        appState.activeUploadFile = payload.file_name || file.name;
        appendMessage("assistant", `已完成上传并自动灌库：${appState.activeUploadFile}`);
    } finally {
        appState.isUploading = false;
        refreshStatusView();
    }
}

async function fetchUploadStatus() {
    const response = await fetch(`${apiBase}/upload_status`);
    if (!response.ok) {
        const error = await parseApiError(response, "无法获取上传状态");
        throw new Error(error.message);
    }
    return response.json();
}

async function fetchRuntimeStatus() {
    const response = await fetch(`${apiBase}/runtime_status`);
    if (!response.ok) {
        const error = await parseApiError(response, "无法获取运行时状态");
        throw new Error(error.message);
    }
    return response.json();
}

async function clearUploadedDocs() {
    const response = await fetch(`${apiBase}/upload_status`, {
        method: "DELETE",
    });
    if (!response.ok) {
        const error = await parseApiError(response, "无法清空上传文档");
        throw new Error(error.message);
    }
    return response.json();
}

async function clearSession() {
    const response = await fetch(`${apiBase}/session/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
    });
    if (!response.ok) {
        const error = await parseApiError(response, "无法清空会话");
        throw new Error(error.message);
    }
    return response.json();
}

function renderUploadStatus(payload) {
    appState.hasUploadedDocs = Boolean(payload.has_uploaded_docs && payload.active_file);
    appState.activeUploadFile = payload.active_file || null;
    refreshStatusView();
}

function renderRuntimeStatus(payload) {
    appState.runtimeChat = payload.chat || null;
    appState.runtimeUpload = payload.upload || null;
    refreshStatusView();
}

async function askQuestion(question) {
    const response = await fetch(`${apiBase}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            question,
            use_uploaded_docs: appState.hasUploadedDocs,
            session_id: sessionId,
        }),
    });

    if (!response.ok) {
        const error = await parseApiError(response, "问答请求失败");
        throw new Error(error.message);
    }

    return response.json();
}

async function streamQuestion(question, targetNode) {
    const response = await fetch(`${apiBase}/chat_stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            question,
            use_uploaded_docs: appState.hasUploadedDocs,
            session_id: sessionId,
        }),
    });

    if (!response.ok) {
        const error = await parseApiError(response, "问答请求失败");
        throw new Error(error.message);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalMeta = null;
    const typewriter = createTypewriter(getMessageBody(targetNode));

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) {
                continue;
            }

            const payload = JSON.parse(line.slice(5).trim());
            if (payload.type === "token") {
                typewriter.push(payload.content || "");
            } else if (payload.type === "replace") {
                typewriter.replace(payload.content || "");
            } else if (payload.type === "meta") {
                finalMeta = payload;
            }
        }
    }

    await typewriter.waitForIdle();
    typewriter.setFinalText(typewriter.getText());
    renderAnswerMeta(targetNode, finalMeta);
}

async function syncStatus() {
    const [uploadPayload, runtimePayload] = await Promise.all([fetchUploadStatus(), fetchRuntimeStatus()]);
    renderUploadStatus(uploadPayload);
    renderRuntimeStatus(runtimePayload);
}

uploadInput?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file || appState.isUploading || appState.isSending) {
        return;
    }

    try {
        await uploadDocument(file);
        await syncStatus();
    } catch (error) {
        appState.activeUploadFile = null;
        refreshStatusView();
        appendMessage("assistant", `上传失败：${error.message}`);
    } finally {
        uploadInput.value = "";
    }
});

clearUploadButton?.addEventListener("click", async () => {
    if (appState.isUploading || appState.isSending || !appState.hasUploadedDocs) {
        return;
    }

    try {
        const payload = await clearUploadedDocs();
        renderUploadStatus(payload);
        appendMessage("assistant", "已清空上传知识库，当前恢复为个人简历问答模式。");
        await syncStatus();
    } catch (error) {
        appendMessage("assistant", `清空失败：${error.message}`);
    }
});

clearSessionButton?.addEventListener("click", async () => {
    if (appState.isUploading || appState.isSending) {
        return;
    }

    try {
        await clearSession();
        appState.lastSessionResetAt = Date.now();
        chatLog.innerHTML = "";
        appendMessage("assistant", "会话已清空，可以重新开始提问。");
        refreshStatusView();
    } catch (error) {
        appendMessage("assistant", `清空会话失败：${error.message}`);
    }
});

chatForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = chatInput.value.trim();
    if (!question || appState.isSending || appState.isUploading) {
        return;
    }

    appState.isSending = true;
    appState.lastSessionResetAt = null;
    refreshStatusView();

    appendMessage("user", question);
    chatInput.value = "";
    const assistantNode = appendMessage("assistant", "");

    try {
        await streamQuestion(question, assistantNode);
    } catch (error) {
        try {
            const payload = await askQuestion(question);
            getMessageBody(assistantNode).textContent = payload.answer;
            renderAnswerMeta(assistantNode, payload);
        } catch (fallbackError) {
            getMessageBody(assistantNode).textContent = `请求失败：${fallbackError.message}`;
        }
    } finally {
        appState.isSending = false;
        refreshStatusView();
        syncStatus().catch(() => {});
    }
});

suggestionChips.forEach((chip) => {
    chip.addEventListener("click", () => {
        if (appState.isSending || appState.isUploading) {
            return;
        }
        const question = chip.dataset.question || "";
        if (!question) {
            return;
        }
        chatInput.value = question;
        chatInput.focus();
    });
});

const reveals = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.16 }
    );

    reveals.forEach((item) => observer.observe(item));
} else {
    reveals.forEach((item) => item.classList.add("is-visible"));
}

syncStatus()
    .catch(() => {
        refreshStatusView();
    });

window.setInterval(() => {
    syncStatus().catch(() => {});
}, 10000);
