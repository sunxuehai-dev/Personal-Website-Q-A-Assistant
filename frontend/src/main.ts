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

  const featuredProject = siteContent.projects[0];
  const supportingProjects = siteContent.projects.slice(1);

  document.title = `${siteContent.profile.name} | AI 控制台`;

  app.innerHTML = `
    <div class="shell brand-shell">
      <section class="hero brand-hero">
        <div class="hero-copy">
          <p class="eyebrow">Sun Xuehai / AI Application Engineer</p>
          <h1>把 AI 能力做成真正能上线、能使用、能维护的产品。</h1>
          <p class="subtitle">${escapeHtml(siteContent.profile.name)} · ${escapeHtml(siteContent.profile.title)} · ${escapeHtml(siteContent.profile.location)}</p>
          <p class="copy">${escapeHtml(siteContent.profile.tagline)}。我更关注把检索、模型、接口、前端和部署组织成完整产品，而不只是做一个只能演示的模型能力页面。</p>
          <div class="hero-actions">
            <a class="hero-link primary" href="#assistant">直接和我对话</a>
            <a class="hero-link secondary" href="#projects">看项目作品</a>
          </div>
        </div>
        <div class="hero-aside">
          <div class="intro-card lead">
            <span class="intro-label">Currently Building</span>
            <strong>Resume Assistant</strong>
            <p>一个嵌入个人网站的问答助手。它既是作品，也是我对轻量 AI 产品工程化的实际回答。</p>
          </div>
          <div class="intro-grid">
            <div class="intro-card">
              <span class="intro-label">Focus</span>
              <strong>RAG / Agent / API</strong>
              <p>围绕真实业务链路组织模型能力，而不是把模型孤立出来。</p>
            </div>
            <div class="intro-card">
              <span class="intro-label">Deploy</span>
              <strong>2 核 2G 优先</strong>
              <p>先把东西做轻、做稳，再谈复杂扩展。</p>
            </div>
          </div>
        </div>
      </section>

      <section class="story-grid">
        <article class="panel story-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">About</p>
              <h2>我在做什么</h2>
            </div>
          </div>
          <div class="manifesto">
            <p>我做的不是“模型演示页”，而是<strong>可以被真正使用的 AI 应用</strong>。这意味着：前后端边界要清楚，接口要稳定，知识库要可维护，线上资源约束要被认真对待。</p>
            <p>这个网站本身就是作品的一部分。它把个人经历、项目案例和问答助手合在一起，让访问者可以直接和内容交互，而不是只看一页静态介绍。</p>
          </div>
          <div class="chip-row">
            <span class="chip">产品化思维</span>
            <span class="chip">后端服务化</span>
            <span class="chip">RAG 落地</span>
            <span class="chip">轻量部署</span>
          </div>
        </article>

        <article class="panel featured-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">Featured Work</p>
              <h2>${escapeHtml(featuredProject?.name || "代表项目")}</h2>
            </div>
            <span class="section-note">${escapeHtml(featuredProject?.stack || "")}</span>
          </div>
          <p class="featured-copy">${escapeHtml(featuredProject?.description || "")}</p>
          <div class="metric-grid">
            <div class="metric-card">
              <span>对话体验</span>
              <strong>Memory + RAG</strong>
            </div>
            <div class="metric-card">
              <span>交付方式</span>
              <strong>Single Service</strong>
            </div>
            <div class="metric-card">
              <span>使用方式</span>
              <strong>Ask + Upload</strong>
            </div>
          </div>
        </article>
      </section>

      <section class="experience-layout">
        <article class="panel experience-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">Experience</p>
              <h2>经历</h2>
            </div>
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
        </article>

        <aside class="panel principle-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">Approach</p>
              <h2>做事方式</h2>
            </div>
          </div>
          <div class="notes-list">
            <div class="note-card">
              <strong>先把东西做通</strong>
              <p>我更重视真实链路跑通，再在这个基础上打磨交互、结构和边界。</p>
            </div>
            <div class="note-card">
              <strong>优先轻量可维护</strong>
              <p>在小规格服务器上做产品，意味着每个模块都要有边界意识。</p>
            </div>
            <div class="note-card">
              <strong>避免空转式复杂度</strong>
              <p>不是所有系统都需要大而重的架构，合适比前沿名词更重要。</p>
            </div>
          </div>
        </aside>
      </section>

      <section id="projects" class="panel projects-panel">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">Projects</p>
            <h2>项目作品</h2>
          </div>
          <span class="section-note">从视觉、算法到大模型应用</span>
        </div>
        <div class="project-grid wide">
          ${supportingProjects
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
      </section>

      <section class="capability-layout">
        <article class="panel capability-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">Capabilities</p>
              <h2>这个网站内置了什么能力</h2>
            </div>
            <span class="section-note">问答助手不是摆设，而是可用功能</span>
          </div>
          <div class="module-grid brand">
            <div class="module-card">
              <span class="module-index">01</span>
              <strong>短期记忆</strong>
              <p>浏览器会话级记忆，让追问保持连贯。</p>
            </div>
            <div class="module-card">
              <span class="module-index">02</span>
              <strong>双知识源 RAG</strong>
              <p>既能问我本人，也能问你上传的文档。</p>
            </div>
            <div class="module-card">
              <span class="module-index">03</span>
              <strong>引用与来源</strong>
              <p>回答不是黑盒文本，会明确展示引用片段和来源标识。</p>
            </div>
            <div class="module-card">
              <span class="module-index">04</span>
              <strong>轻量运行保护</strong>
              <p>围绕真实服务器资源边界做了并发与上传约束。</p>
            </div>
          </div>
        </article>

        <aside class="panel stack-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">Stack</p>
              <h2>技术栈</h2>
            </div>
          </div>
          <div class="chip-row">
            ${siteContent.skills.map((skill) => `<span class="chip">${escapeHtml(skill)}</span>`).join("")}
          </div>
        </aside>
      </section>

      <section id="assistant" class="panel assistant assistant-panel">
          <div class="assistant-head">
            <div>
              <p class="panel-kicker">Ask Me</p>
              <h2>和这个网站直接对话</h2>
              <p class="section-summary">如果你不想自己读完整页内容，可以直接提问。它会基于我的资料、项目和你上传的文档来回答。</p>
              <div class="status-group">
                <span id="knowledge-status" class="status-chip">当前模式：初始化中</span>
                <span id="session-status" class="status-chip subtle">会话记忆：初始化中</span>
                <span id="runtime-status" class="status-chip subtle">运行状态：初始化中</span>
              </div>
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
          <div id="chat-log" class="chat-log">
            <div class="message assistant">
              <div class="message-body">你好，我已经联通后端问答链路。你可以问我的项目、经历、技术栈，也可以先上传 PDF 再围绕文档继续追问。</div>
            </div>
          </div>
          <form id="chat-form" class="chat-form">
            <textarea id="chat-input" rows="4" placeholder="例如：你做过哪些 AI 项目？这个问答助手的链路是怎么设计的？"></textarea>
            <button id="send-button" type="submit">开始提问</button>
          </form>
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
