(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))o(a);new MutationObserver(a=>{for(const n of a)if(n.type==="childList")for(const c of n.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&o(c)}).observe(document,{childList:!0,subtree:!0});function s(a){const n={};return a.integrity&&(n.integrity=a.integrity),a.referrerPolicy&&(n.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?n.credentials="include":a.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function o(a){if(a.ep)return;a.ep=!0;const n=s(a);fetch(a.href,n)}})();function w(e,t,s){const o=e.error??{},a=o.code??"request_failed",n=e.detail??o.message??s;return a==="chat_capacity_full"||t===429?new Error("当前聊天请求较多，容量已满，请稍后重试。"):a==="upload_busy"||t===409?new Error("系统正在处理另一份上传文档，请稍后再试。"):a==="upload_too_large"||t===413?new Error("上传文件过大，已超过当前站点限制。"):a==="unsupported_file_type"?new Error("当前仅支持上传 PDF 文件。"):a==="empty_question"?new Error("请输入问题后再发送。"):a==="model_timeout"?new Error("模型响应超时，请稍后重试，或改成更短的问题。"):new Error(n)}async function h(e,t){const s=await fetch(e,t);if(!s.ok){const o=await s.json().catch(()=>({}));throw w(o,s.status,t?.fallbackMessage??"请求失败")}return s.json()}function U(){return h("/site_content",{fallbackMessage:"无法获取站点内容"})}function I(){return h("/upload_status",{fallbackMessage:"无法获取上传状态"})}function D(){return h("/runtime_status",{fallbackMessage:"无法获取运行时状态"})}function A(){return h("/upload_status",{method:"DELETE",fallbackMessage:"无法清空上传文档"})}function M(e){return h(`/session/${encodeURIComponent(e)}`,{method:"DELETE",fallbackMessage:"无法清空会话"})}function T(e,t,s){return h("/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:e,use_uploaded_docs:t,session_id:s}),fallbackMessage:"问答请求失败"})}async function j(e,t,s){const o=await fetch("/chat_stream",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:e,use_uploaded_docs:t,session_id:s})});if(!o.ok){const a=await o.json().catch(()=>({}));throw w(a,o.status,"问答请求失败")}return o}async function x(e){const t=new FormData;return t.append("file",e),h("/upload_resume",{method:"POST",body:t,fallbackMessage:"上传失败"})}const S="resume_assistant_frontend_session_id",$="https://blog.csdn.net/sunxuehai1?spm=1000.2115.3001.5343";function L(){const e=globalThis.crypto?.randomUUID?.();if(e)return e;const t=Date.now().toString(36),s=Math.random().toString(36).slice(2,10);return`session-${t}-${s}`}const v=window.localStorage.getItem(S)||L();window.localStorage.setItem(S,v);const i={hasUploadedDocs:!1,activeUploadFile:null,isSending:!1,isUploading:!1,lastSessionResetAt:!1};function P(e,t=180){const s=e.replace(/\s+/g," ").trim();return s.length<=t?s:`${s.slice(0,t)}...`}function r(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}function _(){return`
    <div class="chat-empty-state">
      <p>你好，你可以直接问我的项目经验、技术方案、职业经历，也可以上传一份 PDF 继续追问。</p>
    </div>
  `}function B(e){const t=document.getElementById("app");t&&(document.title=`${e.profile.name} | ${e.profile.title}`,t.innerHTML=`
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
            ${_()}
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

          <div class="hero-notes">
            <a class="note-card note-card-link" href="${$}" target="_blank" rel="noreferrer">
              <span class="summary-label">Writing</span>
              <strong>CSDN 博客</strong>
              <p>查看我的技术文章、项目记录与开发思考。</p>
            </a>
            <div class="note-card">
              <span class="summary-label">Method</span>
              <strong>偏向可上线的 AI 产品</strong>
              <p>关注问答链路、检索质量、接口稳定性和小机器上的真实部署表现。</p>
            </div>
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

      <section class="content-grid">
        <article id="projects" class="panel projects-panel">
          <p class="panel-kicker">Selected Projects</p>
          <h2>代表项目</h2>
          <p class="section-note">聚焦已经落地或具备完整链路的项目，强调系统结构、检索质量与真实部署边界。</p>
          <div class="project-grid">
            ${e.projects.map(s=>`
                  <div class="project-card">
                    <strong>${r(s.name)}</strong>
                    <span>${r(s.stack)}</span>
                    <p>${r(s.description)}</p>
                  </div>
                `).join("")}
          </div>
        </article>

        <div class="side-stack">
          <article class="panel experience-panel">
            <p class="panel-kicker">Experience</p>
            <h2>经历</h2>
            <p class="section-note">经历更偏向产品与工程交叉视角，关注方案落地、接口稳定性和持续迭代能力。</p>
            <div class="timeline">
              ${e.experience.map(s=>`
                    <div class="timeline-item">
                      <span class="timeline-period">${r(s.period)}</span>
                      <div class="timeline-content">
                        <strong>${r(s.role)}</strong>
                        <p>${r(s.company)}</p>
                        <small>${r(s.summary)}</small>
                      </div>
                    </div>
                  `).join("")}
            </div>
          </article>

          <section class="skills-section panel">
            <p class="panel-kicker">Technology</p>
            <h2>技术栈</h2>
            <p class="section-note">围绕 Python、检索增强、前端交互与轻量部署展开，优先选择能稳定上线的组合。</p>
            <div class="chip-row">
              ${e.skills.map(s=>`<span class="chip">${r(s)}</span>`).join("")}
            </div>
          </section>
        </div>
      </section>

      <footer class="site-footer panel">
        <div class="footer-block">
          <span class="panel-kicker">Contact</span>
          <strong>${r(e.profile.name)}</strong>
        </div>
        <div class="footer-links">
          <a class="footer-link" href="mailto:${r(e.profile.email)}">${r(e.profile.email)}</a>
          <a class="footer-link" href="${$}" target="_blank" rel="noreferrer">CSDN 博客</a>
          <span class="footer-link static">${r(e.profile.location)}</span>
        </div>
      </footer>
    </div>
  `,q())}function d(e,t,s="default"){const o=document.getElementById(e);o&&(o.textContent=t,o.className=`status-chip${s==="default"?"":` ${s}`}`)}function m(e,t){const s=document.getElementById("chat-log");if(!s)return null;s.querySelector(".chat-empty-state")?.remove();const o=document.createElement("div");return o.className=`message ${e}`,o.innerHTML=`<div class="message-body">${r(t)}</div>`,s.appendChild(o),s.scrollTop=s.scrollHeight,o}function k(e,t){if(!e)return;e.querySelector(".message-meta")?.remove();const s=[t.source_badge,t.used_local_context?"本地资料":"",t.used_web_search?"联网补充":"",t.retried?"已重试":""].filter(Boolean),o=t.references.slice(0,3).map(F).join(""),a=document.createElement("div");a.className="message-meta",a.innerHTML=`
    <div class="meta-badges">
      ${s.map(n=>`<span>${r(n)}</span>`).join("")}
    </div>
    ${o?`<div class="reference-list">${o}</div>`:""}
  `,e.appendChild(a)}function F(e){const t=[e.source_file||"未知来源",e.page?`P${e.page}`:"",e.retrieval_method||""].filter(Boolean);return`
    <div class="reference-card">
      <strong>${r(t.join(" · "))}</strong>
      <p>${r(P(e.content))}</p>
    </div>
  `}async function u(){const[e,t]=await Promise.all([I(),D()]);if(i.hasUploadedDocs=e.has_uploaded_docs,i.activeUploadFile=e.active_file,i.isUploading?d("knowledge-status","当前模式：正在处理上传文档","busy"):i.hasUploadedDocs&&i.activeUploadFile?d("knowledge-status",`当前模式：文档问答 · ${i.activeUploadFile}`):d("knowledge-status","当前模式：站内问答"),i.lastSessionResetAt?d("session-status","会话记忆：已清空","subtle"):d("session-status","会话记忆：当前浏览器会话","subtle"),i.isSending){d("runtime-status","运行状态：正在生成回答","busy");return}if(t.upload.busy){d("runtime-status","运行状态：文档处理中","busy");return}if(t.chat.busy){d("runtime-status",`运行状态：并发已满（${t.chat.active}/${t.chat.max_concurrent}）`,"busy");return}d("runtime-status","运行状态：空闲","subtle")}async function O(e,t){const o=(await j(e,i.hasUploadedDocs,v)).body?.getReader();if(!o)throw new Error("流式响应不可用");const a=new TextDecoder("utf-8");let n="",c=null;const l=t.querySelector(".message-body");for(;;){const{value:f,done:g}=await o.read();if(g)break;n+=a.decode(f,{stream:!0});const p=n.split(`

`);n=p.pop()||"";for(const E of p){const b=E.trim();if(!b.startsWith("data:"))continue;const y=JSON.parse(b.slice(5).trim());y.type==="token"?l.textContent+=y.content||"":y.type==="replace"?l.textContent=y.content||"":y.type==="meta"&&(c=y)}}c&&k(t,c)}function q(){const e=document.getElementById("chat-form"),t=document.getElementById("chat-input"),s=document.getElementById("resume-upload"),o=document.getElementById("clear-upload"),a=document.getElementById("clear-session");e?.addEventListener("submit",async n=>{n.preventDefault();const c=t?.value.trim()??"";if(!c||i.isSending||i.isUploading)return;i.isSending=!0,i.lastSessionResetAt=!1,await u().catch(()=>{});const l=m("user",c);t&&(t.value="");const f=m("assistant","");try{l&&l.scrollIntoView({block:"end"}),f&&await O(c,f)}catch{try{const g=await T(c,i.hasUploadedDocs,v),p=f?.querySelector(".message-body");p&&(p.textContent=g.answer),k(f,g)}catch(g){const p=f?.querySelector(".message-body");p&&(p.textContent=`请求失败：${g.message}`)}}finally{i.isSending=!1,u().catch(()=>{})}}),s?.addEventListener("change",async n=>{const c=n.target.files?.[0];if(!(!c||i.isSending||i.isUploading)){i.isUploading=!0,await u().catch(()=>{});try{const l=await x(c);i.hasUploadedDocs=!0,i.activeUploadFile=l.file_name,m("assistant",`文档已上传并完成入库：${l.file_name}`)}catch(l){m("assistant",`上传失败：${l.message}`)}finally{i.isUploading=!1,s&&(s.value=""),u().catch(()=>{})}}}),o?.addEventListener("click",async()=>{try{await A(),i.hasUploadedDocs=!1,i.activeUploadFile=null,m("assistant","已清空上传文档，当前恢复为站内资料问答模式。"),u().catch(()=>{})}catch(n){m("assistant",`清空失败：${n.message}`)}}),a?.addEventListener("click",async()=>{try{await M(v),i.lastSessionResetAt=!0;const n=document.getElementById("chat-log");n&&(n.innerHTML=_()),u().catch(()=>{})}catch(n){m("assistant",`清空会话失败：${n.message}`)}}),u().catch(()=>{}),window.setInterval(()=>{u().catch(()=>{})},1e4)}U().then(B).catch(e=>{const t=document.getElementById("app");t&&(t.innerHTML=`<div class="shell"><section class="panel"><h1>前端初始化失败</h1><p>${r(e.message)}</p></section></div>`)});
