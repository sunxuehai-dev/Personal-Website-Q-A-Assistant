import {
  askQuestion,
  clearSession,
  clearUploadedDocs,
  fetchRuntimeStatus,
  fetchSiteContent,
  fetchUploadStatus,
  startChatStream,
  uploadResume
} from "./api";
import "./style.css";
import type { ChatReference, ChatResponse, SiteContent } from "./types";

const storageKey = "resume_assistant_frontend_session_id";
const csdnUrl = "https://blog.csdn.net/sunxuehai1?spm=1000.2115.3001.5343";

function createSessionId() {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid;
  }

  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `session-${timestamp}-${randomPart}`;
}

const sessionId = window.localStorage.getItem(storageKey) || createSessionId();
window.localStorage.setItem(storageKey, sessionId);

const state = {
  hasUploadedDocs: false,
  activeUploadFile: null as string | null,
  isSending: false,
  isUploading: false,
  lastSessionResetAt: false
};

function truncateText(text: string, maxLength = 180) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderEmptyState() {
  return `
    <div class="chat-empty-state">
      <p>你好，你可以直接问我的项目经验、技术方案、职业经历，也可以上传一份 PDF 继续追问。</p>
    </div>
  `;
}

function renderApp(siteContent: SiteContent) {
  const app = document.getElementById("app");
  if (!app) {
    return;
  }

  document.title = `${siteContent.profile.name} | ${siteContent.profile.title}`;

  app.innerHTML = `
    <div class="shell site-shell">
      <section id="assistant" class="assistant-stage">
        <div class="assistant-surface">
          <div class="assistant-toolbar">
            <div class="assistant-statusline">
              <span id="knowledge-status" class="status-chip">当前模式：初始化中</span>
              <span id="session-status" class="status-chip subtle">会话记忆：初始化中</span>
              <span id="runtime-status" class="status-chip subtle">运行状态：初始化中</span>
            </div>
            <div class="actions compact-actions">
              <label class="upload">
                <input id="resume-upload" type="file" accept=".pdf" />
                <span>上传 PDF</span>
              </label>
              <button id="clear-upload" type="button">清空文档</button>
              <button id="clear-session" type="button">新对话</button>
            </div>
          </div>

          <div id="chat-log" class="chat-log minimal-chat">
            ${renderEmptyState()}
          </div>

          <form id="chat-form" class="chat-form minimal-form">
            <textarea id="chat-input" rows="3" placeholder="例如：你做过哪些 AI 项目？这个问答助手的整体架构是怎样的？"></textarea>
            <button id="send-button" type="submit">发送</button>
          </form>
        </div>
      </section>

      <section class="hero editorial-hero">
        <div class="hero-copy">
          <p class="eyebrow">AI Product Builder</p>
          <h2>${escapeHtml(siteContent.profile.name)}</h2>
          <p class="hero-title">${escapeHtml(siteContent.profile.title)}</p>
          <p class="hero-copy-text">${escapeHtml(siteContent.profile.tagline)}。我更关注完整产品链路，而不是孤立的模型能力，偏好把检索、接口、前端体验与真实部署约束组织成稳定可用的系统。</p>
          <div class="hero-meta">
            <span>${escapeHtml(siteContent.profile.location)}</span>
            <span>${escapeHtml(siteContent.profile.email)}</span>
            <span>${escapeHtml(siteContent.profile.phone)}</span>
          </div>
        </div>

        <div class="hero-portrait">
          <div class="portrait-frame">
            <img class="portrait-image" src="/static/images/profile.jpg" alt="${escapeHtml(siteContent.profile.name)} portrait" />
          </div>
          <div class="portrait-note">
            <span class="summary-label">Current Focus</span>
            <strong>RAG / Agent / FastAPI / Shipping</strong>
            <p>偏好轻量架构、真实部署、清晰边界和可维护的用户体验。</p>
          </div>
        </div>
      </section>

      <section class="link-strip">
        <a class="panel link-card link-card-primary" href="${csdnUrl}" target="_blank" rel="noreferrer">
          <p class="panel-kicker">Writing</p>
          <strong>CSDN 博客</strong>
          <p>查看我的技术文章、项目记录与开发思考。</p>
          <span class="link-highlight">前往阅读</span>
        </a>
        <article class="panel link-card compact-card">
          <p class="panel-kicker">Build</p>
          <strong>这个网站本身也是作品</strong>
          <p>前后端分离、RAG、记忆、引用展示与轻量部署，都是当前网站的一部分。</p>
        </article>
      </section>

      <section class="content-grid">
        <article id="projects" class="panel">
          <p class="panel-kicker">Selected Projects</p>
          <h2>代表项目</h2>
          <div class="project-grid">
            ${siteContent.projects
              .map(
                (item) => `
                  <div class="project-card">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(item.stack)}</span>
                    <p>${escapeHtml(item.description)}</p>
                  </div>
                `
              )
              .join("")}
          </div>
        </article>

        <article class="panel">
          <p class="panel-kicker">Experience</p>
          <h2>经历</h2>
          <div class="timeline">
            ${siteContent.experience
              .map(
                (item) => `
                  <div class="timeline-item">
                    <span class="timeline-period">${escapeHtml(item.period)}</span>
                    <div class="timeline-content">
                      <strong>${escapeHtml(item.role)}</strong>
                      <p>${escapeHtml(item.company)}</p>
                      <small>${escapeHtml(item.summary)}</small>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      </section>

      <section class="skills-section panel">
        <p class="panel-kicker">Technology</p>
        <h2>技术栈</h2>
        <div class="chip-row">
          ${siteContent.skills.map((skill) => `<span class="chip">${escapeHtml(skill)}</span>`).join("")}
        </div>
      </section>
    </div>
  `;

  bindRuntime();
}

function setStatusText(id: string, text: string, variant: "default" | "subtle" | "busy" = "default") {
  const node = document.getElementById(id);
  if (!node) {
    return;
  }
  node.textContent = text;
  node.className = `status-chip${variant === "default" ? "" : ` ${variant}`}`;
}

function appendMessage(role: "user" | "assistant", content: string) {
  const chatLog = document.getElementById("chat-log");
  if (!chatLog) {
    return null;
  }

  chatLog.querySelector(".chat-empty-state")?.remove();

  const node = document.createElement("div");
  node.className = `message ${role}`;
  node.innerHTML = `<div class="message-body">${escapeHtml(content)}</div>`;
  chatLog.appendChild(node);
  chatLog.scrollTop = chatLog.scrollHeight;
  return node;
}

function renderAnswerMeta(node: HTMLElement | null, payload: ChatResponse) {
  if (!node) {
    return;
  }

  node.querySelector(".message-meta")?.remove();

  const badges = [
    payload.source_badge,
    payload.used_local_context ? "本地资料" : "",
    payload.used_web_search ? "联网补充" : "",
    payload.retried ? "已重试" : ""
  ].filter(Boolean);

  const references = payload.references.slice(0, 3).map(renderReferenceCard).join("");

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.innerHTML = `
    <div class="meta-badges">
      ${badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join("")}
    </div>
    ${references ? `<div class="reference-list">${references}</div>` : ""}
  `;
  node.appendChild(meta);
}

function renderReferenceCard(reference: ChatReference) {
  const parts = [
    reference.source_file || "未知来源",
    reference.page ? `P${reference.page}` : "",
    reference.retrieval_method || ""
  ].filter(Boolean);

  return `
    <div class="reference-card">
      <strong>${escapeHtml(parts.join(" · "))}</strong>
      <p>${escapeHtml(truncateText(reference.content))}</p>
    </div>
  `;
}

async function refreshStatusText() {
  const [uploadStatus, runtimeStatus] = await Promise.all([fetchUploadStatus(), fetchRuntimeStatus()]);
  state.hasUploadedDocs = uploadStatus.has_uploaded_docs;
  state.activeUploadFile = uploadStatus.active_file;

  if (state.isUploading) {
    setStatusText("knowledge-status", "当前模式：正在处理上传文档", "busy");
  } else if (state.hasUploadedDocs && state.activeUploadFile) {
    setStatusText("knowledge-status", `当前模式：文档问答 · ${state.activeUploadFile}`);
  } else {
    setStatusText("knowledge-status", "当前模式：站内问答");
  }

  if (state.lastSessionResetAt) {
    setStatusText("session-status", "会话记忆：已清空", "subtle");
  } else {
    setStatusText("session-status", "会话记忆：当前浏览器会话", "subtle");
  }

  if (state.isSending) {
    setStatusText("runtime-status", "运行状态：正在生成回答", "busy");
    return;
  }
  if (runtimeStatus.upload.busy) {
    setStatusText("runtime-status", "运行状态：文档处理中", "busy");
    return;
  }
  if (runtimeStatus.chat.busy) {
    setStatusText(
      "runtime-status",
      `运行状态：并发已满（${runtimeStatus.chat.active}/${runtimeStatus.chat.max_concurrent}）`,
      "busy"
    );
    return;
  }
  setStatusText("runtime-status", "运行状态：空闲", "subtle");
}

async function streamQuestion(question: string, targetNode: HTMLElement) {
  const response = await startChatStream(question, state.hasUploadedDocs, sessionId);
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("流式响应不可用");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let finalMeta: ChatResponse | null = null;
  const body = targetNode.querySelector(".message-body") as HTMLElement;

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

      const payload = JSON.parse(line.slice(5).trim()) as ChatResponse & { type?: string; content?: string };
      if (payload.type === "token") {
        body.textContent += payload.content || "";
      } else if (payload.type === "replace") {
        body.textContent = payload.content || "";
      } else if (payload.type === "meta") {
        finalMeta = payload;
      }
    }
  }

  if (finalMeta) {
    renderAnswerMeta(targetNode, finalMeta);
  }
}

function bindRuntime() {
  const chatForm = document.getElementById("chat-form") as HTMLFormElement | null;
  const chatInput = document.getElementById("chat-input") as HTMLTextAreaElement | null;
  const uploadInput = document.getElementById("resume-upload") as HTMLInputElement | null;
  const clearUploadButton = document.getElementById("clear-upload") as HTMLButtonElement | null;
  const clearSessionButton = document.getElementById("clear-session") as HTMLButtonElement | null;

  chatForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = chatInput?.value.trim() ?? "";
    if (!question || state.isSending || state.isUploading) {
      return;
    }

    state.isSending = true;
    state.lastSessionResetAt = false;
    await refreshStatusText().catch(() => {});
    const userNode = appendMessage("user", question);
    if (chatInput) {
      chatInput.value = "";
    }
    const message = appendMessage("assistant", "");

    try {
      if (userNode) {
        userNode.scrollIntoView({ block: "end" });
      }
      if (message) {
        await streamQuestion(question, message);
      }
    } catch {
      try {
        const payload = await askQuestion(question, state.hasUploadedDocs, sessionId);
        const body = message?.querySelector(".message-body");
        if (body) {
          body.textContent = payload.answer;
        }
        renderAnswerMeta(message, payload);
      } catch (error) {
        const body = message?.querySelector(".message-body");
        if (body) {
          body.textContent = `请求失败：${(error as Error).message}`;
        }
      }
    } finally {
      state.isSending = false;
      refreshStatusText().catch(() => {});
    }
  });

  uploadInput?.addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || state.isSending || state.isUploading) {
      return;
    }

    state.isUploading = true;
    await refreshStatusText().catch(() => {});

    try {
      const payload = await uploadResume(file);
      state.hasUploadedDocs = true;
      state.activeUploadFile = payload.file_name;
      appendMessage("assistant", `文档已上传并完成入库：${payload.file_name}`);
    } catch (error) {
      appendMessage("assistant", `上传失败：${(error as Error).message}`);
    } finally {
      state.isUploading = false;
      if (uploadInput) {
        uploadInput.value = "";
      }
      refreshStatusText().catch(() => {});
    }
  });

  clearUploadButton?.addEventListener("click", async () => {
    try {
      await clearUploadedDocs();
      state.hasUploadedDocs = false;
      state.activeUploadFile = null;
      appendMessage("assistant", "已清空上传文档，当前恢复为站内资料问答模式。");
      refreshStatusText().catch(() => {});
    } catch (error) {
      appendMessage("assistant", `清空失败：${(error as Error).message}`);
    }
  });

  clearSessionButton?.addEventListener("click", async () => {
    try {
      await clearSession(sessionId);
      state.lastSessionResetAt = true;
      const chatLog = document.getElementById("chat-log");
      if (chatLog) {
        chatLog.innerHTML = renderEmptyState();
      }
      refreshStatusText().catch(() => {});
    } catch (error) {
      appendMessage("assistant", `清空会话失败：${(error as Error).message}`);
    }
  });

  refreshStatusText().catch(() => {});
  window.setInterval(() => {
    refreshStatusText().catch(() => {});
  }, 10000);
}

fetchSiteContent()
  .then(renderApp)
  .catch((error: Error) => {
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `<div class="shell"><section class="panel"><h1>前端初始化失败</h1><p>${escapeHtml(error.message)}</p></section></div>`;
    }
  });
