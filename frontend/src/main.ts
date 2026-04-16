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
const sessionId = window.localStorage.getItem(storageKey) || crypto.randomUUID();
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
          <p class="eyebrow">Signal Console / Frontend v2</p>
          <h1>把个人网站升级成可运行的 AI 工作台</h1>
          <p class="subtitle">${escapeHtml(siteContent.profile.name)} · ${escapeHtml(siteContent.profile.title)}</p>
          <p class="copy">${escapeHtml(siteContent.profile.tagline)}。当前版本已经完成前后端分离第二阶段，独立前端工程通过 API 直接接入问答、上传、状态与会话能力。</p>
          <div class="hero-tags">
            <span class="hero-tag">前后端分离进行中</span>
            <span class="hero-tag">轻量部署优先</span>
            <span class="hero-tag">2 核 2G 友好</span>
          </div>
        </div>
        <div class="hero-signal">
          <div class="signal-card primary">
            <span class="signal-label">System Role</span>
            <strong>Personal AI Site</strong>
            <p>一个能回答简历、项目、上传文档并保留基础会话记忆的个人网站助手。</p>
          </div>
          <div class="signal-grid">
            <div class="signal-card">
              <span class="signal-label">Deploy</span>
              <strong>FastAPI Monolith</strong>
              <p>单体架构优先，压低服务器资源成本。</p>
            </div>
            <div class="signal-card">
              <span class="signal-label">Access</span>
              <strong>/frontend</strong>
              <p>新前端独立挂载，旧站点仍继续保留。</p>
            </div>
            <div class="signal-card">
              <span class="signal-label">Operator</span>
              <strong>${escapeHtml(siteContent.profile.location)}</strong>
              <p>${escapeHtml(siteContent.profile.email)}</p>
            </div>
            <div class="signal-card">
              <span class="signal-label">Model Slot</span>
              <strong>qvq-max-2025-03-25</strong>
              <p>按当前可用模型路线继续推进。</p>
            </div>
          </div>
        </div>
      </section>

      <section class="overview-grid">
        <article class="panel control-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">Architecture</p>
              <h2>当前系统模块</h2>
            </div>
            <span class="section-note">麻雀虽小，模块完整</span>
          </div>
          <div class="module-grid">
            <div class="module-card">
              <span class="module-index">01</span>
              <strong>Session Memory</strong>
              <p>基于浏览器 session_id 持续对话，支持单会话清空重置。</p>
            </div>
            <div class="module-card">
              <span class="module-index">02</span>
              <strong>RAG Retrieval</strong>
              <p>内置个人简历知识库，并支持上传 PDF 后切换临时知识库问答。</p>
            </div>
            <div class="module-card">
              <span class="module-index">03</span>
              <strong>Web Augmentation</strong>
              <p>本地资料不足时启用联网补充，回答中保留来源标识与引用片段。</p>
            </div>
            <div class="module-card">
              <span class="module-index">04</span>
              <strong>Runtime Guard</strong>
              <p>对聊天并发与上传任务做轻量限流，适配轻量服务器承载边界。</p>
            </div>
          </div>
        </article>

        <article class="panel control-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">Resume Knowledge</p>
              <h2>工程背景与项目信号</h2>
            </div>
            <span class="section-note">内容由 API 动态加载</span>
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
              <h2>问答控制台</h2>
              <p class="section-summary">这一块是实际产品工作区，支持流式输出、引用来源展示、上传知识库切换和会话清空。</p>
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
              <div class="message-body">控制台已联通后端。你现在可以直接提问，也可以先上传 PDF 切换到临时知识库模式。</div>
            </div>
          </div>
          <form id="chat-form" class="chat-form">
            <textarea id="chat-input" rows="4" placeholder="例如：请总结一下你的 AI 项目经验，并说明当前问答链路包含哪些模块"></textarea>
            <button id="send-button" type="submit">发送</button>
          </form>
        </article>

        <aside class="workspace-side">
          <section class="panel side-panel">
            <div class="panel-head">
              <div>
                <p class="panel-kicker">Capability Matrix</p>
                <h2>技能栈接口层</h2>
              </div>
            </div>
            <div class="chip-row">
              ${siteContent.skills.map((skill) => `<span class="chip">${escapeHtml(skill)}</span>`).join("")}
            </div>
          </section>

          <section class="panel side-panel">
            <div class="panel-head">
              <div>
                <p class="panel-kicker">Operation Notes</p>
                <h2>运行规则</h2>
              </div>
            </div>
            <div class="notes-list">
              <div class="note-card">
                <strong>默认知识源</strong>
                <p>未上传文档时，问答围绕个人简历与站点资料展开。</p>
              </div>
              <div class="note-card">
                <strong>上传切换</strong>
                <p>上传 PDF 后，系统优先按当前上传资料进行问答并返回引用片段。</p>
              </div>
              <div class="note-card">
                <strong>记忆边界</strong>
                <p>会话记忆限定在当前浏览器会话，符合个人网站场景与资源约束。</p>
              </div>
              <div class="note-card">
                <strong>架构策略</strong>
                <p>保留单体后端与轻量前端，先稳定交付，再逐步增强。</p>
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
