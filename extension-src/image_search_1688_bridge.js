(() => {
  "use strict";

  if (window.top !== window.self || globalThis.__TDT_1688_UPLOAD_BRIDGE_V5__) return;

  function isUploadSessionPage() {
    try {
      const url = new URL(location.href);
      return url.searchParams.get("tdtImageSearch") === "1" || Boolean(url.searchParams.get("tdtRequest"));
    } catch (_error) {
      return false;
    }
  }

  const MAX_WAIT_MS = 24_000;
  const MAIN_REQUEST_TYPE = "TDT_1688_MAIN_UPLOAD_REQUEST_V1";
  const MAIN_RESPONSE_TYPE = "TDT_1688_MAIN_UPLOAD_RESPONSE_V1";
  let panel = null;
  let statusText = null;
  let manualButton = null;
  let pending = null;
  let activeMainRequest = null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function runtimeMessage(payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(payload, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(response || { ok: false, error: "Extension không phản hồi." });
        });
      } catch (error) {
        resolve({ ok: false, error: error?.message || "Không gửi được yêu cầu." });
      }
    });
  }

  function isResultPage() {
    try {
      const url = new URL(location.href);
      const hostname = url.hostname.toLowerCase();
      const pathname = url.pathname.toLowerCase();
      const hasImageId = Boolean(url.searchParams.get("imageId") || url.searchParams.get("imageIdList"));
      if (!hasImageId || !(hostname === "1688.com" || hostname.endsWith(".1688.com"))) return false;
      if (hostname === "air.1688.com" && /\/kapp\/1688-search\/pc-image-search\/?/i.test(pathname)) return true;
      if (hostname === "pages-fast.1688.com" && /\/image[_-]search\//i.test(pathname)) return true;
      return /(?:image[_-]?search|pc-image-search|srch_rec)/i.test(pathname);
    } catch (_error) {
      return false;
    }
  }

  if (isResultPage()) {
    globalThis.__TDT_1688_UPLOAD_BRIDGE_V5__ = true;
    void runtimeMessage({ type: "TDT_1688_RESULT_READY" });
    return;
  }

  // Ordinary 1688 browsing must stay untouched. Only the tab created by this
  // extension carries one of these markers and needs the upload bridge.
  if (!isUploadSessionPage()) return;
  globalThis.__TDT_1688_UPLOAD_BRIDGE_V5__ = true;

  function createFailurePanel(message) {
    if (panel?.isConnected) {
      statusText.textContent = String(message || "Không thể tự tìm kiếm bằng ảnh.");
      return;
    }
    panel = document.createElement("aside");
    panel.id = "tdt-1688-upload-fallback";
    panel.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:2147483647;width:min(370px,calc(100vw - 36px));box-sizing:border-box;padding:14px;border:1px solid rgba(255,255,255,.28);border-radius:16px;background:rgba(24,25,28,.96);color:#fff;box-shadow:0 18px 45px rgba(0,0,0,.35);font:600 13px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);";
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:38px;height:38px;display:grid;place-items:center;border-radius:11px;background:linear-gradient(135deg,#ff7a00,#ff4d00);font-size:10px;font-weight:900">1688</div>
        <div style="min-width:0;flex:1"><strong style="display:block;font-size:14px">Tìm sản phẩm bằng ảnh</strong><span id="tdt-1688-status" style="display:block;margin-top:2px;color:#ffb2bc;font-weight:600"></span></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button id="tdt-1688-manual" type="button" style="flex:1;height:36px;border:0;border-radius:9px;background:#ff6200;color:#fff;font-weight:800;cursor:pointer">Thử tìm kiếm lại</button>
        <button id="tdt-1688-close" type="button" style="height:36px;padding:0 13px;border:1px solid rgba(255,255,255,.22);border-radius:9px;background:rgba(255,255,255,.08);color:#fff;font-weight:700;cursor:pointer">Ẩn</button>
      </div>
    `;
    statusText = panel.querySelector("#tdt-1688-status");
    statusText.textContent = String(message || "Không thể tự tìm kiếm bằng ảnh.");
    manualButton = panel.querySelector("#tdt-1688-manual");
    manualButton.addEventListener("click", async () => {
      if (!pending?.dataUrl || activeMainRequest) return;
      manualButton.disabled = true;
      statusText.textContent = "Đang gửi lại file ảnh vào 1688…";
      const result = await uploadInMainWorld(pending.dataUrl, 20_000);
      if (!result.ok) {
        statusText.textContent = result.error || "1688 chưa nhận được file ảnh.";
      } else {
        statusText.textContent = "Ảnh đã gửi, đang mở kết quả…";
        const ready = await waitForResultOrFail(Date.now(), pending.requestId);
        if (ready) panel?.remove();
      }
      manualButton.disabled = false;
    });
    panel.querySelector("#tdt-1688-close")?.addEventListener("click", () => panel?.remove());
    document.documentElement.appendChild(panel);
  }

  function requestToken() {
    try { return crypto.randomUUID(); } catch (_error) { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  }

  function uploadInMainWorld(dataUrl, timeoutMs = 28_000) {
    if (activeMainRequest) return Promise.resolve({ ok: false, error: "Yêu cầu đang được xử lý." });
    const token = requestToken();
    return new Promise((resolve) => {
      let settled = false;
      let retryTimer = 0;
      let mainAcknowledged = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearInterval(retryTimer);
        window.removeEventListener("message", onMessage);
        activeMainRequest = null;
        resolve(result);
      };
      const onMessage = (event) => {
        if (event.source !== window) return;
        const message = event.data;
        if (!message || message.source !== "TDT_1688_MAIN" || message.type !== MAIN_RESPONSE_TYPE || message.token !== token) return;
        mainAcknowledged = true;
        clearInterval(retryTimer);
        if (message.status === "preparing") {
          void runtimeMessage({ type: "TDT_1688_UPLOAD_STATUS", status: "preparing" });
        } else if (message.status === "file-assigned") {
          // Do not mark uploaded yet. input.files alone does not mean React accepted it.
        } else if (message.status === "preview-ready") {
          void runtimeMessage({ type: "TDT_1688_UPLOAD_STATUS", status: "uploaded" });
        } else if (message.status === "submitted") {
          void runtimeMessage({ type: "TDT_1688_UPLOAD_STATUS", status: "submitted" });
          finish({ ok: true });
        } else if (message.status === "failed") {
          finish({ ok: false, error: String(message.error || "1688 chưa nhận được file ảnh.") });
        }
      };
      const timer = setTimeout(() => finish({ ok: false, error: "1688 xử lý ảnh quá lâu." }), timeoutMs + 2500);
      activeMainRequest = { token };
      window.addEventListener("message", onMessage);
      const request = {
        source: "TDT_1688_ISOLATED",
        type: MAIN_REQUEST_TYPE,
        token,
        dataUrl: String(dataUrl || ""),
        timeoutMs
      };
      window.postMessage(request, "*");
      retryTimer = setInterval(() => {
        if (!mainAcknowledged && !settled) window.postMessage(request, "*");
      }, 120);
    });
  }

  async function getPendingWithRetry() {
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const response = await runtimeMessage({ type: "TDT_1688_GET_PENDING" });
      if (response?.ok && response.pending?.dataUrl) return response.pending;
      await sleep(attempt < 4 ? 70 : 120 + attempt * 8);
    }
    return null;
  }

  async function waitForResultOrFail(startedAt, requestId) {
    while (Date.now() - startedAt < MAX_WAIT_MS) {
      if (isResultPage()) {
        await runtimeMessage({ type: "TDT_1688_RESULT_READY" });
        return true;
      }
      const status = await runtimeMessage({ type: "TDT_1688_RESULT_STATUS", requestId });
      if (status?.ok && status.ready) return true;
      await sleep(180);
    }
    return false;
  }

  async function uploadPendingImage() {
    pending = await getPendingWithRetry();
    if (!pending?.dataUrl) return;
    const startedAt = Date.now();
    const uploaded = await uploadInMainWorld(pending.dataUrl, 20_000);
    if (!uploaded.ok) {
      createFailurePanel(uploaded.error || "1688 chưa nhận được file ảnh.");
      await runtimeMessage({ type: "TDT_1688_UPLOAD_STATUS", status: "failed", error: uploaded.error || "1688 chưa nhận được file ảnh." });
      return;
    }
    const resultReady = await waitForResultOrFail(startedAt, pending.requestId);
    if (resultReady) return;
    createFailurePanel("Ảnh đã tải lên nhưng 1688 chưa mở trang kết quả. Bấm Thử tìm kiếm lại.");
    await runtimeMessage({
      type: "TDT_1688_UPLOAD_STATUS",
      status: "failed",
      error: "1688 không chuyển sang trang kết quả sau khi gửi ảnh."
    });
  }

  void uploadPendingImage().catch(async (error) => {
    const message = error?.message || "Không thể tải và tìm ảnh trên 1688.";
    createFailurePanel(message);
    await runtimeMessage({ type: "TDT_1688_UPLOAD_STATUS", status: "failed", error: message });
  });
})();
