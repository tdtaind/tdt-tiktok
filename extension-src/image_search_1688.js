(() => {
  "use strict";

  const IS_TIKTOK_SHOP = location.hostname === "shop.tiktok.com" || location.hostname.endsWith(".shop.tiktok.com");
  const IS_TOP_FRAME = window.top === window.self;
  if ((!IS_TOP_FRAME && !IS_TIKTOK_SHOP) || globalThis.__TDT_1688_IMAGE_SEARCH_V300__) return;
  globalThis.__TDT_1688_IMAGE_SEARCH_V300__ = true;

  const SEARCH_EVENT = "tdt-1688-search-request";
  const MIN_VIDEO_WIDTH = 220;
  const MIN_VIDEO_HEIGHT = 220;
  const MAX_IMAGE_EDGE = 1280;
  const JPEG_QUALITY = 0.86;
  const TARGET_SCAN_INTERVAL_MS = 5000;
  const POSITION_EPSILON = 1;
  const SHOP_IMAGE_SCAN_LIMIT = 900;
  const SHOP_BACKGROUND_SCAN_LIMIT = 160;
  const SHOP_RESCAN_INTERVAL_MS = 9000;

  let host = null;
  let shadow = null;
  let videoButton = null;
  let toast = null;
  let currentVideo = null;
  let busy = false;
  let positionFrame = 0;
  let scanTimer = null;
  let toastTimer = null;
  let imageScanTimer = null;
  let lastRect = null;
  let imageObserver = null;
  let imageIdleHandle = 0;
  let videoTargetDirty = true;
  const pendingImageRoots = new Set();

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

  function createUi() {
    if (host?.isConnected) return;
    host = document.createElement("div");
    host.id = "tdt-1688-video-search-host";
    host.style.cssText = "all:initial;position:fixed;left:0;top:0;width:0;height:0;z-index:2147483645;pointer-events:none;display:none;";
    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        #search {
          pointer-events:auto; position:fixed; left:0; top:0; display:grid; place-items:center;
          width:31px; height:31px; padding:0; border:1px solid rgba(255,255,255,.66);
          border-radius:9px; color:#fff; background:linear-gradient(145deg,#ff7a00,#f45100);
          box-shadow:0 5px 16px rgba(0,0,0,.34); cursor:pointer; user-select:none;
          font:900 8px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          transform:translate3d(-9999px,-9999px,0); transition:filter .14s ease,box-shadow .14s ease,opacity .14s ease,transform .12s ease;
          opacity:.96; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
        }
        #search:hover { filter:brightness(1.1); box-shadow:0 7px 20px rgba(0,0,0,.42); opacity:1; }
        #search:active { transform:translate3d(var(--x),var(--y),0) scale(.94); }
        #search[disabled] { cursor:progress; opacity:.7; }
        .mark { display:block; letter-spacing:-.45px; }
        .spinner { display:none; width:13px; height:13px; border:2px solid rgba(255,255,255,.4); border-top-color:#fff; border-radius:50%; animation:spin .72s linear infinite; }
        #search.busy .mark { display:none; }
        #search.busy .spinner { display:block; }
        #toast {
          pointer-events:none; position:fixed; left:50%; bottom:28px; transform:translateX(-50%) translateY(12px);
          max-width:min(460px,calc(100vw - 32px)); padding:11px 15px; border-radius:12px;
          color:#fff; background:rgba(18,18,20,.94); border:1px solid rgba(255,255,255,.18);
          box-shadow:0 12px 34px rgba(0,0,0,.38); opacity:0; transition:opacity .18s ease,transform .18s ease;
          font:600 13px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; text-align:center;
          backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
        }
        #toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
        #toast.error { background:rgba(123,20,31,.96); }
        @keyframes spin { to { transform:rotate(360deg); } }
        @media (prefers-reduced-motion:reduce) { #search,#toast { transition:none!important; } .spinner { animation-duration:1.2s; } }
      </style>
      <button id="search" type="button" title="Tìm khung hình trên 1688 · phím F" aria-label="Tìm khung hình video trên 1688">
        <span class="mark">1688</span><span class="spinner"></span>
      </button>
      <div id="toast" role="status" aria-live="polite"></div>
    `;
    videoButton = shadow.getElementById("search");
    toast = shadow.getElementById("toast");
    videoButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void searchCurrentFrame();
    });
    document.documentElement.appendChild(host);
  }

  function showToast(message, isError = false, duration = 3400) {
    createUi();
    clearTimeout(toastTimer);
    toast.textContent = String(message || "");
    toast.classList.toggle("error", Boolean(isError));
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast?.classList.remove("show"), duration);
  }

  function videoScore(video) {
    if (!(video instanceof HTMLVideoElement) || !video.isConnected) return -Infinity;
    const rect = video.getBoundingClientRect();
    if (rect.width < MIN_VIDEO_WIDTH || rect.height < MIN_VIDEO_HEIGHT) return -Infinity;
    if (rect.bottom < 0 || rect.right < 0 || rect.top > innerHeight || rect.left > innerWidth) return -Infinity;
    const style = getComputedStyle(video);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) < 0.05) return -Infinity;
    const visibleWidth = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
    const visibleHeight = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
    const visibleArea = visibleWidth * visibleHeight;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(centerX - innerWidth / 2, centerY - innerHeight / 2);
    let score = visibleArea - distance * 40;
    if (!video.paused && !video.ended) score += 2_000_000;
    if (video.closest("#tdt-lightdom-player")) score += 4_000_000;
    if (video.dataset.tdtReplacement === "true" || video.classList.contains("tdt-replacement-video")) score += 3_000_000;
    return score;
  }

  function findBestVideo() {
    let best = null;
    let bestScore = -Infinity;
    for (const candidate of document.querySelectorAll("video")) {
      const score = videoScore(candidate);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  }

  function hasIntegratedControlButton() {
    try {
      const extensionHost = document.getElementById("tdt-tiktok-extension-host");
      return Boolean(extensionHost?.shadowRoot?.querySelector(".tdt-1688-control-button"));
    } catch (_error) {
      return false;
    }
  }

  function rectChanged(rect) {
    if (!lastRect) return true;
    return ["left", "top", "width", "height"].some((key) => Math.abs(Number(rect[key]) - Number(lastRect[key])) > POSITION_EPSILON);
  }

  function positionButton() {
    positionFrame = 0;
    if (!host?.isConnected || !videoButton || !currentVideo?.isConnected) {
      if (host) host.style.display = "none";
      return;
    }
    const rect = currentVideo.getBoundingClientRect();
    if (videoScore(currentVideo) === -Infinity || hasIntegratedControlButton()) {
      host.style.display = "none";
      return;
    }
    host.style.display = "block";
    if (!rectChanged(rect)) return;
    const x = Math.max(8, Math.min(innerWidth - 39, rect.right - 39));
    const y = Math.max(8, Math.min(innerHeight - 39, rect.bottom - 48));
    videoButton.style.setProperty("--x", `${Math.round(x)}px`);
    videoButton.style.setProperty("--y", `${Math.round(y)}px`);
    videoButton.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
    lastRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }

  function schedulePosition() {
    if (positionFrame) return;
    positionFrame = requestAnimationFrame(positionButton);
  }

  function refreshTarget(force = false) {
    const currentValid = currentVideo instanceof HTMLVideoElement && videoScore(currentVideo) !== -Infinity;
    if (force || videoTargetDirty || !currentValid) {
      const best = findBestVideo();
      if (best !== currentVideo) {
        currentVideo = best;
        lastRect = null;
      }
      videoTargetDirty = false;
    }
    schedulePosition();
  }

  function canvasToDataUrl(canvas, type = "image/jpeg", quality = JPEG_QUALITY) {
    return new Promise((resolve, reject) => {
      if (typeof canvas.toBlob !== "function") {
        try { resolve(canvas.toDataURL(type, quality)); } catch (error) { reject(error); }
        return;
      }
      canvas.toBlob((blob) => {
        if (!blob) {
          try { resolve(canvas.toDataURL(type, quality)); } catch (error) { reject(error); }
          return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error("Không mã hóa được ảnh."));
        reader.onload = () => resolve(String(reader.result || ""));
        reader.readAsDataURL(blob);
      }, type, quality);
    });
  }

  async function drawVideoFrame(video) {
    if (!(video instanceof HTMLVideoElement) || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      throw new Error("Video chưa tải đủ để chụp hình.");
    }
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false, willReadFrequently: false });
    if (!context) throw new Error("Trình duyệt không tạo được ảnh chụp.");
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, height);
    context.drawImage(video, 0, 0, width, height);
    return await canvasToDataUrl(canvas);
  }

  async function drawImageElement(image) {
    if (!(image instanceof HTMLImageElement) || !image.complete || !image.naturalWidth || !image.naturalHeight) {
      throw new Error("Ảnh sản phẩm chưa tải xong.");
    }
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Không tạo được ảnh tìm kiếm.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return await canvasToDataUrl(canvas);
  }

  async function cropVisibleScreenshot(screenshotDataUrl, element) {
    const image = new Image();
    image.decoding = "async";
    image.src = screenshotDataUrl;
    await image.decode();
    const rect = element.getBoundingClientRect();
    const scaleX = image.naturalWidth / Math.max(1, innerWidth);
    const scaleY = image.naturalHeight / Math.max(1, innerHeight);
    const sourceX = Math.max(0, Math.round(rect.left * scaleX));
    const sourceY = Math.max(0, Math.round(rect.top * scaleY));
    const sourceWidth = Math.max(1, Math.min(image.naturalWidth - sourceX, Math.round(rect.width * scaleX)));
    const sourceHeight = Math.max(1, Math.min(image.naturalHeight - sourceY, Math.round(rect.height * scaleY)));
    const outputScale = Math.min(1, MAX_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight));
    const outputWidth = Math.max(1, Math.round(sourceWidth * outputScale));
    const outputHeight = Math.max(1, Math.round(sourceHeight * outputScale));
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Không xử lý được ảnh chụp màn hình.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, outputWidth, outputHeight);
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
    return await canvasToDataUrl(canvas);
  }

  async function captureElement(element) {
    try {
      if (element instanceof HTMLVideoElement) {
        const direct = await drawVideoFrame(element);
        if (direct.length > 1200) return direct;
      } else if (element instanceof HTMLImageElement) {
        const direct = await drawImageElement(element);
        if (direct.length > 1200) return direct;
      }
    } catch (_error) {
      // Cross-origin media can taint canvas. Use a visible-tab crop below.
    }
    const captured = await runtimeMessage({ type: "TDT_1688_CAPTURE_VISIBLE_TAB" });
    if (!captured?.ok || !captured.dataUrl) {
      throw new Error(captured?.error || "Không chụp được hình ảnh đang hiển thị.");
    }
    return cropVisibleScreenshot(captured.dataUrl, element);
  }

  function setBusy(nextBusy) {
    busy = Boolean(nextBusy);
    if (videoButton) {
      videoButton.disabled = busy;
      videoButton.classList.toggle("busy", busy);
    }
    document.dispatchEvent(new CustomEvent("tdt-1688-search-status", {
      detail: { busy }
    }));
  }

  async function submitImageSearch(payload, fallbackElement = null) {
    if (busy) return null;
    setBusy(true);
    try {
      let response = await runtimeMessage({
        type: "TDT_1688_SEARCH_IMAGE",
        sourceUrl: location.href,
        ...payload
      });
      if (!response?.ok && fallbackElement) {
        const dataUrl = await captureElement(fallbackElement);
        response = await runtimeMessage({
          type: "TDT_1688_SEARCH_IMAGE",
          dataUrl,
          sourceUrl: location.href,
          sourceKind: payload.sourceKind || "product-image-fallback"
        });
      }
      if (!response?.ok) throw new Error(response?.error || "Không mở được tìm kiếm 1688.");
      showToast("Đang tìm trực tiếp trên 1688. Tab kết quả sẽ tự mở khi xử lý xong.");
      return response;
    } catch (error) {
      showToast(error?.message || "Tìm kiếm hình ảnh thất bại.", true, 4700);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function searchCurrentFrame() {
    videoTargetDirty = true;
    refreshTarget(true);
    const target = currentVideo;
    if (!(target instanceof HTMLVideoElement)) {
      showToast("Không tìm thấy video đang hiển thị.", true);
      return;
    }
    let dataUrl;
    try {
      setBusy(true);
      dataUrl = await captureElement(target);
    } catch (error) {
      setBusy(false);
      showToast(error?.message || "Không chụp được khung hình video.", true, 4500);
      return;
    }
    setBusy(false);
    await submitImageSearch({
      dataUrl,
      sourceKind: "video-frame",
      videoTime: Number.isFinite(target.currentTime) ? target.currentTime : 0
    });
  }

  function normalizeImageUrl(image) {
    if (!(image instanceof HTMLImageElement)) return "";
    const raw = String(image.currentSrc || image.src || image.getAttribute("src") || "").trim();
    if (!raw) return "";
    if (raw.startsWith("//")) return `${location.protocol}${raw}`;
    try { return new URL(raw, location.href).href; } catch (_error) { return raw; }
  }

  async function searchProductImage(imageUrl, fallbackElement = null, sourceKind = "tiktok-shop-image") {
    const normalized = String(imageUrl || "").trim();
    if (/^https?:\/\//i.test(normalized)) {
      await submitImageSearch({ imageUrl: normalized, sourceKind }, fallbackElement);
      return;
    }
    if (fallbackElement) {
      const dataUrl = await captureElement(fallbackElement);
      await submitImageSearch({ dataUrl, sourceKind }, null);
      return;
    }
    showToast("Không lấy được liên kết ảnh sản phẩm.", true);
  }

  function installShopImageStyles() {
    if (document.getElementById("tdt-1688-shop-image-style")) return;
    const style = document.createElement("style");
    style.id = "tdt-1688-shop-image-style";
    style.textContent = `
      .tdt-1688-image-container{position:relative!important}
      .tdt-1688-image-search-btn{position:absolute!important;top:6px!important;right:6px!important;z-index:2147483000!important;display:grid!important;place-items:center!important;width:29px!important;height:29px!important;padding:0!important;border:1px solid rgba(255,255,255,.72)!important;border-radius:9px!important;color:#fff!important;background:linear-gradient(145deg,#ff7a00,#f45100)!important;box-shadow:0 5px 15px rgba(0,0,0,.34)!important;font:900 7px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;letter-spacing:-.35px!important;cursor:pointer!important;opacity:.94!important;visibility:visible!important;pointer-events:auto!important;transition:transform .14s ease,filter .14s ease,opacity .14s ease!important}
      .tdt-1688-image-search-btn:hover{filter:brightness(1.1)!important;transform:scale(1.06)!important;opacity:1!important}
      .tdt-1688-image-search-btn:active{transform:scale(.94)!important}
      .tdt-1688-image-search-btn[disabled]{cursor:progress!important;opacity:.62!important}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function imageLooksLikeProduct(image) {
    if (!(image instanceof HTMLImageElement) || image.dataset.tdt1688Processed === "1") return false;
    const rect = image.getBoundingClientRect();
    const width = Math.max(rect.width, Number(image.width) || 0);
    const height = Math.max(rect.height, Number(image.height) || 0);
    if (width < 74 || height < 74 || width > 1600 || height > 1600) return false;
    const ratio = width / Math.max(1, height);
    if (ratio < 0.48 || ratio > 2.1) return false;
    const descriptor = `${image.alt || ""} ${image.className || ""} ${image.id || ""} ${normalizeImageUrl(image)}`.toLowerCase();
    if (/avatar|profile|logo|icon|emoji|badge|flag|qrcode|qr-code|sprite/.test(descriptor)) return false;
    const anchor = image.closest("a[href]");
    const href = String(anchor?.href || "").toLowerCase();
    const context = image.closest('[data-e2e*="product" i],[class*="product" i],[class*="goods" i],[class*="item-card" i],[class*="product-card" i],article,li');
    const contextText = String(context?.textContent || "").slice(0, 700).toLowerCase();
    const explicitProduct = /\/product\b|\/view\/product\b|product_id=|productid=|goods/.test(href)
      || Boolean(image.closest('[data-e2e*="product" i],[class*="product-card" i],[class*="product-item" i],[class*="goods-card" i]'));
    if (IS_TIKTOK_SHOP) {
      // TikTok Shop changes card class names frequently. On the dedicated Shop host,
      // every sufficiently large non-UI image is a useful product-search target.
      return width >= 64 && height >= 64;
    }
    return explicitProduct || /tiktok shop|mở trên tiktok shop/.test(contextText);
  }

  function buttonContainerForImage(image) {
    let container = image.parentElement;
    if (container?.tagName === "PICTURE") container = container.parentElement || container;
    if (!(container instanceof HTMLElement)) return null;
    const display = getComputedStyle(container).display;
    if (display === "inline") {
      container.style.setProperty("display", "inline-block", "important");
      container.style.setProperty("line-height", "0", "important");
    }
    return container;
  }

  function decorateProductImage(image) {
    if (!imageLooksLikeProduct(image)) return false;
    const container = buttonContainerForImage(image);
    if (!container) return false;
    image.dataset.tdt1688Processed = "1";
    container.classList.add("tdt-1688-image-container");
    const existing = Array.from(container.children).find((child) => child instanceof HTMLElement && child.classList.contains("tdt-1688-image-search-btn"));
    if (existing) return false;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tdt-1688-image-search-btn";
    button.textContent = "1688";
    button.title = "Tìm ảnh sản phẩm này trên 1688";
    button.setAttribute("aria-label", "Tìm ảnh sản phẩm này trên 1688");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void searchProductImage(normalizeImageUrl(image), image, "tiktok-shop-page-image");
    }, true);
    container.appendChild(button);
    return true;
  }


  function parseBackgroundImageUrl(element) {
    if (!(element instanceof HTMLElement)) return "";
    const value = String(getComputedStyle(element).backgroundImage || element.style.backgroundImage || "");
    const match = value.match(/url\(["']?(.+?)["']?\)/i);
    if (!match?.[1] || match[1].startsWith("data:image/svg")) return "";
    try { return new URL(match[1], location.href).href; } catch (_error) { return match[1]; }
  }

  function decorateBackgroundProduct(element) {
    if (!IS_TIKTOK_SHOP || !(element instanceof HTMLElement) || element.dataset.tdt1688BgProcessed === "1") return false;
    const rect = element.getBoundingClientRect();
    if (rect.width < 74 || rect.height < 74 || rect.width > 1600 || rect.height > 1600) return false;
    const imageUrl = parseBackgroundImageUrl(element);
    if (!/^https?:\/\//i.test(imageUrl)) return false;
    const descriptor = `${element.className || ""} ${element.id || ""} ${imageUrl}`.toLowerCase();
    if (/avatar|profile|logo|icon|emoji|badge|flag|qrcode|qr-code|sprite/.test(descriptor)) return false;
    element.dataset.tdt1688BgProcessed = "1";
    element.classList.add("tdt-1688-image-container");
    if (Array.from(element.children).some((child) => child instanceof HTMLElement && child.classList.contains("tdt-1688-image-search-btn"))) return false;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tdt-1688-image-search-btn";
    button.textContent = "1688";
    button.title = "Tìm ảnh sản phẩm này trên 1688";
    button.setAttribute("aria-label", "Tìm ảnh sản phẩm này trên 1688");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void searchProductImage(imageUrl, element, "tiktok-shop-background-image");
    }, true);
    element.appendChild(button);
    return true;
  }

  function scanShopImages(root = document) {
    installShopImageStyles();
    const candidates = [];
    if (root instanceof HTMLImageElement) candidates.push(root);
    if (root?.querySelectorAll) {
      const selector = IS_TIKTOK_SHOP
        ? "img"
        : '[data-e2e*="product" i] img,[class*="product-card" i] img,[class*="product-item" i] img,[class*="goods-card" i] img,a[href*="/product"] img';
      root.querySelectorAll(selector).forEach((image) => {
        if (candidates.length < SHOP_IMAGE_SCAN_LIMIT) candidates.push(image);
      });
    }
    let decorated = 0;
    for (const image of candidates) {
      if (decorateProductImage(image)) decorated += 1;
    }
    if (IS_TIKTOK_SHOP && root?.querySelectorAll) {
      let count = 0;
      for (const element of root.querySelectorAll("[style*='background-image'],[class*='product'],[class*='goods'],[class*='item']")) {
        if (count >= SHOP_BACKGROUND_SCAN_LIMIT) break;
        count += 1;
        if (decorateBackgroundProduct(element)) decorated += 1;
      }
    }
    return decorated;
  }

  function flushShopImageScans(deadline = null) {
    imageScanTimer = null;
    imageIdleHandle = 0;
    if (document.hidden) {
      pendingImageRoots.clear();
      return;
    }
    const roots = pendingImageRoots.has(document) ? [document] : Array.from(pendingImageRoots).slice(0, 32);
    pendingImageRoots.clear();
    for (const root of roots) scanShopImages(root);
  }

  function scheduleShopImageScan(root = document, delay = 100) {
    if (root === document) {
      pendingImageRoots.clear();
      pendingImageRoots.add(document);
    } else if (!pendingImageRoots.has(document) && root) {
      pendingImageRoots.add(root);
      if (pendingImageRoots.size > 32) {
        pendingImageRoots.clear();
        pendingImageRoots.add(document);
      }
    }
    if (imageScanTimer || imageIdleHandle) return;
    imageScanTimer = setTimeout(() => {
      imageScanTimer = null;
      if (typeof requestIdleCallback === "function") {
        imageIdleHandle = requestIdleCallback(flushShopImageScans, { timeout: 500 });
      } else {
        flushShopImageScans();
      }
    }, Math.max(0, delay));
  }

  document.addEventListener(SEARCH_EVENT, (event) => {
    const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
    if (detail.kind === "image" || detail.imageUrl) {
      void searchProductImage(String(detail.imageUrl || ""), null, String(detail.sourceKind || "scanned-product-image"));
      return;
    }
    void searchCurrentFrame();
  });

  if (IS_TOP_FRAME) {
    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable) return;
      const code = String(event.code || "");
      const key = String(event.key || "").toLowerCase();
      if (code !== "KeyF" && key !== "f") return;
      event.preventDefault();
      event.stopPropagation();
      void searchCurrentFrame();
    }, true);
  }

  if (IS_TOP_FRAME) {
    createUi();
    refreshTarget();
  }
  scanShopImages(document);

  scanTimer = setInterval(() => {
    if (!document.hidden && IS_TOP_FRAME) {
      if (!(currentVideo instanceof HTMLVideoElement) || videoScore(currentVideo) === -Infinity) videoTargetDirty = true;
      refreshTarget();
    }
    if (IS_TIKTOK_SHOP && !document.hidden) scheduleShopImageScan(document, 0);
  }, IS_TIKTOK_SHOP ? SHOP_RESCAN_INTERVAL_MS : TARGET_SCAN_INTERVAL_MS);

  imageObserver = new MutationObserver((records) => {
    let needsVideoRefresh = false;
    const imageRoots = new Set();
    for (const record of records) {
      if (record.type === "attributes" && record.target instanceof HTMLImageElement) imageRoots.add(record.target);
      for (const node of record.addedNodes || []) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.("video,#tdt-lightdom-player") || node.querySelector?.("video,#tdt-lightdom-player")) needsVideoRefresh = true;
        const embeddedProductSelector = '[data-e2e*="product" i],[class*="product-card" i],[class*="product-item" i],[class*="goods-card" i],a[href*="/product"]';
        if (IS_TIKTOK_SHOP) {
          if (node.matches?.("img") || node.querySelector?.("img")) imageRoots.add(node);
        } else if (node.matches?.(embeddedProductSelector) || node.closest?.(embeddedProductSelector) || node.querySelector?.(`${embeddedProductSelector} img`)) {
          imageRoots.add(node);
        }
      }
    }
    if (needsVideoRefresh) { videoTargetDirty = true; refreshTarget(); }
    for (const root of imageRoots) scheduleShopImageScan(root);
  });
  imageObserver.observe(document.documentElement, IS_TIKTOK_SHOP
    ? { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "srcset"] }
    : { childList: true, subtree: true });

  document.addEventListener("load", (event) => {
    if (!(event.target instanceof HTMLImageElement)) return;
    if (IS_TIKTOK_SHOP || imageLooksLikeProduct(event.target)) scheduleShopImageScan(event.target, 40);
  }, true);
  window.addEventListener("resize", () => { if (IS_TOP_FRAME) schedulePosition(); scheduleShopImageScan(document, 160); }, { passive: true });
  if (IS_TOP_FRAME) window.addEventListener("scroll", schedulePosition, { passive: true, capture: true });
  if (IS_TOP_FRAME) {
    document.addEventListener("play", (event) => {
      if (event.target instanceof HTMLVideoElement) {
        currentVideo = event.target;
        videoTargetDirty = false;
        lastRect = null;
        schedulePosition();
      }
    }, true);
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      if (IS_TOP_FRAME) refreshTarget();
      scheduleShopImageScan(document, 0);
    }
  });
  window.addEventListener("pagehide", () => {
    clearInterval(scanTimer);
    clearTimeout(toastTimer);
    clearTimeout(imageScanTimer);
    if (imageIdleHandle && typeof cancelIdleCallback === "function") cancelIdleCallback(imageIdleHandle);
    pendingImageRoots.clear();
    if (positionFrame) cancelAnimationFrame(positionFrame);
    imageObserver?.disconnect();
    host?.remove();
  }, { once: true });
})();
