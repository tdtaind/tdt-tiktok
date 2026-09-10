(() => {
  "use strict";

  if (window.top !== window.self || window.__TDT_TRANSCRIPT365_MAIN_HOOK_V2__) return;
  window.__TDT_TRANSCRIPT365_MAIN_HOOK_V2__ = true;

  const SOURCE = "tdt-transcript365-main-hook";
  const MAX_CAPTURE_CHARS = 2500000;

  function looksRelevant(url, text) {
    const marker = `${url || ""} ${String(text || "").slice(0, 12000)}`;
    return /transcript|subtitle|caption|\bsrt\b|\bvtt\b|speech|segment|utterance/i.test(marker)
      && (/WEBVTT|-->|(?:^|\n)\s*(?:(?:\d{1,2}:)?\d{1,2}:\d{2})(?:[.,]\d{1,3})?\b|"(?:start|start_time|startTime|end|end_time|text|caption|transcript|subtitle)"/im.test(marker));
  }

  function emit(url, payload) {
    try {
      let value = payload;
      if (typeof value === "string" && value.length > MAX_CAPTURE_CHARS) value = value.slice(0, MAX_CAPTURE_CHARS);
      window.postMessage({ source: SOURCE, type: "TRANSCRIPT365_CAPTURE", url: String(url || ""), payload: value }, "*");
    } catch {
      // Không làm ảnh hưởng trang Transcript365.
    }
  }

  const originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    window.fetch = async function patchedFetch(...args) {
      const response = await originalFetch.apply(this, args);
      try {
        const requestUrl = String(response.url || args[0]?.url || args[0] || "");
        response.clone().text().then((text) => {
          if (!looksRelevant(requestUrl, text)) return;
          try { emit(requestUrl, JSON.parse(text)); } catch { emit(requestUrl, text); }
        }).catch(() => {});
      } catch {
        // Bỏ qua phản hồi không đọc được.
      }
      return response;
    };
  }

  const OriginalXHR = window.XMLHttpRequest;
  if (OriginalXHR?.prototype) {
    const originalOpen = OriginalXHR.prototype.open;
    const originalSend = OriginalXHR.prototype.send;
    OriginalXHR.prototype.open = function patchedOpen(method, url, ...rest) {
      this.__tdtUrl = String(url || "");
      return originalOpen.call(this, method, url, ...rest);
    };
    OriginalXHR.prototype.send = function patchedSend(...args) {
      this.addEventListener("load", () => {
        try {
          const text = typeof this.responseText === "string" ? this.responseText : "";
          if (!looksRelevant(this.responseURL || this.__tdtUrl, text)) return;
          try { emit(this.responseURL || this.__tdtUrl, JSON.parse(text)); } catch { emit(this.responseURL || this.__tdtUrl, text); }
        } catch {
          // responseType có thể không cho phép đọc responseText.
        }
      }, { once: true });
      return originalSend.apply(this, args);
    };
  }

  const originalCreateObjectURL = URL.createObjectURL?.bind(URL);
  if (originalCreateObjectURL) {
    try {
      URL.createObjectURL = function patchedCreateObjectURL(object) {
      const objectUrl = originalCreateObjectURL(object);
      if (object instanceof Blob && object.size <= MAX_CAPTURE_CHARS) {
        object.text().then((text) => {
          if (looksRelevant(objectUrl, text)) emit(objectUrl, text);
        }).catch(() => {});
      }
        return objectUrl;
      };
    } catch {
      // Trình duyệt có thể khóa thuộc tính createObjectURL.
    }
  }
})();
