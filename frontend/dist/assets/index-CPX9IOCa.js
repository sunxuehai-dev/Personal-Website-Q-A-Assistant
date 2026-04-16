(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const n of a)if(n.type==="childList")for(const c of n.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&i(c)}).observe(document,{childList:!0,subtree:!0});function t(a){const n={};return a.integrity&&(n.integrity=a.integrity),a.referrerPolicy&&(n.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?n.credentials="include":a.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function i(a){if(a.ep)return;a.ep=!0;const n=t(a);fetch(a.href,n)}})();function w(e,s,t){const i=e.error??{},a=i.code??"request_failed",n=e.detail??i.message??t;return a==="chat_capacity_full"||s===429?new Error("当前聊天请求较多，容量已满，请稍后重试。"):a==="upload_busy"||s===409?new Error("系统正在处理另一份上传文档，请稍后再试。"):a==="upload_too_large"||s===413?new Error("上传文件过大，已超过当前站点限制。"):a==="unsupported_file_type"?new Error("当前仅支持上传 PDF 文件。"):a==="empty_question"?new Error("请输入问题后再发送。"):a==="model_timeout"?new Error("模型响应超时，请稍后重试，或改成更短的问题。"):new Error(n)}async function g(e,s){const t=await fetch(e,s);if(!t.ok){const i=await t.json().catch(()=>({}));throw w(i,t.status,s?.fallbackMessage??"请求失败")}return t.json()}function E(){return g("/site_content",{fallbackMessage:"无法获取站点内容"})}function k(){return g("/upload_status",{fallbackMessage:"无法获取上传状态"})}function I(){return g("/runtime_status",{fallbackMessage:"无法获取运行时状态"})}function U(){return g("/upload_status",{method:"DELETE",fallbackMessage:"无法清空上传文档"})}function A(e){return g(`/session/${encodeURIComponent(e)}`,{method:"DELETE",fallbackMessage:"无法清空会话"})}function D(e,s,t){return g("/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:e,use_uploaded_docs:s,session_id:t}),fallbackMessage:"问答请求失败"})}async function P(e,s,t){const i=await fetch("/chat_stream",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:e,use_uploaded_docs:s,session_id:t})});if(!i.ok){const a=await i.json().catch(()=>({}));throw w(a,i.status,"问答请求失败")}return i}async function M(e){const s=new FormData;return s.append("file",e),g("/upload_resume",{method:"POST",body:s,fallbackMessage:"上传失败"})}const S="resume_assistant_frontend_session_id";function x(){const e=globalThis.crypto?.randomUUID?.();if(e)return e;const s=Date.now().toString(36),t=Math.random().toString(36).slice(2,10);return`session-${s}-${t}`}const y=window.localStorage.getItem(S)||x();window.localStorage.setItem(S,y);const o={hasUploadedDocs:!1,activeUploadFile:null,isSending:!1,isUploading:!1,lastSessionResetAt:!1};function L(e,s=180){const t=e.replace(/\s+/g," ").trim();return t.length<=s?t:`${t.slice(0,s)}...`}function r(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}function T(e){const s=document.getElementById("app");s&&(document.title=`${e.profile.name} | AI 控制台`,s.innerHTML=`
    <div class="shell dashboard-shell">
      <section class="hero hero-console">
        <div class="hero-copy">
          <p class="eyebrow">Personal AI Product / Live Site</p>
          <h1>把个人经历、项目和知识库做成一个能直接对话的网站</h1>
          <p class="subtitle">${r(e.profile.name)} · ${r(e.profile.title)}</p>
          <p class="copy">${r(e.profile.tagline)}。这不是一张静态简历，而是一套真正上线运行的轻量 AI 产品：前端独立构建、后端 API 化，支持记忆、RAG、上传文档问答和按需联网补充。</p>
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
              <strong>${r(e.profile.location)}</strong>
              <p>${r(e.profile.email)}</p>
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
              ${e.skills.map(t=>`<span class="chip">${r(t)}</span>`).join("")}
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
  `,B())}function d(e,s,t="default"){const i=document.getElementById(e);i&&(i.textContent=s,i.className=`status-chip${t==="default"?"":` ${t}`}`)}function u(e,s){const t=document.getElementById("chat-log");if(!t)return null;const i=document.createElement("div");return i.className=`message ${e}`,i.innerHTML=`<div class="message-body">${r(s)}</div>`,t.appendChild(i),t.scrollTop=t.scrollHeight,i}function $(e,s){if(!e)return;e.querySelector(".message-meta")?.remove();const t=[s.source_badge,s.used_local_context?"本地资料":"",s.used_web_search?"联网补充":"",s.retried?"已重试":""].filter(Boolean),i=s.references.slice(0,3).map(F).join(""),a=document.createElement("div");a.className="message-meta",a.innerHTML=`
    <div class="meta-badges">
      ${t.map(n=>`<span>${r(n)}</span>`).join("")}
    </div>
    ${i?`<div class="reference-list">${i}</div>`:""}
  `,e.appendChild(a)}function F(e){const s=[e.source_file||"未知来源",e.page?`P${e.page}`:"",e.retrieval_method||""].filter(Boolean);return`
    <div class="reference-card">
      <strong>${r(s.join(" · "))}</strong>
      <p>${r(L(e.content))}</p>
    </div>
  `}async function m(){const[e,s]=await Promise.all([k(),I()]);if(o.hasUploadedDocs=e.has_uploaded_docs,o.activeUploadFile=e.active_file,o.isUploading?d("knowledge-status","当前模式：正在处理上传文档","busy"):o.hasUploadedDocs&&o.activeUploadFile?d("knowledge-status",`当前模式：上传文档问答（${o.activeUploadFile}）`):d("knowledge-status","当前模式：个人简历问答"),o.lastSessionResetAt?d("session-status","会话记忆：已清空，后续对话将重新积累","subtle"):d("session-status","会话记忆：当前浏览器会话已启用","subtle"),o.isSending){d("runtime-status","运行状态：正在生成回答","busy");return}if(s.upload.busy){d("runtime-status","运行状态：上传灌库处理中","busy");return}if(s.chat.busy){d("runtime-status",`运行状态：聊天容量已满（${s.chat.active}/${s.chat.max_concurrent}）`,"busy");return}d("runtime-status","运行状态：空闲","subtle")}async function j(e,s){const i=(await P(e,o.hasUploadedDocs,y)).body?.getReader();if(!i)throw new Error("流式响应不可用");const a=new TextDecoder("utf-8");let n="",c=null;const l=s.querySelector(".message-body");for(;;){const{value:f,done:v}=await i.read();if(v)break;n+=a.decode(f,{stream:!0});const p=n.split(`

`);n=p.pop()||"";for(const _ of p){const b=_.trim();if(!b.startsWith("data:"))continue;const h=JSON.parse(b.slice(5).trim());h.type==="token"?l.textContent+=h.content||"":h.type==="replace"?l.textContent=h.content||"":h.type==="meta"&&(c=h)}}c&&$(s,c)}function B(){const e=document.getElementById("chat-form"),s=document.getElementById("chat-input"),t=document.getElementById("resume-upload"),i=document.getElementById("clear-upload"),a=document.getElementById("clear-session");e?.addEventListener("submit",async n=>{n.preventDefault();const c=s?.value.trim()??"";if(!c||o.isSending||o.isUploading)return;o.isSending=!0,o.lastSessionResetAt=!1,await m().catch(()=>{});const l=u("user",c);s&&(s.value="");const f=u("assistant","");try{l&&l.scrollIntoView({block:"end"}),f&&await j(c,f)}catch{try{const v=await D(c,o.hasUploadedDocs,y),p=f?.querySelector(".message-body");p&&(p.textContent=v.answer),$(f,v)}catch(v){const p=f?.querySelector(".message-body");p&&(p.textContent=`请求失败：${v.message}`)}}finally{o.isSending=!1,m().catch(()=>{})}}),t?.addEventListener("change",async n=>{const c=n.target.files?.[0];if(!(!c||o.isSending||o.isUploading)){o.isUploading=!0,await m().catch(()=>{});try{const l=await M(c);o.hasUploadedDocs=!0,o.activeUploadFile=l.file_name,u("assistant",`已完成上传并自动灌库：${l.file_name}`)}catch(l){u("assistant",`上传失败：${l.message}`)}finally{o.isUploading=!1,t&&(t.value=""),m().catch(()=>{})}}}),i?.addEventListener("click",async()=>{try{await U(),o.hasUploadedDocs=!1,o.activeUploadFile=null,u("assistant","已清空上传知识库，当前恢复为个人简历问答模式。"),m().catch(()=>{})}catch(n){u("assistant",`清空失败：${n.message}`)}}),a?.addEventListener("click",async()=>{try{await A(y),o.lastSessionResetAt=!0;const n=document.getElementById("chat-log");n&&(n.innerHTML=""),u("assistant","会话已清空，可以重新开始提问。"),m().catch(()=>{})}catch(n){u("assistant",`清空会话失败：${n.message}`)}}),m().catch(()=>{}),window.setInterval(()=>{m().catch(()=>{})},1e4)}E().then(T).catch(e=>{const s=document.getElementById("app");s&&(s.innerHTML=`<div class="shell"><section class="panel"><h1>前端骨架初始化失败</h1><p>${r(e.message)}</p></section></div>`)});
