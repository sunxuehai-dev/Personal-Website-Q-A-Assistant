import {
    clearSession,
    clearUploadedDocs,
    fetchRuntimeStatus,
    fetchSiteContent,
    fetchUploadStatus,
    uploadDocument,
} from "./api.js";
import { handleChatSubmit } from "./chat.js";
import { dom } from "./dom.js";
import { appState, sessionId } from "./state.js";
import { appendMessage, refreshStatusView, renderSiteContent, setupRevealAnimations } from "./ui.js";

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

async function syncStatus() {
    const [uploadPayload, runtimePayload] = await Promise.all([fetchUploadStatus(), fetchRuntimeStatus()]);
    renderUploadStatus(uploadPayload);
    renderRuntimeStatus(runtimePayload);
}

function bindEvents() {
    dom.uploadInput?.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file || appState.isUploading || appState.isSending) {
            return;
        }

        appState.isUploading = true;
        appState.activeUploadFile = file.name;
        refreshStatusView();

        try {
            const payload = await uploadDocument(file);
            appState.hasUploadedDocs = true;
            appState.activeUploadFile = payload.file_name || file.name;
            appendMessage("assistant", `已完成上传并自动灌库：${appState.activeUploadFile}`);
            await syncStatus();
        } catch (error) {
            appState.activeUploadFile = null;
            appendMessage("assistant", `上传失败：${error.message}`);
        } finally {
            appState.isUploading = false;
            refreshStatusView();
            dom.uploadInput.value = "";
        }
    });

    dom.clearUploadButton?.addEventListener("click", async () => {
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

    dom.clearSessionButton?.addEventListener("click", async () => {
        if (appState.isUploading || appState.isSending) {
            return;
        }

        try {
            await clearSession(sessionId);
            appState.lastSessionResetAt = Date.now();
            dom.chatLog.innerHTML = "";
            appendMessage("assistant", "会话已清空，可以重新开始提问。");
            refreshStatusView();
        } catch (error) {
            appendMessage("assistant", `清空会话失败：${error.message}`);
        }
    });

    dom.chatForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const question = dom.chatInput.value.trim();
        if (!question || appState.isSending || appState.isUploading) {
            return;
        }

        dom.chatInput.value = "";
        await handleChatSubmit(question);
        syncStatus().catch(() => {});
    });

    dom.suggestionChips.forEach((chip) => {
        chip.addEventListener("click", () => {
            if (appState.isSending || appState.isUploading) {
                return;
            }
            const question = chip.dataset.question || "";
            if (!question) {
                return;
            }
            dom.chatInput.value = question;
            dom.chatInput.focus();
        });
    });
}

function bootstrapSiteContent() {
    fetchSiteContent()
        .then(renderSiteContent)
        .catch(() => {
            if (dom.brandName) {
                dom.brandName.textContent = "Resume Assistant";
            }
            if (dom.brandTitle) {
                dom.brandTitle.textContent = "站点内容加载失败";
            }
        });
}

function bootstrapRuntimeState() {
    syncStatus().catch(() => {
        refreshStatusView();
    });

    window.setInterval(() => {
        syncStatus().catch(() => {});
    }, 10000);
}

export function initApp() {
    bindEvents();
    setupRevealAnimations();
    bootstrapRuntimeState();
    bootstrapSiteContent();
}
