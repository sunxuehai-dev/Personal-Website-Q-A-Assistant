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

  document.title = `${siteContent.profile.name} | 个人主页`;

  app.innerHTML = `
    <div class="shell site-shell">
      <section class="hero">
        <div class="hero-main">
          <p class="eyebrow">Sun Xuehai</p>
          <h1>${escapeHtml(siteContent.profile.name)}</h1>
          <p class="hero-title">${escapeHtml(siteContent.profile.title)}</p>
          <p class="hero-copy">${escapeHtml(siteContent.profile.tagline)}。我专注于把大模型能力落到真实产品中，包括检索增强、Agent 编排、接口服务化和轻量部署。</p>
          <div class="hero-actions">
            <a class="hero-link primary" href="#assistant">和我对话</a>
            <a class="hero-link secondary" href="#projects">查看项目</a>
          </div>
        </div>
        <div class="hero-side">
          <div class="summary-card">
            <span class="summary-label">Location</span>
            <strong>${escapeHtml(siteContent.profile.location)}</strong>
            <p>${escapeHtml(siteContent.profile.email)}</p>
          </div>
          <div class="summary-card">
            <span class="summary-label">Focus</span>
            <strong>RAG / Agent / FastAPI</strong>
            <p>关注清晰架构、稳定接口和小机器上的可运行性。</p>
          </div>
        </div>
      </section>

      <section class="intro-grid">
        <article class="panel intro-panel">
          <p class="panel-kicker">About</p>
          <h2>我在做什么</h2>
          <div class="paragraphs">
            <p>我更重视把 AI 能力做成真正可上线、可维护、可交互的产品，而不是停留在模型演示层。</p>
            <p>这个网站本身就是一个作品：你可以直接读内容，也可以让问答助手围绕我的经历、项目和上传文档进行回答。</p>
          </div>
        </article>
        <article class="panel intro-panel">
          <p class="panel-kicker">Highlights</p>
          <h2>核心能力</h2>
          <div class="feature-list">
            <div class="feature-item">
              <strong>轻量会话记忆</strong>
              <p>支持连续追问，但不过度引入复杂记忆系统。</p>
            </div>
            <div class="feature-item">
              <strong>双知识源问答</strong>
              <p>既能围绕我的资料回答，也能切换到上传文档。</p>
            </div>
            <div class="feature-item">
              <strong>引用与流式输出</strong>
              <p>回答过程可见，来源也尽量清楚。</p>
            </div>
          </div>
        </article>
      </section>

      <section class="content-grid">
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

        <article id="projects" class="panel">
          <p class="panel-kicker">Projects</p>
          <h2>项目作品</h2>
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

      <section class="skills-section panel">
        <p class="panel-kicker">Stack</p>
        <h2>技术栈</h2>
        <div class="chip-row">
          ${siteContent.skills.map((skill) => `<span class="chip">${escapeHtml(skill)}</span>`).join("")}
        </div>
      </section>

      <section id="assistant" class="panel assistant-panel">
        <div class="assistant-head">
          <div>
            <p class="panel-kicker">Ask Me</p>
            <h2>和这个网站直接对话</h2>
            <p class="section-summary">你可以直接提问，也可以上传 PDF 再围绕文档继续追问。</p>
          </div>
          <div class="actions">
            <label class="upload">
              <input id="resume-upload" type="file" accept=".pdf" />
              <span>上传文档</span>
            </label>
            <button id="clear-upload" type="button">清空上传</button>
            <button id="clear-session" type="button">清空会话</button>
          </div>
        </div>

        <div class="status-group">
          <span id="knowledge-status" class="status-chip">当前模式：初始化中</span>
          <span id="session-status" class="status-chip subtle">会话记忆：初始化中</span>
          <span id="runtime-status" class="status-chip subtle">运行状态：初始化中</span>
        </div>

        <div class="assistant-layout">
          <div class="chat-column">
            <div id="chat-log" class="chat-log">
              <div class="message assistant">
                <div class="message-body">你好，你可以直接问我的经历、项目和技术栈，也可以先上传 PDF 再继续提问。</div>
              </div>
            </div>
            <form id="chat-form" class="chat-form">
              <textarea id="chat-input" rows="4" placeholder="例如：你做过哪些 AI 项目？这个问答助手的链路怎么设计？"></textarea>
              <button id="send-button" type="submit">开始提问</button>
            </form>
          </div>
          <div class="assistant-note-grid">
            <div class="module-card">
              <span class="module-index">01</span>
              <strong>默认模式</strong>
              <p>未上传文档时，默认围绕我的资料与站点内容回答。</p>
            </div>
            <div class="module-card">
              <span class="module-index">02</span>
              <strong>上传切换</strong>
              <p>上传 PDF 后，问答会优先围绕当前文档检索并回答。</p>
            </div>
            <div class="module-card">
              <span class="module-index">03</span>
              <strong>引用展示</strong>
              <p>回答会尽量展示来源标签和引用片段，而不是只给结论。</p>
            </div>
          </div>
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
