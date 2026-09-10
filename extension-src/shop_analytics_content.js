(() => {
  "use strict";

  if (window.top !== window.self || globalThis.__TDT_SHOP_ANALYTICS_V360__) return;
  globalThis.__TDT_SHOP_ANALYTICS_V360__ = true;

  const ECHOTIK_SETTINGS_KEY = "tdt_echotik_settings_v1";
  const KALODATA_SETTINGS_KEY = "tdt_kalodata_settings_v1";
  const MAIN_SETTINGS_KEY = "tdt_settings_v17";
  const SHOP_ANALYTICS_UI_KEY = "tdt_shop_analytics_ui_v1";
  const DEFAULT_ECHO = Object.freeze({ enabled:false, username:"", password:"", apiKey:"", authMode:"auto", rangePreset:"lifetime", customStart:"", customEnd:"", cacheMinutes:30 });
  const DEFAULT_KALO = Object.freeze({ enabled:false, baseUrl:"", accessKey:"", region:"VN", language:"vi-VN", currency:"VND", dateRange:"last30Day", cacheMinutes:30 });
  const DEFAULT_UI = Object.freeze({ dockEnabled:true, provider:"echotik" });
  const SCAN_INTERVAL_MS = 1800;
  const DOM_DEBOUNCE_MS = 260;

  let echoSettings = { ...DEFAULT_ECHO };
  let kaloSettings = { ...DEFAULT_KALO };
  let cleanMode = false;
  let uiSettings = { ...DEFAULT_UI };
  let currentVideoId = "";
  let requestToken = 0;
  let results = { echo: null, kalo: null };
  let errors = { echo: "", kalo: "" };
  let loading = { echo:false, kalo:false };
  let panelOpen = false;
  let scanTimer = null;
  let debounceTimer = null;
  let observer = null;
  let customRoot = null;
  let controlButton = null;
  let panel = null;
  let fallbackHost = null;
  let fallbackRoot = null;
  let lastFallbackRectKey = "";
  let suppressStorageReanalyzeUntil = 0;

  const storageGet = (defaults) => new Promise((resolve) => chrome.storage.local.get(defaults, (value) => resolve(value || defaults)));
  const storageSet = (values) => new Promise((resolve, reject) => chrome.storage.local.set(values, () => chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve()));

  function normalizeEcho(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      ...DEFAULT_ECHO,
      ...source,
      enabled: source.enabled === true,
      apiKey: String(source.apiKey || "").trim(),
      username: String(source.username || "").trim(),
      rangePreset: String(source.rangePreset || "lifetime")
    };
  }

  function normalizeUi(value) {
    const source = value && typeof value === "object" ? value : {};
    const provider = String(source.provider || "echotik").trim().toLowerCase();
    return { dockEnabled: source.dockEnabled !== false, provider: provider === "kalodata" ? "kalodata" : "echotik" };
  }

  function selectedProvider() { return uiSettings.provider === "kalodata" ? "kalo" : "echo"; }
  function selectedProviderLabel() { return selectedProvider() === "kalo" ? "Kalodata" : "EchoTik"; }
  function selectedSettingsEnabled() { return selectedProvider() === "kalo" ? kaloSettings.enabled : echoSettings.enabled; }
  function selectedResult() { return results[selectedProvider()]; }
  function selectedError() { return errors[selectedProvider()]; }
  function selectedLoading() { return loading[selectedProvider()]; }

  function normalizeKalo(value) {
    const source = value && typeof value === "object" ? value : {};
    return { ...DEFAULT_KALO, ...source, enabled: source.enabled === true };
  }

  function parseVideoId(value) {
    const raw = String(value || "").trim();
    if (/^\d{10,25}$/.test(raw)) return raw;
    return raw.match(/\/video\/(\d{10,25})(?:[/?#]|$)/i)?.[1] || "";
  }

  function visibleArea(element) {
    if (!(element instanceof Element)) return 0;
    const rect = element.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 80 || rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) return 0;
    return Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left)) * Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top));
  }

  function findVideoIdNear(video) {
    if (!(video instanceof HTMLVideoElement)) return "";
    if (video.classList.contains("tdt-replacement-video")) {
      const current = parseVideoId(location.href);
      if (current) return current;
    }
    let node = video;
    for (let depth = 0; depth < 10 && node; depth += 1, node = node.parentElement) {
      for (const attr of ["data-video-id", "data-item-id", "data-aweme-id"]) {
        const id = parseVideoId(node.getAttribute?.(attr)) || String(node.getAttribute?.(attr) || "").match(/\d{10,25}/)?.[0] || "";
        if (id) return id;
      }
      const wrapperId = String(node.id || "").match(/xgwrapper-\d+-(\d{10,25})/)?.[1] || "";
      if (wrapperId) return wrapperId;
      const anchors = node.querySelectorAll?.('a[href*="/video/"]') || [];
      for (const anchor of anchors) {
        const id = parseVideoId(anchor.href || anchor.getAttribute("href"));
        if (id) return id;
      }
    }
    return "";
  }

  function activeVideoInfo() {
    const fromUrl = parseVideoId(location.href);
    let best = null;
    let bestScore = -Infinity;
    for (const video of document.querySelectorAll("video")) {
      const area = visibleArea(video);
      if (!area) continue;
      const rect = video.getBoundingClientRect();
      const centerDistance = Math.abs((rect.top + rect.height / 2) - innerHeight / 2);
      const playBonus = !video.paused && !video.ended ? 3e9 : 0;
      const replacementBonus = video.classList.contains("tdt-replacement-video") ? 1e9 : 0;
      const score = playBonus + replacementBonus + area - centerDistance * 500;
      const id = findVideoIdNear(video) || fromUrl;
      if (id && score > bestScore) { bestScore = score; best = { video, id, rect }; }
    }
    if (best) return best;
    return fromUrl ? { video:null, id:fromUrl, rect:null } : null;
  }

  function formatNumber(value, digits = 0) {
    if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "—";
    return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(Number(value));
  }

  function formatCompact(value) {
    if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "—";
    const n = Number(value), a = Math.abs(n);
    const compact = (d, s) => `${(n / d).toFixed(a >= d * 100 ? 0 : a >= d * 10 ? 1 : 2).replace(/\.0+$|(?<=\.[0-9])0$/g, "")}${s}`;
    if (a >= 1e12) return compact(1e12, "T");
    if (a >= 1e9) return compact(1e9, "B");
    if (a >= 1e6) return compact(1e6, "M");
    if (a >= 1e3) return compact(1e3, "K");
    return formatNumber(n, 2);
  }

  function percent(value, digits = 2) {
    return Number.isFinite(Number(value)) ? `${formatNumber(value, digits)}%` : "—";
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
  }

  function ageText(timestamp) {
    const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp || Date.now())) / 1000));
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  }

  function currencyText(value, currency) {
    const text = formatCompact(value);
    return text === "—" ? text : `${text} ${currency || ""}`.trim();
  }

  function styleText() {
    return `
      .tdt-shop-gmv-dock-btn{position:relative!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:4px!important;width:auto!important;min-width:58px!important;max-width:106px!important;height:32px!important;padding:0 8px!important;border-radius:999px!important;color:#fff9d8!important;background:linear-gradient(135deg,rgba(245,158,11,.42),rgba(234,179,8,.20))!important;border-color:rgba(253,224,71,.54)!important;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif!important;white-space:nowrap!important}.tdt-shop-gmv-dock-btn:hover{background:linear-gradient(135deg,rgba(245,158,11,.58),rgba(234,179,8,.31))!important;border-color:rgba(254,240,138,.78)!important}.tdt-shop-gmv-dock-btn .tdt-gmv-icon{display:inline-grid;place-items:center;flex:0 0 auto;width:18px;height:18px;border-radius:50%;color:#1d1600;background:#fde047;font-size:7px;font-weight:1000;letter-spacing:-.2px;text-shadow:none}.tdt-shop-gmv-dock-btn .tdt-gmv-value{display:block;max-width:68px;overflow:hidden;color:#fffbe8;font-size:9px;font-weight:950;line-height:1;text-overflow:ellipsis}.tdt-shop-gmv-dock-btn[data-state="loading"] .tdt-gmv-icon{animation:tdtGmvPulse .9s infinite}.tdt-shop-gmv-dock-btn[data-state="error"]{color:#ffe4e6!important;background:rgba(159,18,57,.36)!important;border-color:rgba(251,113,133,.55)!important}.tdt-shop-gmv-dock-btn[data-state="error"] .tdt-gmv-icon{color:#fff;background:#fb7185}.tdt-shop-gmv-dock-btn[data-state="ok"] .tdt-gmv-icon{background:#86efac}.tdt-shop-gmv-dock-btn[data-state="idle"] .tdt-gmv-icon{background:#fde68a}@keyframes tdtGmvPulse{50%{opacity:.45;transform:scale(.9)}}
      .tdt-shop-panel{position:absolute;left:50%;top:52px;right:auto;bottom:auto;z-index:120;width:min(330px,calc(100% - 16px));max-height:min(560px,72vh);overflow:auto;box-sizing:border-box;padding:10px;border:1px solid rgba(255,255,255,.16);border-radius:16px;color:#f7f8fb;background:linear-gradient(155deg,rgba(12,14,21,.985),rgba(18,20,29,.975));box-shadow:0 22px 60px rgba(0,0,0,.52),inset 0 1px 0 rgba(255,255,255,.06);backdrop-filter:blur(18px) saturate(145%);transform:translateX(-50%);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;pointer-events:auto}.tdt-shop-panel[hidden]{display:none!important}.tdt-shop-panel *{box-sizing:border-box}.tdt-shop-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.tdt-shop-head strong{display:block;font-size:13px;line-height:1.15}.tdt-shop-head small{display:block;margin-top:3px;color:#8993a6;font-size:9px}.tdt-shop-source-badge{display:inline-flex;align-items:center;margin-top:4px;padding:2px 6px;border-radius:999px;color:#d8e0eb;background:rgba(255,255,255,.06);font-size:7px;font-weight:900}.tdt-shop-rangebar{display:flex;gap:5px;margin-top:8px}.tdt-shop-rangebox{display:flex;align-items:center;gap:4px;min-width:0;padding:3px 5px;border:1px solid rgba(255,255,255,.07);border-radius:8px;background:rgba(255,255,255,.025)}.tdt-shop-rangebox span{color:#727e91;font-size:6.5px;font-weight:900;text-transform:uppercase}.tdt-shop-rangebox select{max-width:190px;height:22px;padding:0 18px 0 5px;border:0;outline:0;border-radius:6px;color:#dfe6ef;background:#191d26;font:800 7.5px/1 Inter,system-ui,sans-serif}.tdt-shop-rangebox[hidden]{display:none!important}.tdt-shop-close{width:25px;height:25px;padding:0;border:0;border-radius:8px;color:#abb4c4;background:rgba(255,255,255,.06);cursor:pointer;font-size:17px}.tdt-shop-close:hover{color:#fff;background:rgba(255,255,255,.11)}
      .tdt-shop-compare{display:block;margin-top:8px}.tdt-shop-provider{min-width:0;padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.035)}.tdt-shop-provider.kalo{border-color:rgba(139,124,255,.2)}.tdt-shop-provider.echo{border-color:rgba(37,244,238,.17)}.tdt-shop-provider-title{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px}.tdt-shop-provider-title b{font-size:10px}.tdt-shop-provider-title span{padding:2px 5px;border-radius:999px;color:#9fa9ba;background:rgba(255,255,255,.06);font-size:7px;font-weight:850}.tdt-shop-big{display:grid;grid-template-columns:1fr 1.25fr;gap:5px}.tdt-shop-metric{min-width:0;padding:6px;border-radius:9px;background:rgba(255,255,255,.045)}.tdt-shop-metric span{display:block;color:#8791a4;font-size:6.5px;font-weight:800;text-transform:uppercase;letter-spacing:.35px}.tdt-shop-metric b{display:block;margin-top:2px;overflow:hidden;font-size:13px;line-height:1.1;text-overflow:ellipsis;white-space:nowrap}.tdt-shop-metric.sales b{color:#ff8ea5}.tdt-shop-metric.money b{color:#76fff0}.tdt-shop-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:5px}.tdt-shop-grid .tdt-shop-metric{padding:5px}.tdt-shop-grid .tdt-shop-metric b{font-size:10px}.tdt-shop-meta{margin-top:6px;color:#778296;font-size:7.5px;line-height:1.45;word-break:break-word}.tdt-shop-warning{margin-top:6px;padding:6px 7px;border-radius:8px;color:#ffd7a6;background:rgba(245,158,11,.09);font-size:7.5px;line-height:1.4}.tdt-shop-error{padding:10px 6px;color:#ff9aaa;text-align:center;font-size:8px;line-height:1.45}.tdt-shop-empty{padding:10px 6px;color:#909aad;text-align:center;font-size:8px;line-height:1.45}.tdt-shop-actions{display:flex;align-items:center;justify-content:space-between;gap:7px;margin-top:8px}.tdt-shop-actions small{min-width:0;overflow:hidden;color:#687386;font-size:7px;text-overflow:ellipsis;white-space:nowrap}.tdt-shop-refresh{flex:0 0 auto;padding:6px 9px;border:1px solid rgba(37,244,238,.19);border-radius:9px;color:#c5fff9;background:rgba(37,244,238,.07);cursor:pointer;font-size:8px;font-weight:900}.tdt-shop-refresh:hover{background:rgba(37,244,238,.13)}.tdt-shop-refresh:disabled{opacity:.5;cursor:wait}
      @media(max-width:620px){.tdt-shop-panel{width:min(318px,calc(100% - 12px));top:48px;padding:8px}.tdt-shop-grid{grid-template-columns:repeat(2,1fr)}.tdt-shop-gmv-dock-btn{min-width:50px!important;max-width:82px!important;padding:0 6px!important}.tdt-shop-gmv-dock-btn .tdt-gmv-value{max-width:50px;font-size:8px}}
    `;
  }

  function providerState() {
    const provider = selectedProvider();
    if (!uiSettings.dockEnabled || !selectedSettingsEnabled()) return "idle";
    if (loading[provider]) return "loading";
    if (errors[provider]) return "error";
    if (results[provider]?.found) return "ok";
    return "idle";
  }

  function echoRangeOptions() {
    return [["lifetime","Tổng"],["1d","1 ngày"],["3d","3 ngày"],["7d","7 ngày"],["14d","14 ngày"],["30d","30 ngày"],["custom","Tùy chọn"]];
  }

  function kaloRangeOptions(current = kaloSettings.dateRange) {
    const list = [["last7Day","7 ngày"],["last30Day","30 ngày"]];
    const now = new Date();
    for (let offset = 0; offset < 18; offset += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}`;
      list.push([value, `${String(d.getMonth() + 1).padStart(2,"0")}/${d.getFullYear()}`]);
    }
    if (current && !list.some(([value]) => value === current)) list.push([current, current]);
    return list;
  }

  function optionHtml(options, selected) {
    return options.map(([value,label]) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(label)}</option>`).join("");
  }

  function refreshRangeControls() {
    if (!panel) return;
    const echoBox = panel.querySelector('[data-provider-range="echo"]');
    const kaloBox = panel.querySelector('[data-provider-range="kalo"]');
    const provider = selectedProvider();
    if (echoBox) echoBox.hidden = provider !== "echo";
    if (kaloBox) kaloBox.hidden = provider !== "kalo";
    const echoSelect = panel.querySelector(".tdt-shop-echo-range");
    const kaloSelect = panel.querySelector(".tdt-shop-kalo-range");
    if (echoSelect) {
      const html = optionHtml(echoRangeOptions(), echoSettings.rangePreset || "lifetime");
      if (echoSelect.innerHTML !== html) echoSelect.innerHTML = html;
      echoSelect.value = echoSettings.rangePreset || "lifetime";
      echoSelect.title = echoSettings.rangePreset === "custom" && echoSettings.customStart && echoSettings.customEnd ? `${echoSettings.customStart} → ${echoSettings.customEnd}` : "Khoảng thời gian EchoTik";
    }
    if (kaloSelect) {
      const html = optionHtml(kaloRangeOptions(kaloSettings.dateRange), kaloSettings.dateRange || "last30Day");
      if (kaloSelect.innerHTML !== html) kaloSelect.innerHTML = html;
      kaloSelect.value = kaloSettings.dateRange || "last30Day";
    }
  }

  async function changeProviderRange(provider, value) {
    if (!currentVideoId) return;
    suppressStorageReanalyzeUntil = Date.now() + 1200;
    if (provider === "echo") {
      echoSettings = normalizeEcho({ ...echoSettings, rangePreset:value });
      await storageSet({ [ECHOTIK_SETTINGS_KEY]: echoSettings });
      results.echo = null; errors.echo = "";
      await analyzeVideo(currentVideoId, true, "echo");
    } else {
      kaloSettings = normalizeKalo({ ...kaloSettings, dateRange:value });
      await storageSet({ [KALODATA_SETTINGS_KEY]: kaloSettings });
      results.kalo = null; errors.kalo = "";
      await analyzeVideo(currentVideoId, true, "kalo");
    }
    refreshRangeControls(); renderPanel();
  }

  function renderKalo(result, error) {
    if (!kaloSettings.enabled) return "";
    if (error) return `<section class="tdt-shop-provider kalo"><div class="tdt-shop-provider-title"><b>Kalodata</b><span>Lỗi</span></div><div class="tdt-shop-error">${esc(error)}</div></section>`;
    if (!result) return `<section class="tdt-shop-provider kalo"><div class="tdt-shop-provider-title"><b>Kalodata</b><span>OPEN API</span></div><div class="tdt-shop-empty">${loading.kalo ? "Đang tải…" : "Chưa có dữ liệu"}</div></section>`;
    if (!result.found) return `<section class="tdt-shop-provider kalo"><div class="tdt-shop-provider-title"><b>Kalodata</b><span>${esc(result.dateRange || kaloSettings.dateRange)}</span></div><div class="tdt-shop-empty">${esc(result.message || "Không có dữ liệu video")}</div></section>`;
    const sales = result.salesAvailable === false ? null : result.sales;
    const gmv = result.gmv, views = result.views;
    const salesPer1k = Number(views) > 0 && Number.isFinite(Number(sales)) ? Number(sales) / Number(views) * 1000 : null;
    const saleRate = Number(views) > 0 && Number.isFinite(Number(sales)) ? Number(sales) / Number(views) * 100 : null;
    const avgOrder = Number(sales) > 0 && Number.isFinite(Number(gmv)) ? Number(gmv) / Number(sales) : null;
    const adsShare = Number(views) > 0 && Number.isFinite(Number(result.adsViews)) ? Number(result.adsViews) / Number(views) * 100 : null;
    const revenuePer1k = Number(views) > 0 && Number.isFinite(Number(gmv)) ? Number(gmv) / Number(views) * 1000 : null;
    const organicViews = Number.isFinite(Number(views)) && Number.isFinite(Number(result.adsViews)) ? Math.max(0, Number(views) - Number(result.adsViews)) : null;
    const missingSales = sales === null || !Number.isFinite(Number(sales));
    const diagnostics = missingSales ? `<div class="tdt-shop-warning"><b>sales_volume chưa có trong payload.</b>${result.responseKeySample ? ` Keys: ${esc(result.responseKeySample)}` : ""}</div>` : "";
    return `<section class="tdt-shop-provider kalo">
      <div class="tdt-shop-provider-title"><b>Kalodata</b><span>${esc(result.dateRange || kaloSettings.dateRange)}</span></div>
      <div class="tdt-shop-big"><div class="tdt-shop-metric sales"><span>Lượt bán</span><b>${formatNumber(sales)}</b></div><div class="tdt-shop-metric money"><span>Revenue</span><b>${currencyText(gmv, result.currency || kaloSettings.currency)}</b></div></div>
      <div class="tdt-shop-grid">
        <div class="tdt-shop-metric"><span>Views</span><b>${formatCompact(views)}</b></div><div class="tdt-shop-metric"><span>Sales / 1K</span><b>${formatNumber(salesPer1k,2)}</b></div><div class="tdt-shop-metric"><span>Sales/View</span><b>${percent(saleRate,3)}</b></div>
        <div class="tdt-shop-metric"><span>Revenue/đơn</span><b>${currencyText(avgOrder,result.currency||kaloSettings.currency)}</b></div><div class="tdt-shop-metric"><span>Video GPM</span><b>${formatNumber(result.gpm,2)}</b></div><div class="tdt-shop-metric"><span>Sản phẩm</span><b>${formatNumber(result.productNumber)}</b></div>
        <div class="tdt-shop-metric"><span>Ads views</span><b>${formatCompact(result.adsViews)}</b></div><div class="tdt-shop-metric"><span>Organic views</span><b>${formatCompact(organicViews)}</b></div><div class="tdt-shop-metric"><span>Ads share</span><b>${percent(adsShare,1)}</b></div>
        <div class="tdt-shop-metric"><span>Ads ROAS</span><b>${formatNumber(result.adsRoas,2)}</b></div><div class="tdt-shop-metric"><span>Ads period</span><b>${result.adsPeriod == null ? "—" : `${formatNumber(result.adsPeriod)}d`}</b></div><div class="tdt-shop-metric"><span>Revenue / 1K</span><b>${currencyText(revenuePer1k,result.currency||kaloSettings.currency)}</b></div>
        <div class="tdt-shop-metric"><span>Cache</span><b>${result.cached ? "Có" : "Mới"}</b></div><div class="tdt-shop-metric"><span>Video ID</span><b>${esc(String(result.videoId || "").slice(-8))}</b></div><div class="tdt-shop-metric"><span>Creator ID</span><b>${result.creatorId ? esc(String(result.creatorId).slice(-8)) : "—"}</b></div>
      </div>
      <div class="tdt-shop-meta">${result.creatorHandle ? `@${esc(String(result.creatorHandle).replace(/^@/,""))} · ` : ""}${esc(result.region || kaloSettings.region)} · ${esc(result.currency || kaloSettings.currency)} · cập nhật ${ageText(result.fetchedAt)}${result.salesSourcePath ? `<br>Sales field: <b>${esc(result.salesSourcePath)}</b>` : ""}${result.revenueSourcePath ? ` · Revenue: <b>${esc(result.revenueSourcePath)}</b>` : ""}${result.title ? `<br>${esc(result.title)}` : ""}</div>${diagnostics}
    </section>`;
  }

  function renderEcho(result, error) {
    if (!echoSettings.enabled) return "";
    if (error) return `<section class="tdt-shop-provider echo"><div class="tdt-shop-provider-title"><b>EchoTik</b><span>Lỗi</span></div><div class="tdt-shop-error">${esc(error)}</div></section>`;
    if (!result) return `<section class="tdt-shop-provider echo"><div class="tdt-shop-provider-title"><b>EchoTik</b><span>API</span></div><div class="tdt-shop-empty">${loading.echo ? "Đang tải…" : "Chưa có dữ liệu"}</div></section>`;
    if (!result.found) return `<section class="tdt-shop-provider echo"><div class="tdt-shop-provider-title"><b>EchoTik</b><span>${esc(result.rangeLabel || "Tổng")}</span></div><div class="tdt-shop-empty">${esc(result.message || "Không có dữ liệu video")}</div></section>`;
    const sales = result.sales, gmv = result.gmv, views = result.views;
    const salesPer1k = Number(views) > 0 ? Number(sales) / Number(views) * 1000 : null;
    const avgOrder = Number(sales) > 0 ? Number(gmv) / Number(sales) : null;
    const interactions = [result.likes,result.comments,result.shares].reduce((sum, value) => sum + (Number(value) || 0), 0);
    const engagement = Number(views) > 0 ? interactions / Number(views) * 100 : null;
    const likeRate = Number(views) > 0 ? (Number(result.likes) || 0) / Number(views) * 100 : null;
    const commentRate = Number(views) > 0 ? (Number(result.comments) || 0) / Number(views) * 100 : null;
    const shareRate = Number(views) > 0 ? (Number(result.shares) || 0) / Number(views) * 100 : null;
    const published = Number(result.createTime) > 0 ? new Date(Number(result.createTime) * 1000).toLocaleDateString("vi-VN") : "—";
    const resolution = Number(result.width) > 0 && Number(result.height) > 0 ? `${formatNumber(result.width)}×${formatNumber(result.height)}` : (result.ratio || "—");
    const rangeBadge = result.rangeAccurate === false ? `${result.rangeLabel || "Range"}*` : (result.rangeLabel || "Tổng");
    return `<section class="tdt-shop-provider echo">
      <div class="tdt-shop-provider-title"><b>EchoTik</b><span>${esc(rangeBadge)}</span></div>
      <div class="tdt-shop-big"><div class="tdt-shop-metric sales"><span>Lượt bán</span><b>${formatNumber(sales)}</b></div><div class="tdt-shop-metric money"><span>GMV</span><b>${formatCompact(gmv)}</b></div></div>
      <div class="tdt-shop-grid">
        <div class="tdt-shop-metric"><span>Views</span><b>${formatCompact(views)}</b></div><div class="tdt-shop-metric"><span>Sales / 1K</span><b>${formatNumber(salesPer1k,2)}</b></div><div class="tdt-shop-metric"><span>GMV / đơn</span><b>${formatCompact(avgOrder)}</b></div>
        <div class="tdt-shop-metric"><span>Likes</span><b>${formatCompact(result.likes)}</b></div><div class="tdt-shop-metric"><span>Comments</span><b>${formatCompact(result.comments)}</b></div><div class="tdt-shop-metric"><span>Shares</span><b>${formatCompact(result.shares)}</b></div>
        <div class="tdt-shop-metric"><span>Favorites</span><b>${formatCompact(result.favorites)}</b></div><div class="tdt-shop-metric"><span>Engagement</span><b>${percent(engagement,2)}</b></div><div class="tdt-shop-metric"><span>Sales flag</span><b>${formatNumber(result.salesFlag)}</b></div>
        <div class="tdt-shop-metric"><span>Like rate</span><b>${percent(likeRate,2)}</b></div><div class="tdt-shop-metric"><span>Comment rate</span><b>${percent(commentRate,3)}</b></div><div class="tdt-shop-metric"><span>Share rate</span><b>${percent(shareRate,3)}</b></div>
        <div class="tdt-shop-metric"><span>Đăng ngày</span><b>${esc(published)}</b></div><div class="tdt-shop-metric"><span>Duration</span><b>${Number(result.duration)>0 ? `${formatNumber(result.duration)}s` : "—"}</b></div><div class="tdt-shop-metric"><span>Resolution</span><b>${esc(resolution)}</b></div>
      </div>
      <div class="tdt-shop-meta">${result.creator ? `@${esc(result.creator)} · ` : ""}${esc(result.region || "—")} · ${esc(result.sourceMode || "API")} · cập nhật ${ageText(result.fetchedAt)}${result.latestTrendDate ? ` · snapshot ${esc(result.latestTrendDate)}` : ""}${result.videoDesc ? `<br>${esc(result.videoDesc)}` : ""}</div>${result.rangeWarning ? `<div class="tdt-shop-warning">${esc(result.rangeWarning)}</div>` : ""}
    </section>`;
  }

  function comparisonHtml() { return ""; }

  function updateDockButton() {
    if (!controlButton) return;
    const provider = selectedProvider();
    const result = results[provider];
    const state = providerState();
    controlButton.dataset.state = state;
    const value = controlButton.querySelector?.(".tdt-gmv-value");
    let text = "—";
    if (state === "loading") text = "…";
    else if (result?.found && Number.isFinite(Number(result.gmv))) text = formatCompact(result.gmv);
    else if (errors[provider]) text = "!";
    if (value) value.textContent = text;
    const providerLabel = selectedProviderLabel();
    const rangeLabel = provider === "kalo" ? (result?.dateRange || kaloSettings.dateRange) : (result?.rangeLabel || echoSettings.rangePreset);
    controlButton.title = `${providerLabel} · GMV ${text}${rangeLabel ? ` · ${rangeLabel}` : ""}`;
    controlButton.setAttribute("aria-label", controlButton.title);
  }

  function renderPanel() {
    if (!panel) return;
    refreshRangeControls();
    const state = providerState();
    updateDockButton();
    const refresh = panel.querySelector(".tdt-shop-refresh");
    if (refresh) refresh.disabled = loading.echo || loading.kalo;
    const body = panel.querySelector(".tdt-shop-body");
    const subtitle = panel.querySelector(".tdt-shop-subtitle");
    if (subtitle) subtitle.textContent = currentVideoId ? `Video ${currentVideoId}` : "Chưa nhận diện video";
    const sourceBadge = panel.querySelector(".tdt-shop-source-badge");
    if (sourceBadge) sourceBadge.textContent = selectedProviderLabel();
    const provider = selectedProvider();
    if (body) body.innerHTML = `<div class="tdt-shop-compare">${provider === "kalo" ? renderKalo(results.kalo,errors.kalo) : renderEcho(results.echo,errors.echo)}</div>`;
    const foot = panel.querySelector(".tdt-shop-foot-status");
    if (foot) {
      const provider = selectedProvider();
      const enabled = selectedSettingsEnabled() ? selectedProviderLabel() : `${selectedProviderLabel()} đang tắt`;
      foot.textContent = `${enabled}${loading[provider] ? " · đang tải" : ""}`;
    }
  }

  function makePanel(root, native = false) {
    const element = document.createElement("section");
    element.className = `tdt-shop-panel${native ? " tdt-native-api-panel" : ""}`;
    element.hidden = !panelOpen;
    element.innerHTML = `<div class="tdt-shop-head"><div><strong>Shop Analytics</strong><small class="tdt-shop-subtitle">Đang nhận diện video…</small><span class="tdt-shop-source-badge"></span></div><button class="tdt-shop-close" type="button" aria-label="Đóng">×</button></div><div class="tdt-shop-rangebar"><label class="tdt-shop-rangebox" data-provider-range="kalo"><span>Range</span><select class="tdt-shop-kalo-range" aria-label="Khoảng thời gian Kalodata"></select></label><label class="tdt-shop-rangebox" data-provider-range="echo"><span>Range</span><select class="tdt-shop-echo-range" aria-label="Khoảng thời gian EchoTik"></select></label></div><div class="tdt-shop-body"></div><div class="tdt-shop-actions"><small class="tdt-shop-foot-status"></small><button class="tdt-shop-refresh" type="button">Làm mới</button></div>`;
    element.querySelector(".tdt-shop-close").addEventListener("click", (event) => { event.stopPropagation(); panelOpen = false; element.hidden = true; });
    element.querySelector(".tdt-shop-refresh").addEventListener("click", (event) => { event.stopPropagation(); void analyzeCurrent(true, selectedProvider()).catch(() => {}); });
    element.querySelector(".tdt-shop-echo-range").addEventListener("change", (event) => { event.stopPropagation(); void changeProviderRange("echo", event.target.value).catch((error) => { errors.echo = String(error?.message || error); renderPanel(); }); });
    element.querySelector(".tdt-shop-kalo-range").addEventListener("change", (event) => { event.stopPropagation(); void changeProviderRange("kalo", event.target.value).catch((error) => { errors.kalo = String(error?.message || error); renderPanel(); }); });
    refreshRangeControls();
    return element;
  }

  function ensureCustomUi() {
    const host = document.getElementById("tdt-tiktok-extension-host");
    const root = host?.shadowRoot;
    const dock = root?.querySelector(".control-dock");
    const playerPanel = root?.querySelector("#panel");
    if (!root || !dock || !playerPanel) return false;
    if (customRoot !== root || !controlButton?.isConnected || !panel?.isConnected) {
      removeFallbackUi();
      customRoot = root;
      let style = root.getElementById("tdt-shop-analytics-style");
      if (!style) { style = document.createElement("style"); style.id = "tdt-shop-analytics-style"; style.textContent = styleText(); root.appendChild(style); }
      controlButton = document.createElement("button");
      controlButton.type = "button";
      controlButton.className = "player-icon-btn tdt-shop-gmv-dock-btn";
      controlButton.innerHTML = `<span class="tdt-gmv-icon">GMV</span><span class="tdt-gmv-value">—</span>`;
      controlButton.title = "Shop Analytics";
      controlButton.setAttribute("aria-label", controlButton.title);
      controlButton.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); panelOpen = !panelOpen; if (panel) panel.hidden = !panelOpen; renderPanel(); });
      dock.appendChild(controlButton);
      panel = makePanel(root, false);
      playerPanel.appendChild(panel);
      renderPanel();
    }
    return true;
  }

  function ensureFallbackHost() {
    if (fallbackHost?.isConnected) return;
    fallbackHost = document.createElement("div");
    fallbackHost.id = "tdt-shop-native-analytics-host";
    fallbackHost.style.cssText = "all:initial;position:fixed;z-index:2147483100;pointer-events:none;";
    document.documentElement.appendChild(fallbackHost);
    fallbackRoot = fallbackHost.attachShadow({ mode:"open" });
    const style = document.createElement("style"); style.textContent = styleText();
    const wrap = document.createElement("div"); wrap.className = "tdt-native-api-wrap";
    controlButton = document.createElement("button"); controlButton.type = "button"; controlButton.className = "tdt-native-api-btn"; controlButton.textContent = "API"; controlButton.title = "Shop Analytics · EchoTik + Kalodata";
    controlButton.addEventListener("click", (event) => { event.stopPropagation(); panelOpen = !panelOpen; if (panel) panel.hidden = !panelOpen; positionFallback(); renderPanel(); });
    panel = makePanel(fallbackRoot, true);
    wrap.append(controlButton);
    fallbackRoot.append(style, wrap, panel);
    renderPanel();
  }

  function positionFallback() {
    if (!fallbackHost?.isConnected) return;
    const info = activeVideoInfo();
    const rect = info?.video?.getBoundingClientRect?.();
    if (!rect || rect.width < 80 || rect.height < 80) { fallbackHost.style.display = "none"; return; }
    fallbackHost.style.display = cleanMode ? "none" : "block";
    const left = Math.max(8, Math.min(innerWidth - 46, rect.right - 48));
    const top = Math.max(8, Math.min(innerHeight - 38, rect.bottom - 48));
    const key = `${Math.round(left)}|${Math.round(top)}|${Math.round(rect.left)}|${Math.round(rect.top)}|${Math.round(rect.width)}|${Math.round(rect.height)}`;
    if (key !== lastFallbackRectKey) {
      lastFallbackRectKey = key;
      const wrap = fallbackRoot?.querySelector(".tdt-native-api-wrap");
      if (wrap) { wrap.style.left = `${left}px`; wrap.style.top = `${top}px`; }
      if (panel && panelOpen) {
        const panelWidth = Math.min(372, innerWidth - 16);
        const panelLeft = Math.max(8, Math.min(innerWidth - panelWidth - 8, rect.right - panelWidth - 8));
        const panelTop = Math.max(8, Math.min(innerHeight - Math.min(570, innerHeight * .7) - 8, rect.bottom - Math.min(570, innerHeight * .7) - 58));
        panel.style.left = `${panelLeft}px`; panel.style.top = `${panelTop}px`; panel.style.width = `${panelWidth}px`;
      }
    }
  }

  function removeFallbackUi() {
    fallbackHost?.remove();
    fallbackHost = fallbackRoot = null;
    lastFallbackRectKey = "";
  }

  function ensureUi() {
    const shouldShow = uiSettings.dockEnabled && !cleanMode && selectedSettingsEnabled();
    if (!shouldShow) {
      if (controlButton) controlButton.style.display = "none";
      if (panel) panel.hidden = true;
      panelOpen = false;
      removeFallbackUi();
      return false;
    }
    removeFallbackUi();
    if (ensureCustomUi()) {
      if (controlButton) controlButton.style.display = "flex";
      updateDockButton();
      return true;
    }
    if (customRoot && !document.getElementById("tdt-tiktok-extension-host")?.shadowRoot?.contains(controlButton)) { customRoot = null; controlButton = panel = null; }
    return false;
  }

  function runtimeRequest(type, videoId, force) {
    return new Promise((resolve, reject) => chrome.runtime.sendMessage({ type, videoId, force }, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!response?.ok) return reject(new Error(response?.error || "API request failed"));
      resolve(response.data);
    }));
  }

  async function analyzeProvider(provider, videoId, force = false, token = requestToken) {
    if (provider === "echo" && !echoSettings.enabled) return null;
    if (provider === "kalo" && !kaloSettings.enabled) return null;
    loading[provider] = true; errors[provider] = ""; renderPanel();
    try {
      const data = await runtimeRequest(provider === "echo" ? "ECHOTIK_VIDEO_ANALYTICS" : "KALODATA_VIDEO_ANALYTICS", videoId, force);
      if (token !== requestToken || videoId !== currentVideoId) return null;
      results[provider] = data; errors[provider] = ""; return data;
    } catch (error) {
      if (token !== requestToken || videoId !== currentVideoId) return null;
      errors[provider] = String(error?.message || "API lỗi"); results[provider] = null; throw error;
    } finally {
      if (token === requestToken && videoId === currentVideoId) { loading[provider] = false; renderPanel(); }
    }
  }

  async function analyzeVideo(videoId, force = false, onlyProvider = "") {
    if (!videoId) return null;
    const changed = videoId !== currentVideoId;
    if (changed) {
      currentVideoId = videoId; requestToken += 1; results = { echo:null, kalo:null }; errors = { echo:"", kalo:"" }; loading = { echo:false, kalo:false };
    } else if (force) requestToken += 1;
    const token = requestToken;
    ensureUi(); renderPanel();
    const tasks = [];
    const provider = onlyProvider || selectedProvider();
    if (provider === "echo" && echoSettings.enabled) tasks.push(analyzeProvider("echo", videoId, force, token).catch(() => null));
    if (provider === "kalo" && kaloSettings.enabled) tasks.push(analyzeProvider("kalo", videoId, force, token).catch(() => null));
    await Promise.all(tasks);
    return onlyProvider ? results[onlyProvider] : results[provider];
  }

  async function analyzeCurrent(force = false, onlyProvider = "") {
    const info = activeVideoInfo();
    const id = info?.id || currentVideoId;
    if (!id) throw new Error("Chưa nhận diện được Video ID TikTok đang phát.");
    return analyzeVideo(id, force, onlyProvider);
  }

  async function loadSettings(reanalyze = false) {
    const stored = await storageGet({ [ECHOTIK_SETTINGS_KEY]: DEFAULT_ECHO, [KALODATA_SETTINGS_KEY]: DEFAULT_KALO, [MAIN_SETTINGS_KEY]: {}, [SHOP_ANALYTICS_UI_KEY]: null });
    echoSettings = normalizeEcho(stored[ECHOTIK_SETTINGS_KEY]);
    kaloSettings = normalizeKalo(stored[KALODATA_SETTINGS_KEY]);
    cleanMode = stored[MAIN_SETTINGS_KEY]?.cleanMode === true;
    uiSettings = normalizeUi(stored[SHOP_ANALYTICS_UI_KEY]);
    if (!stored[SHOP_ANALYTICS_UI_KEY]?.provider && kaloSettings.enabled && !echoSettings.enabled) uiSettings.provider = "kalodata";
    ensureUi(); renderPanel();
    if (reanalyze && currentVideoId && uiSettings.dockEnabled && selectedSettingsEnabled()) void analyzeVideo(currentVideoId, true).catch(() => {});
  }

  function scan() {
    if (document.hidden || !uiSettings.dockEnabled || !selectedSettingsEnabled()) { ensureUi(); return; }
    if (!ensureUi()) return;
    const info = activeVideoInfo();
    if (!info?.id) return;
    if (info.id !== currentVideoId) void analyzeVideo(info.id, false).catch(() => {});
  }

  function scheduleScan(delay = DOM_DEBOUNCE_MS) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scan, Math.max(0, delay));
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[ECHOTIK_SETTINGS_KEY] || changes[KALODATA_SETTINGS_KEY] || changes[MAIN_SETTINGS_KEY] || changes[SHOP_ANALYTICS_UI_KEY]) {
      const providerChanged = Boolean(changes[ECHOTIK_SETTINGS_KEY] || changes[KALODATA_SETTINGS_KEY] || changes[SHOP_ANALYTICS_UI_KEY]);
      const shouldReanalyze = providerChanged && Date.now() > suppressStorageReanalyzeUntil;
      void loadSettings(shouldReanalyze);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "TDT_ECHOTIK_ANALYZE_NOW") {
      void analyzeCurrent(message.force !== false, "echo").then((data) => sendResponse({ ok:true, data })).catch((error) => sendResponse({ ok:false, error:String(error?.message || error) }));
      return true;
    }
    if (message?.type === "TDT_KALODATA_ANALYZE_NOW") {
      void analyzeCurrent(message.force !== false, "kalo").then((data) => sendResponse({ ok:true, data })).catch((error) => sendResponse({ ok:false, error:String(error?.message || error) }));
      return true;
    }
    if (message?.type === "TDT_SHOP_ANALYTICS_ANALYZE_NOW") {
      void analyzeCurrent(message.force !== false, selectedProvider()).then((data) => sendResponse({ ok:true, data })).catch((error) => sendResponse({ ok:false, error:String(error?.message || error) }));
      return true;
    }
    return false;
  });

  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleScan(0); });

  void loadSettings(false).then(() => {
    clearInterval(scanTimer);
    scanTimer = setInterval(scan, SCAN_INTERVAL_MS);
    observer = new MutationObserver((records) => {
      if (!uiSettings.dockEnabled || !selectedSettingsEnabled() || document.hidden) return;
      for (const record of records) {
        if (record.type !== "childList" || (!record.addedNodes.length && !record.removedNodes.length)) continue;
        const nodes = [...record.addedNodes, ...record.removedNodes];
        const relevant = nodes.some((node) => {
          if (!(node instanceof Element)) return false;
          if (node.matches?.("video,#tdt-tiktok-extension-host,.control-dock")) return true;
          return Boolean(node.querySelector?.("video,#tdt-tiktok-extension-host,.control-dock"));
        });
        if (relevant) { scheduleScan(90); break; }
      }
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
    scheduleScan(0);
  });
})();
