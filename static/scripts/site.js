const apiBase = "";
const chatLog = document.getElementById("chat-log");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const uploadInput = document.getElementById("resume-upload");
const knowledgeStatus = document.getElementById("knowledge-status");
const clearUploadButton = document.getElementById("clear-upload");
const suggestionChips = document.querySelectorAll(".suggestion-chip");

let useUploadedDocs = false;

function appendMessage(role, content) {
    const wrapper = document.createElement("div");
    wrapper.className = `message ${role}`;
    wrapper.textContent = content;
    chatLog.appendChild(wrapper);
    chatLog.scrollTop = chatLog.scrollHeight;
    return wrapper;
}

function routeLabel(routeTarget) {
    if (routeTarget === "self_resume") return "来自个人简历知识库";
    if (routeTarget === "uploaded_docs") return "来自上传文档知识库";
    if (routeTarget === "both") return "来自双知识库";
    return "已完成回答";
}

async function uploadDocument(file) {
    const formData = new FormData();
    formData.append("file", file);
    knowledgeStatus.textContent = `正在处理上传文档：${file.name}`;

    const response = await fetch(`${apiBase}/upload_resume`, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "上传失败");
    }

    useUploadedDocs = true;
    knowledgeStatus.textContent = `已加载上传文档：${file.name}`;
    appendMessage("assistant", `已完成上传并自动灌库：${file.name}`);
}

async function fetchUploadStatus() {
    const response = await fetch(`${apiBase}/upload_status`);
    if (!response.ok) {
        throw new Error("无法获取上传状态");
    }
    return response.json();
}

async function clearUploadedDocs() {
    const response = await fetch(`${apiBase}/upload_status`, {
        method: "DELETE",
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "无法清空上传文档");
    }
    return response.json();
}

function renderUploadStatus(payload) {
    if (payload.has_uploaded_docs && payload.active_file) {
        useUploadedDocs = true;
        knowledgeStatus.textContent = `已加载上传文档：${payload.active_file}`;
        return;
    }
    useUploadedDocs = false;
    knowledgeStatus.textContent = "当前模式：个人简历问答";
}

async function askQuestion(question) {
    const response = await fetch(`${apiBase}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            question,
            use_uploaded_docs: useUploadedDocs,
        }),
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "问答请求失败");
    }

    return response.json();
}

async function streamQuestion(question, targetNode) {
    const response = await fetch(`${apiBase}/chat_stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            question,
            use_uploaded_docs: useUploadedDocs,
        }),
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "问答请求失败");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalMeta = null;
    let answerText = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;

            const payload = JSON.parse(line.slice(5).trim());
            if (payload.type === "token") {
                answerText += payload.content || "";
                targetNode.textContent = answerText;
                chatLog.scrollTop = chatLog.scrollHeight;
            } else if (payload.type === "replace") {
                answerText = payload.content || "";
                targetNode.textContent = answerText;
                chatLog.scrollTop = chatLog.scrollHeight;
            } else if (payload.type === "meta") {
                finalMeta = payload;
            }
        }
    }

    if (finalMeta?.route_target) {
        targetNode.textContent = `${answerText}\n\n${routeLabel(finalMeta.route_target)}`;
        knowledgeStatus.textContent = routeLabel(finalMeta.route_target);
    } else {
        knowledgeStatus.textContent = "已完成回答";
    }
}

uploadInput?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        await uploadDocument(file);
    } catch (error) {
        knowledgeStatus.textContent = "上传失败";
        appendMessage("assistant", `上传失败：${error.message}`);
    } finally {
        uploadInput.value = "";
    }
});

clearUploadButton?.addEventListener("click", async () => {
    try {
        const payload = await clearUploadedDocs();
        renderUploadStatus(payload);
        appendMessage("assistant", "已清空上传知识库，已恢复为个人简历问答模式。");
    } catch (error) {
        appendMessage("assistant", `清空失败：${error.message}`);
    }
});

chatForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = chatInput.value.trim();
    if (!question) return;

    appendMessage("user", question);
    chatInput.value = "";
    knowledgeStatus.textContent = "正在生成回答...";
    const assistantNode = appendMessage("assistant", "");

    try {
        await streamQuestion(question, assistantNode);
    } catch (error) {
        try {
            const payload = await askQuestion(question);
            assistantNode.textContent = `${payload.answer}\n\n${routeLabel(payload.route_target)}`;
            knowledgeStatus.textContent = routeLabel(payload.route_target);
        } catch (fallbackError) {
            knowledgeStatus.textContent = "请求失败";
            assistantNode.textContent = `请求失败：${fallbackError.message}`;
        }
    }
});

suggestionChips.forEach((chip) => {
    chip.addEventListener("click", () => {
        const question = chip.dataset.question || "";
        if (!question) return;
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

fetchUploadStatus()
    .then(renderUploadStatus)
    .catch(() => {
        knowledgeStatus.textContent = "当前模式：个人简历问答";
    });
