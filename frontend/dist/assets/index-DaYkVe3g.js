(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const n of a)if(n.type==="childList")for(const c of n.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&i(c)}).observe(document,{childList:!0,subtree:!0});function t(a){const n={};return a.integrity&&(n.integrity=a.integrity),a.referrerPolicy&&(n.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?n.credentials="include":a.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function i(a){if(a.ep)return;a.ep=!0;const n=t(a);fetch(a.href,n)}})();function w(e,s,t){const i=e.error??{},a=i.code??"request_failed",n=e.detail??i.message??t;return a==="chat_capacity_full"||s===429?new Error("当前聊天请求较多，容量已满，请稍后重试。"):a==="upload_busy"||s===409?new Error("系统正在处理另一份上传文档，请稍后再试。"):a==="upload_too_large"||s===413?new Error("上传文件过大，已超过当前站点限制。"):a==="unsupported_file_type"?new Error("当前仅支持上传 PDF 文件。"):a==="empty_question"?new Error("请输入问题后再发送。"):a==="model_timeout"?new Error("模型响应超时，请稍后重试，或改成更短的问题。"):new Error(n)}async function h(e,s){const t=await fetch(e,s);if(!t.ok){const i=await t.json().catch(()=>({}));throw w(i,t.status,s?.fallbackMessage??"请求失败")}return t.json()}function k(){return h("/site_content",{fallbackMessage:"无法获取站点内容"})}function E(){return h("/upload_status",{fallbackMessage:"无法获取上传状态"})}function I(){return h("/runtime_status",{fallbackMessage:"无法获取运行时状态"})}function U(){return h("/upload_status",{method:"DELETE",fallbackMessage:"无法清空上传文档"})}function A(e){return h(`/session/${encodeURIComponent(e)}`,{method:"DELETE",fallbackMessage:"无法清空会话"})}function D(e,s,t){return h("/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:e,use_uploaded_docs:s,session_id:t}),fallbackMessage:"问答请求失败"})}async function M(e,s,t){const i=await fetch("/chat_stream",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:e,use_uploaded_docs:s,session_id:t})});if(!i.ok){const a=await i.json().catch(()=>({}));throw w(a,i.status,"问答请求失败")}return i}async function T(e){const s=new FormData;return s.append("file",e),h("/upload_resume",{method:"POST",body:s,fallbackMessage:"上传失败"})}const $="resume_assistant_frontend_session_id";function j(){const e=globalThis.crypto?.randomUUID?.();if(e)return e;const s=Date.now().toString(36),t=Math.random().toString(36).slice(2,10);return`session-${s}-${t}`}const y=window.localStorage.getItem($)||j();window.localStorage.setItem($,y);const o={hasUploadedDocs:!1,activeUploadFile:null,isSending:!1,isUploading:!1,lastSessionResetAt:!1};function x(e,s=180){const t=e.replace(/\s+/g," ").trim();return t.length<=s?t:`${t.slice(0,s)}...`}function r(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}function P(e){const s=document.getElementById("app");s&&(document.title=`${e.profile.name} | ${e.profile.title}`,s.innerHTML=`
    <div class="shell site-shell">
      <section id="assistant" class="panel assistant-panel assistant-first">
        <div class="assistant-head">
          <div>
            <p class="panel-kicker">Ask Me</p>
            <h2>和这个网站直接对话</h2>
            <p class="section-summary">这是这个网站最重要的入口。你可以直接问我的经历、项目、技术栈，也可以上传 PDF 再围绕文档继续追问。</p>
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
                <div class="message-body">你好，你可以直接问我的经历、项目、技术栈，也可以先上传 PDF 再围绕文档继续提问。</div>
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

      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">AI Product Builder</p>
          <h1>${r(e.profile.name)}</h1>
          <p class="hero-title">${r(e.profile.title)}</p>
          <p class="hero-copy-text">${r(e.profile.tagline)}。我关注的不是孤立的模型能力，而是把检索、接口、前端体验与部署边界组织成完整产品。</p>
          <div class="hero-actions">
            <a class="hero-link primary" href="#assistant">和我直接对话</a>
            <a class="hero-link secondary" href="#projects">查看代表项目</a>
          </div>
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
            <strong>RAG / Agent / FastAPI</strong>
            <p>偏好清晰架构、稳定接口和面向真实部署环境的实现方式。</p>
          </div>
        </div>
      </section>

      <section class="overview-row">
        <article class="panel overview-panel">
          <p class="panel-kicker">Profile</p>
          <h2>关于我</h2>
          <div class="paragraphs">
            <p>我在做的是轻量但完整的 AI 应用：它们应该能上线、能维护、能被真实用户使用，而不只是一次性的模型演示。</p>
            <p>这个网站本身就是一个作品入口。你可以浏览我的经历和项目，也可以直接把它当成问答界面，和内容本身发生交互。</p>
          </div>
        </article>

        <article class="panel overview-panel">
          <p class="panel-kicker">What I Build</p>
          <h2>我偏好的系统能力</h2>
          <div class="feature-list">
            <div class="feature-item">
              <strong>结构清楚的问答链路</strong>
              <p>短期记忆、RAG、引用展示、按需联网，而不是无边界堆能力。</p>
            </div>
            <div class="feature-item">
              <strong>小机器也能稳定运行</strong>
              <p>优先控制复杂度和资源占用，让产品真的能部署和维护。</p>
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
  `,F())}function d(e,s,t="default"){const i=document.getElementById(e);i&&(i.textContent=s,i.className=`status-chip${t==="default"?"":` ${t}`}`)}function u(e,s){const t=document.getElementById("chat-log");if(!t)return null;const i=document.createElement("div");return i.className=`message ${e}`,i.innerHTML=`<div class="message-body">${r(s)}</div>`,t.appendChild(i),t.scrollTop=t.scrollHeight,i}function _(e,s){if(!e)return;e.querySelector(".message-meta")?.remove();const t=[s.source_badge,s.used_local_context?"本地资料":"",s.used_web_search?"联网补充":"",s.retried?"已重试":""].filter(Boolean),i=s.references.slice(0,3).map(L).join(""),a=document.createElement("div");a.className="message-meta",a.innerHTML=`
    <div class="meta-badges">
      ${t.map(n=>`<span>${r(n)}</span>`).join("")}
    </div>
    ${i?`<div class="reference-list">${i}</div>`:""}
  `,e.appendChild(a)}function L(e){const s=[e.source_file||"未知来源",e.page?`P${e.page}`:"",e.retrieval_method||""].filter(Boolean);return`
    <div class="reference-card">
      <strong>${r(s.join(" · "))}</strong>
      <p>${r(x(e.content))}</p>
    </div>
  `}async function f(){const[e,s]=await Promise.all([E(),I()]);if(o.hasUploadedDocs=e.has_uploaded_docs,o.activeUploadFile=e.active_file,o.isUploading?d("knowledge-status","当前模式：正在处理上传文档","busy"):o.hasUploadedDocs&&o.activeUploadFile?d("knowledge-status",`当前模式：上传文档问答（${o.activeUploadFile}）`):d("knowledge-status","当前模式：个人简历问答"),o.lastSessionResetAt?d("session-status","会话记忆：已清空，后续对话将重新积累","subtle"):d("session-status","会话记忆：当前浏览器会话已启用","subtle"),o.isSending){d("runtime-status","运行状态：正在生成回答","busy");return}if(s.upload.busy){d("runtime-status","运行状态：上传灌库处理中","busy");return}if(s.chat.busy){d("runtime-status",`运行状态：聊天容量已满（${s.chat.active}/${s.chat.max_concurrent}）`,"busy");return}d("runtime-status","运行状态：空闲","subtle")}async function B(e,s){const i=(await M(e,o.hasUploadedDocs,y)).body?.getReader();if(!i)throw new Error("流式响应不可用");const a=new TextDecoder("utf-8");let n="",c=null;const l=s.querySelector(".message-body");for(;;){const{value:m,done:g}=await i.read();if(g)break;n+=a.decode(m,{stream:!0});const p=n.split(`

`);n=p.pop()||"";for(const S of p){const b=S.trim();if(!b.startsWith("data:"))continue;const v=JSON.parse(b.slice(5).trim());v.type==="token"?l.textContent+=v.content||"":v.type==="replace"?l.textContent=v.content||"":v.type==="meta"&&(c=v)}}c&&_(s,c)}function F(){const e=document.getElementById("chat-form"),s=document.getElementById("chat-input"),t=document.getElementById("resume-upload"),i=document.getElementById("clear-upload"),a=document.getElementById("clear-session");e?.addEventListener("submit",async n=>{n.preventDefault();const c=s?.value.trim()??"";if(!c||o.isSending||o.isUploading)return;o.isSending=!0,o.lastSessionResetAt=!1,await f().catch(()=>{});const l=u("user",c);s&&(s.value="");const m=u("assistant","");try{l&&l.scrollIntoView({block:"end"}),m&&await B(c,m)}catch{try{const g=await D(c,o.hasUploadedDocs,y),p=m?.querySelector(".message-body");p&&(p.textContent=g.answer),_(m,g)}catch(g){const p=m?.querySelector(".message-body");p&&(p.textContent=`请求失败：${g.message}`)}}finally{o.isSending=!1,f().catch(()=>{})}}),t?.addEventListener("change",async n=>{const c=n.target.files?.[0];if(!(!c||o.isSending||o.isUploading)){o.isUploading=!0,await f().catch(()=>{});try{const l=await T(c);o.hasUploadedDocs=!0,o.activeUploadFile=l.file_name,u("assistant",`已完成上传并自动灌库：${l.file_name}`)}catch(l){u("assistant",`上传失败：${l.message}`)}finally{o.isUploading=!1,t&&(t.value=""),f().catch(()=>{})}}}),i?.addEventListener("click",async()=>{try{await U(),o.hasUploadedDocs=!1,o.activeUploadFile=null,u("assistant","已清空上传知识库，当前恢复为个人简历问答模式。"),f().catch(()=>{})}catch(n){u("assistant",`清空失败：${n.message}`)}}),a?.addEventListener("click",async()=>{try{await A(y),o.lastSessionResetAt=!0;const n=document.getElementById("chat-log");n&&(n.innerHTML=""),u("assistant","会话已清空，可以重新开始提问。"),f().catch(()=>{})}catch(n){u("assistant",`清空会话失败：${n.message}`)}}),f().catch(()=>{}),window.setInterval(()=>{f().catch(()=>{})},1e4)}k().then(P).catch(e=>{const s=document.getElementById("app");s&&(s.innerHTML=`<div class="shell"><section class="panel"><h1>前端骨架初始化失败</h1><p>${r(e.message)}</p></section></div>`)});
