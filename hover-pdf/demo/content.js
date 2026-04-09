(function(){if(window!==window.top||window.location.href.includes(chrome.runtime.id))return;function l(n){const e=new Uint8Array(n);let t="";const o=8192;for(let r=0;r<e.length;r+=o){const s=e.subarray(r,Math.min(r+o,e.length));t+=String.fromCharCode.apply(null,s)}return btoa(t)}async function p(n){const e=await fetch(n,{credentials:"include",cache:"force-cache"});if(!e.ok)return null;const t=await e.arrayBuffer(),o=new Uint8Array(t.slice(0,5));return String.fromCharCode(...o).startsWith("%PDF-")?l(t):null}async function f(n){try{const e=await p(n);if(e)return{data:e};const t=[],o=document.getElementById("pdf-iframe");o?.src&&t.push(o.src);for(const r of document.querySelectorAll("iframe[src]"))if(!t.includes(r.src))try{new URL(r.src).pathname.toLowerCase().includes("pdf")&&t.push(r.src)}catch{}for(const r of document.querySelectorAll('embed[type="application/pdf"]'))r.src&&!t.includes(r.src)&&t.push(r.src);for(const r of t){const s=await p(r);if(s)return{data:s}}return{error:"No PDF found on this page"}}catch(e){return{error:e.message}}}if(chrome.runtime.onMessage.addListener((n,e,t)=>{if(n.type==="FETCH_PDF_FROM_PAGE")return f(window.location.href).then(t),!0}),document.contentType!=="application/pdf")return;console.log("[Hover] PDF detected at document_start:",window.location.href);const d=document.createElement("style");d.textContent=`
    body, embed[type="application/pdf"] {
      display: none !important;
      visibility: hidden !important;
    }
    #hover-loading-overlay {
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      background: #1C1C1E;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #E5E5EA;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    #hover-loading-overlay .hover-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(255, 255, 255, 0.12);
      border-top-color: #A0A0B0;
      border-radius: 50%;
      animation: hover-spin 0.8s linear infinite;
      margin-bottom: 20px;
    }
    #hover-loading-overlay .hover-title {
      font-size: 15px;
      font-weight: 500;
      color: #E5E5EA;
      margin-bottom: 6px;
      letter-spacing: 0.01em;
    }
    #hover-loading-overlay .hover-status {
      font-size: 13px;
      color: #8E8E93;
      transition: opacity 0.2s ease;
    }
    #hover-loading-overlay .hover-progress-track {
      position: relative;
      width: 200px;
      height: 3px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 2px;
      margin-top: 16px;
      overflow: hidden;
    }
    #hover-loading-overlay .hover-progress-bar {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      width: 0%;
      background: #A0A0B0;
      border-radius: 2px;
      transition: width 0.3s ease;
    }
    #hover-loading-overlay .hover-progress-bar.indeterminate {
      width: 30%;
      animation: hover-indeterminate 1.5s ease-in-out infinite;
    }
    @keyframes hover-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes hover-indeterminate {
      0% { left: 0%; width: 30%; }
      50% { left: 35%; width: 35%; }
      100% { left: 70%; width: 30%; }
    }
  `,document.documentElement.appendChild(d);const c=document.createElement("div");c.id="hover-loading-overlay",c.innerHTML=`
    <div class="hover-spinner"></div>
    <div class="hover-title">Hover</div>
    <div class="hover-status" id="hover-status-text">Preparing document…</div>
    <div class="hover-progress-track">
      <div class="hover-progress-bar" id="hover-progress-bar"></div>
    </div>
  `,document.documentElement.appendChild(c);function i(n,e){const t=document.getElementById("hover-status-text"),o=document.getElementById("hover-progress-bar");t&&(t.textContent=n),o&&(e===void 0?(o.classList.add("indeterminate"),o.style.width=""):(o.classList.remove("indeterminate"),o.style.width=`${Math.min(100,Math.round(e))}%`))}chrome.runtime.onMessage.addListener(n=>{n.type==="PDF_PROGRESS"&&i("Downloading PDF…",n.percent)});function a(){const n=document.getElementById("hover-loading-overlay");n&&n.remove(),d.parentNode&&d.remove()}function u(){const n=document.getElementById("hover-loading-overlay");n&&(n.innerHTML=`
      <div style="max-width: 400px; text-align: center; padding: 24px;">
        <div style="font-size: 28px; margin-bottom: 16px;">📄</div>
        <div style="font-size: 15px; font-weight: 600; color: #E5E5EA; margin-bottom: 8px;">
          Local File Access Required
        </div>
        <div style="font-size: 13px; color: #8E8E93; line-height: 1.6; margin-bottom: 20px;">
          To open local PDF files, Hover needs file access permission.
          Enable <strong style="color: #E5E5EA;">"Allow access to file URLs"</strong>
          in your extension settings.
        </div>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="hover-open-settings" style="
            background: #3A3A3C; color: #E5E5EA; border: none;
            padding: 8px 16px; border-radius: 8px; font-size: 13px;
            cursor: pointer; font-weight: 500;
          ">Open Extension Settings</button>
          <button id="hover-use-native" style="
            background: transparent; color: #8E8E93; border: 1px solid #3A3A3C;
            padding: 8px 16px; border-radius: 8px; font-size: 13px;
            cursor: pointer;
          ">Use Default Viewer</button>
        </div>
      </div>
    `,document.getElementById("hover-open-settings")?.addEventListener("click",()=>{chrome.runtime.sendMessage({type:"OPEN_EXTENSION_SETTINGS"})}),document.getElementById("hover-use-native")?.addEventListener("click",()=>{a()}))}(async function(){try{i("Connecting…");const e=await chrome.runtime.sendMessage({type:"PDF_PAGE_DETECTED",url:window.location.href});if(e?.action==="none"){a();return}if(e?.action==="done"){i("Opening viewer…",100);return}if(e?.action==="file_access_denied"){u();return}i("Downloading PDF…",15);const t=await fetch(window.location.href,{credentials:"include",cache:"force-cache"});if(!t.ok){a();return}const o=t.headers.get("content-type")||"";if(!o.includes("application/pdf")&&!o.includes("octet-stream")){a();return}i("Reading PDF data…",35);const r=await t.arrayBuffer(),s=new Uint8Array(r.slice(0,5));if(!String.fromCharCode(...s).startsWith("%PDF-")){a();return}i("Preparing for viewer…",55);const h=l(r);i("Opening viewer…",80),(await chrome.runtime.sendMessage({type:"PDF_DATA_READY",url:window.location.href,data:h}))?.success?i("Opening viewer…",100):a()}catch(e){console.error("[Hover] Error intercepting PDF:",e),a()}})()})();
