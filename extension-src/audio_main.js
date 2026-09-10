(() => {
  "use strict";
  if (window.top !== window.self || globalThis.__TDT_AUDIO_MAIN_V325__) return;
  globalThis.__TDT_AUDIO_MAIN_V325__ = true;

  const REQUEST_SOURCE = "tdt-audio-cors-probe-ui";
  const RESPONSE_SOURCE = "tdt-audio-cors-probe-main";
  const MAX_URL_LENGTH = 12000;

  async function probeCors(url, credentials = "omit") {
    const target = String(url || "").trim();
    if (!/^https?:\/\//i.test(target) || target.length > MAX_URL_LENGTH) return { ok: false, reason: "invalid-url" };
    let parsed;
    try { parsed = new URL(target, location.href); } catch { return { ok: false, reason: "invalid-url" }; }
    if (parsed.origin === location.origin) return { ok: true, reason: "same-origin" };

    const base = {
      mode: "cors",
      credentials: credentials === "include" ? "include" : "omit",
      cache: "no-store",
      redirect: "follow",
      referrerPolicy: "strict-origin-when-cross-origin"
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2200);
    try {
      try {
        const response = await fetch(target, { ...base, method: "HEAD", signal: controller.signal });
        if (response.ok || response.status === 206 || response.status === 304) return { ok: true, status: response.status, reason: "head" };
      } catch {}

      // Some TikTok CDN endpoints reject HEAD although the media GET is CORS-safe.
      // A one-byte range request validates the page-origin CORS path without
      // downloading the full video; cancel the body as soon as headers arrive.
      try {
        const response = await fetch(target, {
          ...base,
          method: "GET",
          headers: { Range: "bytes=0-0" },
          signal: controller.signal
        });
        const ok = response.ok || response.status === 206;
        try { await response.body?.cancel(); } catch {}
        return { ok, status: response.status, reason: ok ? "range" : "http" };
      } catch (error) {
        return { ok: false, reason: error?.name === "AbortError" ? "timeout" : "cors" };
      }
    } finally {
      clearTimeout(timer);
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== REQUEST_SOURCE || data.type !== "probe" || !data.id) return;
    const id = String(data.id);
    void probeCors(data.url, data.credentials).then((result) => {
      window.postMessage({
        source: RESPONSE_SOURCE,
        type: "probe-result",
        id,
        ok: Boolean(result?.ok),
        status: Number(result?.status || 0),
        reason: String(result?.reason || "")
      }, "*");
    }).catch(() => {
      window.postMessage({ source: RESPONSE_SOURCE, type: "probe-result", id, ok: false, status: 0, reason: "probe-error" }, "*");
    });
  }, false);
})();
