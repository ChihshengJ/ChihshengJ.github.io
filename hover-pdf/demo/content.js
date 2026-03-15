(function(){if(window!==window.top||document.contentType!=="application/pdf"||window.location.href.includes(chrome.runtime.id))return;console.log("[Hover] PDF detected at document_start:",window.location.href);const c=document.createElement("style");c.textContent=`
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
      width: 200px;
      height: 3px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 2px;
      margin-top: 16px;
      overflow: hidden;
    }
    #hover-loading-overlay .hover-progress-bar {
      height: 100%;
      width: 0%;
      background: #A0A0B0;
      border-radius: 2px;
      transition: width 0.3s ease;
    }
    @keyframes hover-spin {
      to { transform: rotate(360deg); }
    }
  `,document.documentElement.appendChild(c);const l=document.createElement("div");l.id="hover-loading-overlay",l.innerHTML=`
    <div class="hover-spinner"></div>
    <div class="hover-title">Hover</div>
    <div class="hover-status" id="hover-status-text">Preparing document…</div>
    <div class="hover-progress-track">
      <div class="hover-progress-bar" id="hover-progress-bar"></div>
    </div>
  `,document.documentElement.appendChild(l);function a(t,r){const o=document.getElementById("hover-status-text"),i=document.getElementById("hover-progress-bar");o&&(o.textContent=t),i&&r!==void 0&&(i.style.width=`${Math.min(100,Math.round(r))}%`)}function s(){const t=document.getElementById("hover-loading-overlay");t&&t.remove(),c.parentNode&&c.remove()}function v(t){try{const i=(new URL(t).pathname.split("/").pop()||"document.pdf").split("?")[0];return i.endsWith(".pdf")?i:i+".pdf"}catch{return"document.pdf"}}function g(){const t=document.getElementById("hover-loading-overlay");t&&(t.innerHTML=`
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
    `,document.getElementById("hover-open-settings")?.addEventListener("click",()=>{chrome.runtime.sendMessage({type:"OPEN_EXTENSION_SETTINGS"})}),document.getElementById("hover-use-native")?.addEventListener("click",()=>{s()}))}(async function(){try{const r=window.location.protocol==="file:";let o=null;if(r){a("Reading local file…",15);const e=await chrome.runtime.sendMessage({type:"FETCH_LOCAL_FILE",url:window.location.href});if(!e?.success)throw new Error(e?.error||"FILE_ACCESS_DENIED");const n=atob(e.data);o=Uint8Array.from(n,d=>d.charCodeAt(0)).buffer}else{const e=await chrome.runtime.sendMessage({type:"PDF_PAGE_DETECTED",url:window.location.href});if(e?.action!=="fetch_and_send"){console.log("[Hover] Background declined interception:",e?.reason),s();return}a("Downloading PDF…",15);const n=await fetch(window.location.href,{credentials:"include",cache:"force-cache"});if(!n.ok){console.error("[Hover] Failed to fetch PDF:",n.status,n.statusText),s();return}const d=n.headers.get("content-type")||"";if(!d.includes("application/pdf")&&!d.includes("octet-stream")){console.log("[Hover] Response is not a PDF, content-type:",d),s();return}a("Reading PDF data…",35),o=await n.arrayBuffer()}const i=new Uint8Array(o.slice(0,5));if(!String.fromCharCode(...i).startsWith("%PDF-")){console.log("[Hover] Response does not have PDF magic bytes"),s();return}console.log("[Hover] PDF fetched successfully, size:",o.byteLength),a("Preparing for viewer…",55);const p=new Uint8Array(o);let h="";const u=8192;for(let e=0;e<p.length;e+=u){const n=p.subarray(e,Math.min(e+u,p.length));h+=String.fromCharCode.apply(null,n)}const m=btoa(h);a("Opening viewer…",80);const f=await chrome.runtime.sendMessage({type:"PDF_DATA_READY",url:window.location.href,data:m,filename:v(window.location.href)});f?.success?a("Opening viewer…",100):(console.error("[Hover] Failed to send PDF to viewer:",f?.error),s())}catch(r){if(r.message==="FILE_ACCESS_DENIED"){g();return}console.error("[Hover] Error intercepting PDF:",r),s()}})()})();
