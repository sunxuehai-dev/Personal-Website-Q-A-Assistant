(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const n of a)if(n.type==="childList")for(const c of n.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&i(c)}).observe(document,{childList:!0,subtree:!0});function t(a){const n={};return a.integrity&&(n.integrity=a.integrity),a.referrerPolicy&&(n.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?n.credentials="include":a.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function i(a){if(a.ep)return;a.ep=!0;const n=t(a);fetch(a.href,n)}})();function w(e,s,t){const i=e.error??{},a=i.code??"request_failed",n=e.detail??i.message??t;return a==="chat_capacity_full"||s===429?new Error("当前聊天请求较多，容量已满，请稍后重试。"):a==="upload_busy"||s===409?new Error("系统正在处理另一份上传文档，请稍后再试。"):a==="upload_too_large"||s===413?new Error("上传文件过大，已超过当前站点限制。"):a==="unsupported_file_type"?new Error("当前仅支持上传 PDF 文件。"):a==="empty_question"?new Error("请输入问题后再发送。"):a==="model_timeout"?new Error("模型响应超时，请稍后重试，或改成更短的问题。"):new Error(n)}async function h(e,s){const t=await fetch(e,s);if(!t.ok){const i=await t.json().catch(()=>({}));throw w(i,t.status,s?.fallbackMessage??"请求失败")}return t.json()}function E(){return h("/site_content",{fallbackMessage:"无法获取站点内容"})}function k(){return h("/upload_status",{fallbackMessage:"无法获取上传状态"})}function I(){return h("/runtime_status",{fallbackMessage:"无法获取运行时状态"})}function U(){return h("/upload_status",{method:"DELETE",fallbackMessage:"无法清空上传文档"})}function A(e){return h(`/session/${encodeURIComponent(e)}`,{method:"DELETE",fallbackMessage:"无法清空会话"})}function D(e,s,t){return h("/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:e,use_uploaded_docs:s,session_id:t}),fallbackMessage:"问答请求失败"})}async function T(e,s,t){const i=await fetch("/chat_stream",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:e,use_uploaded_docs:s,session_id:t})});if(!i.ok){const a=await i.json().catch(()=>({}));throw w(a,i.status,"问答请求失败")}return i}async function M(e){const s=new FormData;return s.append("file",e),h("/upload_resume",{method:"POST",body:s,fallbackMessage:"上传失败"})}const $="resume_assistant_frontend_session_id";function P(){const e=globalThis.crypto?.randomUUID?.();if(e)return e;const s=Date.now().toString(36),t=Math.random().toString(36).slice(2,10);return`session-${s}-${t}`}const y=window.localStorage.getItem($)||P();window.localStorage.setItem($,y);const o={hasUploadedDocs:!1,activeUploadFile:null,isSending:!1,isUploading:!1,lastSessionResetAt:!1};function j(e,s=180){const t=e.replace(/\s+/g," ").trim();return t.length<=s?t:`${t.slice(0,s)}...`}function r(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}function L(e){const s=document.getElementById("app");s&&(document.title=`${e.profile.name} | ${e.profile.title}`,s.innerHTML=`
    <div class="shell site-shell">
      <section id="assistant" class="assistant-stage">
        <div class="assistant-stage-copy">
          <p class="panel-kicker">AI Assistant</p>
          <h1>先问我，再认识我。</h1>
          <p class="assistant-lead">这是一个嵌在个人网站里的轻量问答助手。你可以直接提问经历、项目、技术栈，也可以上传 PDF，让回答临时围绕文档展开。</p>
          <div class="assistant-summary">
            <span>${r(e.profile.name)}</span>
            <span>${r(e.profile.title)}</span>
            <span>${r(e.profile.location)}</span>
          </div>
        </div>

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
            <div class="message assistant">
              <div class="message-body">你好，你可以直接问我的项目经验、技术方案、职业经历，也可以上传一份 PDF 继续追问。</div>
            </div>
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
          <h2>${r(e.profile.name)}</h2>
          <p class="hero-title">${r(e.profile.title)}</p>
          <p class="hero-copy-text">${r(e.profile.tagline)}。我更关注完整产品链路，而不是孤立的模型能力，偏好把检索、接口、前端体验与真实部署约束组织成稳定可用的系统。</p>
          <div class="hero-meta">
            <span>${r(e.profile.location)}</span>
            <span>${r(e.profile.email)}</span>
            <span>${r(e.profile.phone)}</span>
          </div>
        </div>

        <div class="hero-portrait">
          <div class="portrait-frame">
            <img class="portrait-image" src="/static/images/profile.jpg" alt="${r(e.profile.name)} portrait" />
          </div>
          <div class="portrait-note">
            <span class="summary-label">Current Focus</span>
            <strong>RAG / Agent / FastAPI / Shipping</strong>
            <p>偏好轻量架构、真实部署、清晰边界和可维护的用户体验。</p>
          </div>
        </div>
      </section>

      <section class="overview-row">
        <article class="panel overview-panel">
          <p class="panel-kicker">Profile</p>
          <h2>我在做什么</h2>
          <div class="paragraphs">
            <p>我在做的是资源克制但功能完整的 AI 应用。它们不需要无限堆叠能力，而要能上线、能维护、能被真实用户持续使用。</p>
            <p>这个网站本身就是一个产品样本：既是个人主页，也是一个可直接交互的问答界面，让内容以对话方式被访问。</p>
          </div>
        </article>

        <article class="panel overview-panel">
          <p class="panel-kicker">Approach</p>
          <h2>我偏好的产品方法</h2>
          <div class="feature-list">
            <div class="feature-item">
              <strong>结构清晰的问答链路</strong>
              <p>记忆、RAG、引用展示、按需联网，各模块边界清楚，能力不过度堆叠。</p>
            </div>
            <div class="feature-item">
              <strong>小机器也能稳定运行</strong>
              <p>优先控制复杂度和资源占用，让 2 核 2G 的实际部署环境也能长期承载。</p>
            </div>
          </div>
        </article>
      </section>

      <section class="content-grid">
        <article id="projects" class="panel">
          <p class="panel-kicker">Selected Projects</p>
          <h2>代表项目</h2>
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

        <article class="panel">
          <p class="panel-kicker">Experience</p>
          <h2>经历</h2>
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
        </article>
      </section>

      <section class="skills-section panel">
        <p class="panel-kicker">Technology</p>
        <h2>技术栈</h2>
        <div class="chip-row">
          ${e.skills.map(t=>`<span class="chip">${r(t)}</span>`).join("")}
        </div>
      </section>
    </div>
  `,F())}function d(e,s,t="default"){const i=document.getElementById(e);i&&(i.textContent=s,i.className=`status-chip${t==="default"?"":` ${t}`}`)}function u(e,s){const t=document.getElementById("chat-log");if(!t)return null;const i=document.createElement("div");return i.className=`message ${e}`,i.innerHTML=`<div class="message-body">${r(s)}</div>`,t.appendChild(i),t.scrollTop=t.scrollHeight,i}function _(e,s){if(!e)return;e.querySelector(".message-meta")?.remove();const t=[s.source_badge,s.used_local_context?"本地资料":"",s.used_web_search?"联网补充":"",s.retried?"已重试":""].filter(Boolean),i=s.references.slice(0,3).map(x).join(""),a=document.createElement("div");a.className="message-meta",a.innerHTML=`
    <div class="meta-badges">
      ${t.map(n=>`<span>${r(n)}</span>`).join("")}
    </div>
    ${i?`<div class="reference-list">${i}</div>`:""}
  `,e.appendChild(a)}function x(e){const s=[e.source_file||"未知来源",e.page?`P${e.page}`:"",e.retrieval_method||""].filter(Boolean);return`
    <div class="reference-card">
      <strong>${r(s.join(" · "))}</strong>
      <p>${r(j(e.content))}</p>
    </div>
  `}async function f(){const[e,s]=await Promise.all([k(),I()]);if(o.hasUploadedDocs=e.has_uploaded_docs,o.activeUploadFile=e.active_file,o.isUploading?d("knowledge-status","当前模式：正在处理上传文档","busy"):o.hasUploadedDocs&&o.activeUploadFile?d("knowledge-status",`当前模式：文档问答 · ${o.activeUploadFile}`):d("knowledge-status","当前模式：站内问答"),o.lastSessionResetAt?d("session-status","会话记忆：已清空","subtle"):d("session-status","会话记忆：当前浏览器会话","subtle"),o.isSending){d("runtime-status","运行状态：正在生成回答","busy");return}if(s.upload.busy){d("runtime-status","运行状态：文档处理中","busy");return}if(s.chat.busy){d("runtime-status",`运行状态：并发已满（${s.chat.active}/${s.chat.max_concurrent}）`,"busy");return}d("runtime-status","运行状态：空闲","subtle")}async function B(e,s){const i=(await T(e,o.hasUploadedDocs,y)).body?.getReader();if(!i)throw new Error("流式响应不可用");const a=new TextDecoder("utf-8");let n="",c=null;const l=s.querySelector(".message-body");for(;;){const{value:m,done:g}=await i.read();if(g)break;n+=a.decode(m,{stream:!0});const p=n.split(`

`);n=p.pop()||"";for(const S of p){const b=S.trim();if(!b.startsWith("data:"))continue;const v=JSON.parse(b.slice(5).trim());v.type==="token"?l.textContent+=v.content||"":v.type==="replace"?l.textContent=v.content||"":v.type==="meta"&&(c=v)}}c&&_(s,c)}function F(){const e=document.getElementById("chat-form"),s=document.getElementById("chat-input"),t=document.getElementById("resume-upload"),i=document.getElementById("clear-upload"),a=document.getElementById("clear-session");e?.addEventListener("submit",async n=>{n.preventDefault();const c=s?.value.trim()??"";if(!c||o.isSending||o.isUploading)return;o.isSending=!0,o.lastSessionResetAt=!1,await f().catch(()=>{});const l=u("user",c);s&&(s.value="");const m=u("assistant","");try{l&&l.scrollIntoView({block:"end"}),m&&await B(c,m)}catch{try{const g=await D(c,o.hasUploadedDocs,y),p=m?.querySelector(".message-body");p&&(p.textContent=g.answer),_(m,g)}catch(g){const p=m?.querySelector(".message-body");p&&(p.textContent=`请求失败：${g.message}`)}}finally{o.isSending=!1,f().catch(()=>{})}}),t?.addEventListener("change",async n=>{const c=n.target.files?.[0];if(!(!c||o.isSending||o.isUploading)){o.isUploading=!0,await f().catch(()=>{});try{const l=await M(c);o.hasUploadedDocs=!0,o.activeUploadFile=l.file_name,u("assistant",`文档已上传并完成入库：${l.file_name}`)}catch(l){u("assistant",`上传失败：${l.message}`)}finally{o.isUploading=!1,t&&(t.value=""),f().catch(()=>{})}}}),i?.addEventListener("click",async()=>{try{await U(),o.hasUploadedDocs=!1,o.activeUploadFile=null,u("assistant","已清空上传文档，当前恢复为站内资料问答模式。"),f().catch(()=>{})}catch(n){u("assistant",`清空失败：${n.message}`)}}),a?.addEventListener("click",async()=>{try{await A(y),o.lastSessionResetAt=!0;const n=document.getElementById("chat-log");n&&(n.innerHTML=""),u("assistant","会话已清空，可以重新开始提问。"),f().catch(()=>{})}catch(n){u("assistant",`清空会话失败：${n.message}`)}}),f().catch(()=>{}),window.setInterval(()=>{f().catch(()=>{})},1e4)}E().then(L).catch(e=>{const s=document.getElementById("app");s&&(s.innerHTML=`<div class="shell"><section class="panel"><h1>前端初始化失败</h1><p>${r(e.message)}</p></section></div>`)});
