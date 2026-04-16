(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))o(a);new MutationObserver(a=>{for(const n of a)if(n.type==="childList")for(const l of n.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&o(l)}).observe(document,{childList:!0,subtree:!0});function t(a){const n={};return a.integrity&&(n.integrity=a.integrity),a.referrerPolicy&&(n.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?n.credentials="include":a.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function o(a){if(a.ep)return;a.ep=!0;const n=t(a);fetch(a.href,n)}})();function w(e,s,t){const o=e.error??{},a=o.code??"request_failed",n=e.detail??o.message??t;return a==="chat_capacity_full"||s===429?new Error("当前聊天请求较多，容量已满，请稍后重试。"):a==="upload_busy"||s===409?new Error("系统正在处理另一份上传文档，请稍后再试。"):a==="upload_too_large"||s===413?new Error("上传文件过大，已超过当前站点限制。"):a==="unsupported_file_type"?new Error("当前仅支持上传 PDF 文件。"):a==="empty_question"?new Error("请输入问题后再发送。"):a==="model_timeout"?new Error("模型响应超时，请稍后重试，或改成更短的问题。"):new Error(n)}async function g(e,s){const t=await fetch(e,s);if(!t.ok){const o=await t.json().catch(()=>({}));throw w(o,t.status,s?.fallbackMessage??"请求失败")}return t.json()}function E(){return g("/site_content",{fallbackMessage:"无法获取站点内容"})}function k(){return g("/upload_status",{fallbackMessage:"无法获取上传状态"})}function I(){return g("/runtime_status",{fallbackMessage:"无法获取运行时状态"})}function U(){return g("/upload_status",{method:"DELETE",fallbackMessage:"无法清空上传文档"})}function A(e){return g(`/session/${encodeURIComponent(e)}`,{method:"DELETE",fallbackMessage:"无法清空会话"})}function D(e,s,t){return g("/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:e,use_uploaded_docs:s,session_id:t}),fallbackMessage:"问答请求失败"})}async function M(e,s,t){const o=await fetch("/chat_stream",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:e,use_uploaded_docs:s,session_id:t})});if(!o.ok){const a=await o.json().catch(()=>({}));throw w(a,o.status,"问答请求失败")}return o}async function x(e){const s=new FormData;return s.append("file",e),g("/upload_resume",{method:"POST",body:s,fallbackMessage:"上传失败"})}const S="resume_assistant_frontend_session_id";function P(){const e=globalThis.crypto?.randomUUID?.();if(e)return e;const s=Date.now().toString(36),t=Math.random().toString(36).slice(2,10);return`session-${s}-${t}`}const y=window.localStorage.getItem(S)||P();window.localStorage.setItem(S,y);const i={hasUploadedDocs:!1,activeUploadFile:null,isSending:!1,isUploading:!1,lastSessionResetAt:!1};function T(e,s=180){const t=e.replace(/\s+/g," ").trim();return t.length<=s?t:`${t.slice(0,s)}...`}function r(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}function L(e){const s=document.getElementById("app");s&&(document.title=`${e.profile.name} | AI 控制台`,s.innerHTML=`
    <div class="shell dashboard-shell">
      <section class="hero hero-console">
        <div class="hero-copy">
          <p class="eyebrow">Signal Console / Frontend v2</p>
          <h1>把个人网站升级成可运行的 AI 工作台</h1>
          <p class="subtitle">${r(e.profile.name)} · ${r(e.profile.title)}</p>
          <p class="copy">${r(e.profile.tagline)}。当前版本已经完成前后端分离第二阶段，独立前端工程通过 API 直接接入问答、上传、状态与会话能力。</p>
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
              <strong>${r(e.profile.location)}</strong>
              <p>${r(e.profile.email)}</p>
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
            ${e.experience.map(t=>`
                  <div class="timeline-item">
                    <span class="timeline-period">${r(t.period)}</span>
                    <div class="timeline-content">
                      <strong>${r(t.role)}</strong>
                      <p>${r(t.company)}</p>
                      <small>${r(t.summary)}</small>
                    </div>
                  </div>
                `).join("")}
          </div>
          <div class="project-grid">
            ${e.projects.map(t=>`
                  <div class="project-card">
                    <strong>${r(t.name)}</strong>
                    <span>${r(t.stack)}</span>
                    <p>${r(t.description)}</p>
                  </div>
                `).join("")}
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
              ${e.skills.map(t=>`<span class="chip">${r(t)}</span>`).join("")}
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
  `,j())}function d(e,s,t="default"){const o=document.getElementById(e);o&&(o.textContent=s,o.className=`status-chip${t==="default"?"":` ${t}`}`)}function u(e,s){const t=document.getElementById("chat-log");if(!t)return null;const o=document.createElement("div");return o.className=`message ${e}`,o.innerHTML=`<div class="message-body">${r(s)}</div>`,t.appendChild(o),t.scrollTop=t.scrollHeight,o}function $(e,s){if(!e)return;e.querySelector(".message-meta")?.remove();const t=[s.source_badge,s.used_local_context?"本地资料":"",s.used_web_search?"联网补充":"",s.retried?"已重试":""].filter(Boolean),o=s.references.slice(0,3).map(F).join(""),a=document.createElement("div");a.className="message-meta",a.innerHTML=`
    <div class="meta-badges">
      ${t.map(n=>`<span>${r(n)}</span>`).join("")}
    </div>
    ${o?`<div class="reference-list">${o}</div>`:""}
  `,e.appendChild(a)}function F(e){const s=[e.source_file||"未知来源",e.page?`P${e.page}`:"",e.retrieval_method||""].filter(Boolean);return`
    <div class="reference-card">
      <strong>${r(s.join(" · "))}</strong>
      <p>${r(T(e.content))}</p>
    </div>
  `}async function m(){const[e,s]=await Promise.all([k(),I()]);if(i.hasUploadedDocs=e.has_uploaded_docs,i.activeUploadFile=e.active_file,i.isUploading?d("knowledge-status","当前模式：正在处理上传文档","busy"):i.hasUploadedDocs&&i.activeUploadFile?d("knowledge-status",`当前模式：上传文档问答（${i.activeUploadFile}）`):d("knowledge-status","当前模式：个人简历问答"),i.lastSessionResetAt?d("session-status","会话记忆：已清空，后续对话将重新积累","subtle"):d("session-status","会话记忆：当前浏览器会话已启用","subtle"),i.isSending){d("runtime-status","运行状态：正在生成回答","busy");return}if(s.upload.busy){d("runtime-status","运行状态：上传灌库处理中","busy");return}if(s.chat.busy){d("runtime-status",`运行状态：聊天容量已满（${s.chat.active}/${s.chat.max_concurrent}）`,"busy");return}d("runtime-status","运行状态：空闲","subtle")}async function R(e,s){const o=(await M(e,i.hasUploadedDocs,y)).body?.getReader();if(!o)throw new Error("流式响应不可用");const a=new TextDecoder("utf-8");let n="",l=null;const c=s.querySelector(".message-body");for(;;){const{value:f,done:v}=await o.read();if(v)break;n+=a.decode(f,{stream:!0});const p=n.split(`

`);n=p.pop()||"";for(const _ of p){const b=_.trim();if(!b.startsWith("data:"))continue;const h=JSON.parse(b.slice(5).trim());h.type==="token"?c.textContent+=h.content||"":h.type==="replace"?c.textContent=h.content||"":h.type==="meta"&&(l=h)}}l&&$(s,l)}function j(){const e=document.getElementById("chat-form"),s=document.getElementById("chat-input"),t=document.getElementById("resume-upload"),o=document.getElementById("clear-upload"),a=document.getElementById("clear-session");e?.addEventListener("submit",async n=>{n.preventDefault();const l=s?.value.trim()??"";if(!l||i.isSending||i.isUploading)return;i.isSending=!0,i.lastSessionResetAt=!1,await m().catch(()=>{});const c=u("user",l);s&&(s.value="");const f=u("assistant","");try{c&&c.scrollIntoView({block:"end"}),f&&await R(l,f)}catch{try{const v=await D(l,i.hasUploadedDocs,y),p=f?.querySelector(".message-body");p&&(p.textContent=v.answer),$(f,v)}catch(v){const p=f?.querySelector(".message-body");p&&(p.textContent=`请求失败：${v.message}`)}}finally{i.isSending=!1,m().catch(()=>{})}}),t?.addEventListener("change",async n=>{const l=n.target.files?.[0];if(!(!l||i.isSending||i.isUploading)){i.isUploading=!0,await m().catch(()=>{});try{const c=await x(l);i.hasUploadedDocs=!0,i.activeUploadFile=c.file_name,u("assistant",`已完成上传并自动灌库：${c.file_name}`)}catch(c){u("assistant",`上传失败：${c.message}`)}finally{i.isUploading=!1,t&&(t.value=""),m().catch(()=>{})}}}),o?.addEventListener("click",async()=>{try{await U(),i.hasUploadedDocs=!1,i.activeUploadFile=null,u("assistant","已清空上传知识库，当前恢复为个人简历问答模式。"),m().catch(()=>{})}catch(n){u("assistant",`清空失败：${n.message}`)}}),a?.addEventListener("click",async()=>{try{await A(y),i.lastSessionResetAt=!0;const n=document.getElementById("chat-log");n&&(n.innerHTML=""),u("assistant","会话已清空，可以重新开始提问。"),m().catch(()=>{})}catch(n){u("assistant",`清空会话失败：${n.message}`)}}),m().catch(()=>{}),window.setInterval(()=>{m().catch(()=>{})},1e4)}E().then(L).catch(e=>{const s=document.getElementById("app");s&&(s.innerHTML=`<div class="shell"><section class="panel"><h1>前端骨架初始化失败</h1><p>${r(e.message)}</p></section></div>`)});
