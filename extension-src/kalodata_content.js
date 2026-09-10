(() => {
  "use strict";

  if (window.top !== window.self || globalThis.__TDT_KALODATA_V343__) return;
  globalThis.__TDT_KALODATA_V343__ = true;

  const KALODATA_SETTINGS_KEY = "tdt_kalodata_settings_v1";
  const MAIN_SETTINGS_KEY = "tdt_settings_v17";
  const DEFAULT_SETTINGS = Object.freeze({ enabled: false, baseUrl: "", accessKey: "", region: "VN", language: "vi-VN", currency: "VND", dateRange: "last30Day", cacheMinutes: 30 });
  const SCAN_INTERVAL_MS = 1350;
  const SCAN_DEBOUNCE_MS = 200;

  let settings = { ...DEFAULT_SETTINGS };
  let cleanMode = false;
  let currentVideoId = "";
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
      baseUrl: String(source.baseUrl || "").trim(),
      accessKey: String(source.accessKey || "").trim(),
      region: String(source.region || "VN").trim().toUpperCase(),
      language: String(source.language || "vi-VN").trim(),
      currency: String(source.currency || "VND").trim().toUpperCase(),
      dateRange: String(source.dateRange || "last30Day").trim() || "last30Day",
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
    return Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left)) * Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top));
  }

  function findVideoIdNear(video) {
    if (!(video instanceof HTMLVideoElement)) return "";
    let node = video;
    for (let depth = 0; depth < 8 && node; depth += 1, node = node.parentElement) {
      const direct = parseVideoId(node.getAttribute?.("data-video-id")) || parseVideoId(node.getAttribute?.("data-e2e"));
      if (direct) return direct;
      const anchors = node.querySelectorAll?.('a[href*="/video/"]') || [];
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
      const rect = video.getBoundingClientRect();
      const centerPenalty = Math.abs((rect.top + rect.height / 2) - innerHeight / 2) * 200;
      const playingBonus = !video.paused && !video.ended ? 2_000_000_000 : 0;
      const score = playingBonus + area - centerPenalty;
      if (score > bestScore) { bestScore = score; bestId = id; }
    }
    return bestId;
  }

  function formatCompact(value) {
    if (value === null || value === undefined || value === "") return "—";
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
    if (value === null || value === undefined || value === "") return "—";
    const number = Number(value);
    return Number.isFinite(number) ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(number) : "—";
  }

  function formatDecimal(value, digits = 2) {
    if (value === null || value === undefined || value === "") return "—";
    const number = Number(value);
    return Number.isFinite(number) ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(number) : "—";
  }

  function cssText() {
    return `
      :host{all:initial}.wrap{position:fixed;right:92px;top:132px;z-index:2147483099;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#fff;pointer-events:none}
      .pill{pointer-events:auto;display:flex;align-items:center;gap:8px;max-width:315px;min-height:38px;padding:7px 11px 7px 8px;border:1px solid rgba(255,255,255,.22);border-radius:999px;color:#fff;background:linear-gradient(135deg,rgba(17,20,29,.96),rgba(25,27,52,.96));box-shadow:0 12px 38px rgba(0,0,0,.42),0 0 0 1px rgba(124,109,255,.10) inset;backdrop-filter:blur(16px) saturate(145%);cursor:pointer;transition:.16s ease}.pill:hover{transform:translateY(-1px);border-color:rgba(124,109,255,.62)}
      .logo{display:grid;place-items:center;flex:0 0 auto;width:26px;height:26px;border-radius:9px;background:linear-gradient(135deg,#6d5dfc,#9a8cff);box-shadow:0 7px 18px rgba(109,93,252,.28);font-size:12px;font-weight:950}.pill-copy{display:grid;min-width:0;gap:1px}.pill-copy b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.pill-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#aeb6c6;font-size:8px}.badge{flex:0 0 auto;padding:3px 6px;border-radius:999px;color:#d9d3ff;background:rgba(124,109,255,.12);font-size:7px;font-weight:900;letter-spacing:.4px}
      .panel{pointer-events:auto;position:absolute;right:0;top:47px;width:342px;padding:13px;border:1px solid rgba(255,255,255,.17);border-radius:18px;background:linear-gradient(155deg,rgba(27,28,40,.99),rgba(10,11,17,.99));box-shadow:0 24px 70px rgba(0,0,0,.58);backdrop-filter:blur(20px) saturate(150%)}.panel[hidden]{display:none}.head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.head strong{display:block;font-size:12px}.head small{display:block;margin-top:2px;color:#8f98aa;font-size:8px}.close{display:grid;place-items:center;width:29px;height:29px;border:1px solid rgba(255,255,255,.10);border-radius:9px;color:#d5d9e2;background:rgba(255,255,255,.06);cursor:pointer;font-size:17px}.close:hover{background:rgba(255,255,255,.12)}
      .status{margin-top:9px;padding:7px 8px;border-radius:10px;color:#b8c0ce;background:rgba(255,255,255,.045);font-size:8px;line-height:1.4}.status.error{color:#fecaca;background:rgba(185,28,28,.17)}.status.ok{color:#d9d3ff;background:rgba(124,109,255,.09)}.hero{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.metric{padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.04)}.metric span{display:block;color:#9099aa;font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}.metric b{display:block;margin-top:3px;font-size:18px;letter-spacing:-.4px}.metric.gmv b{color:#b9afff}.metric.sales b{color:#8ee8ff}.mini{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px}.mini .metric{padding:8px 7px}.mini .metric b{font-size:11px}.mini .metric span{font-size:6.5px}.foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px}.video{min-width:0;color:#798396;font-size:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.refresh{flex:0 0 auto;padding:6px 9px;border:1px solid rgba(124,109,255,.28);border-radius:9px;color:#ddd8ff;background:rgba(124,109,255,.10);cursor:pointer;font-size:8px;font-weight:900}.refresh:hover{background:rgba(124,109,255,.17)}.refresh:disabled{opacity:.45;cursor:wait}.note{margin-top:8px;color:#697387;font-size:7px;line-height:1.4}.empty{padding:16px 6px 7px;color:#9ba5b7;text-align:center;font-size:9px;line-height:1.5}@media(max-width:900px){.wrap{right:12px;top:120px}.panel{width:min(342px,calc(100vw - 24px))}.pill{max-width:250px}}
    `;
  }

  function ensureWidget() {
    if (widgetHost?.isConnected) return;
    widgetHost = document.createElement("div");
    widgetHost.id = "tdt-kalodata-analytics-host";
    widgetHost.style.cssText = "all:initial;position:fixed;z-index:2147483099;";
    document.documentElement.appendChild(widgetHost);
    widgetRoot = widgetHost.attachShadow({ mode: "open" });
    const style = document.createElement("style"); style.textContent = cssText();
    const wrap = document.createElement("div"); wrap.className = "wrap";
    widgetPill = document.createElement("button"); widgetPill.type = "button"; widgetPill.className = "pill";
    widgetPill.innerHTML = '<span class="logo">K</span><span class="pill-copy"><b>Kalodata Shop Analytics</b><small>Đang chờ video TikTok</small></span><span class="badge">OPEN API</span>';
    widgetPanel = document.createElement("section"); widgetPanel.className = "panel"; widgetPanel.hidden = true;
    widgetPanel.innerHTML = '<div class="head"><div><strong>Kalodata Shop Analytics</strong><small>Video Detail · Open API</small></div><button class="close" type="button" aria-label="Đóng">×</button></div><div class="status">Đang chờ video TikTok…</div><div class="body"><div class="empty">Mở một video TikTok Shop để phân tích.</div></div><div class="foot"><span class="video"></span><button class="refresh" type="button">Làm mới API</button></div><div class="note">Revenue/Sales là dữ liệu Kalodata theo region và date range bạn cấu hình trong popup.</div>';
    wrap.append(widgetPill, widgetPanel); widgetRoot.append(style, wrap);
    widgetStatus = widgetPanel.querySelector(".status"); widgetBody = widgetPanel.querySelector(".body"); widgetVideo = widgetPanel.querySelector(".video");
    widgetPill.addEventListener("click", () => { panelOpen = !panelOpen; widgetPanel.hidden = !panelOpen; });
    widgetPanel.querySelector(".close").addEventListener("click", () => { panelOpen = false; widgetPanel.hidden = true; });
    widgetPanel.querySelector(".refresh").addEventListener("click", () => void analyzeCurrent(true));
    applyVisibility();
  }

  function removeWidget() { widgetHost?.remove(); widgetHost = widgetRoot = widgetPanel = widgetPill = widgetStatus = widgetBody = widgetVideo = null; panelOpen = false; }
  function applyVisibility() { if (widgetHost) widgetHost.style.display = settings.enabled && !cleanMode ? "block" : "none"; }
  function setStatus(text, kind = "") { if (widgetStatus) { widgetStatus.textContent = String(text || ""); widgetStatus.className = `status${kind ? ` ${kind}` : ""}`; } }
  function setPill(title, subtitle) { if (!widgetPill) return; const b = widgetPill.querySelector(".pill-copy b"); const s = widgetPill.querySelector(".pill-copy small"); if (b) b.textContent = title; if (s) s.textContent = subtitle; }

  function renderResult(result) {
    if (!widgetBody) return;
    const refresh = widgetPanel?.querySelector(".refresh"); if (refresh) refresh.disabled = false;
    if (widgetVideo) widgetVideo.textContent = currentVideoId ? `Video ${currentVideoId} · ${result?.region || settings.region} · ${result?.dateRange || settings.dateRange}` : "";
    if (!result?.found) {
      setStatus(result?.message || "Kalodata chưa có dữ liệu cho video này.");
      setPill("Kalodata · chưa có dữ liệu", currentVideoId ? `Video ${currentVideoId}` : "Chưa nhận diện video");
      widgetBody.innerHTML = '<div class="empty">Kiểm tra region/date range hoặc video có dữ liệu TikTok Shop hay không.</div>';
      return;
    }
    const hasSales = result.salesAvailable !== false && result.sales !== null && result.sales !== undefined && result.sales !== "" && Number.isFinite(Number(result.sales));
    const hasGmv = result.gmv !== null && result.gmv !== undefined && result.gmv !== "" && Number.isFinite(Number(result.gmv));
    const hasViews = result.views !== null && result.views !== undefined && result.views !== "" && Number.isFinite(Number(result.views));
    const sales = hasSales ? Number(result.sales) : null;
    const gmv = hasGmv ? Number(result.gmv) : null;
    const views = hasViews ? Number(result.views) : null;
    const salesPer1k = hasSales && hasViews && views > 0 ? sales / views * 1000 : null;
    const avgGmv = hasSales && hasGmv && sales > 0 ? gmv / sales : null;
    const ageSeconds = Math.max(0, Math.floor((Date.now() - Number(result.fetchedAt || Date.now())) / 1000));
    const ageText = ageSeconds < 60 ? `${ageSeconds}s` : `${Math.floor(ageSeconds / 60)} phút`;
    const salesSource = result.salesSourceField ? ` · sales: ${result.salesSourceField}` : "";
    setStatus(`${result.cached ? "Từ cache" : "API mới"} · ${result.region || settings.region} · ${result.dateRange || settings.dateRange} · cập nhật ${ageText} trước${salesSource}${hasSales ? "" : " · API không trả sales_volume"}`, hasSales ? "ok" : "error");
    setPill(hasSales ? `Kalodata · ${formatCompact(sales)} lượt bán` : "Kalodata · chưa có sales_volume", `GMV ${formatCompact(gmv)} ${result.currency || settings.currency} · ${formatCompact(views)} view`);
    widgetBody.innerHTML = `
      <div class="hero"><div class="metric sales"><span>Lượt bán</span><b>${formatInteger(sales)}</b></div><div class="metric gmv"><span>Doanh thu / GMV</span><b>${formatCompact(gmv)}</b></div></div>
      <div class="mini"><div class="metric"><span>Lượt xem</span><b>${formatCompact(views)}</b></div><div class="metric"><span>Bán / 1K view</span><b>${formatDecimal(salesPer1k,2)}</b></div><div class="metric"><span>GMV / đơn</span><b>${formatCompact(avgGmv)}</b></div></div>
      <div class="mini"><div class="metric"><span>Video GPM</span><b>${formatCompact(result.gpm)}</b></div><div class="metric"><span>Ads ROAS</span><b>${formatDecimal(result.adsRoas,2)}</b></div><div class="metric"><span>Ads views</span><b>${formatCompact(result.adsViews)}</b></div></div>
      <div class="mini"><div class="metric"><span>Sản phẩm</span><b>${formatInteger(result.productNumber)}</b></div><div class="metric"><span>Ngày chạy Ads</span><b>${formatInteger(result.adsPeriod)}</b></div><div class="metric"><span>Tiền tệ</span><b>${result.currency || settings.currency}</b></div></div>
      ${hasSales ? "" : '<div class="empty">Kalodata đã trả dữ liệu video nhưng response hiện tại không chứa <b>sales_volume</b>. Hãy bấm “Làm mới API”; extension sẽ không còn biến field thiếu thành 0.</div>'}`;
  }

  function requestAnalytics(videoId, force = false) {
    return new Promise((resolve, reject) => chrome.runtime.sendMessage({ type: "KALODATA_VIDEO_ANALYTICS", videoId, force }, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!response?.ok) return reject(new Error(response?.error || "Không thể gọi Kalodata API."));
      resolve(response.data);
    }));
  }

  async function analyzeVideo(videoId, force = false) {
    if (!settings.enabled || !videoId) return null;
    ensureWidget(); const token = ++currentRequestToken; currentVideoId = videoId;
    const refresh = widgetPanel?.querySelector(".refresh"); if (refresh) refresh.disabled = true;
    setPill("Kalodata · đang phân tích…", `Video ${videoId}`); setStatus(force ? "Đang làm mới Kalodata Open API…" : "Đang tải dữ liệu Kalodata…"); if (widgetVideo) widgetVideo.textContent = `Video ${videoId}`;
    try {
      const result = await requestAnalytics(videoId, force);
      if (token !== currentRequestToken || currentVideoId !== videoId) return null;
      renderResult(result); return result;
    } catch (error) {
      if (token !== currentRequestToken || currentVideoId !== videoId) return null;
      if (refresh) refresh.disabled = false;
      const message = String(error?.message || "Kalodata API lỗi."); setPill("Kalodata · lỗi API", message); setStatus(message, "error");
      if (widgetBody) widgetBody.innerHTML = '<div class="empty">Kiểm tra API URL/Base URL, Access Key, region/currency/date range trong popup rồi thử lại.</div>';
      throw error;
    }
  }

  async function analyzeCurrent(force = false) {
    const id = resolveCurrentVideoId() || currentVideoId;
    if (!id) { ensureWidget(); setPill("Kalodata Shop Analytics", "Chưa nhận diện được video TikTok"); setStatus("Hãy mở hoặc phát một video TikTok rồi thử lại.", "error"); return null; }
    return analyzeVideo(id, force);
  }

  function scan() { if (!settings.enabled || document.hidden) return; const nextId = resolveCurrentVideoId(); if (!nextId || nextId === currentVideoId) return; void analyzeVideo(nextId, false).catch(() => {}); }
  function scheduleScan(delay = SCAN_DEBOUNCE_MS) { clearTimeout(debounceTimer); debounceTimer = setTimeout(scan, Math.max(0, delay)); }
  function start() {
    ensureWidget(); applyVisibility(); clearInterval(scanTimer); scanTimer = setInterval(scan, SCAN_INTERVAL_MS); observer?.disconnect();
    observer = new MutationObserver((records) => { for (const record of records) if (record.type === "childList" && (record.addedNodes.length || record.removedNodes.length)) { scheduleScan(); break; } });
    observer.observe(document.documentElement, { childList: true, subtree: true }); scheduleScan(0);
  }
  function stop() { clearInterval(scanTimer); scanTimer = null; clearTimeout(debounceTimer); debounceTimer = null; observer?.disconnect(); observer = null; currentRequestToken += 1; currentVideoId = ""; removeWidget(); }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[KALODATA_SETTINGS_KEY]) {
      const previousEnabled = settings.enabled; settings = normalizeSettings(changes[KALODATA_SETTINGS_KEY].newValue);
      if (settings.enabled && !previousEnabled) start(); else if (!settings.enabled && previousEnabled) stop(); else if (settings.enabled) { applyVisibility(); currentVideoId = ""; scheduleScan(0); }
    }
    if (changes[MAIN_SETTINGS_KEY]) { cleanMode = changes[MAIN_SETTINGS_KEY].newValue?.cleanMode === true; applyVisibility(); }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "TDT_KALODATA_ANALYZE_NOW") return false;
    void analyzeCurrent(message.force !== false).then((data) => sendResponse({ ok: true, data })).catch((error) => sendResponse({ ok: false, error: error?.message || "Không phân tích được video bằng Kalodata." }));
    return true;
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleScan(80); }); window.addEventListener("popstate", () => scheduleScan(40)); window.addEventListener("hashchange", () => scheduleScan(40));
  void storageGet({ [KALODATA_SETTINGS_KEY]: DEFAULT_SETTINGS, [MAIN_SETTINGS_KEY]: {} }).then((stored) => { settings = normalizeSettings(stored[KALODATA_SETTINGS_KEY]); cleanMode = stored[MAIN_SETTINGS_KEY]?.cleanMode === true; if (settings.enabled) start(); });
})();
