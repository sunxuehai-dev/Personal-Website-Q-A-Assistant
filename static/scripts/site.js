const apiBase = document.body.dataset.apiBase || "";
const chatLog = document.getElementById("chat-log");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const uploadInput = document.getElementById("resume-upload");
const knowledgeStatus = document.getElementById("knowledge-status");
const suggestionChips = document.querySelectorAll(".suggestion-chip");

let useUploadedDocs = false;

function appendMessage(role, content) {
    const wrapper = document.createElement("div");
    wrapper.className = `message ${role}`;
    wrapper.textContent = content;
    chatLog.appendChild(wrapper);
    chatLog.scrollTop = chatLog.scrollHeight;
}

function routeLabel(routeTarget) {
    if (routeTarget === "self_resume") return "\u6765\u81ea\u4e2a\u4eba\u7b80\u5386\u77e5\u8bc6\u5e93";
    if (routeTarget === "uploaded_docs") return "\u6765\u81ea\u4e0a\u4f20\u6587\u6863\u77e5\u8bc6\u5e93";
    if (routeTarget === "both") return "\u6765\u81ea\u53cc\u77e5\u8bc6\u5e93";
    return "\u5df2\u5b8c\u6210\u56de\u7b54";
}

async function uploadDocument(file) {
    const formData = new FormData();
    formData.append("file", file);
    knowledgeStatus.textContent = `\u6b63\u5728\u5904\u7406\u4e0a\u4f20\u6587\u6863\uff1a${file.name}`;

    const response = await fetch(`${apiBase}/upload_resume`, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "\u4e0a\u4f20\u5931\u8d25");
    }

    useUploadedDocs = true;
    knowledgeStatus.textContent = `\u5df2\u52a0\u8f7d\u4e0a\u4f20\u6587\u6863\uff1a${file.name}`;
    appendMessage("assistant", `\u5df2\u5b8c\u6210\u4e0a\u4f20\u5e76\u81ea\u52a8\u704c\u5e93\uff1a${file.name}`);
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
        throw new Error(payload.detail || "\u95ee\u7b54\u8bf7\u6c42\u5931\u8d25");
    }

    return response.json();
}

uploadInput?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        await uploadDocument(file);
    } catch (error) {
        knowledgeStatus.textContent = "\u4e0a\u4f20\u5931\u8d25";
        appendMessage("assistant", `\u4e0a\u4f20\u5931\u8d25\uff1a${error.message}`);
    } finally {
        uploadInput.value = "";
    }
});

chatForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = chatInput.value.trim();
    if (!question) return;

    appendMessage("user", question);
    chatInput.value = "";
    knowledgeStatus.textContent = "\u6b63\u5728\u751f\u6210\u56de\u7b54...";

    try {
        const payload = await askQuestion(question);
        appendMessage("assistant", `${payload.answer}\n\n${routeLabel(payload.route_target)}`);
        knowledgeStatus.textContent = routeLabel(payload.route_target);
    } catch (error) {
        knowledgeStatus.textContent = "\u8bf7\u6c42\u5931\u8d25";
        appendMessage("assistant", `\u8bf7\u6c42\u5931\u8d25\uff1a${error.message}`);
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
