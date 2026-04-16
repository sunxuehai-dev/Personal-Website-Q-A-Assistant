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

function renderApp(siteContent: SiteContent) {
  const app = document.getElementById("app");
  if (!app) {
    return;
  }

  document.title = `${siteContent.profile.name} | AI 控制台`;

  app.innerHTML = `
    <div class="shell dashboard-shell">
      <section class="hero hero-console">
        <div class="hero-copy">
          <p class="eyebrow">Personal AI Product / Live Site</p>
          <h1>把个人经历、项目和知识库做成一个能直接对话的网站</h1>
          <p class="subtitle">${escapeHtml(siteContent.profile.name)} · ${escapeHtml(siteContent.profile.title)}</p>
          <p class="copy">${escapeHtml(siteContent.profile.tagline)}。这不是一张静态简历，而是一套真正上线运行的轻量 AI 产品：前端独立构建、后端 API 化，支持记忆、RAG、上传文档问答和按需联网补充。</p>
          <div class="hero-tags">
            <span class="hero-tag">正式首页已切换</span>
            <span class="hero-tag">FastAPI + Vite</span>
            <span class="hero-tag">2 核 2G 可运行</span>
          </div>
        </div>
        <div class="hero-signal">
          <div class="signal-card primary">
            <span class="signal-label">Current Product</span>
            <strong>Resume Assistant</strong>
            <p>一个嵌入个人网站的轻量问答助手，可以回答关于我本人、项目经历和上传文档的问题。</p>
          </div>
          <div class="signal-grid">
            <div class="signal-card">
              <span class="signal-label">Architecture</span>
              <strong>API First</strong>
              <p>前后端边界清晰，接口稳定，页面内容由后端 API 驱动。</p>
            </div>
            <div class="signal-card">
              <span class="signal-label">Deployment</span>
              <strong>Single Server</strong>
              <p>保留单体服务与轻量部署，优先稳定交付而不是复杂扩展。</p>
            </div>
            <div class="signal-card">
              <span class="signal-label">Location</span>
              <strong>${escapeHtml(siteContent.profile.location)}</strong>
              <p>${escapeHtml(siteContent.profile.email)}</p>
            </div>
            <div class="signal-card">
              <span class="signal-label">Interaction</span>
              <strong>Stream + References</strong>
              <p>回答流式输出，并展示来源标签和引用片段。</p>
            </div>
          </div>
        </div>
      </section>

      <section class="overview-grid">
        <article class="panel control-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">System Modules</p>
              <h2>这个站点能做什么</h2>
            </div>
            <span class="section-note">不是大而全，但足够完整</span>
          </div>
          <div class="module-grid">
            <div class="module-card">
              <span class="module-index">01</span>
              <strong>短期记忆</strong>
              <p>浏览器会话级记忆，让连续追问能继承上下文，又不把系统做得过重。</p>
            </div>
            <div class="module-card">
              <span class="module-index">02</span>
              <strong>双知识源 RAG</strong>
              <p>默认围绕个人简历问答，上传 PDF 后自动切到临时知识库模式。</p>
            </div>
            <div class="module-card">
              <span class="module-index">03</span>
              <strong>联网补充</strong>
              <p>本地资料不够时，再按需联网补充，而不是把所有问题都丢给搜索。</p>
            </div>
            <div class="module-card">
              <span class="module-index">04</span>
              <strong>运行时保护</strong>
              <p>针对小规格服务器做了上传互斥和聊天限流，保证线上环境不容易拖垮。</p>
            </div>
          </div>
        </article>

        <article class="panel control-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">Experience Graph</p>
              <h2>工程背景与项目脉络</h2>
            </div>
            <span class="section-note">站点内容由统一内容接口加载</span>
          </div>
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
      </section>

      <section class="workspace-grid">
        <article class="panel assistant assistant-panel">
          <div class="assistant-head">
            <div>
              <p class="panel-kicker">Assistant Workspace</p>
              <h2>直接开问</h2>
              <p class="section-summary">这里是网站的实际工作区。你可以直接提问、上传 PDF、查看引用来源，或者清空当前会话重新开始。</p>
              <div class="status-group">
                <span id="knowledge-status" class="status-chip">当前模式：初始化中</span>
                <span id="session-status" class="status-chip subtle">会话记忆：初始化中</span>
                <span id="runtime-status" class="status-chip subtle">运行状态：初始化中</span>
              </div>
            </div>
            <div class="actions">
              <label class="upload">
                <input id="resume-upload" type="file" accept=".pdf" />
                <span>上传 PDF</span>
              </label>
              <button id="clear-upload" type="button">清空上传</button>
              <button id="clear-session" type="button">清空会话</button>
            </div>
          </div>
          <div id="chat-log" class="chat-log">
            <div class="message assistant">
              <div class="message-body">你好，我已经联通后端问答链路。你可以问我的项目、经历、技术栈，也可以先上传 PDF 再围绕文档继续追问。</div>
            </div>
          </div>
          <form id="chat-form" class="chat-form">
            <textarea id="chat-input" rows="4" placeholder="例如：你做过哪些 AI 项目？这个问答助手的链路是怎么设计的？"></textarea>
            <button id="send-button" type="submit">开始提问</button>
          </form>
        </article>

        <aside class="workspace-side">
          <section class="panel side-panel">
            <div class="panel-head">
              <div>
                <p class="panel-kicker">Capability Matrix</p>
                <h2>核心技术栈</h2>
              </div>
            </div>
            <div class="chip-row">
              ${siteContent.skills.map((skill) => `<span class="chip">${escapeHtml(skill)}</span>`).join("")}
            </div>
          </section>

          <section class="panel side-panel">
            <div class="panel-head">
              <div>
                <p class="panel-kicker">Use Cases</p>
                <h2>使用方式</h2>
              </div>
            </div>
            <div class="notes-list">
              <div class="note-card">
                <strong>问我本人</strong>
                <p>默认模式会围绕我的个人经历、项目背景和技术栈进行回答。</p>
              </div>
              <div class="note-card">
                <strong>问上传文档</strong>
                <p>上传 PDF 后，系统会优先围绕当前文档检索并给出引用片段。</p>
              </div>
              <div class="note-card">
                <strong>连续追问</strong>
                <p>当前浏览器会话内保留短期上下文，适合轻量多轮对话。</p>
              </div>
              <div class="note-card">
                <strong>资源约束</strong>
                <p>整个系统按小规格服务器设计，优先实用、稳定和可维护。</p>
              </div>
            </div>
          </section>
        </aside>
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
    setStatusText("knowledge-status", `当前模式：上传文档问答（${state.activeUploadFile}）`);
  } else {
    setStatusText("knowledge-status", "当前模式：个人简历问答");
  }

  if (state.lastSessionResetAt) {
    setStatusText("session-status", "会话记忆：已清空，后续对话将重新积累", "subtle");
  } else {
    setStatusText("session-status", "会话记忆：当前浏览器会话已启用", "subtle");
  }

  if (state.isSending) {
    setStatusText("runtime-status", "运行状态：正在生成回答", "busy");
    return;
  }
  if (runtimeStatus.upload.busy) {
    setStatusText("runtime-status", "运行状态：上传灌库处理中", "busy");
    return;
  }
  if (runtimeStatus.chat.busy) {
    setStatusText(
      "runtime-status",
      `运行状态：聊天容量已满（${runtimeStatus.chat.active}/${runtimeStatus.chat.max_concurrent}）`,
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
      appendMessage("assistant", `已完成上传并自动灌库：${payload.file_name}`);
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
      appendMessage("assistant", "已清空上传知识库，当前恢复为个人简历问答模式。");
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
        chatLog.innerHTML = "";
      }
      appendMessage("assistant", "会话已清空，可以重新开始提问。");
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
      app.innerHTML = `<div class="shell"><section class="panel"><h1>前端骨架初始化失败</h1><p>${escapeHtml(error.message)}</p></section></div>`;
    }
  });
