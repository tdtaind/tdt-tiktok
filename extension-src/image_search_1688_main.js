(() => {
  "use strict";

  if (window.top !== window.self || globalThis.__TDT_1688_MAIN_UPLOAD_V3__) return;

  function isUploadSessionPage() {
    try {
      const url = new URL(location.href);
      return url.searchParams.get("tdtImageSearch") === "1" || Boolean(url.searchParams.get("tdtRequest"));
    } catch (_error) {
      return false;
    }
  }

  function isImageResultUrl(rawUrl = location.href) {
    try {
      const url = new URL(String(rawUrl || ""), location.href);
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

  // Ordinary 1688 tabs must remain untouched. Only the hidden uploader tab
  // created by the extension carries one of these query markers.
  if (!isUploadSessionPage()) return;
  globalThis.__TDT_1688_MAIN_UPLOAD_V3__ = true;

  const REQUEST_TYPE = "TDT_1688_MAIN_UPLOAD_REQUEST_V1";
  const RESPONSE_TYPE = "TDT_1688_MAIN_UPLOAD_RESPONSE_V1";
  const DEFAULT_TIMEOUT_MS = 18_000;
  const QUICK_PREVIEW_WAIT_MS = 1_150;
  let activeToken = "";

  function respond(token, status, extra = {}) {
    window.postMessage({
      source: "TDT_1688_MAIN",
      type: RESPONSE_TYPE,
      token,
      status,
      ...extra
    }, "*");
  }

  function dataUrlToFile(dataUrl, filename = "tdt-1688-product.jpg") {
    const value = String(dataUrl || "");
    const comma = value.indexOf(",");
    if (comma < 0 || !/^data:image\//i.test(value)) throw new Error("Dữ liệu ảnh không hợp lệ.");
    const header = value.slice(0, comma);
    const mime = header.match(/^data:([^;,]+)/i)?.[1] || "image/jpeg";
    const binary = atob(value.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mime, lastModified: Date.now() });
  }

  function inputAcceptsImages(input) {
    if (!(input instanceof HTMLInputElement) || input.type !== "file" || input.disabled) return false;
    const accept = String(input.accept || "").toLowerCase();
    return !accept || /image|jpg|jpeg|png|bmp|webp/.test(accept);
  }

  function uploaderScore(input) {
    if (!inputAcceptsImages(input)) return -Infinity;
    let score = 0;
    if (input.id === "img-search-upload") score += 500;
    if (input.classList.contains("image-file-reader-wrapper")) score += 320;
    const owner = input.closest("[data-spm='imageUpload'],.search-image-upload-container,.image-upload-button-container,[class*='image-upload'],[class*='imageUpload']");
    if (owner) score += 220;
    const accept = String(input.accept || "").toLowerCase();
    if (/jpg|jpeg|png|bmp|webp/.test(accept)) score += 80;
    if (input.multiple) score += 20;
    if (input.closest(".insight-screenshot-upload,[class*='feedback'],[class*='avatar']")) score -= 600;
    return score;
  }

  function findUploader() {
    const candidates = Array.from(document.querySelectorAll('input[type="file"]')).filter(inputAcceptsImages);
    candidates.sort((a, b) => uploaderScore(b) - uploaderScore(a));
    return candidates[0] || null;
  }

  function getReactProps(element) {
    if (!element) return null;
    const key = Object.keys(element).find((name) => name.startsWith("__reactProps$") || name.startsWith("__reactEventHandlers$"));
    return key ? element[key] : null;
  }

  function syntheticFrameworkEvent(type, input, nativeEvent, transfer) {
    let defaultPrevented = false;
    let propagationStopped = false;
    return {
      type,
      target: input,
      currentTarget: input,
      nativeEvent,
      dataTransfer: transfer,
      clipboardData: transfer,
      bubbles: true,
      cancelable: true,
      defaultPrevented: false,
      eventPhase: 3,
      isTrusted: false,
      timeStamp: Date.now(),
      preventDefault() { defaultPrevented = true; this.defaultPrevented = true; },
      stopPropagation() { propagationStopped = true; },
      isDefaultPrevented() { return defaultPrevented; },
      isPropagationStopped() { return propagationStopped; },
      persist() {}
    };
  }

  function invokeFrameworkUploadHandlers(input, transfer, inputEvent, changeEvent) {
    let invoked = false;
    const visited = new Set();
    let node = input;
    for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
      const props = getReactProps(node);
      if (!props || visited.has(props)) continue;
      visited.add(props);
      const handlers = [
        ["onInput", syntheticFrameworkEvent("input", input, inputEvent, transfer)],
        ["onChange", syntheticFrameworkEvent("change", input, changeEvent, transfer)]
      ];
      for (const [name, event] of handlers) {
        if (typeof props[name] !== "function") continue;
        try { props[name](event); invoked = true; } catch (_error) { /* compatibility path */ }
      }
    }
    return invoked;
  }

  function assignInputFile(input, transfer, invokeFramework = false) {
    const filesSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files")?.set;
    if (filesSetter) filesSetter.call(input, transfer.files);
    else input.files = transfer.files;

    const inputEvent = new Event("input", { bubbles: true, composed: true, cancelable: true });
    const changeEvent = new Event("change", { bubbles: true, composed: true, cancelable: true });
    input.dispatchEvent(inputEvent);
    input.dispatchEvent(changeEvent);

    if (invokeFramework) invokeFrameworkUploadHandlers(input, transfer, inputEvent, changeEvent);
    return { inputEvent, changeEvent, fileCount: input.files?.length || 0 };
  }

  function dispatchDropFallback(input, transfer) {
    const target = input.closest(".image-upload-button-container,.search-image-upload-container,[data-spm='imageUpload'],label,[class*='image-upload']")
      || input.parentElement;
    if (!(target instanceof HTMLElement) || typeof DragEvent !== "function") return false;
    try {
      for (const type of ["dragenter", "dragover", "drop"]) {
        target.dispatchEvent(new DragEvent(type, {
          bubbles: true,
          composed: true,
          cancelable: true,
          dataTransfer: transfer
        }));
      }
      return true;
    } catch (_error) {
      return false;
    }
  }

  function dispatchPasteFallback(transfer) {
    try {
      let pasteEvent;
      try {
        pasteEvent = new ClipboardEvent("paste", { bubbles: true, composed: true, cancelable: true, clipboardData: transfer });
      } catch (_error) {
        pasteEvent = new Event("paste", { bubbles: true, composed: true, cancelable: true });
        Object.defineProperty(pasteEvent, "clipboardData", { value: transfer });
      }
      document.dispatchEvent(pasteEvent);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 3 && rect.height > 3;
  }

  function normalizedText(element) {
    return String(element?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function previewImages(scope) {
    if (!(scope instanceof HTMLElement)) return [];
    return Array.from(scope.querySelectorAll("img")).filter((image) => {
      if (!(image instanceof HTMLImageElement) || !isVisible(image)) return false;
      const rect = image.getBoundingClientRect();
      const src = String(image.currentSrc || image.src || "");
      const loaded = image.complete !== false && (Number(image.naturalWidth || 0) > 0 || /^(data:image\/|blob:|https?:)/i.test(src));
      return loaded && rect.width >= 36 && rect.height >= 36 && rect.width * rect.height >= 1800;
    });
  }

  function findSubmitButton() {
    const exactSelectors = [
      "[data-tracker='pasteImagePreview']",
      "[data-trackercn='粘贴图片预览']",
      "[data-aplus-report*='pasteImagePreview']",
      ".copy-image-container .search-btn",
      "[class*='copy-image'] .search-btn",
      "[class*='popover'] button",
      "[class*='popover'] [role='button']",
      "[role='dialog'] button",
      "[role='dialog'] [role='button']"
    ];
    const seen = new Set();
    const candidates = [];
    for (const selector of exactSelectors) {
      for (const candidate of document.querySelectorAll(selector)) {
        if (!seen.has(candidate)) { seen.add(candidate); candidates.push(candidate); }
      }
    }
    for (const candidate of document.querySelectorAll("button,[role='button'],a,div,span")) {
      if (!seen.has(candidate)) { seen.add(candidate); candidates.push(candidate); }
    }

    let winner = null;
    let winnerScore = -Infinity;
    for (const element of candidates) {
      if (!(element instanceof HTMLElement) || !isVisible(element) || element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") continue;
      const text = normalizedText(element);
      if (!/^(搜索图片|图片搜索|搜索同款|搜同款|以图搜款|tìm kiếm hình ảnh|search image|search images)$/.test(text)) continue;

      let score = 0;
      if (element.matches("[data-tracker='pasteImagePreview'],[data-trackercn='粘贴图片预览'],[data-aplus-report*='pasteImagePreview']")) score += 600;
      if (/^(搜索图片|图片搜索|tìm kiếm hình ảnh|search image|search images)$/.test(text)) score += 280;
      if (element.classList.contains("search-btn")) score += 180;
      const semanticOwner = element.closest("[role='dialog'],[class*='popover'],[class*='modal'],[class*='copy-image'],[class*='image-search'],[class*='imageSearch']");
      if (semanticOwner) score += 140;
      let node = element.parentElement;
      for (let depth = 0; node instanceof HTMLElement && depth < 8; depth += 1, node = node.parentElement) {
        if (previewImages(node).length) { score += 220 - depth * 10; break; }
      }
      // The large top-level camera launcher uses the same text on some 1688
      // layouts. It is never the submit button unless a preview is nearby.
      if (/^(以图搜款|搜同款)$/.test(text) && score < 300) continue;
      if (score > winnerScore) { winnerScore = score; winner = element; }
    }
    return winner;
  }

  function previewScopeScore(scope, submit) {
    if (!(scope instanceof HTMLElement) || !isVisible(scope)) return -Infinity;
    const images = previewImages(scope);
    if (!images.length) return -Infinity;
    const text = normalizedText(scope);
    let score = images.length * 100;
    if (submit && scope.contains(submit)) score += 320;
    if (/帮你找同款|找同款|粘贴图片|ctrl\s*\+\s*v|图片已上传|已上传\s*\d*\s*张图片|一张图片已上传|một hình ảnh đã được tải lên|image uploaded|đã tải lên/.test(text)) score += 220;
    if (scope.matches("[role='dialog'],[class*='popover'],[class*='modal'],[class*='copy-image'],[class*='image-search'],[class*='imageSearch']")) score += 130;
    const rect = scope.getBoundingClientRect();
    if (rect.width <= 620 && rect.height <= 720) score += 60;
    return score;
  }

  function findPreviewScope(submit) {
    const candidates = [];
    const add = (node) => {
      if (node instanceof HTMLElement && !candidates.includes(node)) candidates.push(node);
    };
    add(submit?.closest?.("[role='dialog'],[class*='popover'],[class*='modal'],[class*='image-search'],[class*='imageSearch'],[class*='copy-image'],[class*='upload']"));
    let node = submit?.parentElement || null;
    for (let depth = 0; node instanceof HTMLElement && depth < 10; depth += 1, node = node.parentElement) add(node);
    for (const selector of [
      ".copy-image-container,[class*='copy-image-container']",
      "[role='dialog']",
      "[class*='popover']",
      "[class*='image-search'],[class*='imageSearch']",
      "[data-spm='imageUpload']"
    ]) {
      for (const candidate of document.querySelectorAll(selector)) add(candidate);
    }
    let winner = null;
    let winnerScore = -Infinity;
    for (const candidate of candidates) {
      const score = previewScopeScore(candidate, submit);
      if (score > winnerScore) { winnerScore = score; winner = candidate; }
    }
    return winner;
  }

  function getPreviewState() {
    const submit = findSubmitButton();
    const scope = findPreviewScope(submit);
    const text = normalizedText(scope);
    const uploadedMatch = text.match(/(?:已上传\s*(\d+)\s*张图片|上传图片\s*\(?\s*(\d+)\s*\/|(?:uploaded|đã tải lên)\s*(\d+)?)/i);
    const uploadedCount = Number(uploadedMatch?.[1] || uploadedMatch?.[2] || uploadedMatch?.[3] || 0);
    const images = previewImages(scope);
    const imageSources = images
      .map((image) => `${String(image.currentSrc || image.src || "")}|${image.naturalWidth || 0}x${image.naturalHeight || 0}`)
      .slice(0, 24);
    const textReady = /帮你找同款|图片已上传|已上传\s*\d*\s*张图片|一张图片已上传|một hình ảnh đã được tải lên|image uploaded|đã tải lên/.test(text);
    const inProgress = /上传中|正在上传|图片处理中|uploading|processing image|đang tải|đang xử lý/.test(text)
      || Boolean(scope?.querySelector?.("[class*='loading'],[class*='spinner'],[aria-busy='true']"));
    const fileCount = Number(findUploader()?.files?.length || 0);
    return {
      ready: Boolean(submit) && Boolean(scope) && (images.length > 0 || textReady || uploadedCount > 0),
      inProgress,
      signature: `${uploadedCount}|${imageSources.join("|")}|${text.slice(0, 260)}`,
      uploadedCount,
      imageCount: images.length,
      fileCount,
      hasSubmit: Boolean(submit)
    };
  }

  function exactClick(element) {
    if (!(element instanceof HTMLElement)) return false;
    const scrollLeft = window.scrollX;
    const scrollTop = window.scrollY;
    try { element.focus({ preventScroll: true }); } catch (_error) { /* ignore */ }
    try {
      element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, cancelable: true, pointerId: 1, pointerType: "mouse", isPrimary: true }));
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true, cancelable: true, button: 0, buttons: 1 }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, composed: true, cancelable: true, button: 0 }));
      HTMLElement.prototype.click.call(element);
    } catch (_error) {
      try { element.click(); } catch (_ignored) { return false; }
    } finally {
      if (Math.abs(window.scrollX - scrollLeft) > 1 || Math.abs(window.scrollY - scrollTop) > 1) window.scrollTo(scrollLeft, scrollTop);
    }
    return true;
  }

  function waitForValue(getValue, timeoutMs, onFirstCheck = null) {
    return new Promise((resolve) => {
      let settled = false;
      let checkQueued = false;
      let observer = null;
      let fallbackTimer = 0;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        clearInterval(fallbackTimer);
        observer?.disconnect();
        resolve(value || null);
      };
      const check = () => {
        checkQueued = false;
        if (settled) return;
        let value = null;
        try { value = getValue(); } catch (_error) { /* keep waiting */ }
        if (value) finish(value);
      };
      const scheduleCheck = () => {
        if (checkQueued || settled) return;
        checkQueued = true;
        queueMicrotask(check);
      };
      const timeoutTimer = setTimeout(() => finish(null), Math.max(1, timeoutMs));
      if (document.documentElement) {
        observer = new MutationObserver(scheduleCheck);
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
          attributeFilter: ["class", "style", "src", "data-src", "disabled", "aria-disabled", "aria-busy"]
        });
      }
      fallbackTimer = setInterval(check, 260);
      check();
      try { onFirstCheck?.(); } catch (_error) { /* optional trigger */ }
      scheduleCheck();
    });
  }

  async function waitForUploader(timeoutMs) {
    const quickWait = Math.min(1_000, timeoutMs);
    const direct = await waitForValue(findUploader, quickWait);
    if (direct) return direct;

    const triggerCandidates = Array.from(document.querySelectorAll(
      ".image-upload-button-container,.search-image-upload-container,[data-spm='imageUpload'],button,[role='button']"
    ));
    const trigger = triggerCandidates.find((element) => {
      if (!(element instanceof HTMLElement) || !isVisible(element)) return false;
      const text = normalizedText(element);
      return element.matches(".image-upload-button-container,.search-image-upload-container,[data-spm='imageUpload']")
        || /^(以图搜款|图片|hình ảnh|image)$/.test(text);
    });
    if (trigger instanceof HTMLElement) exactClick(trigger);
    return waitForValue(findUploader, Math.max(1, timeoutMs - quickWait));
  }

  async function waitForPreview(timeoutMs, initialState) {
    return waitForValue(() => {
      const state = getPreviewState();
      return state.ready && (!initialState?.ready || state.signature !== initialState.signature) ? state : null;
    }, timeoutMs);
  }

  async function waitForSubmitButton(timeoutMs) {
    return waitForValue(findSubmitButton, timeoutMs);
  }

  async function executeUpload(token, dataUrl, timeoutMs) {
    const startedAt = Date.now();
    const originalX = window.scrollX;
    const originalY = window.scrollY;
    const file = dataUrlToFile(dataUrl);
    respond(token, "preparing");

    const input = await waitForUploader(Math.min(3_200, timeoutMs));
    if (!input) throw new Error("Không tìm thấy bộ tải ảnh của 1688.");

    const initialPreview = getPreviewState();
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const assigned = assignInputFile(input, transfer, false);
    respond(token, "file-assigned", { fileCount: assigned.fileCount });

    // The current 1688 UI creates the preview popover very quickly. Detecting
    // that popover directly avoids the old false error while the image was
    // already visible on screen.
    let previewState = await waitForPreview(Math.min(QUICK_PREVIEW_WAIT_MS, Math.max(500, timeoutMs - (Date.now() - startedAt))), initialPreview);

    if (!previewState && !isImageResultUrl()) {
      const progressState = getPreviewState();
      if (progressState.inProgress || progressState.signature !== initialPreview.signature) {
        previewState = await waitForPreview(Math.min(3_500, Math.max(800, timeoutMs - (Date.now() - startedAt))), initialPreview);
      }
    }

    // React can ignore a synthetic delegated change event even though files was
    // assigned. Call the component handler directly only after the quick native
    // path did not create a preview.
    if (!previewState && !isImageResultUrl()) {
      const currentInput = findUploader() || input;
      assignInputFile(currentInput, transfer, true);
      previewState = await waitForPreview(Math.min(2_700, Math.max(700, timeoutMs - (Date.now() - startedAt))), initialPreview);
    }

    // 1688 explicitly supports Ctrl+V image search. Paste is therefore the most
    // compatible fallback for the current home-page implementation.
    if (!previewState && !isImageResultUrl() && dispatchPasteFallback(transfer)) {
      previewState = await waitForPreview(Math.min(2_700, Math.max(700, timeoutMs - (Date.now() - startedAt))), initialPreview);
    }

    if (!previewState && !isImageResultUrl()) {
      const currentInput = findUploader() || input;
      if (dispatchDropFallback(currentInput, transfer)) {
        previewState = await waitForPreview(Math.min(2_700, Math.max(700, timeoutMs - (Date.now() - startedAt))), initialPreview);
      }
    }

    if (isImageResultUrl()) {
      respond(token, "preview-ready");
      respond(token, "submitted", { resultUrl: location.href });
      return;
    }
    if (!previewState) throw new Error("1688 chưa nhận được file ảnh.");
    respond(token, "preview-ready", {
      imageCount: Number(previewState.imageCount || 0),
      uploadedCount: Number(previewState.uploadedCount || 0)
    });

    const submit = await waitForSubmitButton(Math.min(2_000, Math.max(600, timeoutMs - (Date.now() - startedAt))));
    if (!submit) throw new Error("Không tìm thấy nút Tìm kiếm hình ảnh của 1688.");
    if (!exactClick(submit)) throw new Error("Không bấm được nút Tìm kiếm hình ảnh.");
    respond(token, "submitted");

    if (Math.abs(window.scrollX - originalX) > 1 || Math.abs(window.scrollY - originalY) > 1) window.scrollTo(originalX, originalY);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const message = event.data;
    if (!message || message.source !== "TDT_1688_ISOLATED" || message.type !== REQUEST_TYPE) return;
    const token = String(message.token || "");
    if (!token || !String(message.dataUrl || "").startsWith("data:image/")) return;
    if (activeToken === token) {
      respond(token, "preparing");
      return;
    }
    if (activeToken && activeToken !== token) {
      respond(token, "failed", { error: "Một yêu cầu tìm ảnh khác đang được xử lý." });
      return;
    }
    activeToken = token;
    const timeoutMs = Math.max(8_000, Math.min(40_000, Number(message.timeoutMs) || DEFAULT_TIMEOUT_MS));
    void executeUpload(token, String(message.dataUrl), timeoutMs)
      .catch((error) => respond(token, "failed", { error: error?.message || "Không thể tải ảnh lên 1688." }))
      .finally(() => { if (activeToken === token) activeToken = ""; });
  });
})();
