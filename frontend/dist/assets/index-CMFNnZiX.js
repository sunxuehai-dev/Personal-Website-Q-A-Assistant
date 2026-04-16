(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))n(t);new MutationObserver(t=>{for(const i of t)if(i.type==="childList")for(const r of i.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&n(r)}).observe(document,{childList:!0,subtree:!0});function a(t){const i={};return t.integrity&&(i.integrity=t.integrity),t.referrerPolicy&&(i.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?i.credentials="include":t.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function n(t){if(t.ep)return;t.ep=!0;const i=a(t);fetch(t.href,i)}})();function w(e,s,a){const n=e.error??{},t=n.code??"request_failed",i=e.detail??n.message??a;return t==="chat_capacity_full"||s===429?new Error("当前聊天请求较多，容量已满，请稍后重试。"):t==="upload_busy"||s===409?new Error("系统正在处理另一份上传文档，请稍后再试。"):t==="upload_too_large"||s===413?new Error("上传文件过大，已超过当前站点限制。"):t==="unsupported_file_type"?new Error("当前仅支持上传 PDF 文件。"):t==="empty_question"?new Error("请输入问题后再发送。"):t==="model_timeout"?new Error("模型响应超时，请稍后重试，或改成更短的问题。"):new Error(i)}async function v(e,s){const a=await fetch(e,s);if(!a.ok){const n=await a.json().catch(()=>({}));throw w(n,a.status,s?.fallbackMessage??"请求失败")}return a.json()}function _(){return v("/site_content",{fallbackMessage:"无法获取站点内容"})}function E(){return v("/upload_status",{fallbackMessage:"无法获取上传状态"})}function A(){return v("/runtime_status",{fallbackMessage:"无法获取运行时状态"})}function I(){return v("/upload_status",{method:"DELETE",fallbackMessage:"无法清空上传文档"})}function U(e){return v(`/session/${encodeURIComponent(e)}`,{method:"DELETE",fallbackMessage:"无法清空会话"})}function j(e,s,a){return v("/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:e,use_uploaded_docs:s,session_id:a}),fallbackMessage:"问答请求失败"})}async function x(e,s,a){const n=await fetch("/chat_stream",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:e,use_uploaded_docs:s,session_id:a})});if(!n.ok){const t=await n.json().catch(()=>({}));throw w(t,n.status,"问答请求失败")}return n}async function M(e){const s=new FormData;return s.append("file",e),v("/upload_resume",{method:"POST",body:s,fallbackMessage:"上传失败"})}const $="resume_assistant_frontend_session_id";function D(){const e=globalThis.crypto?.randomUUID?.();if(e)return e;const s=Date.now().toString(36),a=Math.random().toString(36).slice(2,10);return`session-${s}-${a}`}const y=window.localStorage.getItem($)||D();window.localStorage.setItem($,y);const o={hasUploadedDocs:!1,activeUploadFile:null,isSending:!1,isUploading:!1,lastSessionResetAt:!1};function T(e,s=180){const a=e.replace(/\s+/g," ").trim();return a.length<=s?a:`${a.slice(0,s)}...`}function c(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}function L(e){const s=document.getElementById("app");if(!s)return;const a=e.projects[0],n=e.projects.slice(1);document.title=`${e.profile.name} | AI 控制台`,s.innerHTML=`
    <div class="shell brand-shell">
      <section class="hero brand-hero">
        <div class="hero-copy">
          <p class="eyebrow">Sun Xuehai / AI Application Engineer</p>
          <h1>把 AI 能力做成真正能上线、能使用、能维护的产品。</h1>
          <p class="subtitle">${c(e.profile.name)} · ${c(e.profile.title)} · ${c(e.profile.location)}</p>
          <p class="copy">${c(e.profile.tagline)}。我更关注把检索、模型、接口、前端和部署组织成完整产品，而不只是做一个只能演示的模型能力页面。</p>
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
              <h2>${c(a?.name||"代表项目")}</h2>
            </div>
            <span class="section-note">${c(a?.stack||"")}</span>
          </div>
          <p class="featured-copy">${c(a?.description||"")}</p>
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
            ${e.experience.map(t=>`
                  <div class="timeline-item">
                    <span class="timeline-period">${c(t.period)}</span>
                    <div class="timeline-content">
                      <strong>${c(t.role)}</strong>
                      <p>${c(t.company)}</p>
                      <small>${c(t.summary)}</small>
                    </div>
                  </div>
                `).join("")}
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
          ${n.map(t=>`
                <div class="project-card">
                  <strong>${c(t.name)}</strong>
                  <span>${c(t.stack)}</span>
                  <p>${c(t.description)}</p>
                </div>
              `).join("")}
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
            ${e.skills.map(t=>`<span class="chip">${c(t)}</span>`).join("")}
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
  `,R()}function d(e,s,a="default"){const n=document.getElementById(e);n&&(n.textContent=s,n.className=`status-chip${a==="default"?"":` ${a}`}`)}function u(e,s){const a=document.getElementById("chat-log");if(!a)return null;const n=document.createElement("div");return n.className=`message ${e}`,n.innerHTML=`<div class="message-body">${c(s)}</div>`,a.appendChild(n),a.scrollTop=a.scrollHeight,n}function k(e,s){if(!e)return;e.querySelector(".message-meta")?.remove();const a=[s.source_badge,s.used_local_context?"本地资料":"",s.used_web_search?"联网补充":"",s.retried?"已重试":""].filter(Boolean),n=s.references.slice(0,3).map(P).join(""),t=document.createElement("div");t.className="message-meta",t.innerHTML=`
    <div class="meta-badges">
      ${a.map(i=>`<span>${c(i)}</span>`).join("")}
    </div>
    ${n?`<div class="reference-list">${n}</div>`:""}
  `,e.appendChild(t)}function P(e){const s=[e.source_file||"未知来源",e.page?`P${e.page}`:"",e.retrieval_method||""].filter(Boolean);return`
    <div class="reference-card">
      <strong>${c(s.join(" · "))}</strong>
      <p>${c(T(e.content))}</p>
    </div>
  `}async function f(){const[e,s]=await Promise.all([E(),A()]);if(o.hasUploadedDocs=e.has_uploaded_docs,o.activeUploadFile=e.active_file,o.isUploading?d("knowledge-status","当前模式：正在处理上传文档","busy"):o.hasUploadedDocs&&o.activeUploadFile?d("knowledge-status",`当前模式：上传文档问答（${o.activeUploadFile}）`):d("knowledge-status","当前模式：个人简历问答"),o.lastSessionResetAt?d("session-status","会话记忆：已清空，后续对话将重新积累","subtle"):d("session-status","会话记忆：当前浏览器会话已启用","subtle"),o.isSending){d("runtime-status","运行状态：正在生成回答","busy");return}if(s.upload.busy){d("runtime-status","运行状态：上传灌库处理中","busy");return}if(s.chat.busy){d("runtime-status",`运行状态：聊天容量已满（${s.chat.active}/${s.chat.max_concurrent}）`,"busy");return}d("runtime-status","运行状态：空闲","subtle")}async function B(e,s){const n=(await x(e,o.hasUploadedDocs,y)).body?.getReader();if(!n)throw new Error("流式响应不可用");const t=new TextDecoder("utf-8");let i="",r=null;const l=s.querySelector(".message-body");for(;;){const{value:m,done:h}=await n.read();if(h)break;i+=t.decode(m,{stream:!0});const p=i.split(`

`);i=p.pop()||"";for(const S of p){const b=S.trim();if(!b.startsWith("data:"))continue;const g=JSON.parse(b.slice(5).trim());g.type==="token"?l.textContent+=g.content||"":g.type==="replace"?l.textContent=g.content||"":g.type==="meta"&&(r=g)}}r&&k(s,r)}function R(){const e=document.getElementById("chat-form"),s=document.getElementById("chat-input"),a=document.getElementById("resume-upload"),n=document.getElementById("clear-upload"),t=document.getElementById("clear-session");e?.addEventListener("submit",async i=>{i.preventDefault();const r=s?.value.trim()??"";if(!r||o.isSending||o.isUploading)return;o.isSending=!0,o.lastSessionResetAt=!1,await f().catch(()=>{});const l=u("user",r);s&&(s.value="");const m=u("assistant","");try{l&&l.scrollIntoView({block:"end"}),m&&await B(r,m)}catch{try{const h=await j(r,o.hasUploadedDocs,y),p=m?.querySelector(".message-body");p&&(p.textContent=h.answer),k(m,h)}catch(h){const p=m?.querySelector(".message-body");p&&(p.textContent=`请求失败：${h.message}`)}}finally{o.isSending=!1,f().catch(()=>{})}}),a?.addEventListener("change",async i=>{const r=i.target.files?.[0];if(!(!r||o.isSending||o.isUploading)){o.isUploading=!0,await f().catch(()=>{});try{const l=await M(r);o.hasUploadedDocs=!0,o.activeUploadFile=l.file_name,u("assistant",`已完成上传并自动灌库：${l.file_name}`)}catch(l){u("assistant",`上传失败：${l.message}`)}finally{o.isUploading=!1,a&&(a.value=""),f().catch(()=>{})}}}),n?.addEventListener("click",async()=>{try{await I(),o.hasUploadedDocs=!1,o.activeUploadFile=null,u("assistant","已清空上传知识库，当前恢复为个人简历问答模式。"),f().catch(()=>{})}catch(i){u("assistant",`清空失败：${i.message}`)}}),t?.addEventListener("click",async()=>{try{await U(y),o.lastSessionResetAt=!0;const i=document.getElementById("chat-log");i&&(i.innerHTML=""),u("assistant","会话已清空，可以重新开始提问。"),f().catch(()=>{})}catch(i){u("assistant",`清空会话失败：${i.message}`)}}),f().catch(()=>{}),window.setInterval(()=>{f().catch(()=>{})},1e4)}_().then(L).catch(e=>{const s=document.getElementById("app");s&&(s.innerHTML=`<div class="shell"><section class="panel"><h1>前端骨架初始化失败</h1><p>${c(e.message)}</p></section></div>`)});
