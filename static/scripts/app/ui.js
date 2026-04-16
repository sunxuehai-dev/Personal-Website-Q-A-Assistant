import { dom } from "./dom.js";
import { appState } from "./state.js";
import { escapeHtml, sleep, truncateText } from "./utils.js";

export function appendMessage(role, content) {
    const wrapper = document.createElement("div");
    wrapper.className = `message ${role}`;
    const body = document.createElement("div");
    body.className = "message-body";
    body.textContent = content;
    wrapper.appendChild(body);
    dom.chatLog.appendChild(wrapper);
    dom.chatLog.scrollTop = dom.chatLog.scrollHeight;
    return wrapper;
}

export function getMessageBody(node) {
    return node?.querySelector(".message-body") || node;
}

export function setPillState(element, text, variant = "subtle") {
    if (!element) {
        return;
    }
    element.textContent = text;
    element.classList.remove("subtle", "busy", "ready");
    element.classList.add(variant);
}

export function renderSiteContent(payload) {
    const profile = payload.profile || {};
    const experience = Array.isArray(payload.experience) ? payload.experience : [];
    const projects = Array.isArray(payload.projects) ? payload.projects : [];
    const skills = Array.isArray(payload.skills) ? payload.skills : [];

    document.title = `${profile.name || "Resume Assistant"} | ${profile.title || "Personal Website"}`;

    if (dom.brandName) dom.brandName.textContent = profile.name || "Resume Assistant";
    if (dom.brandTitle) dom.brandTitle.textContent = profile.title || "AI 应用开发工程师";
    if (dom.operatorName) dom.operatorName.textContent = profile.name || "未知";
    if (dom.operatorLocation) dom.operatorLocation.textContent = profile.location || "未知";
    if (dom.operatorEmail) dom.operatorEmail.textContent = profile.email || "未知";
    if (dom.operatorPhone) dom.operatorPhone.textContent = profile.phone || "未知";
    if (dom.profileName) dom.profileName.textContent = profile.name || "未知";
    if (dom.profileTagline) dom.profileTagline.textContent = profile.tagline || "暂无简介";

    if (dom.experienceList) {
        dom.experienceList.innerHTML = experience
            .map(
                (item) => `
                    <article class="timeline-card">
                        <p class="timeline-period">${escapeHtml(item.period)}</p>
                        <h4>${escapeHtml(item.role)}</h4>
                        <p class="timeline-company">${escapeHtml(item.company)}</p>
                        <p>${escapeHtml(item.summary)}</p>
                    </article>
                `
            )
            .join("");
    }

    if (dom.projectList) {
        dom.projectList.innerHTML = projects
            .map(
                (item) => `
                    <article class="project-card">
                        <p class="project-stack">${escapeHtml(item.stack)}</p>
                        <h4>${escapeHtml(item.name)}</h4>
                        <p>${escapeHtml(item.description)}</p>
                    </article>
                `
            )
            .join("");
    }

    if (dom.skillList) {
        dom.skillList.innerHTML = skills.map((skill) => `<span>${escapeHtml(skill)}</span>`).join("");
    }
}

export function refreshStatusView() {
    if (appState.isUploading) {
        setPillState(dom.knowledgeStatus, "当前模式：正在处理上传文档", "busy");
    } else if (appState.hasUploadedDocs) {
        const fileLabel = appState.activeUploadFile ? `（${appState.activeUploadFile}）` : "";
        setPillState(dom.knowledgeStatus, `当前模式：上传文档问答${fileLabel}`, "ready");
    } else {
        setPillState(dom.knowledgeStatus, "当前模式：个人简历问答", "ready");
    }

    if (appState.lastSessionResetAt) {
        setPillState(dom.sessionStatus, "会话记忆：已清空，后续对话将重新积累", "subtle");
    } else {
        setPillState(dom.sessionStatus, "会话记忆：当前浏览器会话已启用", "subtle");
    }

    if (appState.isSending) {
        setPillState(dom.runtimeStatus, "运行状态：正在生成回答", "busy");
    } else if (appState.runtimeUpload?.busy) {
        setPillState(dom.runtimeStatus, "运行状态：上传灌库处理中", "busy");
    } else if (appState.runtimeChat?.busy) {
        const active = appState.runtimeChat.active ?? 0;
        const total = appState.runtimeChat.max_concurrent ?? 0;
        setPillState(dom.runtimeStatus, `运行状态：聊天容量已满（${active}/${total}）`, "busy");
    } else {
        setPillState(dom.runtimeStatus, "运行状态：空闲", "ready");
    }

    const disableChat = appState.isSending || appState.isUploading || Boolean(appState.runtimeUpload?.busy);
    const disableUpload = appState.isUploading || appState.isSending || Boolean(appState.runtimeUpload?.busy);
    const disableSessionClear = appState.isSending || appState.isUploading;

    if (dom.sendButton) {
        dom.sendButton.disabled = disableChat;
        dom.sendButton.textContent = appState.isSending ? "发送中..." : "发送";
    }
    if (dom.chatInput) dom.chatInput.disabled = disableChat;
    if (dom.uploadInput) dom.uploadInput.disabled = disableUpload;
    if (dom.uploadChip) dom.uploadChip.classList.toggle("is-disabled", disableUpload);
    if (dom.clearUploadButton) dom.clearUploadButton.disabled = disableUpload || !appState.hasUploadedDocs;
    if (dom.clearSessionButton) dom.clearSessionButton.disabled = disableSessionClear;
}

export function createTypewriter(targetNode) {
    let queue = [];
    let answerText = "";
    let isFlushing = false;

    async function flush() {
        if (isFlushing) return;
        isFlushing = true;

        while (queue.length > 0) {
            answerText += queue.shift();
            targetNode.textContent = answerText;
            dom.chatLog.scrollTop = dom.chatLog.scrollHeight;
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
            dom.chatLog.scrollTop = dom.chatLog.scrollHeight;
        },
    };
}

function buildReferenceLabel(reference) {
    const file = reference.source_file || "未知来源";
    const page = reference.page ? `P${reference.page}` : null;
    const method = reference.retrieval_method || null;
    return [file, page, method].filter(Boolean).join(" · ");
}

export function renderAnswerMeta(messageNode, meta) {
    if (!messageNode || !meta) {
        return;
    }

    messageNode.querySelector(".message-meta")?.remove();

    const metaNode = document.createElement("div");
    metaNode.className = "message-meta";

    const badges = document.createElement("div");
    badges.className = "meta-badges";
    const badgeTexts = [meta.source_badge || "回答完成"];

    if (meta.used_local_context) badgeTexts.push("已使用本地资料");
    if (meta.used_web_search) badgeTexts.push("已使用联网补充");
    if (meta.retried) badgeTexts.push("已执行一次重试");

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

export function setupRevealAnimations() {
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

        dom.reveals.forEach((item) => observer.observe(item));
        return;
    }

    dom.reveals.forEach((item) => item.classList.add("is-visible"));
}
