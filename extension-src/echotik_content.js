(() => {
  "use strict";

  if (window.top !== window.self || globalThis.__TDT_ECHOTIK_V330__) return;
  globalThis.__TDT_ECHOTIK_V330__ = true;

  const ECHOTIK_SETTINGS_KEY = "tdt_echotik_settings_v1";
  const MAIN_SETTINGS_KEY = "tdt_settings_v17";
  const DEFAULT_SETTINGS = Object.freeze({ enabled: false, username: "", password: "", cacheMinutes: 30 });
  const SCAN_INTERVAL_MS = 1200;
  const SCAN_DEBOUNCE_MS = 180;

  let settings = { ...DEFAULT_SETTINGS };
  let cleanMode = false;
  let currentVideoId = "";
  let currentResult = null;
  let currentRequestToken = 0;
  let scanTimer = null;
  let debounceTimer = null;
  let observer = null;
  let widgetHost = null;
  let widgetRoot = null;
  let widgetPanel = null;
  let widgetPill = null;
  let widgetStatus = null;
  let widgetBody = null;
  let widgetVideo = null;
  let panelOpen = false;

  function storageGet(defaults) {
    return new Promise((resolve) => chrome.storage.local.get(defaults, (result) => resolve(result || defaults)));
  }

  function normalizeSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      enabled: source.enabled === true,
      username: String(source.username || "").trim(),
      password: String(source.password || ""),
      cacheMinutes: Math.max(5, Math.min(180, Math.round(Number(source.cacheMinutes) || 30)))
    };
  }

  function parseVideoId(value) {
    const raw = String(value || "").trim();
    if (/^\d{10,25}$/.test(raw)) return raw;
    const match = raw.match(/\/video\/(\d{10,25})(?:[/?#]|$)/i);
    return match?.[1] || "";
  }

  function visibleArea(element) {
    if (!(element instanceof Element)) return 0;
    const rect = element.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 80) return 0;
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(innerWidth, rect.right);
    const bottom = Math.min(innerHeight, rect.bottom);
    return Math.max(0, right - left) * Math.max(0, bottom - top);
  }

  function findVideoIdNear(video) {
    if (!(video instanceof HTMLVideoElement)) return "";
    const scopes = [];
    let node = video;
    for (let depth = 0; depth < 8 && node; depth += 1, node = node.parentElement) scopes.push(node);
    for (const scope of scopes) {
      const direct = parseVideoId(scope.getAttribute?.("data-video-id")) || parseVideoId(scope.getAttribute?.("data-e2e"));
      if (direct) return direct;
      const anchors = scope.querySelectorAll?.('a[href*="/video/"]') || [];
      for (const anchor of anchors) {
        const id = parseVideoId(anchor.href || anchor.getAttribute("href"));
        if (id) return id;
      }
    }
    return "";
  }

  function resolveCurrentVideoId() {
    const fromUrl = parseVideoId(location.href);
    if (fromUrl) return fromUrl;

    let bestId = "";
    let bestScore = -1;
    for (const video of document.querySelectorAll("video")) {
      const id = findVideoIdNear(video);
      if (!id) continue;
      const area = visibleArea(video);
      if (!area) continue;
      const center = video.getBoundingClientRect();
      const centerPenalty = Math.abs((center.top + center.height / 2) - innerHeight / 2) * 200;
      const playingBonus = !video.paused && !video.ended ? 2_000_000_000 : 0;
      const score = playingBonus + area - centerPenalty;
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    }
    return bestId;
  }

  function formatCompact(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    const absolute = Math.abs(number);
    const compact = (divisor, suffix) => `${(number / divisor).toFixed(absolute >= divisor * 100 ? 0 : absolute >= divisor * 10 ? 1 : 2).replace(/\.0+$|(?<=\.[0-9])0$/g, "")}${suffix}`;
    if (absolute >= 1e9) return compact(1e9, "B");
    if (absolute >= 1e6) return compact(1e6, "M");
    if (absolute >= 1e3) return compact(1e3, "K");
    return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(number);
  }

  function formatInteger(value) {
    const number = Number(value);
    return Number.isFinite(number) ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(number) : "—";
  }

  function formatDecimal(value, digits = 2) {
    const number = Number(value);
    return Number.isFinite(number) ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(number) : "—";
  }

  function cssText() {
    return `
      :host{all:initial}
      .wrap{position:fixed;right:92px;top:84px;z-index:2147483100;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#fff;pointer-events:none}
      .pill{pointer-events:auto;display:flex;align-items:center;gap:8px;max-width:310px;min-height:38px;padding:7px 11px 7px 8px;border:1px solid rgba(255,255,255,.24);border-radius:999px;color:#fff;background:linear-gradient(135deg,rgba(17,20,29,.96),rgba(35,19,31,.96));box-shadow:0 12px 38px rgba(0,0,0,.42),0 0 0 1px rgba(254,44,85,.08) inset;backdrop-filter:blur(16px) saturate(145%);cursor:pointer;transition:.16s ease}
      .pill:hover{transform:translateY(-1px);border-color:rgba(254,44,85,.55)}
      .logo{display:grid;place-items:center;flex:0 0 auto;width:26px;height:26px;border-radius:9px;background:linear-gradient(135deg,#fe2c55,#ff5a7d);box-shadow:0 7px 18px rgba(254,44,85,.28);font-size:14px}
      .pill-copy{display:grid;min-width:0;gap:1px}.pill-copy b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.pill-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#aeb6c6;font-size:8px}
      .badge{flex:0 0 auto;padding:3px 6px;border-radius:999px;color:#88fff4;background:rgba(37,244,238,.10);font-size:7px;font-weight:900;letter-spacing:.4px}
      .panel{pointer-events:auto;position:absolute;right:0;top:47px;width:330px;padding:13px;border:1px solid rgba(255,255,255,.17);border-radius:18px;background:linear-gradient(155deg,rgba(27,28,36,.985),rgba(10,11,16,.985));box-shadow:0 24px 70px rgba(0,0,0,.58);backdrop-filter:blur(20px) saturate(150%)}
      .panel[hidden]{display:none}.head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.head strong{display:block;font-size:12px}.head small{display:block;margin-top:2px;color:#8f98aa;font-size:8px}.close{display:grid;place-items:center;width:29px;height:29px;border:1px solid rgba(255,255,255,.10);border-radius:9px;color:#d5d9e2;background:rgba(255,255,255,.06);cursor:pointer;font-size:17px}.close:hover{background:rgba(255,255,255,.12)}
      .status{margin-top:9px;padding:7px 8px;border-radius:10px;color:#b8c0ce;background:rgba(255,255,255,.045);font-size:8px;line-height:1.4}.status.error{color:#fecaca;background:rgba(185,28,28,.17)}.status.ok{color:#99fff5;background:rgba(37,244,238,.075)}
      .hero{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.metric{padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.04)}.metric span{display:block;color:#9099aa;font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}.metric b{display:block;margin-top:3px;font-size:18px;letter-spacing:-.4px}.metric.gmv b{color:#7efff4}.metric.sales b{color:#ff809b}
      .mini{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px}.mini .metric{padding:8px 7px}.mini .metric b{font-size:11px}.mini .metric span{font-size:6.5px}
      .foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px}.video{min-width:0;color:#798396;font-size:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.refresh{flex:0 0 auto;padding:6px 9px;border:1px solid rgba(37,244,238,.22);border-radius:9px;color:#bafff8;background:rgba(37,244,238,.08);cursor:pointer;font-size:8px;font-weight:900}.refresh:hover{background:rgba(37,244,238,.14)}.refresh:disabled{opacity:.45;cursor:wait}
      .note{margin-top:8px;color:#697387;font-size:7px;line-height:1.4}.empty{padding:16px 6px 7px;color:#9ba5b7;text-align:center;font-size:9px;line-height:1.5}
      @media(max-width:900px){.wrap{right:12px;top:72px}.panel{width:min(330px,calc(100vw - 24px))}.pill{max-width:250px}}
    `;
  }

  function ensureWidget() {
    if (widgetHost?.isConnected) return;
    widgetHost = document.createElement("div");
    widgetHost.id = "tdt-echotik-analytics-host";
    widgetHost.style.cssText = "all:initial;position:fixed;z-index:2147483100;";
    document.documentElement.appendChild(widgetHost);
    widgetRoot = widgetHost.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = cssText();
    const wrap = document.createElement("div");
    wrap.className = "wrap";
    widgetPill = document.createElement("button");
    widgetPill.type = "button";
    widgetPill.className = "pill";
    widgetPill.innerHTML = '<span class="logo">🛒</span><span class="pill-copy"><b>EchoTik Shop Analytics</b><small>Đang nhận diện video…</small></span><span class="badge">API</span>';
    widgetPanel = document.createElement("section");
    widgetPanel.className = "panel";
    widgetPanel.hidden = true;
    widgetPanel.innerHTML = `
      <div class="head"><div><strong>EchoTik Shop Analytics</strong><small>Dữ liệu bán hàng ước tính theo video</small></div><button class="close" type="button" aria-label="Đóng">×</button></div>
      <div class="status">Đang chờ video TikTok…</div>
      <div class="body"></div>
      <div class="foot"><div class="video"></div><button class="refresh" type="button">Làm mới API</button></div>
      <div class="note">Sales/GMV là số liệu ước tính do EchoTik cung cấp. Cache cục bộ giúp giảm số lượt gọi API.</div>`;
    wrap.append(widgetPill, widgetPanel);
    widgetRoot.append(style, wrap);
    widgetStatus = widgetPanel.querySelector(".status");
    widgetBody = widgetPanel.querySelector(".body");
    widgetVideo = widgetPanel.querySelector(".video");
    widgetPill.addEventListener("click", () => {
      panelOpen = !panelOpen;
      widgetPanel.hidden = !panelOpen;
    });
    widgetPanel.querySelector(".close").addEventListener("click", () => {
      panelOpen = false;
      widgetPanel.hidden = true;
    });
    widgetPanel.querySelector(".refresh").addEventListener("click", () => void analyzeCurrent(true));
    applyVisibility();
  }

  function removeWidget() {
    widgetHost?.remove();
    widgetHost = widgetRoot = widgetPanel = widgetPill = widgetStatus = widgetBody = widgetVideo = null;
    panelOpen = false;
  }

  function applyVisibility() {
    if (!widgetHost) return;
    widgetHost.style.display = settings.enabled && !cleanMode ? "block" : "none";
  }

  function setStatus(text, kind = "") {
    if (!widgetStatus) return;
    widgetStatus.textContent = String(text || "");
    widgetStatus.className = `status${kind ? ` ${kind}` : ""}`;
  }

  function setPill(title, subtitle) {
    if (!widgetPill) return;
    const bold = widgetPill.querySelector(".pill-copy b");
    const small = widgetPill.querySelector(".pill-copy small");
    if (bold) bold.textContent = title;
    if (small) small.textContent = subtitle;
  }

  function renderResult(result) {
    currentResult = result;
    if (!widgetBody) return;
    const refresh = widgetPanel?.querySelector(".refresh");
    if (refresh) refresh.disabled = false;
    widgetVideo.textContent = currentVideoId ? `Video ID ${currentVideoId}${result?.region ? ` · ${result.region}` : ""}` : "";

    if (!result?.found) {
      setStatus(result?.message || "EchoTik chưa có dữ liệu cho video này.", "");
      setPill("EchoTik · chưa có dữ liệu", currentVideoId ? `Video ${currentVideoId}` : "Chưa nhận diện video");
      widgetBody.innerHTML = '<div class="empty">Video có thể chưa được EchoTik thu thập hoặc chưa phải video TikTok Shop.</div>';
      return;
    }

    const sales = Number(result.sales) || 0;
    const gmv = Number(result.gmv) || 0;
    const views = Number(result.views) || 0;
    const salesPer1k = views > 0 ? sales / views * 1000 : 0;
    const avgGmv = sales > 0 ? gmv / sales : 0;
    const interactions = (Number(result.likes) || 0) + (Number(result.comments) || 0) + (Number(result.shares) || 0);
    const engagement = views > 0 ? interactions / views * 100 : 0;
    const ageSeconds = Math.max(0, Math.floor((Date.now() - Number(result.fetchedAt || Date.now())) / 1000));
    setStatus(`${result.cached ? "Từ cache" : "API mới"} · cập nhật ${ageSeconds < 60 ? `${ageSeconds}s` : `${Math.floor(ageSeconds / 60)} phút`} trước`, "ok");
    setPill(`EchoTik · ${formatCompact(sales)} lượt bán`, `GMV ${formatCompact(gmv)} · ${formatCompact(views)} view`);
    widgetBody.innerHTML = `
      <div class="hero">
        <div class="metric sales"><span>Lượt bán ước tính</span><b>${formatInteger(sales)}</b></div>
        <div class="metric gmv"><span>GMV ước tính</span><b>${formatCompact(gmv)}</b></div>
      </div>
      <div class="mini">
        <div class="metric"><span>Lượt xem</span><b>${formatCompact(views)}</b></div>
        <div class="metric"><span>Bán / 1K view</span><b>${formatDecimal(salesPer1k, 2)}</b></div>
        <div class="metric"><span>GMV / đơn</span><b>${formatCompact(avgGmv)}</b></div>
      </div>
      <div class="mini">
        <div class="metric"><span>Like</span><b>${formatCompact(result.likes)}</b></div>
        <div class="metric"><span>Bình luận</span><b>${formatCompact(result.comments)}</b></div>
        <div class="metric"><span>Engagement</span><b>${formatDecimal(engagement, 2)}%</b></div>
      </div>`;
  }

  async function requestAnalytics(videoId, force = false) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "ECHOTIK_VIDEO_ANALYTICS", videoId, force }, (response) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response?.ok) return reject(new Error(response?.error || "Không thể gọi EchoTik API."));
        resolve(response.data);
      });
    });
  }

  async function analyzeVideo(videoId, force = false) {
    if (!settings.enabled || !videoId) return null;
    ensureWidget();
    const token = ++currentRequestToken;
    currentVideoId = videoId;
    const refresh = widgetPanel?.querySelector(".refresh");
    if (refresh) refresh.disabled = true;
    setPill("EchoTik · đang phân tích…", `Video ${videoId}`);
    setStatus(force ? "Đang làm mới dữ liệu từ EchoTik API…" : "Đang tải dữ liệu EchoTik…");
    if (widgetVideo) widgetVideo.textContent = `Video ID ${videoId}`;
    try {
      const result = await requestAnalytics(videoId, force);
      if (token !== currentRequestToken || currentVideoId !== videoId) return null;
      renderResult(result);
      return result;
    } catch (error) {
      if (token !== currentRequestToken || currentVideoId !== videoId) return null;
      if (refresh) refresh.disabled = false;
      currentResult = null;
      const message = String(error?.message || "EchoTik API lỗi.");
      setPill("EchoTik · lỗi API", message);
      setStatus(message, "error");
      if (widgetBody) widgetBody.innerHTML = '<div class="empty">Kiểm tra username/password EchoTik trong popup extension rồi thử lại.</div>';
      throw error;
    }
  }

  async function analyzeCurrent(force = false) {
    const id = resolveCurrentVideoId() || currentVideoId;
    if (!id) {
      ensureWidget();
      setPill("EchoTik Shop Analytics", "Chưa nhận diện được video TikTok");
      setStatus("Hãy mở hoặc phát một video TikTok rồi thử lại.", "error");
      return null;
    }
    return analyzeVideo(id, force);
  }

  function scan() {
    if (!settings.enabled || document.hidden) return;
    const nextId = resolveCurrentVideoId();
    if (!nextId || nextId === currentVideoId) return;
    void analyzeVideo(nextId, false).catch(() => {});
  }

  function scheduleScan(delay = SCAN_DEBOUNCE_MS) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scan, Math.max(0, delay));
  }

  function start() {
    ensureWidget();
    applyVisibility();
    clearInterval(scanTimer);
    scanTimer = setInterval(scan, SCAN_INTERVAL_MS);
    observer?.disconnect();
    observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "childList" && (record.addedNodes.length || record.removedNodes.length)) {
          scheduleScan();
          break;
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    scheduleScan(0);
  }

  function stop() {
    clearInterval(scanTimer);
    scanTimer = null;
    clearTimeout(debounceTimer);
    debounceTimer = null;
    observer?.disconnect();
    observer = null;
    currentRequestToken += 1;
    currentVideoId = "";
    currentResult = null;
    removeWidget();
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[ECHOTIK_SETTINGS_KEY]) {
      const previousEnabled = settings.enabled;
      settings = normalizeSettings(changes[ECHOTIK_SETTINGS_KEY].newValue);
      if (settings.enabled && !previousEnabled) start();
      else if (!settings.enabled && previousEnabled) stop();
      else if (settings.enabled) {
        applyVisibility();
        currentVideoId = "";
        scheduleScan(0);
      }
    }
    if (changes[MAIN_SETTINGS_KEY]) {
      cleanMode = changes[MAIN_SETTINGS_KEY].newValue?.cleanMode === true;
      applyVisibility();
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "TDT_ECHOTIK_ANALYZE_NOW") return false;
    void analyzeCurrent(message.force !== false)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "Không phân tích được video." }));
    return true;
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleScan(80);
  });
  window.addEventListener("popstate", () => scheduleScan(40));
  window.addEventListener("hashchange", () => scheduleScan(40));

  void storageGet({ [ECHOTIK_SETTINGS_KEY]: DEFAULT_SETTINGS, [MAIN_SETTINGS_KEY]: {} }).then((stored) => {
    settings = normalizeSettings(stored[ECHOTIK_SETTINGS_KEY]);
    cleanMode = stored[MAIN_SETTINGS_KEY]?.cleanMode === true;
    if (settings.enabled) start();
  });
})();
