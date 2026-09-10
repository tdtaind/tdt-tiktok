"use strict";

const SETTINGS_KEY = "tdt_settings_v17";
const FONT_SIZE_KEY = "tdt_subtitle_font_size";
const SEARCH_KEY = "tdt_search_translate_settings_v1";
const SEARCH_FILTER_KEY = "tdt_search_filter_settings_v251";
const WATCH_ANALYTICS_KEY = "tdt_watch_analytics_v1";
const ECHOTIK_SETTINGS_KEY = "tdt_echotik_settings_v1";
const DEFAULT_ECHOTIK_SETTINGS = Object.freeze({ enabled: false, username: "", password: "", apiKey: "", authMode: "auto", rangePreset: "lifetime", customStart: "", customEnd: "", cacheMinutes: 30 });
const KALODATA_SETTINGS_KEY = "tdt_kalodata_settings_v1";
const DEFAULT_KALODATA_SETTINGS = Object.freeze({ enabled: false, baseUrl: "", accessKey: "", region: "VN", language: "vi-VN", currency: "VND", dateRange: "last30Day", cacheMinutes: 30 });
const SHOP_ANALYTICS_UI_KEY = "tdt_shop_analytics_ui_v1";
const DEFAULT_SHOP_ANALYTICS_UI = Object.freeze({ dockEnabled: true, provider: "echotik" });
const DEFAULT_SETTINGS = {
  autoReplace: true,
  scanSubtitles: false,
  translateVietnamese: true,
  autoplay: true,
  useSubtitleCache: true,
  autoCloseTranscriptWindow: true,
  subtitleBackgroundOpacity: 0.72,
  backgroundPlay: false,
  playbackRate: 1,
  playbackVolume: 1,
  smartAutoPause: false,
  placeBelowSubtitleTranslator: true,
  audioEnabled: false,
  equalizerEnabled: true,
  eqPreset: "flat",
  eqBands: [0, 0, 0, 0, 0, 0, 0, 0],
  adaptiveNormalizer: false,
  spatialAudio: false,
  spatialIntensity: 0.65,
  cleanMode: false,
  productWidgetEnabled: true,
  watchWidgetEnabled: true,
  showVideoStats: true,
  showVideoMeta: true,
  autoScrollEnabled: true
};
const EQ_FREQUENCIES = Object.freeze([60, 120, 250, 500, 1000, 2000, 4000, 8000]);
const EQ_PRESETS = Object.freeze({
  flat: [0, 0, 0, 0, 0, 0, 0, 0],
  bass: [8, 6, 4, 2, 0, -1, -2, -2],
  vocal: [-3, -2, 0, 3, 5, 4, 1, -1],
  rock: [5, 3, -1, -2, 1, 4, 6, 5],
  pop: [2, 4, 2, 0, 1, 3, 5, 4],
  electronic: [6, 4, 0, -2, 0, 3, 6, 7],
  treble: [-4, -3, -2, -1, 1, 4, 7, 9],
  soft: [2, 1, 0, 1, 2, 2, 1, 0]
});
const DEFAULT_SEARCH = { enabled: true, autoTranslateOnSearch: true, targetLanguage: "en" };
const DEFAULT_SEARCH_FILTER = { enabled: true };

const settingIds = ["autoReplace","scanSubtitles","translateVietnamese","autoplay","useSubtitleCache","autoCloseTranscriptWindow","cleanMode","showVideoStats","showVideoMeta","autoScrollEnabled","productWidgetEnabled","watchWidgetEnabled","placeBelowSubtitleTranslator","backgroundPlay","smartAutoPause","audioEnabled","equalizerEnabled","adaptiveNormalizer","spatialAudio"];

function clampEqGain(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(-12, Math.min(12, Math.round(parsed))) : 0;
}

function normalizeEqBands(value) {
  const source = Array.isArray(value) ? value : DEFAULT_SETTINGS.eqBands;
  return EQ_FREQUENCIES.map((_, index) => clampEqGain(source[index]));
}

function normalizeAudioSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const preset = Object.hasOwn(EQ_PRESETS, source.eqPreset) || source.eqPreset === "custom" ? source.eqPreset : "flat";
  return {
    ...source,
    audioEnabled: source.audioEnabled === true,
    equalizerEnabled: source.equalizerEnabled !== false,
    eqPreset: preset,
    eqBands: normalizeEqBands(source.eqBands),
    adaptiveNormalizer: source.adaptiveNormalizer === true,
    spatialAudio: source.spatialAudio === true,
    spatialIntensity: Math.max(0, Math.min(1, Number(source.spatialIntensity) || 0))
  };
}

function normalizeEchoTikSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const authModes = new Set(["auto", "keyapi", "legacy"]);
  const ranges = new Set(["lifetime", "1d", "3d", "7d", "14d", "30d", "custom"]);
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const authMode = String(source.authMode || "auto").trim().toLowerCase();
  const rangePreset = String(source.rangePreset || "lifetime").trim().toLowerCase();
  return {
    enabled: source.enabled === true,
    username: String(source.username || "").trim(),
    password: String(source.password || ""),
    apiKey: String(source.apiKey || "").trim(),
    authMode: authModes.has(authMode) ? authMode : "auto",
    rangePreset: ranges.has(rangePreset) ? rangePreset : "lifetime",
    customStart: datePattern.test(String(source.customStart || "")) ? String(source.customStart) : "",
    customEnd: datePattern.test(String(source.customEnd || "")) ? String(source.customEnd) : "",
    cacheMinutes: Math.max(5, Math.min(180, Math.round(Number(source.cacheMinutes) || 30)))
  };
}

function normalizeShopAnalyticsUi(value) {
  const source = value && typeof value === "object" ? value : {};
  const provider = String(source.provider || "echotik").trim().toLowerCase();
  return {
    dockEnabled: source.dockEnabled !== false,
    provider: provider === "kalodata" ? "kalodata" : "echotik"
  };
}

function normalizeKaloDataSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const regions = new Set(["US","GB","ID","TH","VN","PH","MY"]);
  const languages = new Set(["en-US","zh-CN","th-TH","id-ID","vi-VN"]);
  const currencies = new Set(["CNY","USD","IDR","VND","THB","MYR"]);
  const region = String(source.region || "VN").trim().toUpperCase();
  const language = String(source.language || "vi-VN").trim();
  const currency = String(source.currency || "VND").trim().toUpperCase();
  return {
    enabled: source.enabled === true,
    baseUrl: String(source.baseUrl || "").trim().replace(/\/+$/, ""),
    accessKey: String(source.accessKey || "").trim(),
    region: regions.has(region) ? region : "VN",
    language: languages.has(language) ? language : "vi-VN",
    currency: currencies.has(currency) ? currency : "VND",
    dateRange: String(source.dateRange || "last30Day").trim() || "last30Day",
    cacheMinutes: Math.max(5, Math.min(180, Math.round(Number(source.cacheMinutes) || 30)))
  };
}

function validateKaloDataBaseUrl(value) {
  let url;
  try { url = new URL(String(value || "").trim()); } catch (_error) { throw new Error("Kalodata API URL không hợp lệ."); }
  if (url.protocol !== "https:") throw new Error("Kalodata API URL phải dùng HTTPS.");
  const host = url.hostname.toLowerCase();
  const allowed = host === "kalodata.com" || host.endsWith(".kalodata.com") || host === "kalowave.com" || host.endsWith(".kalowave.com");
  if (!allowed) throw new Error("Kalodata API URL phải thuộc kalodata.com hoặc kalowave.com.");
  url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

function previewKaloDataEndpoint(value) {
  const normalized = validateKaloDataBaseUrl(value);
  const url = new URL(normalized);
  const canonicalPath = "/openapi/v1/video/detail";
  const host = String(url.hostname || "").toLowerCase();
  const path = String(url.pathname || "").replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  const lowerPath = path.toLowerCase();
  if (!path || path === "/" || lowerPath.includes("/open-center/docs")) {
    url.pathname = canonicalPath;
  } else {
    const openApiIndex = lowerPath.indexOf("/openapi");
    if (openApiIndex >= 0) {
      const prefix = path.slice(0, openApiIndex).replace(/\/+$/, "");
      url.pathname = `${prefix}${canonicalPath}`.replace(/\/{2,}/g, "/");
    } else if (host === "kalodata.com" || host === "www.kalodata.com") {
      url.pathname = canonicalPath;
    } else {
      url.pathname = `${path}${canonicalPath}`.replace(/\/{2,}/g, "/");
    }
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}

function storageGet(defaults) {
  return new Promise((resolve) => chrome.storage.local.get(defaults, (result) => resolve(result || defaults)));
}
function storageSet(values) {
  return new Promise((resolve, reject) => chrome.storage.local.set(values, () => chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve()));
}

document.addEventListener("DOMContentLoaded", async () => {
  const scanButton = document.getElementById("scan");
  const subButton = document.getElementById("get-sub");
  const status = document.getElementById("status");
  const toast = document.getElementById("toast");
  const proxyToggle = document.getElementById("tiktokProxyEnabled");
  const proxyState = document.getElementById("proxyState");
  const proxyEndpoint = document.getElementById("proxyEndpoint");
  const rotateProxyButton = document.getElementById("rotateProxy");
  const authGate = document.getElementById("authGate");
  const accountBar = document.getElementById("accountBar");
  const googleLoginButton = document.getElementById("googleLogin");
  const googleLogoutButton = document.getElementById("googleLogout");
  const authError = document.getElementById("authError");
  const accountAvatar = document.getElementById("accountAvatar");
  const accountName = document.getElementById("accountName");
  const accountEmail = document.getElementById("accountEmail");
  const accountStatus = document.getElementById("accountStatus");
  const accountSyncStatus = document.getElementById("accountSyncStatus");
  const accountSyncNow = document.getElementById("accountSyncNow");
  const proxyCountryButtons = [...document.querySelectorAll("[data-proxy-country]")];
  const proxyCountryNames = { vn: "Việt Nam", th: "Thái Lan", kh: "Campuchia" };
  let selectedProxyCountry = "th";
  let latencyMeasurementBusy = false;
  let remoteAccessAllowed = true;
  let googleSignedIn = false;
  let toastTimer = null;
  let settings = { ...DEFAULT_SETTINGS };
  let searchSettings = { ...DEFAULT_SEARCH };
  let searchFilterSettings = { ...DEFAULT_SEARCH_FILTER };
  let echoTikSettings = { ...DEFAULT_ECHOTIK_SETTINGS };
  let kaloDataSettings = { ...DEFAULT_KALODATA_SETTINGS };
  let shopAnalyticsUi = { ...DEFAULT_SHOP_ANALYTICS_UI };

  let watchAnalytics = { version: 1, updatedAt: 0, totalWatchedSeconds: 0, allTimeVideoIds: [], days: {}, history: [] };

  function watchDayKey(timestamp = Date.now()) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function formatWatchTime(value) {
    const total = Math.max(0, Math.floor(Number(value) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours) return `${hours}h ${minutes}m`;
    if (minutes) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }
  function formatWatchTimeDetailed(value) {
    const total = Math.max(0, Math.floor(Number(value) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }
  function formatVideoDuration(value) {
    const total = Math.max(0, Math.floor(Number(value) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
  }
  function watchRange(days) {
    const ids = new Set();
    let watchedSeconds = 0;
    for (let offset = 0; offset < days; offset += 1) {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - offset);
      const day = watchAnalytics.days?.[watchDayKey(date.getTime())] || {};
      watchedSeconds += Number(day.watchedSeconds) || 0;
      for (const id of Array.isArray(day.videoIds) ? day.videoIds : []) ids.add(String(id));
    }
    return { videos: ids.size, watchedSeconds };
  }
  function normalizeWatchAnalytics(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      version: 1,
      updatedAt: Math.max(0, Number(source.updatedAt) || 0),
      totalWatchedSeconds: Math.max(0, Number(source.totalWatchedSeconds) || 0),
      allTimeVideoIds: Array.isArray(source.allTimeVideoIds) ? source.allTimeVideoIds : [],
      days: source.days && typeof source.days === "object" ? source.days : {},
      history: Array.isArray(source.history) ? source.history.slice(0, 200) : []
    };
  }
  function setWatchDashboardActive() {
    document.getElementById("watchDashboardBtn").classList.add("active");
    document.getElementById("watchHistoryBtn").classList.remove("active");
    document.getElementById("watchDashboardPanel").hidden = false;
  }
  function openWatchHistoryModal() {
    const modal = document.getElementById("watchHistoryModal");
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("watchHistoryBtn").classList.add("active");
    document.getElementById("watchHistoryClose").focus();
  }
  function closeWatchHistoryModal() {
    const modal = document.getElementById("watchHistoryModal");
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.getElementById("watchHistoryBtn").classList.remove("active");
  }
  function renderWatchAnalytics() {
    const today = watchRange(1);
    const last7 = watchRange(7);
    const all = { videos: watchAnalytics.allTimeVideoIds.length, watchedSeconds: watchAnalytics.totalWatchedSeconds };
    document.getElementById("watchTodayTime").textContent = formatWatchTime(today.watchedSeconds);
    document.getElementById("watchTodayVideos").textContent = String(today.videos);
    document.getElementById("watchSummaryTodayVideos").textContent = `${today.videos} video`;
    document.getElementById("watchSummaryTodayTime").textContent = formatWatchTime(today.watchedSeconds);
    document.getElementById("watchSummary7Videos").textContent = `${last7.videos} video`;
    document.getElementById("watchSummary7Time").textContent = formatWatchTime(last7.watchedSeconds);
    document.getElementById("watchSummaryAllVideos").textContent = `${all.videos} video`;
    document.getElementById("watchSummaryAllTime").textContent = formatWatchTime(all.watchedSeconds);

    const weekdayLabels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const days = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - offset);
      const key = watchDayKey(date.getTime());
      const dayData = watchAnalytics.days?.[key] || {};
      days.push({
        key,
        label: weekdayLabels[date.getDay()],
        fullLabel: new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" }).format(date),
        seconds: Number(dayData.watchedSeconds) || 0,
        videos: new Set(Array.isArray(dayData.videoIds) ? dayData.videoIds.map(String) : []).size
      });
    }
    const max = Math.max(1, ...days.map((item) => item.seconds));
    const chart = document.getElementById("watchChart");
    if (chart.children.length !== 7) {
      chart.replaceChildren();
      for (let index = 0; index < 7; index += 1) {
        const column = document.createElement("div");
        column.className = "watch-chart-day";
        column.tabIndex = 0;
        column.setAttribute("role", "img");
        const tooltip = document.createElement("div"); tooltip.className = "watch-chart-tooltip";
        const tooltipDay = document.createElement("strong");
        const tooltipTime = document.createElement("span");
        const tooltipVideos = document.createElement("small");
        tooltip.append(tooltipDay, tooltipTime, tooltipVideos);
        const wrap = document.createElement("div"); wrap.className = "watch-chart-bar-wrap";
        const bar = document.createElement("div"); bar.className = "watch-chart-bar"; wrap.appendChild(bar);
        const label = document.createElement("small");
        column.append(tooltip, wrap, label);
        chart.appendChild(column);
      }
    }
    days.forEach((day, index) => {
      const column = chart.children[index];
      const tooltip = column.querySelector(".watch-chart-tooltip");
      const bar = column.querySelector(".watch-chart-bar");
      const label = column.lastElementChild;
      const detailText = `${day.fullLabel}: ${formatWatchTimeDetailed(day.seconds)} · ${day.videos} video`;
      column.dataset.dayKey = day.key;
      column.setAttribute("aria-label", detailText);
      column.title = detailText;
      tooltip.children[0].textContent = day.fullLabel;
      tooltip.children[1].textContent = formatWatchTimeDetailed(day.seconds);
      tooltip.children[2].textContent = `${day.videos} video`;
      bar.style.height = `${Math.max(day.seconds ? 5 : 2, Math.round(day.seconds / max * 100))}%`;
      label.textContent = day.label;
    });

    const list = document.getElementById("watchHistoryList"); list.replaceChildren();
    const history = watchAnalytics.history;
    document.getElementById("watchHistoryEmpty").hidden = history.length > 0;
    document.getElementById("watchHistoryClear").disabled = history.length === 0;
    for (const item of history) {
      const button = document.createElement("button"); button.type = "button"; button.className = "watch-history-card"; button.title = item.caption || item.url || "Mở video TikTok";
      const media = document.createElement("div"); media.className = "watch-history-media";
      if (item.thumbnail) { const image = document.createElement("img"); image.src = item.thumbnail; image.alt = ""; image.loading = "lazy"; image.referrerPolicy = "no-referrer"; media.appendChild(image); }
      const duration = document.createElement("span"); duration.className = "watch-history-duration"; duration.textContent = formatVideoDuration(item.duration); media.appendChild(duration);
      const info = document.createElement("div"); info.className = "watch-history-info";
      const author = document.createElement("strong"); author.textContent = item.author ? `@${item.author}` : "TikTok video";
      const meta = document.createElement("small"); meta.textContent = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(Number(item.lastWatchedAt) || Date.now()));
      info.append(author, meta); button.append(media, info);
      button.addEventListener("click", () => { if (item.url) chrome.tabs.create({ url: item.url }); closeWatchHistoryModal(); });
      list.appendChild(button);
    }
  }
  async function loadWatchAnalytics() {
    const stored = await storageGet({ [WATCH_ANALYTICS_KEY]: {} });
    watchAnalytics = normalizeWatchAnalytics(stored[WATCH_ANALYTICS_KEY]);
    renderWatchAnalytics();
  }

  const eqGrid = document.getElementById("eqGrid");
  EQ_FREQUENCIES.forEach((frequency, index) => {
    const band = document.createElement("label");
    band.className = "eq-band";
    const name = document.createElement("span");
    name.textContent = frequency >= 1000 ? `${frequency / 1000}k` : String(frequency);
    const range = document.createElement("input");
    range.type = "range";
    range.min = "-12";
    range.max = "12";
    range.step = "1";
    range.dataset.eqIndex = String(index);
    range.setAttribute("aria-label", `${frequency} Hz`);
    const output = document.createElement("output");
    output.dataset.eqValue = String(index);
    band.append(name, range, output);
    eqGrid.append(band);
  });

  function showToast(message, error = false) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle("error", error);
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!response?.ok) return reject(new Error(response?.error || "Thao tác thất bại."));
      resolve(response);
    }));
  }

  function renderAuthentication(value) {
    const auth = value && typeof value === "object" ? value : {};
    googleSignedIn = auth.signedIn === true;
    document.body.dataset.authSignedIn = String(googleSignedIn);
    authGate.hidden = googleSignedIn;
    accountBar.hidden = !googleSignedIn;
    if (!googleSignedIn) return;
    accountName.textContent = auth.displayName || "Tài khoản Google";
    accountEmail.textContent = auth.email || "";
    accountAvatar.src = auth.photoURL || "icon.png";
  }

  function formatSyncMoment(timestamp) {
    const value = Number(timestamp) || 0;
    if (!value) return "";
    const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
    if (seconds < 60) return "vừa xong";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
    return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(value));
  }

  function renderOnlineSync(value) {
    const sync = value && typeof value === "object" ? value : {};
    const state = String(sync.status || "idle");
    accountSyncStatus.className = `sync-status ${state}`;
    accountSyncNow.disabled = !googleSignedIn || state === "syncing";
    if (state === "syncing") accountSyncStatus.textContent = "Đang đồng bộ dữ liệu online…";
    else if (state === "synced") accountSyncStatus.textContent = `Đã lưu online${sync.lastSyncAt ? ` · ${formatSyncMoment(sync.lastSyncAt)}` : ""}`;
    else if (state === "pending") accountSyncStatus.textContent = "Có thay đổi đang chờ đồng bộ";
    else if (state === "disabled") accountSyncStatus.textContent = "Đồng bộ online đang tắt";
    else if (state === "signed_out") accountSyncStatus.textContent = "Đăng nhập để đồng bộ online";
    else if (state === "error") accountSyncStatus.textContent = sync.error || "Lỗi đồng bộ; dữ liệu vẫn còn trên máy";
    else accountSyncStatus.textContent = "Dữ liệu tài khoản được lưu online";
  }

  async function refreshOnlineSync(manual = false) {
    if (!googleSignedIn) {
      renderOnlineSync({ status: "signed_out" });
      return null;
    }
    if (manual) renderOnlineSync({ status: "syncing" });
    try {
      const response = await sendRuntimeMessage({ type: manual ? "ONLINE_SYNC_NOW" : "ONLINE_SYNC_GET_STATUS" });
      renderOnlineSync(response.sync);
      if (manual) {
        await loadWatchAnalytics();
        showToast("Đã đồng bộ dữ liệu tài khoản online.");
      }
      return response.sync;
    } catch (error) {
      renderOnlineSync({ status: "error", error: error.message });
      if (manual) showToast(error.message || "Không thể đồng bộ online.", true);
      return null;
    }
  }

  function renderRemoteAccess(value) {
    const state = value && typeof value === "object" ? value : {};
    remoteAccessAllowed = state.allowed === true && Number(state.leaseExpiresAt) > Date.now();
    document.body.dataset.accessLocked = String(!remoteAccessAllowed);
    document.querySelectorAll(".quick-grid,.card:not(.auth-card):not(.version-update-panel),.shortcut-card").forEach((element) => {
      element.inert = !remoteAccessAllowed || !googleSignedIn;
    });
    accountStatus.className = "";
    if (!remoteAccessAllowed) {
      accountStatus.textContent = state.status === "checking" ? "Đang xác minh quyền…" : (state.reason || "Tài khoản đang bị khóa.");
      accountStatus.classList.add("blocked");
      status.textContent = state.reason || "Extension chưa được cấp quyền.";
      status.className = "status error";
    } else if (state.serverReachable === false) {
      accountStatus.textContent = "Mất kết nối xác minh";
      accountStatus.classList.add("blocked");
    } else {
      accountStatus.textContent = "Đã kích hoạt";
    }
    scanButton.disabled = !remoteAccessAllowed;
    subButton.disabled = !remoteAccessAllowed;
  }

  function renderProxy(proxySettings) {
    const value = proxySettings && typeof proxySettings === "object" ? proxySettings : {};
    selectedProxyCountry = Object.hasOwn(proxyCountryNames, value.country) ? value.country : "th";
    proxyCountryButtons.forEach((button) => button.classList.toggle("active", button.dataset.proxyCountry === selectedProxyCountry));
    proxyToggle.checked = value.enabled === true;
    proxyState.className = "proxy-state";
    if (value.status === "connected" && value.enabled) {
      const detectedCountry = Object.hasOwn(proxyCountryNames, value.current?.country) ? value.current.country : selectedProxyCountry;
      proxyState.textContent = `Đang dùng proxy ngẫu nhiên ${proxyCountryNames[detectedCountry]}`;
      proxyState.classList.add("connected");
      const protocol = String(value.current?.protocol || "proxy").toUpperCase();
      const latency = Number(value.current?.latency) > 0
        ? ` · ${Math.round(value.current.latency)}ms realtime`
        : value.error ? ` · ${value.error}` : " · đang đo…";
      proxyEndpoint.textContent = `${protocol} · ${value.current?.host || ""}:${value.current?.port || ""}${latency}`;
    } else if (value.status === "error") {
      proxyState.textContent = "Proxy gặp lỗi";
      proxyState.classList.add("error");
      proxyEndpoint.textContent = value.error || "Hãy thử đổi proxy khác.";
    } else {
      proxyState.textContent = "Đang tắt";
      proxyEndpoint.textContent = "HTTP · SOCKS4 · SOCKS5";
    }
    rotateProxyButton.disabled = value.enabled !== true;
  }

  function setProxyBusy(busy, label = "Đang kết nối…") {
    proxyToggle.disabled = busy;
    rotateProxyButton.disabled = busy;
    proxyCountryButtons.forEach((button) => { button.disabled = busy; });
    if (busy) {
      proxyState.className = "proxy-state";
      proxyState.textContent = label;
      proxyEndpoint.textContent = `Đang tải danh sách ProxyScrape ${proxyCountryNames[selectedProxyCountry]}…`;
    }
  }

  async function refreshProxyLatency() {
    if (!remoteAccessAllowed || latencyMeasurementBusy || !proxyToggle.checked) return;
    latencyMeasurementBusy = true;
    try {
      const response = await sendRuntimeMessage({ type: "PROXY_MEASURE_LATENCY" });
      renderProxy(response.settings);
    } catch (_error) {
      // Keep the last visible reading; the next realtime interval retries.
    } finally {
      latencyMeasurementBusy = false;
    }
  }

  async function currentTikTokTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id || !/^https:\/\/(?:[^/]+\.)?tiktok\.com\//i.test(String(tab.url || ""))) throw new Error("Hãy mở một trang video TikTok trước.");
    return tab;
  }

  async function send(type) {
    const tab = await currentTikTokTab();
    const response = await chrome.tabs.sendMessage(tab.id, { type });
    if (response?.ok === false) throw new Error(response.error || "Thao tác thất bại.");
    return tab;
  }

  function populateKaloDateRangeOptions(selectedValue = "last30Day") {
    const select = document.getElementById("kalodataDateRange");
    if (!select) return;
    const keep = String(selectedValue || "last30Day").trim();
    const fixed = [
      ["last7Day", "7 ngày gần nhất"],
      ["last30Day", "30 ngày gần nhất"]
    ];
    const options = [...fixed];
    const now = new Date();
    for (let offset = 0; offset < 18; offset += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      options.push([value, `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`]);
    }
    if (keep && !options.some(([value]) => value === keep)) options.push([keep, `${keep} · đã lưu`]);
    select.replaceChildren(...options.map(([value, label]) => {
      const option = document.createElement("option"); option.value = value; option.textContent = label; return option;
    }));
    select.value = keep || "last30Day";
  }

  function updateEchoCustomDateVisibility() {
    const custom = document.getElementById("echotikRangePreset")?.value === "custom";
    document.querySelectorAll(".echo-custom-date").forEach((element) => { element.hidden = !custom; });
  }

  function echoCredentialProblem(config) {
    if (!config.enabled) return "";
    if (config.authMode === "keyapi") return config.apiKey ? "" : "Hãy nhập EchoTik / KeyAPI API Key.";
    if (config.authMode === "legacy") return config.username && config.password ? "" : "Hãy nhập đủ Legacy username/password EchoTik.";
    return config.apiKey || (config.username && config.password) ? "" : "Hãy nhập API Key hoặc Legacy username/password EchoTik.";
  }

  function render() {
    settingIds.forEach((key) => { document.getElementById(key).checked = settings[key] !== false; });
    document.getElementById("scanSubtitles").disabled = settings.placeBelowSubtitleTranslator !== false;
    const fontSize = Number(document.getElementById("fontSize").value || 22);
    document.getElementById("fontSizeValue").textContent = `${fontSize}px`;
    document.getElementById("subtitleOpacity").value = String(Math.round((settings.subtitleBackgroundOpacity ?? .72) * 100));
    document.getElementById("subtitleOpacityValue").textContent = `${document.getElementById("subtitleOpacity").value}%`;
    document.getElementById("playbackRate").value = String(settings.playbackRate || 1);
    document.getElementById("playbackVolume").value = String(Math.round((settings.playbackVolume ?? 1) * 100));
    document.getElementById("playbackVolumeValue").textContent = `${document.getElementById("playbackVolume").value}%`;
    document.getElementById("audioCard").dataset.disabled = String(!settings.audioEnabled);
    document.getElementById("eqGrid").dataset.disabled = String(!settings.equalizerEnabled);
    document.getElementById("eqPreset").value = settings.eqPreset;
    normalizeEqBands(settings.eqBands).forEach((gain, index) => {
      const range = document.querySelector(`[data-eq-index="${index}"]`);
      const output = document.querySelector(`[data-eq-value="${index}"]`);
      if (range) range.value = String(gain);
      if (output) output.textContent = `${gain > 0 ? "+" : ""}${gain}dB`;
    });
    document.getElementById("spatialIntensity").value = String(Math.round((settings.spatialIntensity ?? .65) * 100));
    document.getElementById("spatialIntensityValue").textContent = `${document.getElementById("spatialIntensity").value}%`;
    document.getElementById("searchEnabled").checked = searchSettings.enabled !== false;
    document.getElementById("autoTranslateOnSearch").checked = searchSettings.autoTranslateOnSearch !== false;
    document.getElementById("targetLanguage").value = ["en","lo","th","km","vi"].includes(searchSettings.targetLanguage) ? searchSettings.targetLanguage : "en";
    document.getElementById("searchFilterEnabled").checked = searchFilterSettings.enabled !== false;
    document.getElementById("shopAnalyticsDockEnabled").checked = shopAnalyticsUi.dockEnabled !== false;
    document.getElementById("shopAnalyticsProvider").value = shopAnalyticsUi.provider || "echotik";
    document.getElementById("echotikEnabled").checked = echoTikSettings.enabled === true;
    document.getElementById("echotikAuthMode").value = echoTikSettings.authMode || "auto";
    document.getElementById("echotikApiKey").value = echoTikSettings.apiKey || "";
    document.getElementById("echotikUsername").value = echoTikSettings.username || "";
    document.getElementById("echotikPassword").value = echoTikSettings.password || "";
    document.getElementById("echotikRangePreset").value = echoTikSettings.rangePreset || "lifetime";
    document.getElementById("echotikCustomStart").value = echoTikSettings.customStart || "";
    document.getElementById("echotikCustomEnd").value = echoTikSettings.customEnd || "";
    document.getElementById("echotikCacheMinutes").value = String(echoTikSettings.cacheMinutes || 30);
    updateEchoCustomDateVisibility();
    document.getElementById("kalodataEnabled").checked = kaloDataSettings.enabled === true;
    document.getElementById("kalodataBaseUrl").value = kaloDataSettings.baseUrl || "";
    document.getElementById("kalodataAccessKey").value = kaloDataSettings.accessKey || "";
    document.getElementById("kalodataRegion").value = kaloDataSettings.region || "VN";
    document.getElementById("kalodataLanguage").value = kaloDataSettings.language || "vi-VN";
    document.getElementById("kalodataCurrency").value = kaloDataSettings.currency || "VND";
    populateKaloDateRangeOptions(kaloDataSettings.dateRange || "last30Day");
    document.getElementById("kalodataCacheMinutes").value = String(kaloDataSettings.cacheMinutes || 30);
  }

  const stored = await storageGet({ [SETTINGS_KEY]: DEFAULT_SETTINGS, [FONT_SIZE_KEY]: 22, [SEARCH_KEY]: DEFAULT_SEARCH, [SEARCH_FILTER_KEY]: DEFAULT_SEARCH_FILTER, [ECHOTIK_SETTINGS_KEY]: DEFAULT_ECHOTIK_SETTINGS, [KALODATA_SETTINGS_KEY]: DEFAULT_KALODATA_SETTINGS, [SHOP_ANALYTICS_UI_KEY]: null });
  settings = normalizeAudioSettings({ ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}) });
  if (settings.placeBelowSubtitleTranslator !== false) settings.scanSubtitles = false;
  searchSettings = { ...DEFAULT_SEARCH, ...(stored[SEARCH_KEY] || {}) };
  searchFilterSettings = { ...DEFAULT_SEARCH_FILTER, ...(stored[SEARCH_FILTER_KEY] || {}) };
  echoTikSettings = normalizeEchoTikSettings(stored[ECHOTIK_SETTINGS_KEY]);
  kaloDataSettings = normalizeKaloDataSettings(stored[KALODATA_SETTINGS_KEY]);
  shopAnalyticsUi = normalizeShopAnalyticsUi(stored[SHOP_ANALYTICS_UI_KEY]);
  if (!stored[SHOP_ANALYTICS_UI_KEY]?.provider && kaloDataSettings.enabled && !echoTikSettings.enabled) shopAnalyticsUi.provider = "kalodata";
  document.getElementById("fontSize").value = String(Math.max(12, Math.min(42, Number(stored[FONT_SIZE_KEY]) || 22)));
  render();
  {
    const problem = echoCredentialProblem(echoTikSettings);
    const mode = echoTikSettings.authMode === "legacy" ? "Legacy" : echoTikSettings.authMode === "keyapi" ? "API Key" : "Auto";
    setEchoTikStatus(echoTikSettings.enabled
      ? (problem ? problem : `Sẵn sàng · ${mode} · ${echoTikSettings.rangePreset} · cache ${echoTikSettings.cacheMinutes} phút.`)
      : "EchoTik Analytics đang tắt.",
      echoTikSettings.enabled && problem ? "error" : "ok");
  }
  setKaloDataStatus(kaloDataSettings.enabled
    ? (kaloDataSettings.baseUrl && kaloDataSettings.accessKey ? `Sẵn sàng · ${kaloDataSettings.region} · ${kaloDataSettings.dateRange} · cache ${kaloDataSettings.cacheMinutes} phút.` : "Đang bật nhưng chưa nhập đủ API URL/Base URL hoặc Access Key.")
    : "Kalodata Analytics đang tắt.",
    kaloDataSettings.enabled && (!kaloDataSettings.baseUrl || !kaloDataSettings.accessKey) ? "error" : "ok");
  setWatchDashboardActive();
  await loadWatchAnalytics();

  let authResponse = { auth: { signedIn: false }, state: { allowed: false, status: "login_required", reason: "Đăng nhập Google để sử dụng extension." } };
  try { authResponse = await sendRuntimeMessage({ type: "AUTH_STATUS_GET" }); } catch (_error) { /* Hiển thị màn hình đăng nhập mặc định. */ }
  renderAuthentication(authResponse.auth);
  void refreshOnlineSync(false);
  if (authResponse.auth?.signedIn) {
    try {
      const response = await sendRuntimeMessage({ type: "REMOTE_ACCESS_GET" });
      renderRemoteAccess(response.state);
    } catch (error) {
      renderRemoteAccess({ allowed: false, serverReachable: false, reason: error.message });
    }
  } else {
    renderRemoteAccess(authResponse.state);
  }
  void sendRuntimeMessage({ type: "REMOTE_USAGE_EVENT", counter: "popupOpens" }).catch(() => {});

  async function loadProxyStatus() {
    if (!remoteAccessAllowed) {
      renderProxy({ enabled: false, status: "off" });
      proxyState.textContent = "Tạm dừng do tài khoản bị khóa";
      return;
    }
    try {
      const response = await sendRuntimeMessage({ type: "PROXY_GET_STATUS" });
      renderProxy(response.settings);
      void refreshProxyLatency();
    } catch (error) {
      renderProxy({ status: "error", error: error.message });
    }
  }
  await loadProxyStatus();
  const latencyTimer = setInterval(() => { if (!document.hidden) void refreshProxyLatency(); }, 15000);
  window.addEventListener("unload", () => clearInterval(latencyTimer), { once: true });

  try {
    if (!remoteAccessAllowed) throw new Error(accountStatus.textContent || "Tài khoản chưa được cấp quyền.");
    const tab = await currentTikTokTab();
    status.textContent = /\/video\/\d+/.test(String(tab.url || "")) ? "Đã nhận đúng link video TikTok hiện tại." : "Đang ở TikTok; mở video rồi bấm Quét video.";
    status.classList.add("ok");
  } catch (error) {
    status.textContent = error.message;
    status.classList.add("error");
  }


  async function saveShopAnalyticsUi(showMessage = true) {
    shopAnalyticsUi = normalizeShopAnalyticsUi({
      dockEnabled: document.getElementById("shopAnalyticsDockEnabled").checked,
      provider: document.getElementById("shopAnalyticsProvider").value
    });
    await storageSet({ [SHOP_ANALYTICS_UI_KEY]: shopAnalyticsUi });
    if (showMessage) {
      const providerLabel = shopAnalyticsUi.provider === "kalodata" ? "Kalodata" : "EchoTik";
      showToast(shopAnalyticsUi.dockEnabled ? `Control-dock đang hiển thị GMV từ ${providerLabel}.` : "Đã ẩn Analytics khỏi control-dock.");
    }
    return shopAnalyticsUi;
  }

  document.getElementById("shopAnalyticsDockEnabled").addEventListener("change", () => void saveShopAnalyticsUi(true));
  document.getElementById("shopAnalyticsProvider").addEventListener("change", () => void saveShopAnalyticsUi(true));

  document.getElementById("watchDashboardBtn").addEventListener("click", () => setWatchDashboardActive());
  document.getElementById("watchHistoryBtn").addEventListener("click", openWatchHistoryModal);
  document.getElementById("watchHistoryClose").addEventListener("click", closeWatchHistoryModal);
  document.getElementById("watchHistoryModal").addEventListener("click", (event) => { if (event.target.id === "watchHistoryModal") closeWatchHistoryModal(); });
  document.getElementById("watchHistoryClear").addEventListener("click", async () => {
    if (!watchAnalytics.history.length) return;
    watchAnalytics = { ...watchAnalytics, history: [], updatedAt: Date.now() };
    await storageSet({ [WATCH_ANALYTICS_KEY]: watchAnalytics });
    renderWatchAnalytics();
    showToast("Đã xóa lịch sử xem.");
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !document.getElementById("watchHistoryModal").hidden) closeWatchHistoryModal(); });
  const watchRefreshTimer = setInterval(() => { if (!document.hidden) void loadWatchAnalytics(); }, 30000);
  const onWatchStorageChanged = (changes, areaName) => {
    if (areaName === "local" && changes[WATCH_ANALYTICS_KEY]) {
      watchAnalytics = normalizeWatchAnalytics(changes[WATCH_ANALYTICS_KEY].newValue);
      renderWatchAnalytics();
    }
  };
  chrome.storage.onChanged.addListener(onWatchStorageChanged);
  window.addEventListener("unload", () => {
    clearInterval(watchRefreshTimer);
    chrome.storage.onChanged.removeListener(onWatchStorageChanged);
  }, { once: true });

  accountSyncNow.addEventListener("click", async () => {
    accountSyncNow.disabled = true;
    await refreshOnlineSync(true);
    accountSyncNow.disabled = !googleSignedIn;
  });

  googleLoginButton.addEventListener("click", async () => {
    googleLoginButton.disabled = true;
    googleLoginButton.textContent = "Đang mở Google…";
    authError.textContent = "";
    try {
      const response = await sendRuntimeMessage({ type: "AUTH_GOOGLE_SIGN_IN" });
      renderAuthentication(response.auth);
      renderRemoteAccess(response.state);
      await refreshOnlineSync(false);
      await loadProxyStatus();
      showToast(`Đã đăng nhập ${response.auth?.email || "Google"}.`);
    } catch (error) {
      authError.textContent = error.message || "Đăng nhập Google thất bại.";
    } finally {
      googleLoginButton.disabled = false;
      googleLoginButton.textContent = "Đăng nhập Google";
    }
  });

  googleLogoutButton.addEventListener("click", async () => {
    googleLogoutButton.disabled = true;
    try {
      const response = await sendRuntimeMessage({ type: "AUTH_SIGN_OUT" });
      renderAuthentication(response.auth);
      renderRemoteAccess(response.state);
      renderOnlineSync({ status: "signed_out" });
      showToast("Đã đăng xuất Google.");
    } catch (error) {
      showToast(error.message || "Không thể đăng xuất.", true);
    } finally {
      googleLogoutButton.disabled = false;
    }
  });

  function collectEchoTikSettings() {
    return normalizeEchoTikSettings({
      enabled: document.getElementById("echotikEnabled").checked,
      authMode: document.getElementById("echotikAuthMode").value,
      apiKey: document.getElementById("echotikApiKey").value,
      username: document.getElementById("echotikUsername").value,
      password: document.getElementById("echotikPassword").value,
      rangePreset: document.getElementById("echotikRangePreset").value,
      customStart: document.getElementById("echotikCustomStart").value,
      customEnd: document.getElementById("echotikCustomEnd").value,
      cacheMinutes: document.getElementById("echotikCacheMinutes").value
    });
  }

  function setEchoTikStatus(message, kind = "") {
    const element = document.getElementById("echotikStatus");
    element.textContent = String(message || "");
    element.className = `echotik-status${kind ? ` ${kind}` : ""}`;
  }

  async function saveEchoTikSettings(showMessage = true) {
    echoTikSettings = collectEchoTikSettings();
    await storageSet({ [ECHOTIK_SETTINGS_KEY]: echoTikSettings });
    if (showMessage) {
      const credentialError = echoCredentialProblem(echoTikSettings);
      if (credentialError) {
        setEchoTikStatus(`Đã lưu · ${credentialError}`, "error");
      } else {
        const mode = echoTikSettings.authMode === "legacy" ? "Legacy" : echoTikSettings.authMode === "keyapi" ? "API Key" : "Auto";
        setEchoTikStatus(echoTikSettings.enabled ? `Đã lưu · ${mode} · range ${echoTikSettings.rangePreset} · cache ${echoTikSettings.cacheMinutes} phút.` : "Đã lưu · EchoTik Analytics đang tắt.", "ok");
      }
      showToast("Đã lưu EchoTik Analytics.");
    }
    return echoTikSettings;
  }

  document.getElementById("echotikRangePreset").addEventListener("change", updateEchoCustomDateVisibility);

  document.getElementById("echotikSave").addEventListener("click", async () => {
    const button = document.getElementById("echotikSave");
    button.disabled = true;
    try { await saveEchoTikSettings(true); }
    catch (error) { setEchoTikStatus(error.message || "Không lưu được EchoTik.", "error"); }
    finally { button.disabled = false; }
  });

  document.getElementById("echotikEnabled").addEventListener("change", async () => {
    try { await saveEchoTikSettings(false); setEchoTikStatus(document.getElementById("echotikEnabled").checked ? "Đã bật. Mở video TikTok để tự phân tích." : "EchoTik Analytics đang tắt.", "ok"); }
    catch (error) { setEchoTikStatus(error.message || "Không lưu được EchoTik.", "error"); }
  });

  document.getElementById("echotikAnalyze").addEventListener("click", async () => {
    const button = document.getElementById("echotikAnalyze");
    button.disabled = true;
    setEchoTikStatus("Đang gọi EchoTik API cho video hiện tại…");
    try {
      const next = await saveEchoTikSettings(false);
      if (!next.enabled) throw new Error("Hãy bật EchoTik Analytics trước.");
      const credentialError = echoCredentialProblem(next);
      if (credentialError) throw new Error(credentialError);
      if (next.rangePreset === "custom" && (!next.customStart || !next.customEnd)) throw new Error("Hãy chọn đủ ngày bắt đầu và kết thúc cho khoảng tuỳ chọn.");
      const tab = await currentTikTokTab();
      const response = await new Promise((resolve, reject) => chrome.tabs.sendMessage(tab.id, { type: "TDT_ECHOTIK_ANALYZE_NOW", force: true }, (value) => {
        if (chrome.runtime.lastError) return reject(new Error("Không kết nối được module EchoTik trên tab. Hãy tải lại trang TikTok sau khi cập nhật extension."));
        if (!value?.ok) return reject(new Error(value?.error || "Không phân tích được video."));
        resolve(value);
      }));
      const data = response.data;
      if (!data?.found) {
        setEchoTikStatus(data?.message || "EchoTik chưa có dữ liệu cho video này.", "error");
      } else {
        const sold = data.sales == null ? "—" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(data.sales));
        const gmv = data.gmv == null ? "—" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Number(data.gmv));
        const rangeLabel = data.rangeLabel || next.rangePreset;
        setEchoTikStatus(`Video ${data.videoId}: ${sold} lượt bán · GMV ${gmv} · ${rangeLabel}${data.region ? ` · ${data.region}` : ""}.`, "ok");
        showToast("Đã cập nhật EchoTik cho video hiện tại.");
      }
    } catch (error) {
      setEchoTikStatus(error.message || "EchoTik API lỗi.", "error");
      showToast(error.message || "EchoTik API lỗi.", true);
    } finally {
      button.disabled = false;
    }
  });

  function collectKaloDataSettings() {
    return normalizeKaloDataSettings({
      enabled: document.getElementById("kalodataEnabled").checked,
      baseUrl: document.getElementById("kalodataBaseUrl").value,
      accessKey: document.getElementById("kalodataAccessKey").value,
      region: document.getElementById("kalodataRegion").value,
      language: document.getElementById("kalodataLanguage").value,
      currency: document.getElementById("kalodataCurrency").value,
      dateRange: document.getElementById("kalodataDateRange").value,
      cacheMinutes: document.getElementById("kalodataCacheMinutes").value
    });
  }

  function setKaloDataStatus(message, kind = "") {
    const element = document.getElementById("kalodataStatus");
    element.textContent = String(message || "");
    element.className = `echotik-status${kind ? ` ${kind}` : ""}`;
  }

  async function saveKaloDataSettings(showMessage = true) {
    kaloDataSettings = collectKaloDataSettings();
    if (kaloDataSettings.baseUrl) kaloDataSettings.baseUrl = validateKaloDataBaseUrl(kaloDataSettings.baseUrl);
    await storageSet({ [KALODATA_SETTINGS_KEY]: kaloDataSettings });
    if (showMessage) {
      if (kaloDataSettings.enabled && (!kaloDataSettings.baseUrl || !kaloDataSettings.accessKey)) {
        setKaloDataStatus("Đã lưu, nhưng cần nhập API URL/Base URL và Access Key Kalodata Open API.", "error");
      } else {
        const endpoint = kaloDataSettings.baseUrl ? previewKaloDataEndpoint(kaloDataSettings.baseUrl) : "";
        setKaloDataStatus(kaloDataSettings.enabled ? `Đã lưu · ${kaloDataSettings.region} · ${kaloDataSettings.dateRange} · cache ${kaloDataSettings.cacheMinutes} phút.${endpoint ? ` Endpoint: ${endpoint}` : ""}` : "Đã lưu · Kalodata Analytics đang tắt.", "ok");
      }
      showToast("Đã lưu Kalodata Analytics.");
    }
    return kaloDataSettings;
  }

  document.getElementById("kalodataSave").addEventListener("click", async () => {
    const button = document.getElementById("kalodataSave"); button.disabled = true;
    try { await saveKaloDataSettings(true); } catch (error) { setKaloDataStatus(error.message || "Không lưu được Kalodata.", "error"); }
    finally { button.disabled = false; }
  });

  document.getElementById("kalodataEnabled").addEventListener("change", async () => {
    try { await saveKaloDataSettings(false); setKaloDataStatus(document.getElementById("kalodataEnabled").checked ? "Đã bật. Mở video TikTok để tự phân tích bằng Kalodata." : "Kalodata Analytics đang tắt.", "ok"); }
    catch (error) { document.getElementById("kalodataEnabled").checked = false; setKaloDataStatus(error.message || "Không lưu được Kalodata.", "error"); }
  });

  document.getElementById("kalodataAnalyze").addEventListener("click", async () => {
    const button = document.getElementById("kalodataAnalyze"); button.disabled = true; setKaloDataStatus("Đang gọi Kalodata Open API cho video hiện tại…");
    try {
      const next = await saveKaloDataSettings(false);
      if (!next.enabled) throw new Error("Hãy bật Kalodata Analytics trước.");
      if (!next.baseUrl || !next.accessKey) throw new Error("Hãy nhập API URL/Base URL và Access Key Kalodata Open API.");
      const tab = await currentTikTokTab();
      const response = await new Promise((resolve, reject) => chrome.tabs.sendMessage(tab.id, { type: "TDT_KALODATA_ANALYZE_NOW", force: true }, (value) => {
        if (chrome.runtime.lastError) return reject(new Error("Không kết nối được module Kalodata trên tab. Hãy tải lại trang TikTok sau khi cập nhật extension."));
        if (!value?.ok) return reject(new Error(value?.error || "Không phân tích được video bằng Kalodata."));
        resolve(value);
      }));
      const data = response.data;
      if (!data?.found) setKaloDataStatus(data?.message || "Kalodata chưa có dữ liệu cho video này.", "error");
      else {
        const hasSales = data.salesAvailable !== false && data.sales !== null && data.sales !== undefined && data.sales !== "" && Number.isFinite(Number(data.sales));
        const sold = hasSales ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(data.sales)) : "—";
        const hasRevenue = data.gmv !== null && data.gmv !== undefined && data.gmv !== "" && Number.isFinite(Number(data.gmv));
        const revenue = hasRevenue ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Number(data.gmv)) : "—";
        setKaloDataStatus(`Video ${data.videoId}: ${sold} lượt bán${data.salesSourceField ? ` [${data.salesSourceField}]` : ""} · Revenue ${revenue} ${data.currency || next.currency} · ${data.region || next.region} · ${data.dateRange || next.dateRange}.${hasSales ? "" : " Kalodata response không chứa sales_volume."}`, hasSales ? "ok" : "error");
        showToast("Đã cập nhật Kalodata cho video hiện tại.");
      }
    } catch (error) { setKaloDataStatus(error.message || "Kalodata API lỗi.", "error"); showToast(error.message || "Kalodata API lỗi.", true); }
    finally { button.disabled = false; }
  });

  settingIds.forEach((key) => {
    document.getElementById(key).addEventListener("change", async (event) => {
      settings = { ...settings, [key]: event.target.checked };
      if (key === "placeBelowSubtitleTranslator") {
        if (event.target.checked) {
          settings.scanSubtitles = false;
          document.getElementById("scanSubtitles").checked = false;
        }
        document.getElementById("scanSubtitles").disabled = event.target.checked;
      }
      if (key === "audioEnabled" || key === "equalizerEnabled") render();
      await storageSet({ [SETTINGS_KEY]: settings });
      if (key === "cleanMode") void sendRuntimeMessage({ type: "REMOTE_USAGE_EVENT", counter: "cleanModeToggles" }).catch(() => {});
      showToast(key === "placeBelowSubtitleTranslator" && event.target.checked
        ? "Đã bật TikTok Subtitle Translator và tắt Transcript365."
        : key === "audioEnabled" && event.target.checked
          ? "AUDIO sẵn sàng; chạm 1 lần để áp dụng cho toàn bộ video."
          : "Đã lưu cài đặt.");
    });
  });

  proxyToggle.addEventListener("change", async (event) => {
    const enabled = event.target.checked;
    setProxyBusy(true, enabled ? "Đang chọn proxy ngẫu nhiên…" : "Đang ngắt proxy…");
    try {
      const response = await sendRuntimeMessage({ type: "PROXY_SET_ENABLED", enabled, country: selectedProxyCountry });
      renderProxy(response.settings);
      showToast(enabled ? `Đã chọn proxy ngẫu nhiên ${proxyCountryNames[selectedProxyCountry]}.` : "Đã tắt proxy TikTok.");
      if (enabled) void refreshProxyLatency();
    } catch (error) {
      try {
        const latest = await sendRuntimeMessage({ type: "PROXY_GET_STATUS" });
        renderProxy(latest.settings);
      } catch (_statusError) {
        renderProxy({ enabled: false, status: "error", error: error.message });
      }
      showToast(error.message, true);
    } finally {
      proxyToggle.disabled = false;
      proxyCountryButtons.forEach((button) => { button.disabled = false; });
    }
  });

  proxyCountryButtons.forEach((button) => button.addEventListener("click", async () => {
    const country = button.dataset.proxyCountry;
    if (!Object.hasOwn(proxyCountryNames, country) || country === selectedProxyCountry) return;
    selectedProxyCountry = country;
    proxyCountryButtons.forEach((item) => item.classList.toggle("active", item.dataset.proxyCountry === country));
    setProxyBusy(true, `Đang chọn proxy ngẫu nhiên ${proxyCountryNames[country]}…`);
    try {
      const response = await sendRuntimeMessage({ type: "PROXY_SET_COUNTRY", country });
      renderProxy(response.settings);
      showToast(response.settings.enabled ? `Đã chọn proxy ngẫu nhiên ${proxyCountryNames[country]}.` : `Đã chọn ${proxyCountryNames[country]}.`);
      if (response.settings.enabled) void refreshProxyLatency();
    } catch (error) {
      try {
        const latest = await sendRuntimeMessage({ type: "PROXY_GET_STATUS" });
        renderProxy(latest.settings);
      } catch (_statusError) {
        renderProxy({ enabled: false, country, status: "error", error: error.message });
      }
      showToast(error.message, true);
    } finally {
      proxyToggle.disabled = false;
      proxyCountryButtons.forEach((item) => { item.disabled = false; });
    }
  }));

  rotateProxyButton.addEventListener("click", async () => {
    setProxyBusy(true, "Đang chọn proxy ngẫu nhiên mới…");
    try {
      const response = await sendRuntimeMessage({ type: "PROXY_ROTATE", country: selectedProxyCountry });
      renderProxy(response.settings);
      showToast("Đã đổi sang proxy ngẫu nhiên mới.");
      void refreshProxyLatency();
    } catch (error) {
      try {
        const latest = await sendRuntimeMessage({ type: "PROXY_GET_STATUS" });
        renderProxy(latest.settings);
      } catch (_statusError) {
        renderProxy({ enabled: true, status: "error", error: error.message });
      }
      showToast(error.message, true);
    } finally {
      proxyToggle.disabled = false;
      proxyCountryButtons.forEach((button) => { button.disabled = false; });
    }
  });

  document.getElementById("fontSize").addEventListener("input", (event) => document.getElementById("fontSizeValue").textContent = `${event.target.value}px`);
  document.getElementById("fontSize").addEventListener("change", async (event) => {
    await storageSet({ [FONT_SIZE_KEY]: Number(event.target.value) });
    showToast("Đã lưu cỡ chữ phụ đề.");
  });

  document.getElementById("subtitleOpacity").addEventListener("input", (event) => document.getElementById("subtitleOpacityValue").textContent = `${event.target.value}%`);
  document.getElementById("subtitleOpacity").addEventListener("change", async (event) => {
    settings = { ...settings, subtitleBackgroundOpacity: Number(event.target.value) / 100 };
    await storageSet({ [SETTINGS_KEY]: settings });
    showToast("Đã lưu nền phụ đề.");
  });

  document.getElementById("playbackRate").addEventListener("change", async (event) => {
    settings = { ...settings, playbackRate: Number(event.target.value) };
    await storageSet({ [SETTINGS_KEY]: settings });
    showToast("Đã đổi tốc độ phát.");
  });

  document.getElementById("playbackVolume").addEventListener("input", (event) => document.getElementById("playbackVolumeValue").textContent = `${event.target.value}%`);
  document.getElementById("playbackVolume").addEventListener("change", async (event) => {
    settings = { ...settings, playbackVolume: Number(event.target.value) / 100 };
    await storageSet({ [SETTINGS_KEY]: settings });
    showToast("Đã lưu âm lượng.");
  });

  document.getElementById("eqPreset").addEventListener("change", async (event) => {
    const preset = event.target.value;
    const bands = EQ_PRESETS[preset] || settings.eqBands;
    settings = { ...settings, eqPreset: preset, eqBands: [...bands] };
    render();
    await storageSet({ [SETTINGS_KEY]: settings });
    showToast("Đã áp dụng preset EQ.");
  });

  eqGrid.querySelectorAll("input[data-eq-index]").forEach((range) => {
    range.addEventListener("input", () => {
      const index = Number(range.dataset.eqIndex);
      const gain = clampEqGain(range.value);
      const output = document.querySelector(`[data-eq-value="${index}"]`);
      if (output) output.textContent = `${gain > 0 ? "+" : ""}${gain}dB`;
    });
    range.addEventListener("change", async () => {
      const bands = normalizeEqBands(settings.eqBands);
      bands[Number(range.dataset.eqIndex)] = clampEqGain(range.value);
      settings = { ...settings, eqPreset: "custom", eqBands: bands };
      document.getElementById("eqPreset").value = "custom";
      await storageSet({ [SETTINGS_KEY]: settings });
      showToast("Đã lưu EQ tùy chỉnh.");
    });
  });

  document.getElementById("spatialIntensity").addEventListener("input", (event) => {
    document.getElementById("spatialIntensityValue").textContent = `${event.target.value}%`;
  });
  document.getElementById("spatialIntensity").addEventListener("change", async (event) => {
    settings = { ...settings, spatialIntensity: Number(event.target.value) / 100 };
    await storageSet({ [SETTINGS_KEY]: settings });
    showToast("Đã lưu cường độ âm thanh 360°.");
  });

  ["searchEnabled","autoTranslateOnSearch"].forEach((id) => {
    document.getElementById(id).addEventListener("change", async () => {
      searchSettings = {
        ...searchSettings,
        enabled: document.getElementById("searchEnabled").checked,
        autoTranslateOnSearch: document.getElementById("autoTranslateOnSearch").checked
      };
      await storageSet({ [SEARCH_KEY]: searchSettings });
      showToast("Đã lưu cài đặt dịch.");
    });
  });
  document.getElementById("targetLanguage").addEventListener("change", async (event) => {
    searchSettings = { ...searchSettings, targetLanguage: event.target.value };
    await storageSet({ [SEARCH_KEY]: searchSettings });
    showToast("Đã đổi ngôn ngữ dịch.");
  });

  document.getElementById("searchFilterEnabled").addEventListener("change", async (event) => {
    searchFilterSettings = { ...searchFilterSettings, enabled: event.target.checked };
    await storageSet({ [SEARCH_FILTER_KEY]: searchFilterSettings });
    showToast(event.target.checked ? "Đã bật bộ lọc video tìm kiếm." : "Đã tắt bộ lọc video tìm kiếm.");
  });

  scanButton.addEventListener("click", async () => {
    scanButton.disabled = true;
    try { await send("TDT_FORCE_SCAN"); showToast("Đang quét và hiển thị video."); }
    catch (error) { showToast(error.message || "Không thể quét video.", true); }
    finally { scanButton.disabled = !remoteAccessAllowed; }
  });

  subButton.addEventListener("click", async () => {
    subButton.disabled = true;
    try { await send("TDT_FORCE_SUB"); showToast("Đang quét các nguồn phụ đề."); }
    catch (error) { showToast(error.message || "Không thể lấy phụ đề.", true); }
    finally { subButton.disabled = !remoteAccessAllowed; }
  });
});

// Self-hosted/private update UI. The compact version control lives in the
// header; mandatory releases also take over the popup until the package is updated.
(() => {
  const STATE_KEY = "tdt_private_update_state_v1";

  function updateMessage(payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(payload, (response) => {
        const error = chrome.runtime.lastError;
        if (error) return reject(new Error(error.message));
        if (!response?.ok) return reject(new Error(response?.error || "Không thể kết nối bộ cập nhật."));
        resolve(response);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const card = document.getElementById("privateUpdateCard");
    const versionButton = document.getElementById("versionUpdateButton");
    if (!card || !versionButton) return;
    const headerVersion = document.getElementById("headerVersionText");
    const headerDot = document.getElementById("headerUpdateDot");
    const badge = document.getElementById("privateUpdateBadge");
    const current = document.getElementById("privateUpdateCurrent");
    const latest = document.getElementById("privateUpdateLatest");
    const status = document.getElementById("privateUpdateStatus");
    const notes = document.getElementById("privateUpdateNotes");
    const autoDownload = document.getElementById("privateUpdateAutoDownload");
    const checkButton = document.getElementById("privateUpdateCheck");
    const applyButton = document.getElementById("privateUpdateApply");
    const releaseButton = document.getElementById("privateUpdateRelease");
    const server = document.getElementById("privateUpdateServer");
    const overlay = document.getElementById("mandatoryUpdateOverlay");
    const mandatoryMessage = document.getElementById("mandatoryUpdateMessage");
    const mandatoryCurrent = document.getElementById("mandatoryCurrentVersion");
    const mandatoryLatest = document.getElementById("mandatoryLatestVersion");
    const mandatoryNotes = document.getElementById("mandatoryUpdateNotes");
    const mandatoryApply = document.getElementById("mandatoryUpdateApply");
    const mandatoryCheck = document.getElementById("mandatoryUpdateCheck");
    let lastState = {};

    const labels = {
      idle: "TỰ ĐỘNG", checking: "ĐANG KIỂM TRA", available: "CÓ BẢN MỚI",
      downloading: "ĐANG TẢI", downloaded: "ĐÃ TẢI", applying: "ĐANG CÀI", up_to_date: "MỚI NHẤT",
      error: "LỖI", disabled: "ĐÃ TẮT"
    };

    function setPanel(open) {
      card.hidden = !open;
      versionButton.setAttribute("aria-expanded", String(open));
    }

    function setBusy(value) {
      checkButton.disabled = value;
      autoDownload.disabled = value || lastState.mandatory === true;
      mandatoryCheck.disabled = value;
    }

    function render(state = {}, settings = null, config = null) {
      lastState = { ...lastState, ...state };
      const stateName = String(lastState.status || "idle");
      const currentVersion = String(lastState.currentVersion || chrome.runtime.getManifest().version);
      const latestVersion = String(lastState.latestVersion || "—");
      const hasUpdate = lastState.available === true;
      const mandatory = hasUpdate && lastState.mandatory === true;
      headerVersion.textContent = `v${currentVersion}`;
      current.textContent = currentVersion;
      latest.textContent = latestVersion;
      badge.dataset.state = mandatory ? "available" : stateName;
      badge.textContent = mandatory ? "BẮT BUỘC" : (labels[stateName] || "TỰ ĐỘNG");
      status.textContent = String(lastState.message || "Chưa kiểm tra bản cập nhật.");
      status.classList.toggle("error", stateName === "error");
      status.classList.toggle("success", stateName === "up_to_date" || stateName === "downloaded");
      notes.textContent = String(lastState.releaseNotes || "");
      notes.hidden = !notes.textContent;
      headerDot.hidden = !hasUpdate;
      versionButton.classList.toggle("has-update", hasUpdate);
      versionButton.classList.toggle("mandatory", mandatory);
      if (settings) autoDownload.checked = settings.autoDownload !== false;
      if (mandatory) autoDownload.checked = true;
      if (config?.manifestUrl) {
        try { server.textContent = new URL(config.manifestUrl).host; } catch (_error) { server.textContent = "Máy chủ cập nhật"; }
      }
      const canApply = hasUpdate && Boolean(lastState.downloadUrl);
      const busy = stateName === "checking" || stateName === "downloading" || stateName === "applying";
      applyButton.disabled = !canApply || busy;
      applyButton.textContent = stateName === "downloading" ? "Đang tải…" : stateName === "downloaded" ? "Tải lại" : stateName === "applying" ? "Đang cập nhật…" : "Cập nhật";
      releaseButton.disabled = !lastState.releasePageUrl;
      setBusy(busy);
      if (hasUpdate) setPanel(true);

      overlay.hidden = !mandatory;
      overlay.setAttribute("aria-hidden", String(!mandatory));
      document.body.dataset.mandatoryUpdate = String(mandatory);
      mandatoryMessage.textContent = mandatory
        ? `Phiên bản v${latestVersion} là bản bắt buộc. Extension đã tự khóa cho đến khi bạn cập nhật.`
        : "Bạn cần cập nhật Extension để tiếp tục sử dụng toàn bộ tính năng.";
      mandatoryCurrent.textContent = currentVersion;
      mandatoryLatest.textContent = latestVersion;
      mandatoryNotes.textContent = String(lastState.releaseNotes || "");
      mandatoryNotes.hidden = !mandatoryNotes.textContent;
      mandatoryApply.disabled = !canApply || busy;
      mandatoryApply.textContent = stateName === "downloading" ? "Đang tải gói cập nhật…" : stateName === "downloaded" ? "Tải lại gói cập nhật" : stateName === "applying" ? "Đang xử lý…" : "Tải và cập nhật ngay";
    }

    async function load(force = false) {
      try {
        const response = await updateMessage({ type: force ? "PRIVATE_UPDATE_CHECK" : "PRIVATE_UPDATE_GET" });
        render(response.state, response.settings, response.config);
      } catch (error) {
        render({ status: "error", message: error.message, currentVersion: chrome.runtime.getManifest().version });
      }
    }

    async function applyUpdate(button) {
      button.disabled = true;
      const previous = button.textContent;
      button.textContent = "Đang xử lý…";
      try {
        const response = await updateMessage({ type: "PRIVATE_UPDATE_APPLY" });
        render(response.state);
      } catch (error) {
        render({ status: "error", message: error.message, currentVersion: chrome.runtime.getManifest().version });
        button.textContent = previous;
      }
    }

    versionButton.addEventListener("click", () => setPanel(card.hidden));
    checkButton.addEventListener("click", () => void load(true));
    mandatoryCheck.addEventListener("click", () => void load(true));
    applyButton.addEventListener("click", () => void applyUpdate(applyButton));
    mandatoryApply.addEventListener("click", () => void applyUpdate(mandatoryApply));
    releaseButton.addEventListener("click", async () => {
      try { await updateMessage({ type: "PRIVATE_UPDATE_OPEN_RELEASE" }); }
      catch (error) { status.textContent = error.message; status.className = "private-update-status error"; }
    });
    autoDownload.addEventListener("change", async () => {
      autoDownload.disabled = true;
      try {
        const response = await updateMessage({ type: "PRIVATE_UPDATE_SET_AUTO_DOWNLOAD", autoDownload: autoDownload.checked });
        render(response.state, response.settings);
      } catch (error) {
        autoDownload.checked = !autoDownload.checked;
        status.textContent = error.message;
        status.className = "private-update-status error";
      } finally {
        autoDownload.disabled = lastState.mandatory === true;
      }
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes[STATE_KEY]?.newValue) render(changes[STATE_KEY].newValue);
    });
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === "PRIVATE_UPDATE_STATE_CHANGED" && message.state) render(message.state);
    });

    void load(false);
  });
})();
