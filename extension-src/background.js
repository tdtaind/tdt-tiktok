try { importScripts("remote_config.js", "online_sync_core.js"); } catch (_error) { /* Node/static checks do not provide importScripts. */ }
"use strict";

const VIDEO_API_URL = "https://tikwm.com/api/";
const GOOGLE_TRANSLATE_ENDPOINTS = [
  "https://translate.googleapis.com/translate_a/single",
  "https://translate.google.com/translate_a/single"
];
const REQUEST_TIMEOUT_MS = 15000;
const VIDEO_API_MIN_INTERVAL_MS = 1100;
const VIDEO_API_RETRY_DELAYS_MS = Object.freeze([1150, 1900, 3000]);
const VIDEO_INFO_CACHE_KEY = "tdt_video_info_cache_v20";
const VIDEO_INFO_CACHE_TTL_MS = 30 * 60 * 1000;
const VIDEO_INFO_STALE_TTL_MS = 2 * 60 * 60 * 1000;
const VIDEO_INFO_CACHE_MAX_ENTRIES = 80;
const TRANSLATE_TIMEOUT_MS = 9000;
const MAX_TRANSLATION_ITEMS = 300;
const MAX_TOTAL_TRANSLATION_CHARS = 100000;
const TRANSLATION_CONCURRENCY = 6;
const translationCache = new Map();
const videoInfoMemoryCache = new Map();
const videoInfoInFlight = new Map();
let videoApiQueue = Promise.resolve();
let videoCacheWriteQueue = Promise.resolve();
let lastVideoApiStartedAt = 0;
const SETTINGS_KEY = "tdt_settings_v17";
const ECHOTIK_SETTINGS_KEY = "tdt_echotik_settings_v1";
const ECHOTIK_CACHE_KEY = "tdt_echotik_video_cache_v2";
const ECHOTIK_LEGACY_VIDEO_DETAIL_URL = "https://open.echotik.live/api/v3/echotik/video/detail";
const ECHOTIK_KEYAPI_DETAIL_URL = "https://api.keyapi.ai/v1/tiktok/video/detail/analytics";
const ECHOTIK_KEYAPI_TRENDS_URL = "https://api.keyapi.ai/v1/tiktok/video/trends/analytics";
const DEFAULT_ECHOTIK_SETTINGS = Object.freeze({ enabled: false, username: "", password: "", apiKey: "", authMode: "auto", rangePreset: "lifetime", customStart: "", customEnd: "", cacheMinutes: 30 });
const ECHOTIK_TIMEOUT_MS = 15000;
const ECHOTIK_CACHE_MAX_ENTRIES = 160;
const echotikMemoryCache = new Map();
const echotikInFlight = new Map();
let echotikCacheWriteQueue = Promise.resolve();
const KALODATA_SETTINGS_KEY = "tdt_kalodata_settings_v1";
const KALODATA_CACHE_KEY = "tdt_kalodata_video_cache_v3";
const KALODATA_VIDEO_DETAIL_PATH = "/openapi/v1/video/detail";
const DEFAULT_KALODATA_SETTINGS = Object.freeze({ enabled: false, baseUrl: "", accessKey: "", region: "VN", language: "vi-VN", currency: "VND", dateRange: "last30Day", cacheMinutes: 30 });
const KALODATA_TIMEOUT_MS = 12000;
const KALODATA_CACHE_MAX_ENTRIES = 120;
const kalodataMemoryCache = new Map();
const kalodataInFlight = new Map();
let kalodataCacheWriteQueue = Promise.resolve();
const TRANSCRIPT365_REQUEST_KEY = "tdt_transcript365_request";
const TRANSCRIPT365_SUBMIT_GUARD_KEY = "tdt_transcript365_submit_guard";
const TRANSCRIPT365_NO_SUB_KEY = "tdt_transcript365_no_sub_latest";
const SUBTITLE_CACHE_KEY = "tdt_subtitle_cache_v1";
const SUBTITLE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SUBTITLE_CACHE_CLEANUP_ALARM = "tdt-subtitle-cache-cleanup";
const DEFAULT_SETTINGS = Object.freeze({
  autoCloseTranscriptWindow: true,
  smartAutoPause: false
});
const REMOTE_CONFIG_SOURCE = globalThis.TDT_REMOTE_CONFIG && typeof globalThis.TDT_REMOTE_CONFIG === "object" ? globalThis.TDT_REMOTE_CONFIG : {};
const REMOTE_CONFIG = Object.freeze({
  enabled: REMOTE_CONFIG_SOURCE.enabled !== false,
  serverUrl: String(REMOTE_CONFIG_SOURCE.serverUrl || "").trim().replace(/\/+$/, ""),
  projectKey: String(REMOTE_CONFIG_SOURCE.projectKey || "tiktok-tai-dep-trai").trim(),
  expectedExtensionId: String(REMOTE_CONFIG_SOURCE.expectedExtensionId || "").trim(),
  heartbeatMinutes: Math.max(1, Math.min(60, Number(REMOTE_CONFIG_SOURCE.heartbeatMinutes) || 1)),
  requestTimeoutMs: Math.max(2000, Math.min(30000, Number(REMOTE_CONFIG_SOURCE.requestTimeoutMs) || 8000)),
  leaseSeconds: Math.max(60, Math.min(300, Number(REMOTE_CONFIG_SOURCE.leaseSeconds) || 90)),
  failMode: "closed"
});
const REMOTE_CLIENT_ID_KEY = "tdt_remote_client_id_v1";
const REMOTE_ACCESS_STATE_KEY = "tdt_remote_access_state_v1";
const REMOTE_USAGE_KEY = "tdt_remote_usage_v1";
const REMOTE_INSTALL_REASON_KEY = "tdt_remote_install_reason_v1";
const FIREBASE_AUTH_KEY = "tdt_vercel_google_auth_v2";
const FIREBASE_AUTH_LAST_OK_KEY = "tdt_vercel_auth_last_ok_v1";
const FIREBASE_AUTH_TRANSIENT_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const GOOGLE_AUTH_OFFSCREEN_PATH = "offscreen.html"; // Legacy fallback, no longer used by the primary flow.
const GOOGLE_AUTH_PAGE_ORIGINS = new Set([
  "https://tdt-vercel-control.vercel.app"
]);
const GOOGLE_AUTH_PAGE_ORIGIN = "https://tdt-vercel-control.vercel.app";
const GOOGLE_AUTH_WINDOW_BASE_URL = `${GOOGLE_AUTH_PAGE_ORIGIN}/auth-extension/`;
const GOOGLE_AUTH_PENDING_KEY = "tdt_google_auth_pending_v3";
const GOOGLE_AUTH_RESULT_KEY = "tdt_google_auth_result_v3";
const REMOTE_HEARTBEAT_ALARM = "tdt-remote-access-heartbeat";
const FIREBASE_REALTIME_RECONNECT_ALARM = "tdt-vercel-realtime-reconnect";
const REMOTE_COUNTER_KEYS = Object.freeze([
  "videoInfoRequests", "downloads", "subtitleRequests", "subtitleTranslations", "keywordTranslations", "proxyChanges",
  "popupOpens", "googleLogins", "proxyLatencyTests", "cleanModeToggles", "productDetections", "searchFilterRuns",
  "imageSearch1688"
]);
const PRIVATE_UPDATE_SOURCE = REMOTE_CONFIG_SOURCE.privateUpdates && typeof REMOTE_CONFIG_SOURCE.privateUpdates === "object"
  ? REMOTE_CONFIG_SOURCE.privateUpdates
  : {};
const PRIVATE_UPDATE_CONFIG = Object.freeze({
  enabled: PRIVATE_UPDATE_SOURCE.enabled !== false,
  manifestUrl: String(PRIVATE_UPDATE_SOURCE.manifestUrl || `${REMOTE_CONFIG.serverUrl}/api/v1/extension/update-manifest`).trim(),
  manifestFallbackUrls: Object.freeze(Array.isArray(PRIVATE_UPDATE_SOURCE.manifestFallbackUrls)
    ? PRIVATE_UPDATE_SOURCE.manifestFallbackUrls.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 5)
    : []),
  releasePageUrl: String(PRIVATE_UPDATE_SOURCE.releasePageUrl || `${REMOTE_CONFIG.serverUrl}/extension/`).trim(),
  checkMinutes: Math.max(60, Math.min(1440, Number(PRIVATE_UPDATE_SOURCE.checkMinutes) || 360)),
  autoDownload: PRIVATE_UPDATE_SOURCE.autoDownload !== false
});
const PRIVATE_UPDATE_STATE_KEY = "tdt_private_update_state_v1";
const PRIVATE_UPDATE_SETTINGS_KEY = "tdt_private_update_settings_v1";
const PRIVATE_UPDATE_ALARM = "tdt-private-update-check";
const PRIVATE_UPDATE_PROMPTED_VERSION_KEY = "tdt_private_update_prompted_version_v1";
const PRIVATE_UPDATE_PROMPT_PAGE = "update-required.html";
const ONLINE_SYNC_META_KEY = "tdt_online_sync_meta_v1";
const ONLINE_SYNC_PENDING_SESSION_KEY = "tdt_online_sync_pending_v1";
const ONLINE_SYNC_ALARM = "tdt-online-sync";
const ONLINE_SYNC_INTERVAL_MINUTES = 15;
const ONLINE_SYNC_SETTINGS_DELAY_MS = 4_000;
const ONLINE_SYNC_WATCH_DELAY_MS = 90_000;
const ONLINE_SYNC_RETRY_DELAY_MS = 5 * 60_000;
const ONLINE_SYNC_CORE = globalThis.TDT_ONLINE_SYNC_CORE || {};
const ONLINE_SYNC_STORAGE_TO_WIRE = ONLINE_SYNC_CORE.STORAGE_TO_WIRE || Object.freeze({
  tdt_settings_v17: "settings",
  tdt_subtitle_font_size: "fontSize",
  tdt_search_translate_settings_v1: "searchTranslate",
  tdt_search_filter_settings_v251: "searchFilter",
  tdt_watch_analytics_v1: "watchAnalytics",
  tdt_video_stats_position_v4: "videoStatsPosition",
  tdt_private_update_settings_v1: "privateUpdateSettings"
});
const ONLINE_SYNC_WIRE_TO_STORAGE = ONLINE_SYNC_CORE.WIRE_TO_STORAGE || Object.freeze(Object.fromEntries(Object.entries(ONLINE_SYNC_STORAGE_TO_WIRE).map(([storageKey, wireKey]) => [wireKey, storageKey])));
let onlineSyncFlight = null;
let onlineSyncTimer = null;
let onlineSyncPersistTimer = null;
let onlineSyncApplyingRemote = false;
let onlineSyncPendingModifiedAt = {};
let onlineSyncSuppressedStorageValues = {};
const onlineSyncPendingReady = new Promise((resolve) => {
  if (!chrome.storage?.session) return resolve();
  chrome.storage.session.get({ [ONLINE_SYNC_PENDING_SESSION_KEY]: {} }, (result) => {
    if (!chrome.runtime.lastError && result?.[ONLINE_SYNC_PENDING_SESSION_KEY] && typeof result[ONLINE_SYNC_PENDING_SESSION_KEY] === "object") {
      onlineSyncPendingModifiedAt = { ...result[ONLINE_SYNC_PENDING_SESSION_KEY] };
    }
    resolve();
  });
});
const PRIVATE_UPDATE_DEFAULT_STATE = Object.freeze({
  currentVersion: chrome.runtime.getManifest().version,
  latestVersion: chrome.runtime.getManifest().version,
  available: false,
  status: "idle",
  message: "Chưa kiểm tra bản cập nhật.",
  checkedAt: 0,
  publishedAt: "",
  releaseNotes: "",
  downloadUrl: "",
  filename: "",
  releasePageUrl: PRIVATE_UPDATE_CONFIG.releasePageUrl,
  sha256: "",
  mandatory: false,
  downloadId: null,
  downloadStartedAt: 0,
  downloadedVersion: "",
  error: "",
  sourceUrl: ""
});
let privateUpdateCheckInFlight = null;
const DEFAULT_REMOTE_ACCESS_STATE = Object.freeze({
  allowed: false,
  status: "login_required",
  reason: "Đăng nhập Google để kích hoạt extension.",
  mode: "open",
  checkedAt: 0,
  leaseExpiresAt: 0,
  nextCheckSeconds: 60,
  serverReachable: false,
  error: "",
  clientId: "",
  authUid: "",
  source: "startup"
});
let remoteAccessState = { ...DEFAULT_REMOTE_ACCESS_STATE };
let remoteStateLoaded = false;
let remoteSyncInFlight = null;
let remoteUsageQueue = Promise.resolve();
let vercelAuthInFlight = null;
let googleSignInInFlight = null;
let vercelRealtimeGeneration = 0;
let vercelRealtimeRetryTimer = null;
let vercelRealtime = {
  uid: "",
  settings: null,
  access: null,
  update: null,
  settingsSeenAt: 0,
  accessSeenAt: 0,
  updateSeenAt: 0,
  controllers: []
};
const remoteStateReady = new Promise((resolve) => {
  chrome.storage.local.get({ [REMOTE_ACCESS_STATE_KEY]: DEFAULT_REMOTE_ACCESS_STATE }, (result) => {
    const stored = result?.[REMOTE_ACCESS_STATE_KEY];
    const normalized = normalizeRemoteState(stored);
    const cachedAccessFresh = normalized.allowed === true
      && Number(normalized.checkedAt) > 0
      && Date.now() - Number(normalized.checkedAt) <= FIREBASE_AUTH_TRANSIENT_GRACE_MS;
    remoteAccessState = normalized.allowed === false
      ? normalized
      : {
          ...normalized,
          allowed: cachedAccessFresh,
          status: cachedAccessFresh ? "checking_cached" : "checking",
          reason: cachedAccessFresh
            ? "Đang xác minh lại quyền sử dụng · tạm dùng phiên đã xác minh gần nhất."
            : "Đang xác minh lại quyền sử dụng với Vercel…",
          leaseExpiresAt: cachedAccessFresh ? Date.now() + Math.max(60_000, REMOTE_CONFIG.leaseSeconds * 1000) : 0,
          serverReachable: false,
          source: cachedAccessFresh ? "startup-cache" : "startup"
        };
    remoteStateLoaded = true;
    updateRemoteAccessBadge(remoteAccessState);
    resolve(remoteAccessState);
  });
});
const V245_MIGRATION_KEY = "tdt_v245_translator_no_stats_migration";
const V270_PLAYBACK_OFF_MIGRATION_KEY = "tdt_v270_playback_off_migration";
const V271_AUTOPLAY_RESTORE_MIGRATION_KEY = "tdt_v271_autoplay_restore_migration";
const PROXY_SETTINGS_KEY = "tdt_tiktok_proxy_settings_v1";
const PROXY_INSTALL_ID_KEY = "tdt_proxy_install_id_v1";
const PROXY_LIST_URL = "https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=text&country=th%2Cvn%2Ckh";
const PROXY_COUNTRIES = Object.freeze({ th: "Thái Lan", vn: "Việt Nam", kh: "Campuchia" });
const PROXY_HISTORY_LIMIT = 30;
const PROXY_LATENCY_TIMEOUT_MS = 5000;
const PROXY_CONNECT_TIMEOUT_MS = 3800;
const PROXY_CONNECT_MAX_ATTEMPTS = 4;
const PROXY_APPLY_SETTLE_MS = 180;
const PROXY_LATENCY_URL = "https://www.tiktok.com/favicon.ico";
const PROXY_LIST_CACHE_TTL_MS = 60 * 1000;
const PROXY_LIST_STALE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_PROXY_SETTINGS = Object.freeze({
  enabled: false,
  country: "th",
  current: null,
  history: [],
  rotation: 0,
  status: "off",
  error: "",
  updatedAt: 0
});
const proxyListCache = new Map();
const proxyListInFlight = new Map();
let proxyMutationQueue = Promise.resolve();
let proxyMutationInProgress = 0;
let proxyIgnoreErrorsUntil = 0;
let proxyHealthCheckTimer = null;
let proxyHealthCheckFlight = null;
let tiktokReloadTimer = null;

function proxyStorageGet(defaults) {
  return new Promise((resolve) => chrome.storage.local.get(defaults, (value) => {
    resolve(chrome.runtime.lastError ? defaults : value);
  }));
}

function proxyStorageSet(values) {
  return new Promise((resolve, reject) => chrome.storage.local.set(values, () => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
    else resolve();
  }));
}


function normalizeEchoTikSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const authMode = ["auto", "keyapi", "legacy"].includes(String(source.authMode || "auto")) ? String(source.authMode || "auto") : "auto";
  const rangePreset = ["lifetime", "1d", "3d", "7d", "14d", "30d", "custom"].includes(String(source.rangePreset || "lifetime")) ? String(source.rangePreset || "lifetime") : "lifetime";
  const dateValue = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim()) ? String(value || "").trim() : "";
  return {
    enabled: source.enabled === true,
    username: String(source.username || "").trim().slice(0, 300),
    password: String(source.password || "").slice(0, 1000),
    apiKey: String(source.apiKey || "").trim().slice(0, 2000),
    authMode,
    rangePreset,
    customStart: dateValue(source.customStart),
    customEnd: dateValue(source.customEnd),
    cacheMinutes: Math.max(5, Math.min(180, Math.round(Number(source.cacheMinutes) || 30)))
  };
}

function echoTikBasicAuth(username, password) {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return `Basic ${btoa(binary)}`;
}

function echoTikNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeEchoTikVideoItem(item, requestedVideoId, requestId = "") {
  if (!item || typeof item !== "object") return null;
  const videoId = String(item.video_id || requestedVideoId || "").trim();
  if (!videoId) return null;
  return {
    found: true,
    videoId,
    region: String(item.region || "").slice(0, 30),
    creator: String(item.unique_id || "").slice(0, 200),
    userId: String(item.user_id || "").slice(0, 100),
    videoDesc: String(item.video_desc || "").slice(0, 1000),
    sales: echoTikNumber(item.total_video_sale_cnt),
    gmv: echoTikNumber(item.total_video_sale_gmv_amt),
    views: echoTikNumber(item.total_views_cnt),
    views1d: echoTikNumber(item.total_views_1d_cnt),
    views7d: echoTikNumber(item.total_views_7d_cnt),
    views30d: echoTikNumber(item.total_views_30d_cnt),
    likes: echoTikNumber(item.total_digg_cnt),
    likes1d: echoTikNumber(item.total_digg_1d_cnt),
    likes7d: echoTikNumber(item.total_digg_7d_cnt),
    likes30d: echoTikNumber(item.total_digg_30d_cnt),
    comments: echoTikNumber(item.total_comments_cnt),
    shares: echoTikNumber(item.total_shares_cnt),
    favorites: echoTikNumber(item.total_favorites_cnt) < 0 ? null : echoTikNumber(item.total_favorites_cnt),
    salesFlag: echoTikNumber(item.sales_flag),
    createTime: echoTikNumber(item.create_time),
    duration: echoTikNumber(item.duration),
    ratio: String(item.ratio || "").slice(0, 40),
    width: echoTikNumber(item.width),
    height: echoTikNumber(item.height),
    fetchedAt: Date.now(),
    requestId: String(requestId || "").slice(0, 200)
  };
}

function echoTikLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function echoTikAddDays(dateText, amount) {
  const match = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  date.setDate(date.getDate() + Number(amount || 0));
  return echoTikLocalDate(date);
}

function echoTikResolveRange(settings) {
  const preset = settings.rangePreset || "lifetime";
  if (preset === "lifetime") return { preset, label: "Tổng tích lũy", start: "", end: "", baseline: "", days: 0 };
  const end = echoTikLocalDate();
  if (preset === "custom") {
    if (!settings.customStart || !settings.customEnd) throw new Error("EchoTik khoảng tùy chỉnh cần đủ ngày bắt đầu và kết thúc.");
    const startDate = new Date(`${settings.customStart}T12:00:00`);
    const endDate = new Date(`${settings.customEnd}T12:00:00`);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || startDate > endDate) throw new Error("Khoảng ngày EchoTik không hợp lệ.");
    const days = Math.floor((endDate - startDate) / 86400000) + 1;
    if (days > 31) throw new Error("EchoTik Trends hiện giới hạn khoảng tùy chỉnh tối đa 31 ngày để giảm số lượt gọi API.");
    return { preset, label: `${settings.customStart} → ${settings.customEnd}`, start: settings.customStart, end: settings.customEnd, baseline: echoTikAddDays(settings.customStart, -1), days };
  }
  const days = Math.max(1, Number.parseInt(preset, 10) || 7);
  const start = echoTikAddDays(end, -(days - 1));
  return { preset, label: `${days} ngày`, start, end, baseline: echoTikAddDays(start, -1), days };
}

function echoTikCacheId(videoId, settings) {
  const mode = settings.apiKey && settings.authMode !== "legacy" ? "keyapi" : "legacy";
  return `${mode}|${settings.rangePreset}|${settings.customStart}|${settings.customEnd}|${videoId}`;
}

async function readEchoTikPersistentCache() {
  const stored = await proxyStorageGet({ [ECHOTIK_CACHE_KEY]: {} });
  const value = stored?.[ECHOTIK_CACHE_KEY];
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function writeEchoTikCache(cacheId, result) {
  const id = String(cacheId || "");
  if (!id) return;
  const clean = { ...result };
  delete clean.cached;
  echotikMemoryCache.set(id, clean);
  const operation = async () => {
    const cache = await readEchoTikPersistentCache();
    cache[id] = clean;
    const entries = Object.entries(cache).sort((a, b) => Number(b[1]?.fetchedAt || 0) - Number(a[1]?.fetchedAt || 0));
    await proxyStorageSet({ [ECHOTIK_CACHE_KEY]: Object.fromEntries(entries.slice(0, ECHOTIK_CACHE_MAX_ENTRIES)) });
  };
  echotikCacheWriteQueue = echotikCacheWriteQueue.then(operation, operation);
  await echotikCacheWriteQueue;
}

async function readEchoTikCache(cacheId, ttlMs) {
  const id = String(cacheId || "");
  let cached = echotikMemoryCache.get(id) || null;
  if (!cached) {
    const persistent = await readEchoTikPersistentCache();
    cached = persistent[id] || null;
    if (cached) echotikMemoryCache.set(id, cached);
  }
  if (!cached || Date.now() - Number(cached.fetchedAt || 0) > ttlMs) return null;
  return { ...cached, cached: true };
}

async function echoTikFetchJson(url, headers, signal) {
  const response = await fetch(url, { method: "GET", headers: { Accept: "application/json", ...headers }, cache: "no-store", signal });
  if (response.status === 401 || response.status === 403) throw new Error("EchoTik/KeyAPI từ chối xác thực. Kiểm tra API Key hoặc tài khoản API.");
  if (response.status === 402) throw new Error("EchoTik/KeyAPI không đủ quota/credit.");
  if (response.status === 429) throw new Error("EchoTik/KeyAPI đang giới hạn tần suất. Hãy thử lại sau hoặc tăng thời gian cache.");
  if (!response.ok) throw new Error(`EchoTik/KeyAPI lỗi HTTP ${response.status}.`);
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object") throw new Error("EchoTik/KeyAPI trả về dữ liệu không hợp lệ.");
  const code = Number(payload.code);
  if (Number.isFinite(code) && code !== 0) throw new Error(String(payload.message || payload.msg || `EchoTik API code ${code}`).slice(0, 500));
  return payload;
}

function echoTikTrendDelta(rows, range) {
  const list = (Array.isArray(rows) ? rows : []).filter((row) => row && typeof row === "object" && /^\d{4}-\d{2}-\d{2}$/.test(String(row.dt || ""))).sort((a, b) => String(a.dt).localeCompare(String(b.dt)));
  if (!list.length) return null;
  const latest = list[list.length - 1];
  const baseline = list.find((row) => String(row.dt) <= range.baseline) || null;
  if (!baseline || baseline === latest) {
    return { available: false, latestDate: String(latest.dt || ""), rows: list.length };
  }
  const delta = (field) => Math.max(0, echoTikNumber(latest[field]) - echoTikNumber(baseline[field]));
  return {
    available: true,
    baselineDate: String(baseline.dt || ""),
    latestDate: String(latest.dt || ""),
    rows: list.length,
    sales: delta("total_video_sale_cnt"),
    gmv: delta("total_video_sale_gmv_amt"),
    views: delta("total_views_cnt"),
    likes: delta("total_digg_cnt"),
    comments: delta("total_comments_cnt"),
    shares: delta("total_shares_cnt"),
    favorites: delta("total_favorites_cnt")
  };
}

async function fetchEchoTikKeyApiTrends(videoId, settings, range, signal) {
  if (!range.start || !range.end) return null;
  const headers = { Authorization: `Bearer ${settings.apiKey}` };
  const rows = [];
  const queryStart = range.baseline || range.start;
  const maxPages = Math.min(10, Math.max(1, Math.ceil((range.days + 1) / 10) + 1));
  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(ECHOTIK_KEYAPI_TRENDS_URL);
    url.searchParams.set("video_id", videoId);
    url.searchParams.set("start_date", queryStart);
    url.searchParams.set("end_date", range.end);
    url.searchParams.set("page_num", String(page));
    url.searchParams.set("page_size", "10");
    const payload = await echoTikFetchJson(url.toString(), headers, signal);
    const pageRows = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.data?.list) ? payload.data.list : [];
    rows.push(...pageRows);
    if (pageRows.length < 10) break;
  }
  return echoTikTrendDelta(rows, range);
}

function applyEchoTikLegacyRange(result, settings, range) {
  if (!result?.found || range.preset === "lifetime") return { ...result, rangeLabel: range.label, rangeAccurate: true, salesRange: "lifetime", sourceMode: "legacy-detail" };
  const mapped = { ...result, rangeLabel: range.label, rangeAccurate: false, salesRange: "lifetime", sourceMode: "legacy-detail" };
  if (range.preset === "1d") { mapped.views = result.views1d; mapped.likes = result.likes1d; mapped.engagementRange = "1d"; }
  else if (range.preset === "7d") { mapped.views = result.views7d; mapped.likes = result.likes7d; mapped.engagementRange = "7d"; }
  else if (range.preset === "30d") { mapped.views = result.views30d; mapped.likes = result.likes30d; mapped.engagementRange = "30d"; }
  mapped.rangeWarning = "Legacy EchoTik chỉ có View/Like 1d/7d/30d; Sales/GMV đang là tổng tích lũy. Nhập API Key hiện tại để lọc Sales/GMV theo khoảng ngày.";
  return mapped;
}

async function fetchEchoTikVideoAnalytics(videoId, options = {}) {
  const id = String(videoId || "").trim();
  if (!/^\d{10,25}$/.test(id)) throw new Error("Video ID TikTok không hợp lệ.");
  await remoteStateReady;
  const access = effectiveRemoteAccessState(remoteAccessState);
  if (!access.allowed) throw new Error(access.reason || "Extension chưa được cấp quyền sử dụng.");

  const stored = await proxyStorageGet({ [ECHOTIK_SETTINGS_KEY]: DEFAULT_ECHOTIK_SETTINGS });
  const settings = normalizeEchoTikSettings(stored[ECHOTIK_SETTINGS_KEY]);
  if (!settings.enabled) throw new Error("EchoTik Shop Analytics đang tắt trong popup extension.");
  const useKeyApi = Boolean(settings.apiKey) && settings.authMode !== "legacy";
  if (!useKeyApi && (!settings.username || !settings.password)) throw new Error("Chưa nhập EchoTik API Key hoặc username/password Legacy.");
  if (settings.authMode === "keyapi" && !settings.apiKey) throw new Error("Chế độ EchoTik API Key đang bật nhưng chưa nhập API Key.");

  const range = echoTikResolveRange(settings);
  const cacheId = echoTikCacheId(id, settings);
  const force = options.force === true;
  const ttlMs = settings.cacheMinutes * 60 * 1000;
  if (!force) {
    const cached = await readEchoTikCache(cacheId, ttlMs);
    if (cached) return cached;
  }
  if (!force && echotikInFlight.has(cacheId)) return echotikInFlight.get(cacheId);

  const flight = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ECHOTIK_TIMEOUT_MS);
    try {
      let result = null;
      if (useKeyApi) {
        const detailUrl = new URL(ECHOTIK_KEYAPI_DETAIL_URL);
        detailUrl.searchParams.set("video_ids", id);
        const detailPayload = await echoTikFetchJson(detailUrl.toString(), { Authorization: `Bearer ${settings.apiKey}` }, controller.signal);
        const list = Array.isArray(detailPayload.data) ? detailPayload.data : Array.isArray(detailPayload.data?.list) ? detailPayload.data.list : [];
        const item = list.find((entry) => String(entry?.video_id || "") === id) || list[0] || null;
        result = normalizeEchoTikVideoItem(item, id, detailPayload.requestId || detailPayload.request_id || "");
        if (result) {
          result.sourceMode = "keyapi-detail";
          result.rangeLabel = range.label;
          result.rangeAccurate = range.preset === "lifetime";
          result.salesRange = "lifetime";
          if (range.preset !== "lifetime") {
            const trend = await fetchEchoTikKeyApiTrends(id, settings, range, controller.signal);
            result.trend = trend;
            if (trend?.available) {
              result = { ...result, sales: trend.sales, gmv: trend.gmv, views: trend.views, likes: trend.likes, comments: trend.comments, shares: trend.shares, favorites: trend.favorites, rangeAccurate: true, salesRange: range.label, sourceMode: "keyapi-trends", rangeStart: range.start, rangeEnd: range.end, latestTrendDate: trend.latestDate };
            } else {
              result.rangeWarning = "EchoTik Trends chưa có đủ snapshot baseline để tính chênh lệch chính xác; đang hiển thị tổng tích lũy từ Video Detail.";
            }
          }
        }
      } else {
        const url = new URL(ECHOTIK_LEGACY_VIDEO_DETAIL_URL);
        url.searchParams.set("video_ids", id);
        const payload = await echoTikFetchJson(url.toString(), { Authorization: echoTikBasicAuth(settings.username, settings.password) }, controller.signal);
        const list = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.data?.list) ? payload.data.list : [];
        const item = list.find((entry) => String(entry?.video_id || "") === id) || list[0] || null;
        result = normalizeEchoTikVideoItem(item, id, payload.requestId || payload.request_id || "");
        if (result) result = applyEchoTikLegacyRange(result, settings, range);
      }
      if (!result) result = { found: false, videoId: id, rangeLabel: range.label, message: "EchoTik chưa có dữ liệu cho video này. Video có thể chưa được thu thập hoặc không phải video TikTok Shop.", fetchedAt: Date.now(), sourceMode: useKeyApi ? "keyapi" : "legacy" };
      result.fetchedAt = Date.now();
      await writeEchoTikCache(cacheId, result).catch(() => {});
      return { ...result, cached: false };
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("EchoTik API quá thời gian phản hồi.");
      throw error;
    } finally { clearTimeout(timeout); }
  })();
  if (!force) echotikInFlight.set(cacheId, flight);
  try { return await flight; }
  finally { if (echotikInFlight.get(cacheId) === flight) echotikInFlight.delete(cacheId); }
}

function normalizeKaloDataSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const allowedRegions = new Set(["US", "GB", "ID", "TH", "VN", "PH", "MY"]);
  const allowedLanguages = new Set(["en-US", "zh-CN", "th-TH", "id-ID", "vi-VN"]);
  const allowedCurrencies = new Set(["CNY", "USD", "IDR", "VND", "THB", "MYR"]);
  const region = String(source.region || "VN").trim().toUpperCase();
  const language = String(source.language || "vi-VN").trim();
  const currency = String(source.currency || "VND").trim().toUpperCase();
  return {
    enabled: source.enabled === true,
    baseUrl: String(source.baseUrl || "").trim().replace(/\/+$/, "").slice(0, 1000),
    accessKey: String(source.accessKey || "").trim().slice(0, 2000),
    region: allowedRegions.has(region) ? region : "VN",
    language: allowedLanguages.has(language) ? language : "vi-VN",
    currency: allowedCurrencies.has(currency) ? currency : "VND",
    dateRange: String(source.dateRange || "last30Day").trim().slice(0, 80) || "last30Day",
    cacheMinutes: Math.max(5, Math.min(180, Math.round(Number(source.cacheMinutes) || 30)))
  };
}

function validateKaloDataBaseUrl(value) {
  let url;
  try { url = new URL(String(value || "").trim()); }
  catch (_error) { throw new Error("Kalodata API URL không hợp lệ."); }
  if (url.protocol !== "https:") throw new Error("Kalodata API URL phải dùng HTTPS.");
  const hostname = String(url.hostname || "").toLowerCase();
  const allowed = hostname === "kalodata.com" || hostname.endsWith(".kalodata.com") || hostname === "kalowave.com" || hostname.endsWith(".kalowave.com");
  if (!allowed) throw new Error("Kalodata API URL phải thuộc kalodata.com hoặc kalowave.com.");
  url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

function buildKaloDataEndpoint(value) {
  const normalized = validateKaloDataBaseUrl(value);
  const url = new URL(normalized);
  const canonicalPath = KALODATA_VIDEO_DETAIL_PATH;
  const hostname = String(url.hostname || "").toLowerCase();
  const path = String(url.pathname || "").replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  const lowerPath = path.toLowerCase();

  // Kalodata Open Center công khai tài liệu tại /open-center/docs, nhưng đây KHÔNG phải
  // endpoint API. Cho phép người dùng dán URL docs và tự chuyển về Video Detail endpoint
  // trên cùng origin. Đồng thời chuẩn hóa mọi biến thể /openapi, /openapi/v1 hoặc full endpoint.
  if (!path || path === "/") {
    url.pathname = canonicalPath;
  } else if (lowerPath.includes("/open-center/docs")) {
    url.pathname = canonicalPath;
  } else {
    const openApiIndex = lowerPath.indexOf("/openapi");
    if (openApiIndex >= 0) {
      const prefix = path.slice(0, openApiIndex).replace(/\/+$/, "");
      url.pathname = `${prefix}${canonicalPath}`.replace(/\/{2,}/g, "/");
    } else if (hostname === "kalodata.com" || hostname === "www.kalodata.com") {
      // Các URL website Kalodata như /open-center/docs, /pricing, /login... chỉ dùng để
      // nhận diện origin; không ghép path website vào endpoint API.
      url.pathname = canonicalPath;
    } else {
      // Hỗ trợ API gateway/subdomain có base-path riêng do Kalodata/Kalowave cấp.
      url.pathname = `${path}${canonicalPath}`.replace(/\/{2,}/g, "/");
    }
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}

function kaloDataEndpointCandidates(value) {
  const primary = buildKaloDataEndpoint(value);
  const input = new URL(validateKaloDataBaseUrl(value));
  const canonicalOrigin = new URL(KALODATA_VIDEO_DETAIL_PATH, `${input.origin}/`).toString();
  return [...new Set([primary, canonicalOrigin])];
}

function parseKaloDataNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object" && !Array.isArray(value)) {
    for (const key of ["value", "amount", "count", "total", "raw", "number", "num", "data"]) {
      if (!Object.hasOwn(value, key)) continue;
      const parsed = parseKaloDataNumber(value[key]);
      if (parsed !== null) return parsed;
    }
    return null;
  }
  let text = String(value).trim();
  if (!text) return null;
  let multiplier = 1;
  const suffix = text.match(/\s*(K|M|B|T|万|萬|亿|億)\s*$/i)?.[1];
  if (suffix) {
    const upper = suffix.toUpperCase();
    multiplier = upper === "K" ? 1e3 : upper === "M" ? 1e6 : upper === "B" ? 1e9 : upper === "T" ? 1e12 : (suffix === "万" || suffix === "萬") ? 1e4 : 1e8;
    text = text.slice(0, text.length - suffix.length).trim();
  }
  text = text.replace(/[\s\u00A0]/g, "").replace(/[^0-9,.\-+eE]/g, "");
  if (!text) return null;
  if (text.includes(",") && text.includes(".")) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) text = text.replace(/\./g, "").replace(",", ".");
    else text = text.replace(/,/g, "");
  } else if (text.includes(",")) {
    const parts = text.split(",");
    text = parts.length > 2 || (parts.length === 2 && parts[1].length === 3) ? text.replace(/,/g, "") : text.replace(",", ".");
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed * multiplier : null;
}

function normalizeKaloDataMetricKey(key) {
  return String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function maybeParseKaloDataJsonString(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.length < 2 || text.length > 250000 || !((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]")))) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function collectKaloDataEntries(source, maxDepth = 8) {
  const queue = [{ value: source, depth: 0, path: "$" }];
  const seen = new Set();
  const entries = [];
  let visits = 0;
  while (queue.length && visits < 1200) {
    const current = queue.shift();
    const value = current.value;
    visits += 1;
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      const parsed = maybeParseKaloDataJsonString(value);
      if (parsed && current.depth < maxDepth) queue.push({ value: parsed, depth: current.depth + 1, path: `${current.path}#json` });
      continue;
    }
    if (typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    if (Array.isArray(value)) {
      if (current.depth < maxDepth) value.slice(0, 160).forEach((child, index) => queue.push({ value: child, depth: current.depth + 1, path: `${current.path}[${index}]` }));
      continue;
    }
    for (const [key, raw] of Object.entries(value)) {
      const path = `${current.path}.${key}`;
      entries.push({ key, normalizedKey: normalizeKaloDataMetricKey(key), raw, path, depth: current.depth });
      if (current.depth < maxDepth && raw && (typeof raw === "object" || typeof raw === "string")) queue.push({ value: raw, depth: current.depth + 1, path });
    }
  }
  return entries;
}

function findKaloDataMetricEntry(entries, aliases, numeric = true) {
  const aliasOrder = aliases.map(normalizeKaloDataMetricKey);
  for (const alias of aliasOrder) {
    const candidates = entries.filter((entry) => entry.normalizedKey === alias);
    for (const entry of candidates) {
      if (!numeric) {
        if (entry.raw !== null && entry.raw !== undefined && typeof entry.raw !== "object") return { value: String(entry.raw), key: entry.key, path: entry.path };
        continue;
      }
      const parsed = parseKaloDataNumber(entry.raw);
      if (parsed !== null) return { value: parsed, key: entry.key, path: entry.path };
    }
  }
  return { value: numeric ? null : "", key: "", path: "" };
}

function normalizeKaloDataVideoPayload(payload, requestedVideoId, settings) {
  if (!payload || typeof payload !== "object") return null;
  // Video Detail queries exactly one video, therefore metrics may legally live in sibling
  // objects of the video_id wrapper. Scan the WHOLE response instead of throwing siblings away.
  const entries = collectKaloDataEntries(payload, 8);
  const text = (aliases) => findKaloDataMetricEntry(entries, aliases, false);
  const metric = (aliases) => findKaloDataMetricEntry(entries, aliases, true);
  const idEntry = text(["video_id", "videoId", "videoID"]);
  const videoId = String(idEntry.value || requestedVideoId || "").trim();
  if (!videoId) return null;

  // Exact documented fields come first. Compatibility aliases are fallback only.
  const salesMetric = metric(["sales_volume", "salesVolume", "video_sales_volume", "videoSalesVolume", "total_sales_volume", "totalSalesVolume", "sales_count", "salesCount", "sale_count", "saleCount"]);
  const revenueMetric = metric(["revenue", "video_revenue", "videoRevenue", "video_gmv", "videoGmv", "gmv"]);
  const viewsMetric = metric(["views", "video_views", "videoViews", "view_count", "viewCount", "total_views", "totalViews"]);
  const gpmMetric = metric(["video_gpm", "videoGpm", "gpm"]);
  const adsViewsMetric = metric(["ads_views", "adsViews", "ad_views", "adViews"]);
  const adsRoasMetric = metric(["ads_roas", "adsRoas", "roas"]);
  const adsPeriodMetric = metric(["ads_period", "adsPeriod", "ad_days", "adDays"]);
  const productMetric = metric(["product_number", "productNumber", "product_num", "productNum"]);
  const regionEntry = text(["video_region", "videoRegion", "region"]);
  const titleEntry = text(["video_title", "videoTitle", "title"]);
  const creatorIdEntry = text(["creator_id", "creatorId", "belonged_creator_id", "belongedCreatorId"]);
  const creatorHandleEntry = text(["creator_handle", "creatorHandle", "creator_hand", "creatorHand", "belonged_creator_handle", "belongedCreatorHandle"]);

  const responseKeySample = [...new Set(entries.map((entry) => entry.key))].slice(0, 80).join(", ");
  return {
    found: true,
    provider: "kalodata",
    videoId,
    region: String(regionEntry.value || settings.region || "").slice(0, 30),
    title: String(titleEntry.value || "").slice(0, 500),
    creatorId: String(creatorIdEntry.value || "").slice(0, 100),
    creatorHandle: String(creatorHandleEntry.value || "").slice(0, 200),
    productNumber: productMetric.value,
    sales: salesMetric.value,
    salesAvailable: salesMetric.value !== null,
    salesSourceField: salesMetric.key || "",
    salesSourcePath: salesMetric.path || "",
    gmv: revenueMetric.value,
    revenueSourcePath: revenueMetric.path || "",
    views: viewsMetric.value,
    viewsSourcePath: viewsMetric.path || "",
    gpm: gpmMetric.value,
    adsViews: adsViewsMetric.value,
    adsRoas: adsRoasMetric.value,
    adsPeriod: adsPeriodMetric.value,
    currency: String(settings.currency || "").slice(0, 10),
    dateRange: String(settings.dateRange || "").slice(0, 80),
    responseKeySample: salesMetric.value === null ? responseKeySample.slice(0, 1200) : "",
    fetchedAt: Date.now()
  };
}

async function readKaloDataPersistentCache() {
  const stored = await proxyStorageGet({ [KALODATA_CACHE_KEY]: {} });
  const value = stored?.[KALODATA_CACHE_KEY];
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function kaloDataCacheId(videoId, settings) {
  return `${settings.region}|${settings.currency}|${settings.dateRange}|${videoId}`;
}

async function writeKaloDataCache(cacheId, result) {
  const id = String(cacheId || "");
  if (!id) return;
  const clean = { ...result };
  delete clean.cached;
  kalodataMemoryCache.set(id, clean);
  const operation = async () => {
    const cache = await readKaloDataPersistentCache();
    cache[id] = clean;
    const entries = Object.entries(cache).sort((a, b) => Number(b[1]?.fetchedAt || 0) - Number(a[1]?.fetchedAt || 0));
    const trimmed = Object.fromEntries(entries.slice(0, KALODATA_CACHE_MAX_ENTRIES));
    await proxyStorageSet({ [KALODATA_CACHE_KEY]: trimmed });
  };
  kalodataCacheWriteQueue = kalodataCacheWriteQueue.then(operation, operation);
  await kalodataCacheWriteQueue;
}

async function readKaloDataCache(cacheId, ttlMs) {
  const id = String(cacheId || "");
  let cached = kalodataMemoryCache.get(id) || null;
  if (!cached) {
    const persistent = await readKaloDataPersistentCache();
    cached = persistent[id] || null;
    if (cached) kalodataMemoryCache.set(id, cached);
  }
  if (!cached || Date.now() - Number(cached.fetchedAt || 0) > ttlMs) return null;
  return { ...cached, cached: true };
}

async function fetchKaloDataVideoAnalytics(videoId, options = {}) {
  const id = String(videoId || "").trim();
  if (!/^\d{10,25}$/.test(id)) throw new Error("Video ID TikTok không hợp lệ.");

  await remoteStateReady;
  const access = effectiveRemoteAccessState(remoteAccessState);
  if (!access.allowed) throw new Error(access.reason || "Extension chưa được cấp quyền sử dụng.");

  const stored = await proxyStorageGet({ [KALODATA_SETTINGS_KEY]: DEFAULT_KALODATA_SETTINGS });
  const settings = normalizeKaloDataSettings(stored[KALODATA_SETTINGS_KEY]);
  if (!settings.enabled) throw new Error("Kalodata Shop Analytics đang tắt trong popup extension.");
  if (!settings.baseUrl) throw new Error("Chưa nhập Kalodata API URL. Có thể dán URL tài liệu https://www.kalodata.com/open-center/docs hoặc API Base URL/full endpoint do Kalodata cấp.");
  if (!settings.accessKey) throw new Error("Chưa nhập Kalodata Open API Access Key.");
  const baseUrl = validateKaloDataBaseUrl(settings.baseUrl);

  const cacheId = kaloDataCacheId(id, settings);
  const force = options.force === true;
  const ttlMs = settings.cacheMinutes * 60 * 1000;
  if (!force) {
    const cached = await readKaloDataCache(cacheId, ttlMs);
    if (cached) return cached;
  }

  if (!force && kalodataInFlight.has(cacheId)) return kalodataInFlight.get(cacheId);
  const flight = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), KALODATA_TIMEOUT_MS);
    try {
      const endpointCandidates = kaloDataEndpointCandidates(baseUrl);
      const requestBody = JSON.stringify({
        region: settings.region,
        language: settings.language,
        currency: settings.currency,
        date_range: settings.dateRange,
        video_id: id
      });
      let response = null;
      let endpointUsed = endpointCandidates[0];
      let last404Body = "";
      for (let index = 0; index < endpointCandidates.length; index += 1) {
        endpointUsed = endpointCandidates[index];
        response = await fetch(endpointUsed, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "content-type": "application/json;charset=UTF-8",
            "secret-key": settings.accessKey
          },
          body: requestBody,
          cache: "no-store",
          signal: controller.signal
        });
        if (response.status !== 404 || index === endpointCandidates.length - 1) break;
        last404Body = (await response.clone().text().catch(() => "")).slice(0, 240);
      }
      if (response.status === 401 || response.status === 403) throw new Error("Kalodata từ chối xác thực. Kiểm tra Access Key và quyền Open API.");
      if (response.status === 429) throw new Error("Kalodata API đang giới hạn tần suất/quota. Hãy tăng thời gian cache hoặc kiểm tra hạn mức API.");
      if (response.status === 404) {
        const attempted = endpointCandidates.join(" | ");
        const detail = last404Body ? ` Phản hồi: ${last404Body.replace(/\s+/g, " ")}` : "";
        throw new Error(`Kalodata API HTTP 404: endpoint không tồn tại trên host hiện tại. Đã thử: ${attempted}. URL /open-center/docs chỉ là trang tài liệu; extension đã tự chuyển sang /openapi/v1/video/detail. Nếu vẫn 404, tài khoản Open API của bạn đang dùng API host/gateway riêng do Kalodata cấp.${detail}`);
      }
      if (!response.ok) throw new Error(`Kalodata API lỗi HTTP ${response.status} tại ${endpointUsed}.`);
      const payload = await response.json().catch(() => null);
      if (!payload || typeof payload !== "object") throw new Error("Kalodata trả về dữ liệu không hợp lệ.");
      const apiCode = payload.code ?? payload.status_code ?? payload.statusCode;
      if (apiCode !== undefined && apiCode !== null && ![0, 200, "0", "200", "success", "SUCCESS"].includes(apiCode)) {
        throw new Error(String(payload.message || payload.msg || payload.error || `Kalodata API code ${apiCode}`).slice(0, 500));
      }
      let result = normalizeKaloDataVideoPayload(payload, id, settings);
      if (!result) {
        result = {
          found: false,
          provider: "kalodata",
          videoId: id,
          region: settings.region,
          currency: settings.currency,
          dateRange: settings.dateRange,
          message: "Kalodata chưa trả về dữ liệu cho video này hoặc video chưa có dữ liệu TikTok Shop trong khoảng thời gian đã chọn.",
          fetchedAt: Date.now()
        };
      }
      await writeKaloDataCache(cacheId, result).catch(() => {});
      return { ...result, cached: false };
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Kalodata API quá thời gian phản hồi.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  })();
  if (!force) kalodataInFlight.set(cacheId, flight);
  try {
    return await flight;
  } finally {
    if (kalodataInFlight.get(cacheId) === flight) kalodataInFlight.delete(cacheId);
  }
}

function proxySettingsGet() {
  return new Promise((resolve, reject) => chrome.proxy.settings.get({ incognito: false }, (details) => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
    else resolve(details || {});
  }));
}

function proxySettingsSet(value) {
  return new Promise((resolve, reject) => chrome.proxy.settings.set({ value, scope: "regular" }, () => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
    else resolve();
  }));
}

function proxySettingsClear() {
  return new Promise((resolve, reject) => chrome.proxy.settings.clear({ scope: "regular" }, () => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
    else resolve();
  }));
}

function randomInstallId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function emptyRemoteUsage() {
  return Object.fromEntries(REMOTE_COUNTER_KEYS.map((key) => [key, 0]));
}

function normalizeRemoteUsage(value) {
  const source = value && typeof value === "object" ? value : {};
  const usage = emptyRemoteUsage();
  for (const key of REMOTE_COUNTER_KEYS) {
    const amount = Number(source[key]);
    usage[key] = Number.isFinite(amount) && amount > 0 ? Math.min(1_000_000, Math.floor(amount)) : 0;
  }
  return usage;
}

function updateRemoteUsage(mutator) {
  const operation = remoteUsageQueue.then(async () => {
    const stored = await proxyStorageGet({ [REMOTE_USAGE_KEY]: emptyRemoteUsage() });
    const current = normalizeRemoteUsage(stored[REMOTE_USAGE_KEY]);
    const next = normalizeRemoteUsage(mutator({ ...current }) || current);
    await proxyStorageSet({ [REMOTE_USAGE_KEY]: next });
    return next;
  });
  remoteUsageQueue = operation.catch(() => emptyRemoteUsage());
  return operation;
}

function recordRemoteUsage(counter, amount = 1) {
  if (!REMOTE_COUNTER_KEYS.includes(counter)) return Promise.resolve(emptyRemoteUsage());
  const increment = Math.max(1, Math.min(1000, Math.floor(Number(amount) || 1)));
  return updateRemoteUsage((usage) => {
    usage[counter] = Math.min(1_000_000, usage[counter] + increment);
    return usage;
  }).catch(() => emptyRemoteUsage());
}

async function getRemoteClientId() {
  const stored = await proxyStorageGet({ [REMOTE_CLIENT_ID_KEY]: "" });
  const current = String(stored[REMOTE_CLIENT_ID_KEY] || "").trim().toLowerCase();
  if (/^[a-f0-9]{32}$/.test(current)) return current;
  const clientId = randomInstallId();
  await proxyStorageSet({ [REMOTE_CLIENT_ID_KEY]: clientId });
  return clientId;
}

function normalizeRemoteState(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...DEFAULT_REMOTE_ACCESS_STATE,
    allowed: source.allowed === true,
    status: String(source.status || "checking").slice(0, 40),
    reason: String(source.reason || DEFAULT_REMOTE_ACCESS_STATE.reason).slice(0, 500),
    mode: ["open", "whitelist", "blacklist"].includes(source.mode) ? source.mode : "open",
    checkedAt: Math.max(0, Number(source.checkedAt) || 0),
    leaseExpiresAt: Math.max(0, Number(source.leaseExpiresAt) || 0),
    nextCheckSeconds: Math.max(30, Math.min(3600, Number(source.nextCheckSeconds) || 60)),
    serverReachable: source.serverReachable === true,
    error: String(source.error || "").slice(0, 300),
    clientId: String(source.clientId || "").slice(0, 80),
    authUid: String(source.authUid || "").slice(0, 128),
    source: String(source.source || "unknown").slice(0, 30)
  };
}

function remoteAccessLeaseValid(state = remoteAccessState) {
  return state?.allowed === true
    && state?.serverReachable === true
    && Number(state.leaseExpiresAt) > Date.now() + 1000;
}

function remoteConfigError(){if(!REMOTE_CONFIG.enabled)return "Kiểm soát máy chủ đang bị tắt trong cấu hình.";if(!/^https:\/\//i.test(REMOTE_CONFIG.serverUrl)||REMOTE_CONFIG.serverUrl.includes("YOUR_SERVER_URL"))return "Chưa cấu hình Vercel server URL.";if(REMOTE_CONFIG.expectedExtensionId&&REMOTE_CONFIG.expectedExtensionId!==chrome.runtime.id)return "Extension ID không khớp bản phát hành đã được cấp phép.";return "";}

let mandatoryUpdateGate = { locked: false, latestVersion: "", message: "", downloadUrl: "", releasePageUrl: "" };

function effectiveRemoteAccessState(state = remoteAccessState) {
  const base = normalizeRemoteState(state);
  if (!mandatoryUpdateGate.locked) return base;
  return {
    ...base,
    allowed: false,
    status: "mandatory_update",
    reason: mandatoryUpdateGate.message || `Bắt buộc cập nhật lên v${mandatoryUpdateGate.latestVersion} để tiếp tục sử dụng.`,
    leaseExpiresAt: 0,
    serverReachable: true,
    error: "",
    source: "mandatory-update",
    update: { ...mandatoryUpdateGate }
  };
}

async function maybeOpenMandatoryUpdateWindow(state) {
  if (!state?.available || state?.mandatory !== true || !state?.latestVersion) return;
  const stored = await proxyStorageGet({ [PRIVATE_UPDATE_PROMPTED_VERSION_KEY]: "" }).catch(() => ({ [PRIVATE_UPDATE_PROMPTED_VERSION_KEY]: "" }));
  if (stored[PRIVATE_UPDATE_PROMPTED_VERSION_KEY] === state.latestVersion) return;
  const existing = await new Promise((resolve) => chrome.windows.getAll({ populate: true, windowTypes: ["popup"] }, (windows) => {
    if (chrome.runtime.lastError) return resolve(false);
    resolve((windows || []).some((windowInfo) => (windowInfo.tabs || []).some((tab) => String(tab.url || "").includes(PRIVATE_UPDATE_PROMPT_PAGE))));
  }));
  if (!existing) {
    await new Promise((resolve) => chrome.windows.create({
      url: chrome.runtime.getURL(PRIVATE_UPDATE_PROMPT_PAGE),
      type: "popup",
      width: 470,
      height: 590,
      focused: true
    }, () => resolve()));
  }
  await proxyStorageSet({ [PRIVATE_UPDATE_PROMPTED_VERSION_KEY]: state.latestVersion }).catch(() => {});
}

function updateMandatoryUpdateGate(state) {
  const locked = state?.available === true && state?.mandatory === true && comparePrivateUpdateVersions(state.latestVersion, chrome.runtime.getManifest().version) > 0;
  mandatoryUpdateGate = locked ? {
    locked: true,
    latestVersion: String(state.latestVersion || ""),
    message: `Đã có phiên bản bắt buộc v${state.latestVersion}. Hãy cập nhật để tiếp tục sử dụng Extension.`,
    downloadUrl: String(state.downloadUrl || ""),
    releasePageUrl: String(state.releasePageUrl || "")
  } : { locked: false, latestVersion: "", message: "", downloadUrl: "", releasePageUrl: "" };
  broadcastRemoteAccessState(remoteAccessState);
  if (locked) void maybeOpenMandatoryUpdateWindow(state);
  return mandatoryUpdateGate;
}

function updateRemoteAccessBadge(state) {
  if (!chrome.action) return;
  const effective = effectiveRemoteAccessState(state);
  const mandatory = effective.status === "mandatory_update";
  const blocked = effective.allowed === false;
  chrome.action.setBadgeText({ text: mandatory ? "UP" : "" }, () => void chrome.runtime.lastError);
  if (mandatory) chrome.action.setBadgeBackgroundColor({ color: "#fe2c55" }, () => void chrome.runtime.lastError);
  chrome.action.setTitle({
    title: blocked
      ? `TikTok Tài Đẹp Trai · Đã khóa${effective.reason ? `: ${effective.reason}` : ""}`
      : "TikTok Tài Đẹp Trai"
  }, () => void chrome.runtime.lastError);
}

function broadcastRemoteAccessState(state) {
  const effective = effectiveRemoteAccessState(state);
  updateRemoteAccessBadge(effective);
  chrome.tabs.query({ url: ["https://tiktok.com/*", "https://*.tiktok.com/*"] }, (tabs) => {
    if (chrome.runtime.lastError) return;
    for (const tab of tabs || []) {
      if (!Number.isInteger(tab.id)) continue;
      chrome.tabs.sendMessage(tab.id, { type: "TDT_REMOTE_ACCESS_CHANGED", state: effective }).catch(() => {});
    }
  });
}

async function storeRemoteAccessState(state, notify = true) {
  remoteAccessState = normalizeRemoteState(state);
  remoteStateLoaded = true;
  await proxyStorageSet({ [REMOTE_ACCESS_STATE_KEY]: remoteAccessState });
  if (notify) broadcastRemoteAccessState(remoteAccessState);
  else updateRemoteAccessBadge(remoteAccessState);
  return remoteAccessState;
}

function remoteClientMetadata(installReason) {
  let timezone = "";
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (_error) { /* Ignore unavailable timezone. */ }
  return {
    version: chrome.runtime.getManifest().version,
    locale: String(navigator.language || "").slice(0, 40),
    platform: String(navigator.userAgentData?.platform || navigator.platform || "").slice(0, 80),
    browser: String(navigator.userAgent || "").slice(0, 240),
    architecture: String(navigator.userAgentData?.architecture || "").slice(0, 40),
    mobile: navigator.userAgentData?.mobile === true,
    hardwareConcurrency: Math.max(0, Math.min(128, Number(navigator.hardwareConcurrency) || 0)),
    deviceMemory: Math.max(0, Math.min(128, Number(navigator.deviceMemory) || 0)),
    connectionType: String(navigator.connection?.effectiveType || "").slice(0, 30),
    timezone: String(timezone).slice(0, 80),
    installReason: String(installReason || "").slice(0, 40),
    extensionId: chrome.runtime.id
  };
}

function normalizeVercelAuth(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    idToken: String(source.idToken || ""),
    refreshToken: String(source.refreshToken || ""),
    uid: String(source.uid || "").slice(0, 128),
    expiresAt: Math.max(0, Number(source.expiresAt) || 0),
    provider: String(source.provider || "").slice(0, 40),
    email: String(source.email || "").slice(0, 254),
    displayName: String(source.displayName || "").slice(0, 120),
    photoURL: String(source.photoURL || "").slice(0, 500),
    lastOkAt: Math.max(0, Number(source.lastOkAt) || 0)
  };
}

async function vercelAuthPost(path, body) {
  let response; try { response=await fetch(`${REMOTE_CONFIG.serverUrl}${path}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"}); } catch(cause){const e=new Error(cause?.message||"Không thể kết nối máy chủ xác thực.");e.code="NETWORK_ERROR";e.transient=true;throw e;}
  const payload=await response.json().catch(()=>({})); if(!response.ok||payload?.ok!==true){const e=new Error(payload?.error||`Máy chủ xác thực HTTP ${response.status}.`);e.code=String(payload?.error||`HTTP_${response.status}`);e.status=response.status;e.transient=response.status>=500||response.status===408||response.status===429;throw e;} return payload;
}
function vercelRefreshTokenIsPermanentlyInvalid(error){const code=String(error?.code||error?.message||"").toUpperCase();return code.includes("SESSION")||code.includes("INVALID")||code.includes("EXPIRED")||code.includes("UNAUTHORIZED");}
async function refreshVercelAuth(refreshToken,current={}){const payload=await vercelAuthPost("/api/v1/auth/refresh",{refreshToken});return{idToken:String(payload.idToken||""),refreshToken:String(payload.refreshToken||refreshToken),uid:String(payload.uid||current.uid||""),expiresAt:Date.now()+Math.max(300,Number(payload.expiresIn)||3600)*1000,provider:"google.com",email:String(payload.email||current.email||""),displayName:String(payload.displayName||current.displayName||""),photoURL:String(payload.photoURL||current.photoURL||""),lastOkAt:Date.now()};}

function publicAuthState(authValue) {
  const auth = normalizeVercelAuth(authValue);
  return {
    signedIn: Boolean(auth.uid && auth.refreshToken && auth.provider === "google.com"),
    uid: auth.uid,
    email: auth.email,
    displayName: auth.displayName,
    photoURL: auth.photoURL,
    provider: auth.provider
  };
}

async function hasOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(GOOGLE_AUTH_OFFSCREEN_PATH);
  const controlledClients = await clients.matchAll();
  return controlledClients.some((client) => client.url === offscreenUrl);
}

let creatingOffscreenDocument = null;
async function setupGoogleAuthOffscreen() {
  if (await hasOffscreenDocument()) return;
  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen.createDocument({
      url: GOOGLE_AUTH_OFFSCREEN_PATH,
      reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
      justification: "Đăng nhập Google an toàn bằng Vercel Authentication"
    }).finally(() => { creatingOffscreenDocument = null; });
  }
  await creatingOffscreenDocument;
}

async function closeGoogleAuthOffscreen() {
  if (await hasOffscreenDocument()) await chrome.offscreen.closeDocument();
}

function authSessionGet(defaults) {
  const area = chrome.storage.session || chrome.storage.local;
  return new Promise((resolve) => area.get(defaults, (value) => {
    resolve(chrome.runtime.lastError ? defaults : value);
  }));
}

function authSessionSet(values) {
  const area = chrome.storage.session || chrome.storage.local;
  return new Promise((resolve, reject) => area.set(values, () => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
    else resolve();
  }));
}

function authSessionRemove(keys) {
  const area = chrome.storage.session || chrome.storage.local;
  return new Promise((resolve) => area.remove(keys, () => resolve()));
}

function createGoogleAuthWindow(url) {
  return new Promise((resolve, reject) => chrome.windows.create({
    url,
    type: "popup",
    width: 520,
    height: 760,
    focused: true
  }, (createdWindow) => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
    else if (!createdWindow?.id) reject(new Error("Chrome không tạo được cửa sổ đăng nhập Google."));
    else resolve(createdWindow);
  }));
}

function googleAuthWindowExists(windowId) {
  return new Promise((resolve) => chrome.windows.get(windowId, {}, () => {
    resolve(!chrome.runtime.lastError);
  }));
}

function closeGoogleAuthWindow(windowId) {
  if (!Number.isInteger(windowId)) return Promise.resolve();
  return new Promise((resolve) => chrome.windows.remove(windowId, () => resolve()));
}

function authDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForVisibleGoogleAuth(nonce, windowId) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const stored = await authSessionGet({ [GOOGLE_AUTH_RESULT_KEY]: null });
    const result = stored[GOOGLE_AUTH_RESULT_KEY];
    if (result && result.nonce === nonce) {
      await authSessionRemove(GOOGLE_AUTH_RESULT_KEY);
      if (result.ok !== true) throw new Error(result.error || "Đăng nhập Google thất bại.");
      return result;
    }
    if (!(await googleAuthWindowExists(windowId))) {
      throw new Error("Bạn đã đóng cửa sổ đăng nhập Google trước khi hoàn tất.");
    }
    await authDelay(350);
  }
  throw new Error("Đăng nhập Google quá thời gian 3 phút. Hãy thử lại.");
}

async function runVisibleGoogleSignIn() {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const extensionId = chrome.runtime.id;
  if (REMOTE_CONFIG.expectedExtensionId && extensionId !== REMOTE_CONFIG.expectedExtensionId) {
    throw new Error(`Extension ID không đúng. Hiện tại: ${extensionId}. Yêu cầu: ${REMOTE_CONFIG.expectedExtensionId}.`);
  }
  await authSessionRemove([GOOGLE_AUTH_PENDING_KEY, GOOGLE_AUTH_RESULT_KEY]);
  await authSessionSet({
    [GOOGLE_AUTH_PENDING_KEY]: { nonce, extensionId, createdAt: Date.now() }
  });
  const url = `${GOOGLE_AUTH_WINDOW_BASE_URL}?extensionId=${encodeURIComponent(extensionId)}&nonce=${encodeURIComponent(nonce)}&v=2.2.1`;
  let authWindow = null;
  try {
    authWindow = await createGoogleAuthWindow(url);
    const result = await waitForVisibleGoogleAuth(nonce, authWindow.id);
    const next = normalizeVercelAuth({
      idToken: result.idToken,
      refreshToken: result.refreshToken,
      uid: result.uid,
      expiresAt: Date.now() + Math.max(300, Number(result.expiresIn) || 3600) * 1000,
      provider: "google.com",
      email: result.email,
      displayName: result.displayName,
      photoURL: result.photoURL,
      lastOkAt: Date.now()
    });
    if (!next.idToken || !next.refreshToken || !next.uid) {
      throw new Error("Vercel không trả về phiên đăng nhập Google đầy đủ.");
    }
    await proxyStorageSet({ [FIREBASE_AUTH_KEY]: next, [FIREBASE_AUTH_LAST_OK_KEY]: Date.now() });
    await recordRemoteUsage("googleLogins");
    await syncRemoteAccess(true);
    await runOnlineSync("login", true).catch(() => {});
    return next;
  } finally {
    await authSessionRemove([GOOGLE_AUTH_PENDING_KEY, GOOGLE_AUTH_RESULT_KEY]);
    if (authWindow?.id) await closeGoogleAuthWindow(authWindow.id).catch(() => {});
  }
}

async function signInWithGoogle() {
  if (!googleSignInInFlight) {
    googleSignInInFlight = runVisibleGoogleSignIn().finally(() => {
      googleSignInInFlight = null;
    });
  }
  return googleSignInInFlight;
}

async function getStoredVercelAuth() {
  const stored = await proxyStorageGet({ [FIREBASE_AUTH_KEY]: {} });
  return normalizeVercelAuth(stored[FIREBASE_AUTH_KEY]);
}

async function getVercelAuth(forceRefresh = false) {
  if (vercelAuthInFlight) return vercelAuthInFlight;
  vercelAuthInFlight = (async () => {
    const current = await getStoredVercelAuth();
    if (!forceRefresh && current.provider === "google.com" && current.idToken && current.uid && current.expiresAt > Date.now() + 120_000) {
      if (!current.lastOkAt) {
        current.lastOkAt = Date.now();
        await proxyStorageSet({ [FIREBASE_AUTH_KEY]: current, [FIREBASE_AUTH_LAST_OK_KEY]: current.lastOkAt });
      }
      return current;
    }
    if (!current.refreshToken || !current.uid || current.provider !== "google.com") {
      throw new Error("LOGIN_REQUIRED: Đăng nhập Google để sử dụng extension.");
    }
    try {
      const next = await refreshVercelAuth(current.refreshToken, current);
      if (!next?.idToken || !next?.uid || !next?.refreshToken || next.provider !== "google.com") {
        throw Object.assign(new Error("Vercel không trả về phiên làm mới hợp lệ."), { code: "INVALID_REFRESH_RESPONSE", transient: true });
      }
      await proxyStorageSet({ [FIREBASE_AUTH_KEY]: next, [FIREBASE_AUTH_LAST_OK_KEY]: Date.now() });
      return next;
    } catch (error) {
      if (vercelRefreshTokenIsPermanentlyInvalid(error)) {
        await new Promise((resolve) => chrome.storage.local.remove([FIREBASE_AUTH_KEY, FIREBASE_AUTH_LAST_OK_KEY], resolve));
        throw new Error("LOGIN_REQUIRED: Phiên Google đã bị thu hồi. Hãy đăng nhập lại.");
      }
      // Lỗi mạng, timeout hoặc Vercel tạm thời không phản hồi không được phép
      // xóa refresh token. Giữ nguyên tài khoản để extension tự làm mới lại sau.
      const lastOkAt = Math.max(
        current.lastOkAt,
        Number((await proxyStorageGet({ [FIREBASE_AUTH_LAST_OK_KEY]: 0 }))[FIREBASE_AUTH_LAST_OK_KEY]) || 0,
        current.expiresAt ? Math.min(current.expiresAt, Date.now()) : 0
      );
      const errorMessage = String(error?.message || "Không thể làm mới phiên Google.");
      const transient = new Error(`AUTH_TEMPORARY: ${errorMessage}`);
      transient.code = "AUTH_TEMPORARY";
      transient.auth = { ...current, lastOkAt };
      transient.withinGrace = Boolean(lastOkAt && Date.now() - lastOkAt <= FIREBASE_AUTH_TRANSIENT_GRACE_MS);
      throw transient;
    }
  })().finally(() => { vercelAuthInFlight = null; });
  return vercelAuthInFlight;
}

async function fetchRemoteAccessDecision(clientId, counters, installReason, retryAuth = true) {
  const auth = await getVercelAuth(false);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_CONFIG.requestTimeoutMs);
  try {
    const response = await fetch(`${REMOTE_CONFIG.serverUrl}/api/v1/extension/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.idToken}` },
      body: JSON.stringify({
        projectKey: REMOTE_CONFIG.projectKey,
        clientId,
        client: remoteClientMetadata(installReason),
        counters
      }),
      cache: "no-store",
      signal: controller.signal
    });
    let payload = null;
    try { payload = await response.json(); } catch (_error) { /* Report a stable error below. */ }
    if (response.status === 401 && retryAuth) {
      await getVercelAuth(true);
      return fetchRemoteAccessDecision(clientId, counters, installReason, false);
    }
    if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || `Máy chủ phản hồi HTTP ${response.status}.`);
    if (typeof payload.allowed !== "boolean") throw new Error("Phản hồi kiểm soát truy cập không hợp lệ.");
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function realtimeStreamsFresh(){return false;}
async function startVercelRealtime(){vercelRealtime.controllers=[{}, {}, {}];vercelRealtime.uid=String((await getStoredVercelAuth()).uid||"");}
function stopVercelRealtime(){vercelRealtime.controllers=[];}
async function failClosedRealtime(){return syncRemoteAccess(true);}

function ensureRemoteHeartbeatAlarm() {
  if (!REMOTE_CONFIG.enabled) return;
  chrome.alarms.get(REMOTE_HEARTBEAT_ALARM, (alarm) => {
    if (chrome.runtime.lastError) return;
    const desired = REMOTE_CONFIG.heartbeatMinutes;
    if (alarm && Math.abs(Number(alarm.periodInMinutes) - desired) < 0.01) return;
    if (alarm) chrome.alarms.clear(REMOTE_HEARTBEAT_ALARM, () => {
      chrome.alarms.create(REMOTE_HEARTBEAT_ALARM, { delayInMinutes: 0.1, periodInMinutes: desired });
    });
    else chrome.alarms.create(REMOTE_HEARTBEAT_ALARM, { delayInMinutes: 0.1, periodInMinutes: desired });
  });
  chrome.alarms.get(FIREBASE_REALTIME_RECONNECT_ALARM, (alarm) => {
    if (chrome.runtime.lastError || alarm) return;
    chrome.alarms.create(FIREBASE_REALTIME_RECONNECT_ALARM, { delayInMinutes: 0.5, periodInMinutes: 1 });
  });
}

async function syncRemoteAccess(force = false) {
  await remoteStateReady;
  const configurationError = remoteConfigError();
  if (configurationError) {
    return storeRemoteAccessState({
      ...remoteAccessState,
      allowed: false,
      status: "configuration_error",
      reason: configurationError,
      serverReachable: false,
      error: configurationError,
      checkedAt: Date.now(),
      leaseExpiresAt: 0,
      source: "configuration"
    });
  }
  if (!force && remoteAccessLeaseValid()) return remoteAccessState;
  if (remoteSyncInFlight) return remoteSyncInFlight;

  remoteSyncInFlight = (async () => {
    const clientId = await getRemoteClientId();
    await remoteUsageQueue.catch(() => {});
    const stored = await proxyStorageGet({ [REMOTE_USAGE_KEY]: emptyRemoteUsage(), [REMOTE_INSTALL_REASON_KEY]: "" });
    const snapshot = normalizeRemoteUsage(stored[REMOTE_USAGE_KEY]);
    try {
      const result = await fetchRemoteAccessDecision(clientId, snapshot, stored[REMOTE_INSTALL_REASON_KEY]);
      if (result.update && typeof result.update === "object") {
        try { await applyPrivateUpdateManifest(result.update, "vercel-api-check"); }
        catch (_error) { /* Các nguồn manifest dự phòng sẽ thử lại. */ }
      }
      const next = await storeRemoteAccessState({
        allowed: result.allowed,
        status: result.status,
        reason: result.reason,
        mode: result.mode,
        checkedAt: Date.now(),
        leaseExpiresAt: Math.min(
          Number(result.leaseExpiresAt) || Date.now() + REMOTE_CONFIG.leaseSeconds * 1000,
          Date.now() + REMOTE_CONFIG.leaseSeconds * 1000
        ),
        nextCheckSeconds: result.nextCheckSeconds,
        serverReachable: true,
        error: "",
        clientId,
        authUid: result.authUid,
        source: "vercel-api"
      });
      await updateRemoteUsage((usage) => {
        for (const key of REMOTE_COUNTER_KEYS) usage[key] = Math.max(0, usage[key] - snapshot[key]);
        return usage;
      });
      void Promise.resolve();
      return next;
    } catch (error) {
      const errorMessage = error?.name === "AbortError"
        ? "Máy chủ kiểm soát phản hồi quá chậm."
        : String(error?.message || "Không thể kết nối máy chủ kiểm soát.");
      const loginRequired = errorMessage.startsWith("LOGIN_REQUIRED:");
      const authTemporary = errorMessage.startsWith("AUTH_TEMPORARY:");
      const cachedAllowed = authTemporary && remoteAccessState.allowed === true && Date.now() - Number(remoteAccessState.checkedAt || 0) <= FIREBASE_AUTH_TRANSIENT_GRACE_MS;
      return storeRemoteAccessState({
        ...remoteAccessState,
        allowed: cachedAllowed,
        status: loginRequired ? "login_required" : cachedAllowed ? "active_cached" : "server_unavailable",
        reason: loginRequired
          ? "Đăng nhập Google để sử dụng extension."
          : cachedAllowed
          ? "Vercel tạm thời ngoại tuyến · đang dùng quyền đã xác minh gần nhất."
          : remoteAccessState.allowed === false && remoteAccessState.reason
          ? remoteAccessState.reason
          : "Không thể xác minh quyền sử dụng với Vercel. Extension tạm dừng cho đến lần kết nối lại.",
        checkedAt: cachedAllowed ? remoteAccessState.checkedAt : Date.now(),
        leaseExpiresAt: cachedAllowed ? Date.now() + Math.max(60_000, REMOTE_CONFIG.leaseSeconds * 1000) : 0,
        serverReachable: false,
        error: errorMessage,
        clientId,
        source: cachedAllowed ? "cached-auth-grace" : "fail-closed"
      });
    }
  })().finally(() => { remoteSyncInFlight = null; });
  return remoteSyncInFlight;
}

async function getProxyInstallId() {
  const stored = await proxyStorageGet({ [PROXY_INSTALL_ID_KEY]: "" });
  if (stored[PROXY_INSTALL_ID_KEY]) return String(stored[PROXY_INSTALL_ID_KEY]);
  const id = randomInstallId();
  await proxyStorageSet({ [PROXY_INSTALL_ID_KEY]: id });
  return id;
}

function parseProxyList(text) {
  const unique = new Map();
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^(https?|socks4|socks5):\/\/([a-z\d.-]+):(\d{1,5})$/i);
    if (!match) continue;
    const protocol = match[1].toLowerCase();
    const host = match[2].toLowerCase();
    const port = Number(match[3]);
    if (!port || port > 65535 || !host || host.includes("..")) continue;
    const normalizedProtocol = protocol === "https" ? "https" : protocol === "http" ? "http" : protocol;
    const key = `${normalizedProtocol}://${host}:${port}`;
    unique.set(key, { protocol: normalizedProtocol, host, port, key });
  }
  return [...unique.values()];
}

function stableHash(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function fetchProxyListUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`ProxyScrape trả về HTTP ${response.status}.`);
    const proxies = parseProxyList(await response.text());
    if (!proxies.length) throw new Error("ProxyScrape chưa trả về proxy hợp lệ.");
    return proxies;
  } finally {
    clearTimeout(timeout);
  }
}

function countryProxyListUrl(country) {
  const safeCountry = Object.hasOwn(PROXY_COUNTRIES, country) ? country : "th";
  return `https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=text&country=${safeCountry}`;
}

async function fetchDetectedCountryProxyList(country) {
  const safeCountry = Object.hasOwn(PROXY_COUNTRIES, country) ? country : "th";
  const now = Date.now();
  const cached = proxyListCache.get(safeCountry);
  if (cached?.proxies?.length && now - cached.updatedAt < PROXY_LIST_CACHE_TTL_MS) return cached.proxies;
  if (proxyListInFlight.has(safeCountry)) return proxyListInFlight.get(safeCountry);

  const task = (async () => {
    try {
      const [combinedResult, countryResult] = await Promise.allSettled([
        fetchProxyListUrl(PROXY_LIST_URL),
        fetchProxyListUrl(countryProxyListUrl(safeCountry))
      ]);
      if (countryResult.status !== "fulfilled") throw countryResult.reason;
      const countryProxies = countryResult.value.map((proxy) => ({ ...proxy, country: safeCountry }));
      let proxies = countryProxies;
      if (combinedResult.status === "fulfilled") {
        const combinedKeys = new Set(combinedResult.value.map((proxy) => proxy.key));
        const detected = countryProxies.filter((proxy) => combinedKeys.has(proxy.key));
        if (detected.length) proxies = detected;
      }
      proxyListCache.set(safeCountry, { proxies, updatedAt: Date.now() });
      return proxies;
    } catch (error) {
      if (cached?.proxies?.length && now - cached.updatedAt < PROXY_LIST_STALE_TTL_MS) return cached.proxies;
      throw error;
    } finally {
      proxyListInFlight.delete(safeCountry);
    }
  })();
  proxyListInFlight.set(safeCountry, task);
  return task;
}

function pacDirective(proxy) {
  if (proxy.protocol === "socks5") return `SOCKS5 ${proxy.host}:${proxy.port}`;
  if (proxy.protocol === "socks4") return `SOCKS ${proxy.host}:${proxy.port}`;
  // ProxyScrape labels an endpoint as "https" when it can tunnel HTTPS targets.
  // It is still an HTTP CONNECT proxy in PAC syntax. Using the PAC keyword HTTPS
  // makes many public endpoints fail immediately with ERR_PROXY_CONNECTION_FAILED.
  return `PROXY ${proxy.host}:${proxy.port}`;
}

function buildTikTokPac(proxy) {
  const directive = pacDirective(proxy);
  return `function FindProxyForURL(url, host) {
    host = String(host || "").toLowerCase();
    var useProxy = host === "tiktok.com" || dnsDomainIs(host, ".tiktok.com") ||
      host === "tiktokv.com" || dnsDomainIs(host, ".tiktokv.com") ||
      host === "tiktokcdn.com" || dnsDomainIs(host, ".tiktokcdn.com") ||
      host === "tiktokcdn-us.com" || dnsDomainIs(host, ".tiktokcdn-us.com") ||
      host === "byteoversea.com" || dnsDomainIs(host, ".byteoversea.com") ||
      host === "ibytedtos.com" || dnsDomainIs(host, ".ibytedtos.com") ||
      host === "byteimg.com" || dnsDomainIs(host, ".byteimg.com") ||
      host === "muscdn.com" || dnsDomainIs(host, ".muscdn.com") ||
      host === "musical.ly" || dnsDomainIs(host, ".musical.ly") ||
      host === "bytefcdn-oversea.com" || dnsDomainIs(host, ".bytefcdn-oversea.com") ||
      host === "tiktokcdn-eu.com" || dnsDomainIs(host, ".tiktokcdn-eu.com");
    return useProxy ? ${JSON.stringify(directive)} : "DIRECT";
  }`;
}

async function readProxySettings() {
  const stored = await proxyStorageGet({ [PROXY_SETTINGS_KEY]: DEFAULT_PROXY_SETTINGS });
  const value = stored[PROXY_SETTINGS_KEY];
  return { ...DEFAULT_PROXY_SETTINGS, ...(value && typeof value === "object" ? value : {}) };
}

function proxyKeyOf(proxy) {
  if (!proxy || typeof proxy !== "object") return "";
  return String(proxy.key || `${proxy.protocol || "http"}://${proxy.host || ""}:${Number(proxy.port) || 0}`);
}

async function verifyAppliedProxy(proxy) {
  const expected = `${proxy.host}:${proxy.port}`;
  const details = await proxySettingsGet();
  if (details.levelOfControl === "not_controllable" || details.levelOfControl === "controlled_by_other_extensions") {
    throw new Error("Proxy đang do extension hoặc chính sách khác kiểm soát.");
  }
  const value = details.value || {};
  const pacData = String(value?.pacScript?.data || "");
  if (value.mode !== "pac_script" || !pacData.includes(expected)) {
    throw new Error("Chrome chưa áp dụng cấu hình proxy TikTok.");
  }
  return true;
}

async function probeTikTokProxy(proxy) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROXY_CONNECT_TIMEOUT_MS);
  const startedAt = performance.now();
  try {
    const separator = PROXY_LATENCY_URL.includes("?") ? "&" : "?";
    const response = await fetch(`${PROXY_LATENCY_URL}${separator}tdt_proxy_probe=${Date.now()}`, {
      cache: "no-store",
      credentials: "include",
      redirect: "follow",
      signal: controller.signal
    });
    // A 4xx response still proves that the proxy reached TikTok. A 5xx commonly
    // comes from a dead public proxy/gateway and must not be committed.
    if (response.status >= 500) throw new Error(`Proxy trả về HTTP ${response.status}.`);
    const latency = Math.max(1, Math.round(performance.now() - startedAt));
    try { await response.body?.cancel(); } catch (_error) {}
    return { latency, key: proxyKeyOf(proxy) };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Proxy không phản hồi sau ${PROXY_CONNECT_TIMEOUT_MS}ms.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function applyAndProbeTikTokProxy(proxy) {
  await proxySettingsSet({ mode: "pac_script", pacScript: { data: buildTikTokPac(proxy) } });
  await new Promise((resolve) => setTimeout(resolve, PROXY_APPLY_SETTLE_MS));
  await verifyAppliedProxy(proxy);
  return probeTikTokProxy(proxy);
}

async function randomProxyCandidates(proxies, settings, limit = PROXY_CONNECT_MAX_ATTEMPTS) {
  const remaining = [...proxies];
  const candidates = [];
  let cursor = { ...settings };
  while (remaining.length && candidates.length < Math.max(1, limit)) {
    const selected = await chooseRandomProxy(remaining, cursor);
    if (!selected) break;
    candidates.push(selected);
    const key = proxyKeyOf(selected);
    const index = remaining.findIndex((item) => proxyKeyOf(item) === key);
    if (index >= 0) remaining.splice(index, 1);
    cursor = {
      ...cursor,
      current: selected,
      rotation: (Number(cursor.rotation) || 0) + 1,
      history: [...(Array.isArray(cursor.history) ? cursor.history : []), key].slice(-PROXY_HISTORY_LIMIT)
    };
  }
  return candidates;
}

async function chooseRandomProxy(proxies, settings) {
  const installId = await getProxyInstallId();
  const history = new Set(Array.isArray(settings.history) ? settings.history : []);
  const available = proxies.filter((proxy) => !history.has(proxy.key) && proxy.key !== settings.current?.key);
  const pool = available.length ? available : proxies.filter((proxy) => proxy.key !== settings.current?.key);
  const candidates = pool.length ? pool : proxies;
  const entropy = new Uint32Array(1);
  crypto.getRandomValues(entropy);
  const index = (stableHash(`${installId}:${Number(settings.rotation) || 0}`) + entropy[0]) % candidates.length;
  return candidates[index];
}

async function measureActiveProxyLatency() {
  const settings = await readProxySettings();
  if (!settings.enabled || !settings.current?.host || !settings.current?.port) return settings;
  const measuredProxyKey = String(settings.current.key || `${settings.current.protocol}://${settings.current.host}:${settings.current.port}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROXY_LATENCY_TIMEOUT_MS);
  const startedAt = performance.now();
  try {
    await verifyAppliedProxy(settings.current);
    const separator = PROXY_LATENCY_URL.includes("?") ? "&" : "?";
    const response = await fetch(`${PROXY_LATENCY_URL}${separator}tdt_latency=${Date.now()}`, {
      cache: "no-store",
      credentials: "include",
      redirect: "follow",
      signal: controller.signal
    });
    if (response.status >= 500) throw new Error(`Proxy trả về HTTP ${response.status}.`);
    const latency = Math.max(1, Math.round(performance.now() - startedAt));
    try { await response.body?.cancel(); } catch (_error) { /* Response timing is enough. */ }
    const latest = await readProxySettings();
    const latestProxyKey = String(latest.current?.key || `${latest.current?.protocol}://${latest.current?.host}:${latest.current?.port}`);
    if (!latest.enabled || latestProxyKey !== measuredProxyKey) return latest;
    const next = { ...latest, status: "connected", current: { ...latest.current, latency, latencyUpdatedAt: Date.now() }, error: "" };
    await proxyStorageSet({ [PROXY_SETTINGS_KEY]: next });
    return next;
  } catch (error) {
    const latest = await readProxySettings();
    const latestProxyKey = String(latest.current?.key || `${latest.current?.protocol}://${latest.current?.host}:${latest.current?.port}`);
    if (!latest.enabled || latestProxyKey !== measuredProxyKey) return latest;
    const next = { ...latest, current: { ...latest.current, latency: null, latencyUpdatedAt: Date.now() }, error: error?.name === "AbortError" ? "Độ trễ > 5000ms" : "Không đo được độ trễ" };
    await proxyStorageSet({ [PROXY_SETTINGS_KEY]: next }).catch(() => {});
    return next;
  } finally {
    clearTimeout(timeout);
  }
}

async function restorePreviousProxyAfterFailure(settings) {
  try {
    if (settings.enabled && settings.current?.host && settings.current?.port) {
      await proxySettingsSet({ mode: "pac_script", pacScript: { data: buildTikTokPac(settings.current) } });
    } else {
      await proxySettingsClear();
    }
    proxyIgnoreErrorsUntil = Date.now() + 1200;
  } catch (_error) { /* Preserve the original error reported to the popup. */ }
}

function reloadTikTokTabs() {
  chrome.tabs.query({ url: ["https://tiktok.com/*", "https://*.tiktok.com/*"] })
    .then((tabs) => Promise.allSettled(tabs.filter((tab) => Number.isInteger(tab.id)).map((tab) => chrome.tabs.reload(tab.id))))
    .catch(() => {});
}

function scheduleTikTokReload() {
  clearTimeout(tiktokReloadTimer);
  tiktokReloadTimer = setTimeout(() => {
    tiktokReloadTimer = null;
    reloadTikTokTabs();
  }, 250);
}

function enqueueProxyMutation(task) {
  const run = async () => {
    proxyMutationInProgress += 1;
    try { return await task(); }
    finally { proxyMutationInProgress = Math.max(0, proxyMutationInProgress - 1); }
  };
  const result = proxyMutationQueue.then(run, run);
  proxyMutationQueue = result.catch(() => undefined);
  return result;
}

async function assertProxyControl() {
  const details = await proxySettingsGet();
  if (details.levelOfControl === "not_controllable" || details.levelOfControl === "controlled_by_other_extensions") {
    throw new Error("Proxy đang do extension hoặc chính sách khác kiểm soát.");
  }
}

async function rotateTikTokProxy(requestedCountry = "") {
  clearTimeout(proxyHealthCheckTimer);
  proxyHealthCheckTimer = null;
  const previous = await readProxySettings();
  const country = Object.hasOwn(PROXY_COUNTRIES, requestedCountry) ? requestedCountry : (Object.hasOwn(PROXY_COUNTRIES, previous.country) ? previous.country : "th");
  const attempted = [];
  try {
    await assertProxyControl();
    const proxies = await fetchDetectedCountryProxyList(country);
    const candidates = await randomProxyCandidates(proxies, { ...previous, country });
    if (!candidates.length) throw new Error(`Không tìm thấy proxy ${PROXY_COUNTRIES[country]}.`);

    let selected = null;
    let measuredLatency = null;
    let lastError = null;
    for (const candidate of candidates) {
      attempted.push(proxyKeyOf(candidate));
      try {
        const probe = await applyAndProbeTikTokProxy(candidate);
        selected = candidate;
        measuredLatency = probe.latency;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!selected) {
      throw new Error(lastError?.message || `Không có proxy ${PROXY_COUNTRIES[country]} nào phản hồi TikTok.`);
    }

    proxyIgnoreErrorsUntil = Date.now() + 2500;
    const history = [...(Array.isArray(previous.history) ? previous.history : []), ...attempted].slice(-PROXY_HISTORY_LIMIT);
    const next = {
      ...previous,
      enabled: true,
      country,
      current: { ...selected, latency: measuredLatency, latencyUpdatedAt: Date.now() },
      history,
      rotation: (Number(previous.rotation) || 0) + 1,
      status: "connected",
      error: "",
      updatedAt: Date.now()
    };
    await proxyStorageSet({ [PROXY_SETTINGS_KEY]: next });
    scheduleTikTokReload();
    return next;
  } catch (error) {
    await restorePreviousProxyAfterFailure(previous);
    const baseMessage = error?.name === "AbortError" ? "Hết thời gian tải danh sách proxy." : String(error?.message || "Không thể kết nối proxy.");
    const failed = { ...previous, status: "error", error: attempted.length ? `${baseMessage} Đã thử ${attempted.length} proxy.` : baseMessage, updatedAt: Date.now() };
    await proxyStorageSet({ [PROXY_SETTINGS_KEY]: failed }).catch(() => {});
    throw new Error(failed.error);
  }
}

async function setTikTokProxyCountry(requestedCountry) {
  const country = Object.hasOwn(PROXY_COUNTRIES, requestedCountry) ? requestedCountry : "th";
  const previous = await readProxySettings();
  if (previous.enabled) return rotateTikTokProxy(country);
  const next = { ...previous, country, current: null, status: "off", error: "", updatedAt: Date.now() };
  await proxyStorageSet({ [PROXY_SETTINGS_KEY]: next });
  return next;
}

async function disableTikTokProxy() {
  clearTimeout(proxyHealthCheckTimer);
  proxyHealthCheckTimer = null;
  const previous = await readProxySettings();
  await assertProxyControl();
  await proxySettingsClear();
  const next = { ...previous, enabled: false, status: "off", error: "", updatedAt: Date.now() };
  await proxyStorageSet({ [PROXY_SETTINGS_KEY]: next });
  scheduleTikTokReload();
  return next;
}

async function restoreTikTokProxy() {
  const settings = await readProxySettings();
  if (!settings.enabled) return settings;
  if (settings.status === "testing") {
    settings.status = "connected";
    await proxyStorageSet({ [PROXY_SETTINGS_KEY]: settings }).catch(() => {});
  }
  if (!settings.current?.host || !settings.current?.port) return rotateTikTokProxy();
  try {
    await assertProxyControl();
    await proxySettingsSet({ mode: "pac_script", pacScript: { data: buildTikTokPac(settings.current) } });
    await new Promise((resolve) => setTimeout(resolve, PROXY_APPLY_SETTLE_MS));
    await verifyAppliedProxy(settings.current);
    const probe = await probeTikTokProxy(settings.current);
    const connected = {
      ...settings,
      status: "connected",
      error: "",
      current: { ...settings.current, latency: probe.latency, latencyUpdatedAt: Date.now() },
      updatedAt: Date.now()
    };
    await proxyStorageSet({ [PROXY_SETTINGS_KEY]: connected });
    return connected;
  } catch (error) {
    try {
      return await rotateTikTokProxy(settings.country);
    } catch (rotationError) {
      // Do not leave a dead PAC active after browser startup. Fall back to the
      // direct connection so TikTok remains usable and let the user retry later.
      await proxySettingsClear().catch(() => {});
      const failed = {
        ...settings,
        enabled: false,
        status: "error",
        error: String(rotationError?.message || error?.message || "Không thể khôi phục proxy."),
        updatedAt: Date.now()
      };
      await proxyStorageSet({ [PROXY_SETTINGS_KEY]: failed }).catch(() => {});
      scheduleTikTokReload();
      return failed;
    }
  }
}


function scheduleProxyHealthVerification(errorText = "") {
  clearTimeout(proxyHealthCheckTimer);
  proxyHealthCheckTimer = setTimeout(() => {
    proxyHealthCheckTimer = null;
    if (proxyHealthCheckFlight) return;
    proxyHealthCheckFlight = enqueueProxyMutation(async () => {
      const settings = await readProxySettings();
      if (!settings.enabled || !settings.current?.host || !settings.current?.port) return settings;
      const measuredKey = proxyKeyOf(settings.current);
      try {
        await verifyAppliedProxy(settings.current);
        const probe = await probeTikTokProxy(settings.current);
        const latest = await readProxySettings();
        if (!latest.enabled || proxyKeyOf(latest.current) !== measuredKey) return latest;
        const next = {
          ...latest,
          status: "connected",
          error: "",
          current: { ...latest.current, latency: probe.latency, latencyUpdatedAt: Date.now() },
          updatedAt: Date.now()
        };
        await proxyStorageSet({ [PROXY_SETTINGS_KEY]: next });
        return next;
      } catch (error) {
        const latest = await readProxySettings();
        if (!latest.enabled || proxyKeyOf(latest.current) !== measuredKey) return latest;
        // The current endpoint is confirmed dead. Try one automatic rotation so
        // a transient public-proxy failure does not leave TikTok offline.
        try {
          return await rotateTikTokProxy(latest.country);
        } catch (rotationError) {
          const detail = String(rotationError?.message || error?.message || errorText || "Proxy TikTok không còn phản hồi.").slice(0, 240);
          const next = { ...latest, status: "error", error: detail, updatedAt: Date.now() };
          await proxyStorageSet({ [PROXY_SETTINGS_KEY]: next }).catch(() => {});
          return next;
        }
      }
    }).finally(() => { proxyHealthCheckFlight = null; });
  }, 900);
}

if (chrome.proxy?.onProxyError?.addListener) {
  chrome.proxy.onProxyError.addListener((details) => {
    if (proxyMutationInProgress > 0 || Date.now() < proxyIgnoreErrorsUntil) return;
    // One failed TikTok CDN request does not necessarily mean the proxy is dead.
    // Confirm with a fresh TikTok probe before changing the visible connection state.
    scheduleProxyHealthVerification(String(details?.error || details?.details || "Lỗi kết nối proxy TikTok."));
  });
}

function cleanupExpiredSubtitleCache() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [SUBTITLE_CACHE_KEY]: {} }, (result) => {
      if (chrome.runtime.lastError) return resolve({ removed: 0, kept: 0 });
      const source = result[SUBTITLE_CACHE_KEY];
      const cache = source && typeof source === "object" ? source : {};
      const now = Date.now();
      const fresh = {};
      let removed = 0;
      for (const [key, entry] of Object.entries(cache)) {
        const updatedAt = Number(entry?.updatedAt) || 0;
        if (!updatedAt || now - updatedAt >= SUBTITLE_CACHE_TTL_MS) {
          removed += 1;
          continue;
        }
        fresh[key] = entry;
      }
      if (!removed) return resolve({ removed: 0, kept: Object.keys(fresh).length });
      chrome.storage.local.set({ [SUBTITLE_CACHE_KEY]: fresh }, () => resolve({ removed, kept: Object.keys(fresh).length }));
    });
  });
}


function privateUpdateVersionParts(value) {
  return String(value || "0").split(/[.-]/).map((part) => {
    const parsed = Number.parseInt(String(part).replace(/\D+/g, ""), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }).slice(0, 4);
}

function comparePrivateUpdateVersions(left, right) {
  const a = privateUpdateVersionParts(left);
  const b = privateUpdateVersionParts(right);
  const length = Math.max(a.length, b.length, 4);
  for (let index = 0; index < length; index += 1) {
    const delta = (a[index] || 0) - (b[index] || 0);
    if (delta) return delta > 0 ? 1 : -1;
  }
  return 0;
}

function privateUpdateTrustedUrl(value, allowEmpty = false) {
  const raw = String(value || "").trim();
  if (!raw && allowEmpty) return "";
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:") throw new Error("Máy chủ cập nhật phải sử dụng HTTPS.");
  const trustedOrigins = new Set();
  const configuredUrls = [
    PRIVATE_UPDATE_CONFIG.manifestUrl,
    ...PRIVATE_UPDATE_CONFIG.manifestFallbackUrls,
    PRIVATE_UPDATE_CONFIG.releasePageUrl,
    REMOTE_CONFIG.serverUrl
  ];
  for (const configuredUrl of configuredUrls) {
    try { trustedOrigins.add(new URL(configuredUrl).origin); } catch (_error) {}
  }
  if (!trustedOrigins.has(parsed.origin)) throw new Error("URL cập nhật không thuộc máy chủ riêng đã cấu hình.");
  return parsed.href;
}

function privateUpdateManifestUrls() {
  const unique = new Set();
  for (const value of [PRIVATE_UPDATE_CONFIG.manifestUrl, ...PRIVATE_UPDATE_CONFIG.manifestFallbackUrls]) {
    try { unique.add(privateUpdateTrustedUrl(value)); } catch (_error) {}
  }
  return [...unique];
}

async function fetchPrivateUpdateJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(5000, REMOTE_CONFIG.requestTimeoutMs));
  try {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "omit",
      redirect: "follow",
      ...options,
      signal: controller.signal,
      headers: { "Accept": "application/json", ...(options.headers || {}) }
    });
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
    const payload = await response.json();
    if (!payload || typeof payload !== "object") throw new Error("Phản hồi manifest không phải JSON hợp lệ.");
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPrivateUpdateManifest(currentVersion) {
  const errors = [];
  for (const baseUrl of privateUpdateManifestUrls()) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    const requestUrl = `${baseUrl}${separator}extensionId=${encodeURIComponent(chrome.runtime.id)}&currentVersion=${encodeURIComponent(currentVersion)}&t=${Date.now()}`;
    try {
      return { manifest: await fetchPrivateUpdateJson(requestUrl), sourceUrl: baseUrl };
    } catch (error) {
      errors.push(`${new URL(baseUrl).pathname}: ${error?.name === "AbortError" ? "timeout" : error?.message || "error"}`);
    }
  }

  if (vercelRealtime.update && typeof vercelRealtime.update === "object") return { manifest: vercelRealtime.update, sourceUrl: "vercel-api-cache" };

  const detail = errors.slice(0, 4).join(" · ");
  throw new Error(detail ? `Không thể lấy manifest cập nhật (${detail}).` : "Không thể lấy manifest cập nhật.");
}

function normalizePrivateUpdateManifest(value) {
  const source = value && typeof value === "object" ? value : {};
  const version = String(source.version || source.latestVersion || "").trim();
  if (!/^\d+(?:\.\d+){1,3}(?:[-+][A-Za-z0-9.-]+)?$/.test(version)) {
    throw new Error("Máy chủ trả về số phiên bản không hợp lệ.");
  }
  const downloadUrl = privateUpdateTrustedUrl(source.downloadUrl || source.packageUrl || "", true);
  let filename = String(source.filename || source.fileName || "").trim();
  if (!filename && downloadUrl) {
    try { filename = decodeURIComponent(new URL(downloadUrl).pathname.split("/").pop() || ""); } catch (_error) {}
  }
  filename = filename.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 180);
  if (!/\.(?:zip|crx)$/i.test(filename)) filename = `TikTok_Tai_Dep_Trai_v${version}.zip`;
  return {
    version,
    downloadUrl,
    filename,
    releasePageUrl: privateUpdateTrustedUrl(source.releasePageUrl || PRIVATE_UPDATE_CONFIG.releasePageUrl, true),
    releaseNotes: String(source.releaseNotes || source.notes || "").slice(0, 6000),
    publishedAt: String(source.publishedAt || source.releaseDate || "").slice(0, 80),
    sha256: String(source.sha256 || "").replace(/[^a-fA-F0-9]/g, "").slice(0, 64).toLowerCase(),
    mandatory: source.mandatory === true,
    minimumChromeVersion: String(source.minimumChromeVersion || "").slice(0, 40)
  };
}

async function applyPrivateUpdateManifest(rawManifest, sourceUrl = "") {
  const manifest = normalizePrivateUpdateManifest(rawManifest);
  const currentVersion = chrome.runtime.getManifest().version;
  const { state: previous, settings } = await getPrivateUpdateState();
  const previousLatest = String(previous.latestVersion || currentVersion);
  // Realtime Database có thể còn giữ manifest của lần deploy trước. Không cho
  // một nguồn chậm hơn hạ trạng thái từ bản mới về bản cũ hoặc xóa update đang chờ.
  if (comparePrivateUpdateVersions(manifest.version, currentVersion) < 0
      || comparePrivateUpdateVersions(manifest.version, previousLatest) < 0) {
    return storePrivateUpdateState({ ...previous, currentVersion });
  }
  const available = comparePrivateUpdateVersions(manifest.version, currentVersion) > 0;
  let next = await storePrivateUpdateState({
    ...previous,
    currentVersion,
    latestVersion: manifest.version,
    available,
    status: available ? "available" : "up_to_date",
    message: available ? `Có phiên bản mới v${manifest.version}.` : `Đang dùng phiên bản mới nhất v${currentVersion}.`,
    checkedAt: Date.now(),
    publishedAt: manifest.publishedAt,
    releaseNotes: manifest.releaseNotes,
    downloadUrl: manifest.downloadUrl,
    filename: manifest.filename,
    releasePageUrl: manifest.releasePageUrl || PRIVATE_UPDATE_CONFIG.releasePageUrl,
    sha256: manifest.sha256,
    mandatory: available && manifest.mandatory,
    error: "",
    sourceUrl: String(sourceUrl || "")
  });
  if (available && (manifest.mandatory || settings.autoDownload) && manifest.downloadUrl
      && previous.downloadedVersion !== manifest.version && previous.status !== "downloading") {
    try { next = await downloadPrivateUpdatePackage(next, false); }
    catch (error) {
      next = await storePrivateUpdateState({
        ...next,
        status: "available",
        message: `Có v${manifest.version}; chưa thể tự tải gói cập nhật.`,
        error: error?.message || "Không thể tự tải."
      });
    }
  }
  return next;
}

async function getPrivateUpdateState() {
  const stored = await proxyStorageGet({
    [PRIVATE_UPDATE_STATE_KEY]: PRIVATE_UPDATE_DEFAULT_STATE,
    [PRIVATE_UPDATE_SETTINGS_KEY]: { autoDownload: PRIVATE_UPDATE_CONFIG.autoDownload }
  });
  const state = stored[PRIVATE_UPDATE_STATE_KEY] && typeof stored[PRIVATE_UPDATE_STATE_KEY] === "object"
    ? { ...PRIVATE_UPDATE_DEFAULT_STATE, ...stored[PRIVATE_UPDATE_STATE_KEY], currentVersion: chrome.runtime.getManifest().version }
    : { ...PRIVATE_UPDATE_DEFAULT_STATE };
  const settings = stored[PRIVATE_UPDATE_SETTINGS_KEY] && typeof stored[PRIVATE_UPDATE_SETTINGS_KEY] === "object"
    ? { autoDownload: stored[PRIVATE_UPDATE_SETTINGS_KEY].autoDownload !== false }
    : { autoDownload: PRIVATE_UPDATE_CONFIG.autoDownload };
  return { state, settings };
}

async function storePrivateUpdateState(next) {
  const state = {
    ...PRIVATE_UPDATE_DEFAULT_STATE,
    ...(next && typeof next === "object" ? next : {}),
    currentVersion: chrome.runtime.getManifest().version
  };
  await proxyStorageSet({ [PRIVATE_UPDATE_STATE_KEY]: state });
  updateMandatoryUpdateGate(state);
  try { chrome.runtime.sendMessage({ type: "PRIVATE_UPDATE_STATE_CHANGED", state }).catch(() => {}); } catch (_error) {}
  return state;
}

function privateUpdateDownloadById(downloadId) {
  return new Promise((resolve) => {
    if (!Number.isInteger(downloadId)) return resolve(null);
    chrome.downloads.search({ id: downloadId }, (items) => {
      if (chrome.runtime.lastError) return resolve(null);
      resolve(Array.isArray(items) ? items[0] || null : null);
    });
  });
}

async function reconcilePrivateUpdateDownload(inputState) {
  const state = inputState && typeof inputState === "object" ? inputState : (await getPrivateUpdateState()).state;
  if (state.status !== "downloading" || !Number.isInteger(state.downloadId)) return state;
  const item = await privateUpdateDownloadById(state.downloadId);
  if (item?.state === "in_progress") return state;
  if (item?.state === "complete") {
    return storePrivateUpdateState({
      ...state,
      status: "downloaded",
      message: `Đã tải xong gói cập nhật v${state.latestVersion}.`,
      downloadedVersion: state.latestVersion,
      error: ""
    });
  }
  return storePrivateUpdateState({
    ...state,
    status: "available",
    message: `Có v${state.latestVersion}; gói cập nhật chưa tải xong.`,
    downloadedVersion: "",
    error: item?.error ? String(item.error).slice(0, 300) : "Không còn phiên tải cập nhật đang hoạt động."
  });
}

function ensurePrivateUpdateAlarm() {
  if (!PRIVATE_UPDATE_CONFIG.enabled) return;
  chrome.alarms.get(PRIVATE_UPDATE_ALARM, (alarm) => {
    if (chrome.runtime.lastError) return;
    const periodInMinutes = PRIVATE_UPDATE_CONFIG.checkMinutes;
    if (alarm && Math.abs(Number(alarm.periodInMinutes || 0) - periodInMinutes) < 0.1) return;
    const create = () => chrome.alarms.create(PRIVATE_UPDATE_ALARM, { delayInMinutes: 2, periodInMinutes });
    if (alarm) chrome.alarms.clear(PRIVATE_UPDATE_ALARM, create);
    else create();
  });
}

async function downloadPrivateUpdatePackage(inputState = null, userInitiated = false) {
  const { state: storedState } = await getPrivateUpdateState();
  const state = inputState && typeof inputState === "object" ? { ...storedState, ...inputState } : storedState;
  const downloadUrl = privateUpdateTrustedUrl(state.downloadUrl || "", true);
  if (!downloadUrl) throw new Error("Máy chủ chưa cung cấp gói cập nhật.");
  if (state.status === "downloading" && Number.isInteger(state.downloadId)) {
    const reconciled = await reconcilePrivateUpdateDownload(state);
    if (["downloading", "downloaded"].includes(reconciled.status)) return reconciled;
  }
  const version = String(state.latestVersion || "update").replace(/[^0-9A-Za-z._-]/g, "_");
  const packageFilename = String(state.filename || "");
  const extension = (() => {
    if (/\.crx$/i.test(packageFilename)) return "crx";
    if (/\.zip$/i.test(packageFilename)) return "zip";
    try {
      const pathname = new URL(downloadUrl).pathname.toLowerCase();
      if (pathname.endsWith(".crx")) return "crx";
    } catch (_error) {}
    return "zip";
  })();
  const filename = `TikTok-TDT-Updates/TikTok_Tai_Dep_Trai_v${version}.${extension}`;
  const downloadId = await new Promise((resolve, reject) => {
    chrome.downloads.download({ url: downloadUrl, filename, saveAs: userInitiated }, (id) => {
      const error = chrome.runtime.lastError;
      if (error || !Number.isInteger(id)) reject(new Error(error?.message || "Không thể tải gói cập nhật."));
      else resolve(id);
    });
  });
  return storePrivateUpdateState({
    ...state,
    status: "downloading",
    message: `Đang tải gói cập nhật v${state.latestVersion}…`,
    downloadId,
    downloadStartedAt: Date.now(),
    downloadedVersion: state.downloadedVersion === state.latestVersion ? state.downloadedVersion : "",
    error: ""
  });
}

chrome.downloads.onChanged.addListener((delta) => {
  if (!Number.isInteger(delta?.id) || (!delta.state && !delta.error)) return;
  void getPrivateUpdateState().then(async ({ state }) => {
    if (state.status !== "downloading" || Number(state.downloadId) !== delta.id) return;
    if (delta.state?.current === "complete") {
      await storePrivateUpdateState({
        ...state,
        status: "downloaded",
        message: `Đã tải xong gói cập nhật v${state.latestVersion}.`,
        downloadedVersion: state.latestVersion,
        error: ""
      });
      return;
    }
    if (delta.state?.current === "interrupted" || delta.error?.current) {
      const detail = String(delta.error?.current || "Tải gói cập nhật bị gián đoạn.").slice(0, 300);
      await storePrivateUpdateState({
        ...state,
        status: "available",
        message: `Có v${state.latestVersion}; tải gói cập nhật chưa hoàn tất.`,
        downloadedVersion: "",
        error: detail
      });
    }
  }).catch(() => {});
});

async function checkPrivateUpdate(force = false) {
  if (!PRIVATE_UPDATE_CONFIG.enabled) {
    return storePrivateUpdateState({ ...PRIVATE_UPDATE_DEFAULT_STATE, status: "disabled", message: "Cập nhật từ máy chủ riêng đang tắt." });
  }
  if (privateUpdateCheckInFlight) return privateUpdateCheckInFlight;
  privateUpdateCheckInFlight = (async () => {
    const currentVersion = chrome.runtime.getManifest().version;
    const { state: storedState } = await getPrivateUpdateState();
    const previous = await reconcilePrivateUpdateDownload(storedState);
    if (!force && previous.checkedAt && Date.now() - Number(previous.checkedAt) < 15 * 60 * 1000) return previous;
    await storePrivateUpdateState({ ...previous, status: "checking", message: "Đang kiểm tra máy chủ cập nhật…", error: "" });
    try {
      const result = await fetchPrivateUpdateManifest(currentVersion);
      return applyPrivateUpdateManifest(result.manifest, result.sourceUrl);
    } catch (error) {
      const message = error?.name === "AbortError" ? "Máy chủ cập nhật phản hồi quá chậm." : error?.message || "Không thể kiểm tra cập nhật.";
      return storePrivateUpdateState({
        ...previous,
        currentVersion,
        status: "error",
        message,
        checkedAt: Date.now(),
        error: message
      });
    }
  })().finally(() => { privateUpdateCheckInFlight = null; });
  return privateUpdateCheckInFlight;
}

function requestChromePrivateUpdateCheck() {
  return new Promise((resolve) => {
    if (typeof chrome.runtime.requestUpdateCheck !== "function") return resolve({ status: "unsupported" });
    chrome.runtime.requestUpdateCheck((status, details) => {
      if (chrome.runtime.lastError) return resolve({ status: "error", error: chrome.runtime.lastError.message });
      resolve({ status: String(status || "no_update"), version: String(details?.version || "") });
    });
  });
}

async function applyPrivateUpdate() {
  const nativeResult = await requestChromePrivateUpdateCheck();
  if (nativeResult.status === "update_available") {
    const { state } = await getPrivateUpdateState();
    return storePrivateUpdateState({ ...state, status: "applying", message: `Chrome đang cài đặt v${nativeResult.version || state.latestVersion}.` });
  }
  const { state } = await getPrivateUpdateState();
  if (state.available && state.downloadUrl) return downloadPrivateUpdatePackage(state, true);
  return checkPrivateUpdate(true);
}


function onlineSyncDefaultMeta() {
  return {
    enabled: true,
    initialized: false,
    status: "idle",
    reason: "",
    lastSyncAt: 0,
    lastUploadAt: 0,
    lastDownloadAt: 0,
    lastAttemptAt: 0,
    revision: 0,
    accountUid: "",
    accountEmail: "",
    error: "",
    modifiedAtByKey: {}
  };
}

function normalizeOnlineSyncMeta(value) {
  const source = value && typeof value === "object" ? value : {};
  const modified = source.modifiedAtByKey && typeof source.modifiedAtByKey === "object" ? source.modifiedAtByKey : {};
  return {
    ...onlineSyncDefaultMeta(),
    enabled: source.enabled !== false,
    initialized: source.initialized === true,
    status: String(source.status || "idle").slice(0, 40),
    reason: String(source.reason || "").slice(0, 120),
    lastSyncAt: Math.max(0, Number(source.lastSyncAt) || 0),
    lastUploadAt: Math.max(0, Number(source.lastUploadAt) || 0),
    lastDownloadAt: Math.max(0, Number(source.lastDownloadAt) || 0),
    lastAttemptAt: Math.max(0, Number(source.lastAttemptAt) || 0),
    revision: Math.max(0, Number(source.revision) || 0),
    accountUid: String(source.accountUid || "").slice(0, 128),
    accountEmail: String(source.accountEmail || "").slice(0, 254),
    error: String(source.error || "").slice(0, 500),
    modifiedAtByKey: Object.fromEntries(Object.keys(ONLINE_SYNC_WIRE_TO_STORAGE).map((key) => [key, Math.max(0, Number(modified[key]) || 0)]))
  };
}

async function getOnlineSyncMeta() {
  const stored = await proxyStorageGet({ [ONLINE_SYNC_META_KEY]: onlineSyncDefaultMeta() });
  return normalizeOnlineSyncMeta(stored[ONLINE_SYNC_META_KEY]);
}

async function storeOnlineSyncMeta(value) {
  const meta = normalizeOnlineSyncMeta(value);
  await proxyStorageSet({ [ONLINE_SYNC_META_KEY]: meta });
  return meta;
}

function onlineSyncPublicStatus(metaValue) {
  const meta = normalizeOnlineSyncMeta(metaValue);
  return {
    enabled: meta.enabled,
    initialized: meta.initialized,
    status: meta.status,
    reason: meta.reason,
    lastSyncAt: meta.lastSyncAt,
    lastUploadAt: meta.lastUploadAt,
    lastDownloadAt: meta.lastDownloadAt,
    revision: meta.revision,
    accountUid: meta.accountUid,
    accountEmail: meta.accountEmail,
    error: meta.error,
    pending: Object.keys(onlineSyncPendingModifiedAt).length > 0 || Boolean(onlineSyncTimer)
  };
}

function onlineSyncClone(value, fallback = null) {
  if (typeof ONLINE_SYNC_CORE.clone === "function") return ONLINE_SYNC_CORE.clone(value, fallback);
  try { return structuredClone(value); } catch (_error) {
    try { return JSON.parse(JSON.stringify(value)); } catch (_secondError) { return fallback; }
  }
}

function onlineSyncEqual(left, right) {
  if (typeof ONLINE_SYNC_CORE.equal === "function") return ONLINE_SYNC_CORE.equal(left, right);
  try { return JSON.stringify(left) === JSON.stringify(right); } catch (_error) { return false; }
}

function mergeOnlineWatch(localValue, remoteValue) {
  if (typeof ONLINE_SYNC_CORE.mergeWatch === "function") return ONLINE_SYNC_CORE.mergeWatch(localValue, remoteValue);
  return remoteValue && typeof remoteValue === "object" ? onlineSyncClone(remoteValue, {}) : onlineSyncClone(localValue, {});
}

function persistOnlineSyncPendingSession() {
  if (!chrome.storage?.session) return;
  chrome.storage.session.set({ [ONLINE_SYNC_PENDING_SESSION_KEY]: { ...onlineSyncPendingModifiedAt } }, () => void chrome.runtime.lastError);
}

function onlineSyncSchedule(reason = "changed", delayMs = ONLINE_SYNC_SETTINGS_DELAY_MS) {
  clearTimeout(onlineSyncTimer);
  onlineSyncTimer = setTimeout(() => {
    onlineSyncTimer = null;
    void runOnlineSync(reason, false);
  }, Math.max(500, Number(delayMs) || ONLINE_SYNC_SETTINGS_DELAY_MS));
}

function scheduleOnlineSyncMetaPersist(delayMs = 1_500) {
  if (onlineSyncPersistTimer) clearTimeout(onlineSyncPersistTimer);
  onlineSyncPersistTimer = setTimeout(() => {
    onlineSyncPersistTimer = null;
    void getOnlineSyncMeta().then((meta) => storeOnlineSyncMeta({
      ...meta,
      status: Object.keys(onlineSyncPendingModifiedAt).length ? "pending" : meta.status,
      modifiedAtByKey: { ...meta.modifiedAtByKey, ...onlineSyncPendingModifiedAt }
    })).catch(() => {});
  }, Math.max(500, Number(delayMs) || 1_500));
}

function markOnlineSyncStorageChanged(changes, areaName) {
  if (areaName !== "local" || onlineSyncApplyingRemote) return;
  const now = Date.now();
  let changed = false;
  let watchChanged = false;
  for (const storageKey of Object.keys(changes || {})) {
    const wireKey = ONLINE_SYNC_STORAGE_TO_WIRE[storageKey];
    if (!wireKey) continue;
    if (Object.prototype.hasOwnProperty.call(onlineSyncSuppressedStorageValues, storageKey)
      && onlineSyncEqual(changes[storageKey]?.newValue, onlineSyncSuppressedStorageValues[storageKey])) {
      delete onlineSyncSuppressedStorageValues[storageKey];
      continue;
    }
    onlineSyncPendingModifiedAt[wireKey] = now;
    changed = true;
    if (wireKey === "watchAnalytics") watchChanged = true;
  }
  if (!changed) return;
  persistOnlineSyncPendingSession();
  scheduleOnlineSyncMetaPersist(watchChanged ? 8_000 : 1_200);
  onlineSyncSchedule(watchChanged ? "watch-changed" : "settings-changed", watchChanged ? ONLINE_SYNC_WATCH_DELAY_MS : ONLINE_SYNC_SETTINGS_DELAY_MS);
}

async function onlineSyncRequest(payload, retryAuth = true) {
  const auth = await getVercelAuth(false);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(6000, REMOTE_CONFIG.requestTimeoutMs));
  try {
    const response = await fetch(`${REMOTE_CONFIG.serverUrl}/api/v1/extension/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.idToken}` },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal
    });
    let body = null;
    try { body = await response.json(); } catch (_error) { /* Stable error below. */ }
    if (response.status === 401 && retryAuth) {
      await getVercelAuth(true);
      return onlineSyncRequest(payload, false);
    }
    if (!response.ok || body?.ok !== true || !body.sync) throw new Error(body?.error || `Máy chủ đồng bộ phản hồi HTTP ${response.status}.`);
    return body.sync;
  } finally {
    clearTimeout(timeout);
  }
}

async function buildOnlineSyncPayload(meta) {
  const defaults = Object.fromEntries(Object.keys(ONLINE_SYNC_STORAGE_TO_WIRE).map((key) => [key, null]));
  const stored = await proxyStorageGet(defaults);
  const data = {};
  const effectiveModifiedAtByKey = { ...meta.modifiedAtByKey, ...onlineSyncPendingModifiedAt };
  for (const [storageKey, wireKey] of Object.entries(ONLINE_SYNC_STORAGE_TO_WIRE)) {
    const value = stored[storageKey];
    if (value === null || value === undefined) continue;
    if (wireKey === "watchAnalytics") {
      effectiveModifiedAtByKey[wireKey] = Math.max(
        Number(effectiveModifiedAtByKey[wireKey]) || 0,
        Number(value?.updatedAt) || 0
      );
    }
    data[wireKey] = wireKey === "watchAnalytics" && typeof ONLINE_SYNC_CORE.compactWatch === "function"
      ? ONLINE_SYNC_CORE.compactWatch(value)
      : onlineSyncClone(value, value);
  }
  const clientId = await getRemoteClientId();
  return {
    projectKey: REMOTE_CONFIG.projectKey,
    clientId,
    client: remoteClientMetadata("online-sync"),
    firstSync: meta.initialized !== true,
    modifiedAtByKey: effectiveModifiedAtByKey,
    data
  };
}

async function applyOnlineSyncResponse(sync, localMeta) {
  const remoteData = sync?.data && typeof sync.data === "object" ? sync.data : {};
  const remoteModified = sync?.modifiedAtByKey && typeof sync.modifiedAtByKey === "object" ? sync.modifiedAtByKey : {};
  const defaults = Object.fromEntries(Object.keys(ONLINE_SYNC_STORAGE_TO_WIRE).map((key) => [key, null]));
  const local = await proxyStorageGet(defaults);
  const updates = {};
  const nextModified = { ...localMeta.modifiedAtByKey };
  let downloaded = false;

  for (const [wireKey, storageKey] of Object.entries(ONLINE_SYNC_WIRE_TO_STORAGE)) {
    if (!Object.prototype.hasOwnProperty.call(remoteData, wireKey)) continue;
    const remoteAt = Math.max(0, Number(remoteModified[wireKey]) || 0);
    const localAt = Math.max(0, Number(localMeta.modifiedAtByKey[wireKey]) || 0, Number(onlineSyncPendingModifiedAt[wireKey]) || 0);
    if (wireKey === "watchAnalytics") {
      const merged = mergeOnlineWatch(local[storageKey], remoteData[wireKey]);
      if (!onlineSyncEqual(local[storageKey], merged)) {
        updates[storageKey] = merged;
        downloaded = true;
      }
      nextModified[wireKey] = Math.max(localAt, remoteAt);
      continue;
    }
    if (!localMeta.initialized || remoteAt >= localAt) {
      if (!onlineSyncEqual(local[storageKey], remoteData[wireKey])) {
        updates[storageKey] = onlineSyncClone(remoteData[wireKey], remoteData[wireKey]);
        downloaded = true;
      }
      nextModified[wireKey] = remoteAt;
    } else {
      nextModified[wireKey] = localAt;
    }
  }

  if (Object.keys(updates).length) {
    const suppressedKeys = Object.keys(updates);
    onlineSyncSuppressedStorageValues = { ...onlineSyncSuppressedStorageValues, ...onlineSyncClone(updates, {}) };
    onlineSyncApplyingRemote = true;
    try { await proxyStorageSet(updates); } finally { onlineSyncApplyingRemote = false; }
    setTimeout(() => {
      for (const key of suppressedKeys) delete onlineSyncSuppressedStorageValues[key];
    }, 5_000);
  }
  return { nextModified, downloaded };
}

async function runOnlineSync(reason = "manual", force = false) {
  await onlineSyncPendingReady;
  if (onlineSyncFlight) return onlineSyncFlight;
  onlineSyncFlight = (async () => {
    let meta = await getOnlineSyncMeta();
    if (!meta.enabled && !force) return onlineSyncPublicStatus(meta);
    const storedAuth = await getStoredVercelAuth();
    if (!publicAuthState(storedAuth).signedIn) {
      meta = await storeOnlineSyncMeta({ ...meta, status: "signed_out", reason: "Đăng nhập Google để đồng bộ online.", error: "" });
      return onlineSyncPublicStatus(meta);
    }
    meta = normalizeOnlineSyncMeta({
      ...meta,
      status: "syncing",
      reason: String(reason || "sync").slice(0, 120),
      lastAttemptAt: Date.now(),
      error: "",
      modifiedAtByKey: { ...meta.modifiedAtByKey, ...onlineSyncPendingModifiedAt }
    });
    await storeOnlineSyncMeta(meta);
    const sentModified = { ...meta.modifiedAtByKey };
    try {
      const payload = await buildOnlineSyncPayload(meta);
      const sync = await onlineSyncRequest(payload, true);
      const applied = await applyOnlineSyncResponse(sync, meta);
      for (const [key, timestamp] of Object.entries(sentModified)) {
        if (Number(onlineSyncPendingModifiedAt[key]) <= Number(timestamp)) delete onlineSyncPendingModifiedAt[key];
      }
      persistOnlineSyncPendingSession();
      const now = Date.now();
      meta = await storeOnlineSyncMeta({
        ...meta,
        enabled: true,
        initialized: true,
        status: "synced",
        reason: "Dữ liệu tài khoản đã được lưu online.",
        lastSyncAt: now,
        lastUploadAt: now,
        lastDownloadAt: applied.downloaded ? now : meta.lastDownloadAt,
        revision: Math.max(0, Number(sync.revision) || 0),
        accountUid: String(sync.account?.uid || storedAuth.uid || ""),
        accountEmail: String(sync.account?.email || storedAuth.email || ""),
        error: "",
        modifiedAtByKey: applied.nextModified
      });
      if (Object.keys(onlineSyncPendingModifiedAt).length) onlineSyncSchedule("pending-after-sync", ONLINE_SYNC_SETTINGS_DELAY_MS);
      return onlineSyncPublicStatus(meta);
    } catch (error) {
      const message = error?.name === "AbortError" ? "Máy chủ đồng bộ phản hồi quá chậm." : String(error?.message || "Không thể đồng bộ dữ liệu online.");
      meta = await storeOnlineSyncMeta({ ...meta, status: "error", reason: "Dữ liệu vẫn được giữ an toàn trên máy.", error: message });
      onlineSyncSchedule("retry", ONLINE_SYNC_RETRY_DELAY_MS);
      throw Object.assign(new Error(message), { syncStatus: onlineSyncPublicStatus(meta) });
    }
  })().finally(() => { onlineSyncFlight = null; });
  return onlineSyncFlight;
}

function ensureOnlineSyncAlarm() {
  chrome.alarms.get(ONLINE_SYNC_ALARM, (alarm) => {
    if (chrome.runtime.lastError) return;
    if (alarm && Math.abs(Number(alarm.periodInMinutes || 0) - ONLINE_SYNC_INTERVAL_MINUTES) < 0.1) return;
    const create = () => chrome.alarms.create(ONLINE_SYNC_ALARM, { delayInMinutes: 1, periodInMinutes: ONLINE_SYNC_INTERVAL_MINUTES });
    if (alarm) chrome.alarms.clear(ONLINE_SYNC_ALARM, create);
    else create();
  });
}


chrome.storage.onChanged.addListener(markOnlineSyncStorageChanged);

function ensureSubtitleCacheCleanupAlarm() {
  chrome.alarms.get(SUBTITLE_CACHE_CLEANUP_ALARM, (alarm) => {
    if (chrome.runtime.lastError || alarm) return;
    chrome.alarms.create(SUBTITLE_CACHE_CLEANUP_ALARM, { delayInMinutes: 1, periodInMinutes: 60 });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureSubtitleCacheCleanupAlarm();
  ensurePrivateUpdateAlarm();
  ensureOnlineSyncAlarm();
  void cleanupExpiredSubtitleCache();
  void checkPrivateUpdate(true);
});
chrome.runtime.onStartup.addListener(() => {
  ensureSubtitleCacheCleanupAlarm();
  ensurePrivateUpdateAlarm();
  ensureOnlineSyncAlarm();
  void cleanupExpiredSubtitleCache();
  void checkPrivateUpdate(false);
});
chrome.runtime.onInstalled.addListener(() => { void enqueueProxyMutation(restoreTikTokProxy); });
chrome.runtime.onStartup.addListener(() => { void enqueueProxyMutation(restoreTikTokProxy); });
chrome.runtime.onInstalled.addListener((details) => {
  ensureRemoteHeartbeatAlarm();
  // Không tự mở trang/ch cửa sổ đăng nhập ở lần cài đầu. Người dùng chủ động
  // đăng nhập từ popup để tránh làm gián đoạn tab đang sử dụng.
  void proxyStorageSet({ [REMOTE_INSTALL_REASON_KEY]: String(details?.reason || "install") })
    .catch(() => {})
    .then(() => syncRemoteAccess(true));
});
chrome.runtime.onStartup.addListener(() => {
  ensureRemoteHeartbeatAlarm();
  void syncRemoteAccess(true);
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SUBTITLE_CACHE_CLEANUP_ALARM) void cleanupExpiredSubtitleCache();
  if (alarm.name === PRIVATE_UPDATE_ALARM) void checkPrivateUpdate(false);
  if (alarm.name === REMOTE_HEARTBEAT_ALARM) void syncRemoteAccess(true);
  if (alarm.name === ONLINE_SYNC_ALARM) void runOnlineSync("alarm", false).catch(() => {});
  if (alarm.name === FIREBASE_REALTIME_RECONNECT_ALARM) void syncRemoteAccess(true);
});
ensureSubtitleCacheCleanupAlarm();
ensurePrivateUpdateAlarm();
ensureRemoteHeartbeatAlarm();
ensureOnlineSyncAlarm();
void getPrivateUpdateState().then(({ state }) => updateMandatoryUpdateGate(state)).catch(() => {});
void remoteStateReady.then(async () => {
  await syncRemoteAccess(false).catch(() => null);
  await runOnlineSync("startup", false).catch(() => {});
}).catch(() => {});

// Apply every historical settings migration in one read/write transaction.
// Separate onInstalled listeners used to race on a fresh install and the last
// callback could overwrite fields written by another migration.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({
    [SETTINGS_KEY]: {},
    [V245_MIGRATION_KEY]: false,
    [V270_PLAYBACK_OFF_MIGRATION_KEY]: false,
    [V271_AUTOPLAY_RESTORE_MIGRATION_KEY]: false
  }, (result) => {
    if (chrome.runtime.lastError) return;
    let settings = result[SETTINGS_KEY] && typeof result[SETTINGS_KEY] === "object"
      ? { ...result[SETTINGS_KEY] }
      : {};
    const updates = {};
    let changed = false;
    let removeLegacyStatsPosition = false;

    if (!result[V245_MIGRATION_KEY]) {
      settings = { ...settings, scanSubtitles: false, placeBelowSubtitleTranslator: true };
      delete settings.showVideoStats;
      updates[V245_MIGRATION_KEY] = true;
      removeLegacyStatsPosition = true;
      changed = true;
    }
    if (!result[V270_PLAYBACK_OFF_MIGRATION_KEY]) {
      settings = {
        ...settings,
        autoplay: typeof settings.autoplay === "boolean" ? settings.autoplay : true,
        backgroundPlay: typeof settings.backgroundPlay === "boolean" ? settings.backgroundPlay : false,
        smartAutoPause: typeof settings.smartAutoPause === "boolean" ? settings.smartAutoPause : false
      };
      updates[V270_PLAYBACK_OFF_MIGRATION_KEY] = true;
      changed = true;
    }
    if (!result[V271_AUTOPLAY_RESTORE_MIGRATION_KEY]) {
      settings = {
        ...settings,
        autoplay: typeof settings.autoplay === "boolean" ? settings.autoplay : true,
        backgroundPlay: typeof settings.backgroundPlay === "boolean" ? settings.backgroundPlay : false,
        smartAutoPause: typeof settings.smartAutoPause === "boolean" ? settings.smartAutoPause : false
      };
      updates[V271_AUTOPLAY_RESTORE_MIGRATION_KEY] = true;
      changed = true;
    }
    if (!changed) return;

    chrome.storage.local.set({ [SETTINGS_KEY]: settings, ...updates }, () => {
      if (chrome.runtime.lastError) return;
      if (removeLegacyStatsPosition) chrome.storage.local.remove("tdt_video_stats_position_v1");
    });
  });
});

function readSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [SETTINGS_KEY]: DEFAULT_SETTINGS }, (result) => {
      if (chrome.runtime.lastError) return resolve({ ...DEFAULT_SETTINGS });
      const value = result[SETTINGS_KEY];
      resolve({
        autoCloseTranscriptWindow: value?.autoCloseTranscriptWindow !== false,
        smartAutoPause: value?.smartAutoPause === true
      });
    });
  });
}

function isTikTokUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && (url.hostname === "tiktok.com" || url.hostname.endsWith(".tiktok.com"));
  } catch {
    return false;
  }
}

function safeFilename(value) {
  return String(value || "tiktok-video")
    .normalize("NFKD")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100) || "tiktok-video";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function canonicalTikTokVideoUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (!isTikTokUrl(url.toString())) return "";
    const match = url.pathname.match(/\/video\/(\d+)/);
    if (!match) return "";
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

function videoInfoCacheKey(url) {
  return String(url || "").match(/\/video\/(\d+)/)?.[1] || String(url || "");
}

function isRateLimitError(error) {
  const text = String(error?.message || error || "");
  return /free api limit|1\s*request\s*\/\s*second|rate.?limit|too many requests|http\s*429/i.test(text);
}

function storageSessionGet(defaults) {
  return new Promise((resolve) => {
    if (!chrome.storage?.session) return resolve({ ...defaults });
    chrome.storage.session.get(defaults, (result) => {
      if (chrome.runtime.lastError) return resolve({ ...defaults });
      resolve(result || { ...defaults });
    });
  });
}

function storageSessionSet(value) {
  return new Promise((resolve) => {
    if (!chrome.storage?.session) return resolve();
    chrome.storage.session.set(value, () => resolve());
  });
}

async function getCachedVideoInfo(canonicalUrl, allowStale = false) {
  const key = videoInfoCacheKey(canonicalUrl);
  const now = Date.now();
  const memoryEntry = videoInfoMemoryCache.get(key);
  const ttl = allowStale ? VIDEO_INFO_STALE_TTL_MS : VIDEO_INFO_CACHE_TTL_MS;
  if (memoryEntry && now - Number(memoryEntry.updatedAt || 0) < ttl && memoryEntry.data?.videoUrl) {
    return memoryEntry.data;
  }

  const stored = await storageSessionGet({ [VIDEO_INFO_CACHE_KEY]: {} });
  const cache = stored[VIDEO_INFO_CACHE_KEY] && typeof stored[VIDEO_INFO_CACHE_KEY] === "object"
    ? stored[VIDEO_INFO_CACHE_KEY]
    : {};
  const entry = cache[key];
  if (!entry || now - Number(entry.updatedAt || 0) >= ttl || !entry.data?.videoUrl) return null;
  videoInfoMemoryCache.set(key, entry);
  return entry.data;
}

async function setCachedVideoInfo(canonicalUrl, data) {
  const key = videoInfoCacheKey(canonicalUrl);
  const entry = { updatedAt: Date.now(), data };
  videoInfoMemoryCache.set(key, entry);

  const write = videoCacheWriteQueue.then(async () => {
    const stored = await storageSessionGet({ [VIDEO_INFO_CACHE_KEY]: {} });
    const source = stored[VIDEO_INFO_CACHE_KEY] && typeof stored[VIDEO_INFO_CACHE_KEY] === "object"
      ? stored[VIDEO_INFO_CACHE_KEY]
      : {};
    const cache = { ...source, [key]: entry };
    const compact = {};
    for (const [cacheKey, cacheEntry] of Object.entries(cache)
      .sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0))
      .slice(0, VIDEO_INFO_CACHE_MAX_ENTRIES)) {
      compact[cacheKey] = cacheEntry;
    }
    await storageSessionSet({ [VIDEO_INFO_CACHE_KEY]: compact });
  });
  videoCacheWriteQueue = write.catch(() => undefined);
  await write;
}

function enqueueVideoApiRequest(task) {
  const execute = async () => {
    const waitMs = VIDEO_API_MIN_INTERVAL_MS - (Date.now() - lastVideoApiStartedAt);
    if (waitMs > 0) await sleep(waitMs);
    lastVideoApiStartedAt = Date.now();
    return task();
  };
  const result = videoApiQueue.then(execute, execute);
  videoApiQueue = result.catch(() => undefined);
  return result;
}

async function requestVideoInfoOnce(canonicalUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${VIDEO_API_URL}?url=${encodeURIComponent(canonicalUrl)}`, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Máy chủ video phản hồi HTTP ${response.status}.`);

    const payload = await response.json();
    const data = payload?.data;
    const requestedVideoId = String(canonicalUrl).match(/\/video\/(\d{8,})/)?.[1] || "";
    const returnedVideoId = String(data?.id || data?.aweme_id || data?.awemeId || data?.item_id || data?.itemId || data?.video_id || data?.videoId || "").match(/\d{8,}/)?.[0] || "";
    if (requestedVideoId && returnedVideoId && requestedVideoId !== returnedVideoId) {
      throw new Error(`Máy chủ trả về sai Video ID (${returnedVideoId}) thay vì ${requestedVideoId}.`);
    }
    const rawVideoUrl = data && (data.hdplay || data.play || data.wmplay);
    const videoUrl = rawVideoUrl ? new URL(String(rawVideoUrl), VIDEO_API_URL).href : "";
    if (!videoUrl) throw new Error(String(payload?.msg || "Không lấy được video từ link này."));

    return {
      videoId: returnedVideoId || requestedVideoId,
      requestedVideoId,
      pageUrl: canonicalUrl,
      videoUrl,
      isHd: Boolean(data.hdplay),
      quality: data.hdplay ? "hd" : (data.play ? "standard" : "watermarked"),
      duration: Number(data.duration) || 0,
      createTime: Number(data.create_time) || 0,
      title: String(data.title || ""),
      cover: String(data.cover || data.origin_cover || data.ai_dynamic_cover || data.dynamic_cover || ""),
      author: String(data.author?.unique_id || data.author?.nickname || ""),
      authorInfo: {
        uniqueId: String(data.author?.unique_id || ""),
        nickname: String(data.author?.nickname || ""),
        verified: data.author?.verified === true || data.author?.verified === 1 || /^(?:1|true)$/i.test(String(data.author?.verified || ""))
      },
      stats: {
        views: Number(data.play_count) || 0,
        likes: Number(data.digg_count) || 0,
        comments: Number(data.comment_count) || 0,
        shares: Number(data.share_count) || 0,
        saves: Number(data.collect_count) || 0
      },
      music: {
        id: String(data.music_info?.id || data.music_id || ""),
        title: String(data.music_info?.title || data.music_title || (typeof data.music === "object" ? data.music?.title : "") || ""),
        author: String(data.music_info?.author || data.music_author || (typeof data.music === "object" ? data.music?.author : "") || ""),
        album: String(data.music_info?.album || (typeof data.music === "object" ? data.music?.album : "") || ""),
        url: String(data.music_info?.play || data.music_info?.play_url || (typeof data.music === "object" ? data.music?.play : "") || "")
      },
      hashtags: Array.from(new Set(String(data.title || "").match(/#[\p{L}\p{N}_]+/gu) || [])),
      source: "tikwm",
      downloadable: true
    };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Yêu cầu lấy video quá thời gian. Hãy thử lại.");
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestVideoInfoWithRetry(canonicalUrl) {
  let lastError = null;
  for (let attempt = 0; attempt <= VIDEO_API_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await enqueueVideoApiRequest(() => requestVideoInfoOnce(canonicalUrl));
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt >= VIDEO_API_RETRY_DELAYS_MS.length) break;
      await sleep(VIDEO_API_RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError || new Error("Không thể lấy video từ máy chủ.");
}

async function fetchVideoInfo(tiktokUrl, options = {}) {
  const canonicalUrl = canonicalTikTokVideoUrl(tiktokUrl);
  if (!canonicalUrl) throw new Error("Link TikTok không hợp lệ.");
  const force = Boolean(options?.force);

  if (!force) {
    const cached = await getCachedVideoInfo(canonicalUrl, false);
    if (cached) return { ...cached, cached: true };
  }

  const key = videoInfoCacheKey(canonicalUrl);
  if (videoInfoInFlight.has(key)) return videoInfoInFlight.get(key);

  const task = (async () => {
    try {
      const data = await requestVideoInfoWithRetry(canonicalUrl);
      await setCachedVideoInfo(canonicalUrl, data);
      return data;
    } catch (error) {
      const stale = await getCachedVideoInfo(canonicalUrl, true);
      if (stale) return { ...stale, cached: true, stale: true };
      if (isRateLimitError(error)) {
        throw new Error("Máy chủ video đang giới hạn 1 yêu cầu/giây. Extension đã tự chờ và thử lại nhưng chưa thành công.");
      }
      throw error;
    }
  })();

  videoInfoInFlight.set(key, task);
  try {
    return await task;
  } finally {
    if (videoInfoInFlight.get(key) === task) videoInfoInFlight.delete(key);
  }
}

function parseGoogleTranslation(payload) {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return "";
  return payload[0]
    .map((segment) => (Array.isArray(segment) ? String(segment[0] || "") : ""))
    .join("")
    .trim();
}

function rememberTranslation(key, value) {
  translationCache.set(key, value);
  if (translationCache.size > 1200) {
    const firstKey = translationCache.keys().next().value;
    translationCache.delete(firstKey);
  }
}

async function translateOne(text, targetLanguage = "vi") {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const cacheKey = `${targetLanguage}|${normalized}`;
  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

  let lastError = null;
  for (const baseUrl of GOOGLE_TRANSLATE_ENDPOINTS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TRANSLATE_TIMEOUT_MS);
    try {
      const url = new URL(baseUrl);
      url.searchParams.set("client", "gtx");
      url.searchParams.set("sl", "auto");
      url.searchParams.set("tl", targetLanguage);
      url.searchParams.set("dt", "t");
      url.searchParams.set("q", normalized.slice(0, 4500));
      const response = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const translated = parseGoogleTranslation(payload);
      if (!translated) throw new Error("Phản hồi dịch trống");
      rememberTranslation(cacheKey, translated);
      return translated;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw new Error(lastError?.name === "AbortError" ? "Dịch quá thời gian" : (lastError?.message || "Không thể dịch"));
}

async function translateSubtitles(texts, targetLanguage = "vi") {
  if (!Array.isArray(texts) || !texts.length) throw new Error("Không có nội dung phụ đề để dịch.");
  if (texts.length > MAX_TRANSLATION_ITEMS) throw new Error("Phụ đề có quá nhiều đoạn.");

  const normalizedTexts = texts.map((text) => String(text || "").trim());
  const totalChars = normalizedTexts.reduce((sum, text) => sum + text.length, 0);
  if (totalChars > MAX_TOTAL_TRANSLATION_CHARS) throw new Error("Nội dung phụ đề quá dài để dịch tự động.");

  // Dịch mỗi câu khác nhau đúng một lần để tăng tốc với phụ đề bị lặp.
  const uniqueTexts = [];
  const uniqueIndexByText = new Map();
  const sourceToUnique = normalizedTexts.map((text) => {
    if (!text) return -1;
    if (!uniqueIndexByText.has(text)) {
      uniqueIndexByText.set(text, uniqueTexts.length);
      uniqueTexts.push(text);
    }
    return uniqueIndexByText.get(text);
  });

  const uniqueTranslations = new Array(uniqueTexts.length);
  const occurrenceCounts = new Array(uniqueTexts.length).fill(0);
  for (const index of sourceToUnique) {
    if (index >= 0) occurrenceCounts[index] += 1;
  }
  let failedCount = 0;
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= uniqueTexts.length) return;
      const original = uniqueTexts[index];
      try {
        uniqueTranslations[index] = await translateOne(original, targetLanguage);
      } catch {
        uniqueTranslations[index] = original;
        failedCount += occurrenceCounts[index];
      }
    }
  }

  const workerCount = Math.min(TRANSLATION_CONCURRENCY, uniqueTexts.length || 1);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  const translations = sourceToUnique.map((index) => index < 0 ? "" : uniqueTranslations[index]);
  return { translations, failedCount };
}

const TRANSCRIPT365_PAGE = "https://www.transcript365.com/free/tiktok-transcript/";

function isTranscript365Url(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && (url.hostname === "transcript365.com" || url.hostname.endsWith(".transcript365.com"));
  } catch {
    return false;
  }
}

const transcriptWorkerWindows = new Map();
const transcriptWorkerTabs = new Map();

async function openTranscript365Background(pageUrl, requestId, openerWindowId) {
  if (!isTikTokUrl(pageUrl)) throw new Error("Link TikTok không hợp lệ.");
  // Mở URL sạch. Truyền link qua chrome.storage để tránh trang tự submit/reload lặp do query string.
  const createdWindow = await chrome.windows.create({
    url: TRANSCRIPT365_PAGE,
    type: "popup",
    focused: false,
    width: 900,
    height: 760
  });
  const windowId = createdWindow?.id ?? null;
  let tabId = createdWindow?.tabs?.[0]?.id ?? null;
  if (!Number.isInteger(tabId) && Number.isInteger(windowId)) {
    const tabs = await chrome.tabs.query({ windowId });
    tabId = tabs[0]?.id ?? null;
  }
  if (!Number.isInteger(tabId) || !Number.isInteger(windowId)) {
    if (Number.isInteger(windowId)) await chrome.windows.remove(windowId).catch(() => {});
    throw new Error("Không tạo được cửa sổ Transcript365.");
  }

  transcriptWorkerWindows.set(windowId, String(requestId || ""));
  transcriptWorkerTabs.set(tabId, windowId);

  // Đảm bảo cửa sổ TikTok vẫn ở phía trước, Transcript365 nằm ở cửa sổ riêng phía sau.
  if (Number.isInteger(openerWindowId)) {
    setTimeout(() => {
      chrome.windows.update(openerWindowId, { focused: true }).catch(() => {});
    }, 30);
  }
  return { tabId, windowId };
}

async function closeTranscript365Safely(windowId, tabId) {
  if (Number.isInteger(windowId)) {
    transcriptWorkerWindows.delete(windowId);
    for (const [knownTabId, knownWindowId] of transcriptWorkerTabs.entries()) {
      if (knownWindowId === windowId) transcriptWorkerTabs.delete(knownTabId);
    }
    try {
      await chrome.windows.remove(windowId);
      return true;
    } catch {
      // Cửa sổ có thể đã được đóng; thử đóng riêng tab nếu còn.
    }
  }
  if (Number.isInteger(tabId)) {
    transcriptWorkerTabs.delete(tabId);
    try {
      await chrome.tabs.remove(tabId);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

chrome.windows.onRemoved.addListener((windowId) => {
  transcriptWorkerWindows.delete(windowId);
  for (const [tabId, knownWindowId] of transcriptWorkerTabs.entries()) {
    if (knownWindowId === windowId) transcriptWorkerTabs.delete(tabId);
  }
});



async function pauseOtherTikTokTabs(exceptTabId = null, reason = "other-media") {
  const settings = await readSettings();
  if (!settings.smartAutoPause) return 0;
  const tabs = await chrome.tabs.query({});
  const targets = tabs.filter((tab) => Number.isInteger(tab.id) && tab.id !== exceptTabId && isTikTokUrl(tab.url || ""));
  await Promise.all(targets.map((tab) => chrome.tabs.sendMessage(tab.id, {
    type: "TDT_PAUSE_FOR_OTHER_MEDIA",
    reason
  }).catch(() => {})));
  return targets.length;
}


async function handleTikTokMediaPlaying(tabId) {
  const settings = await readSettings();
  if (!settings.smartAutoPause) return { pausedCurrent: false, pausedOthers: 0 };
  const tabs = await chrome.tabs.query({});
  const otherAudible = tabs.find((tab) => Number.isInteger(tab.id) && tab.id !== tabId && tab.audible === true);
  if (otherAudible && Number.isInteger(tabId)) {
    await chrome.tabs.sendMessage(tabId, {
      type: "TDT_PAUSE_FOR_OTHER_MEDIA",
      reason: "existing-audible-tab"
    }).catch(() => {});
    return { pausedCurrent: true, pausedOthers: 0 };
  }
  const pausedOthers = await pauseOtherTikTokTabs(tabId, "tiktok-player");
  return { pausedCurrent: false, pausedOthers };
}

function notifyTikTokTabUrl(tabId, rawUrl, status = "") {
  if (!Number.isInteger(tabId) || !isTikTokUrl(rawUrl)) return;
  chrome.tabs.sendMessage(tabId, {
    type: "TDT_TAB_URL_UPDATED",
    url: String(rawUrl || ""),
    status: String(status || "")
  }).catch(() => {});
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const rawUrl = String(changeInfo.url || tab?.url || "");
  if (rawUrl && (changeInfo.url || changeInfo.status === "loading" || changeInfo.status === "complete")) {
    notifyTikTokTabUrl(tabId, rawUrl, changeInfo.status || (changeInfo.url ? "url" : ""));
  }
  if (changeInfo.audible === true) {
    void pauseOtherTikTokTabs(tabId, "audible-tab");
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId).then((tab) => notifyTikTokTabUrl(tabId, tab?.url || "", "activated")).catch(() => {});
});



const TDT_1688_PENDING_PREFIX = "tdt_1688_pending_v1_";
const TDT_1688_TAB_PREFIX = "tdt_1688_tab_v1_";
const TDT_1688_ACTIVE_PREFIX = "tdt_1688_active_v2_";
const TDT_1688_RESULT_PREFIX = "tdt_1688_result_v2_";
const TDT_1688_PENDING_TTL_MS = 12 * 60 * 1000;
const TDT_1688_ACTIVE_REUSE_MS = 12 * 1000;
const TDT_1688_RESULT_TTL_MS = 12 * 60 * 1000;
const tdt1688OpenFlights = new Map();
const tdt1688FinalizeFlights = new Map();
const TDT_1688_MAX_DATA_URL_LENGTH = 7_500_000;
const TDT_1688_MAX_REMOTE_IMAGE_BYTES = 6 * 1024 * 1024;
const TDT_1688_START_URL = "https://www.1688.com/";
const TDT_1688_CLEANUP_MIN_INTERVAL_MS = 60 * 1000;
const tdt1688Storage = chrome.storage.session || chrome.storage.local;
let tdt1688LastCleanupAt = 0;
let tdt1688CleanupFlight = null;

function tdt1688RequestId() {
  try { return crypto.randomUUID(); } catch (_error) {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function tdt1688PendingKey(requestId) {
  return `${TDT_1688_PENDING_PREFIX}${String(requestId || "").replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function tdt1688TabKey(tabId) {
  return `${TDT_1688_TAB_PREFIX}${Number(tabId)}`;
}

function tdt1688SafeToken(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 160);
}

function tdt1688ActiveKey(fingerprint) {
  return `${TDT_1688_ACTIVE_PREFIX}${tdt1688SafeToken(fingerprint)}`;
}

function tdt1688ResultKey(token) {
  return `${TDT_1688_RESULT_PREFIX}${tdt1688SafeToken(token)}`;
}

function tdt1688Hash(value) {
  const text = String(value || "");
  let hash = 0x811c9dc5;
  const step = Math.max(1, Math.floor(text.length / 2048));
  for (let index = 0; index < text.length; index += step) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function tdt1688ImageFingerprint(dataUrl, metadata = {}) {
  const image = String(dataUrl || "");
  const sample = `${image.length}|${image.slice(0, 160)}|${image.slice(-160)}|${String(metadata.imageUrl || "").slice(0, 500)}|${String(metadata.sourceUrl || "").slice(0, 500)}|${String(metadata.sourceKind || "")}|${Math.round((Number(metadata.videoTime) || 0) * 2)}`;
  return tdt1688Hash(sample);
}

function tdt1688ResultSignature(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    if (!is1688ImageResultUrl(url.href)) return "";
    const imageId = String(url.searchParams.get("imageId") || "").trim();
    const imageIdList = String(url.searchParams.get("imageIdList") || imageId).trim();
    // 1688 currently serves the same result through both pages-fast.1688.com
    // and air.1688.com. Use only immutable image IDs so both URLs dedupe.
    return tdt1688Hash(`${imageId}|${imageIdList}`);
  } catch (_error) {
    return "";
  }
}

async function tdt1688TabExists(tabId) {
  if (!Number.isInteger(tabId)) return false;
  return Boolean(await chrome.tabs.get(tabId).catch(() => null));
}

function is1688ImageResultUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();
    const hasImageId = Boolean(url.searchParams.get("imageId") || url.searchParams.get("imageIdList"));
    if (!hasImageId || !(hostname === "1688.com" || hostname.endsWith(".1688.com"))) return false;

    // Current 1688 result route (2026):
    // https://air.1688.com/kapp/1688-search/pc-image-search/?imageId=...
    if (hostname === "air.1688.com" && /\/kapp\/1688-search\/pc-image-search\/?/i.test(pathname)) return true;

    // Legacy route still used for some accounts/regions.
    if (hostname === "pages-fast.1688.com" && /\/image[_-]search\//i.test(pathname)) return true;

    // Future-compatible fallback: accept an image-search route on a 1688 host
    // only when an immutable imageId is present.
    return /(?:image[_-]?search|pc-image-search|srch_rec)/i.test(pathname);
  } catch (_error) {
    return false;
  }
}

async function cleanupStale1688Searches(force = false) {
  const now = Date.now();
  if (!force && now - tdt1688LastCleanupAt < TDT_1688_CLEANUP_MIN_INTERVAL_MS) return 0;
  if (tdt1688CleanupFlight) return tdt1688CleanupFlight;
  tdt1688CleanupFlight = (async () => {
    const all = await tdt1688Storage.get(null);
    const checkedAt = Date.now();
    const removeKeys = [];
    const activeMaxAge = Math.max(TDT_1688_ACTIVE_REUSE_MS * 3, TDT_1688_CLEANUP_MIN_INTERVAL_MS);
    for (const [key, value] of Object.entries(all || {})) {
      if (key.startsWith(TDT_1688_PENDING_PREFIX)) {
        if (!value || checkedAt - Number(value.createdAt || 0) > TDT_1688_PENDING_TTL_MS) removeKeys.push(key);
        continue;
      }
      if (key.startsWith(TDT_1688_ACTIVE_PREFIX)) {
        const age = checkedAt - Number(value?.createdAt || 0);
        const tabAlive = value && age <= activeMaxAge && await tdt1688TabExists(Number(value.tabId));
        if (!value || !tabAlive || age > activeMaxAge) removeKeys.push(key);
        continue;
      }
      if (key.startsWith(TDT_1688_RESULT_PREFIX)) {
        const age = checkedAt - Number(value?.completedAt || 0);
        const tabAlive = value && age <= TDT_1688_RESULT_TTL_MS && await tdt1688TabExists(Number(value.tabId));
        if (!value || !tabAlive || age > TDT_1688_RESULT_TTL_MS) removeKeys.push(key);
      }
    }
    if (removeKeys.length) await tdt1688Storage.remove(removeKeys);
    tdt1688LastCleanupAt = checkedAt;
    return removeKeys.length;
  })();
  try {
    return await tdt1688CleanupFlight;
  } finally {
    tdt1688CleanupFlight = null;
  }
}
async function captureVisibleTabFor1688(sender) {
  const windowId = Number.isInteger(sender?.tab?.windowId) ? sender.tab.windowId : chrome.windows.WINDOW_ID_CURRENT;
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!/^data:image\/png;base64,/i.test(String(dataUrl || ""))) {
        reject(new Error("Chrome không trả về ảnh chụp hợp lệ."));
        return;
      }
      resolve(dataUrl);
    });
  });
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize)));
  }
  return btoa(binary);
}

async function fetch1688ImageAsDataUrl(rawUrl) {
  let url;
  try { url = new URL(String(rawUrl || "")); } catch (_error) { throw new Error("Link ảnh sản phẩm không hợp lệ."); }
  if (!/^https?:$/.test(url.protocol)) throw new Error("1688 chỉ hỗ trợ ảnh HTTP/HTTPS.");
  const response = await fetch(url.href, {
    method: "GET",
    credentials: "omit",
    cache: "force-cache",
    redirect: "follow",
    referrerPolicy: "no-referrer"
  });
  if (!response.ok) throw new Error(`Không tải được ảnh sản phẩm (HTTP ${response.status}).`);
  const blob = await response.blob();
  if (!blob.size || blob.size > TDT_1688_MAX_REMOTE_IMAGE_BYTES) {
    throw new Error("Ảnh sản phẩm quá lớn hoặc không có dữ liệu.");
  }
  let mime = String(blob.type || response.headers.get("content-type") || "image/jpeg").split(";")[0].trim().toLowerCase();
  if (!/^image\/(?:jpeg|jpg|png|webp|gif|bmp)$/i.test(mime)) mime = "image/jpeg";
  const base64 = arrayBufferToBase64(await blob.arrayBuffer());
  return `data:${mime};base64,${base64}`;
}

async function resolve1688ImageData(dataUrl, imageUrl) {
  const normalized = String(dataUrl || "").trim();
  if (/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(normalized)) return normalized;
  if (String(imageUrl || "").trim()) return fetch1688ImageAsDataUrl(String(imageUrl || "").trim());
  throw new Error("Không nhận được ảnh để tìm kiếm.");
}

async function open1688ImageSearch(dataUrl, metadata = {}) {
  const normalized = await resolve1688ImageData(dataUrl, metadata.imageUrl);
  if (normalized.length > TDT_1688_MAX_DATA_URL_LENGTH) {
    throw new Error("Ảnh tìm kiếm quá lớn. Hãy chọn ảnh nhỏ hơn rồi thử lại.");
  }

  const fingerprint = tdt1688ImageFingerprint(normalized, metadata);
  if (tdt1688OpenFlights.has(fingerprint)) return tdt1688OpenFlights.get(fingerprint);

  const flight = (async () => {
    await cleanupStale1688Searches();
    const activeKey = tdt1688ActiveKey(fingerprint);
    const activeStored = await tdt1688Storage.get({ [activeKey]: null });
    const active = activeStored[activeKey];
    if (active
      && Date.now() - Number(active.createdAt || 0) <= TDT_1688_ACTIVE_REUSE_MS
      && await tdt1688TabExists(Number(active.tabId))) {
      return { requestId: String(active.requestId || ""), tabId: Number(active.tabId), backgroundUpload: true, reused: true };
    }

    const requestId = tdt1688RequestId();
    const record = {
      requestId,
      fingerprint,
      dataUrl: normalized,
      sourceUrl: String(metadata.sourceUrl || "").slice(0, 1800),
      sourceKind: String(metadata.sourceKind || "image").slice(0, 80),
      imageUrl: String(metadata.imageUrl || "").slice(0, 2400),
      videoTime: Math.max(0, Number(metadata.videoTime) || 0),
      createdAt: Date.now(),
      status: "queued"
    };
    await tdt1688Storage.set({ [tdt1688PendingKey(requestId)]: record });
    const url = `${TDT_1688_START_URL}?tdtImageSearch=1&tdtRequest=${encodeURIComponent(requestId)}`;
    const tab = await chrome.tabs.create({ url, active: false });
    if (!Number.isInteger(tab?.id)) throw new Error("Không tạo được tab 1688.");
    await tdt1688Storage.set({
      [tdt1688PendingKey(requestId)]: { ...record, uploadTabId: tab.id, status: "opening-upload-tab", updatedAt: Date.now() },
      [tdt1688TabKey(tab.id)]: requestId,
      [activeKey]: { requestId, tabId: tab.id, fingerprint, createdAt: record.createdAt }
    });
    return { requestId, tabId: tab.id, backgroundUpload: true, reused: false };
  })();

  tdt1688OpenFlights.set(fingerprint, flight);
  try {
    return await flight;
  } finally {
    setTimeout(() => tdt1688OpenFlights.delete(fingerprint), TDT_1688_ACTIVE_REUSE_MS);
  }
}
async function findSingleRecent1688RequestId() {
  const all = await tdt1688Storage.get(null);
  const now = Date.now();
  const pending = Object.entries(all || {})
    .filter(([key, value]) => key.startsWith(TDT_1688_PENDING_PREFIX)
      && value
      && now - Number(value.createdAt || 0) <= TDT_1688_PENDING_TTL_MS)
    .sort((a, b) => Number(b[1]?.createdAt || 0) - Number(a[1]?.createdAt || 0));
  return pending.length === 1 ? String(pending[0][1]?.requestId || "") : "";
}

async function find1688ResultWinnerBySignature(signature) {
  if (!signature) return null;
  const all = await tdt1688Storage.get(null);
  const now = Date.now();
  const matches = Object.entries(all || {})
    .filter(([key, value]) => key.startsWith(TDT_1688_RESULT_PREFIX)
      && value
      && String(value.signature || "") === signature
      && now - Number(value.completedAt || 0) <= TDT_1688_RESULT_TTL_MS)
    .map(([, value]) => value)
    .sort((a, b) => Number(b.completedAt || 0) - Number(a.completedAt || 0));
  return matches[0] || null;
}

async function resolve1688RequestForTab(tabId, tabInfo = null) {
  if (!Number.isInteger(tabId)) return { requestId: "", openerTabId: null };
  const tabKey = tdt1688TabKey(tabId);
  const own = await tdt1688Storage.get({ [tabKey]: "" });
  let requestId = String(own[tabKey] || "");
  let openerTabId = null;

  const tab = tabInfo || await chrome.tabs.get(tabId).catch(() => null);
  if (!requestId && Number.isInteger(tab?.openerTabId)) {
    openerTabId = tab.openerTabId;
    const openerKey = tdt1688TabKey(openerTabId);
    const opener = await tdt1688Storage.get({ [openerKey]: "" });
    requestId = String(opener[openerKey] || "");
  }

  // Some 1688 navigations use noopener. When there is exactly one queued image
  // request, safely attach that result tab to the only pending request.
  if (!requestId) requestId = await findSingleRecent1688RequestId();

  // A delayed duplicate can arrive after the pending record has been removed.
  // Reattach it by the immutable imageId/imageIdList signature.
  if (!requestId && is1688ImageResultUrl(tab?.url || "")) {
    const winner = await find1688ResultWinnerBySignature(tdt1688ResultSignature(tab?.url || ""));
    requestId = String(winner?.requestId || "");
  }

  if (requestId) await tdt1688Storage.set({ [tabKey]: requestId });
  return { requestId, openerTabId };
}

async function get1688PendingForSender(sender) {
  const tabId = Number.isInteger(sender?.tab?.id) ? sender.tab.id : null;
  if (!Number.isInteger(tabId)) return null;
  const tabKey = tdt1688TabKey(tabId);
  const mapped = await resolve1688RequestForTab(tabId, sender?.tab || null);
  let requestId = String(mapped.requestId || "");
  if (!requestId) {
    try { requestId = new URL(String(sender?.tab?.url || "")).searchParams.get("tdtRequest") || ""; } catch (_error) { /* invalid URL */ }
  }
  if (!requestId) return null;
  const pendingKey = tdt1688PendingKey(requestId);
  const stored = await tdt1688Storage.get({ [pendingKey]: null });
  const pending = stored[pendingKey];
  if (!pending || Date.now() - Number(pending.createdAt || 0) > TDT_1688_PENDING_TTL_MS) {
    await tdt1688Storage.remove([tabKey, pendingKey]);
    return null;
  }
  return pending;
}

async function get1688ResultStatus(requestId = "") {
  const safeRequestId = String(requestId || "");
  if (!safeRequestId) return null;
  const all = await tdt1688Storage.get(null);
  const candidates = Object.entries(all || {})
    .filter(([key, value]) => key.startsWith(TDT_1688_RESULT_PREFIX)
      && value
      && String(value.requestId || "") === safeRequestId)
    .map(([, value]) => value)
    .sort((a, b) => Number(b.completedAt || 0) - Number(a.completedAt || 0));
  for (const candidate of candidates) {
    const tabId = Number(candidate?.tabId);
    if (Number.isInteger(tabId) && await tdt1688TabExists(tabId)) return candidate;
  }
  return null;
}

async function complete1688Search(sender, requestId = "") {
  const tabId = Number.isInteger(sender?.tab?.id) ? sender.tab.id : null;
  const keys = [];
  if (Number.isInteger(tabId)) keys.push(tdt1688TabKey(tabId));
  if (requestId) keys.push(tdt1688PendingKey(requestId));
  if (keys.length) await tdt1688Storage.remove(keys);
}

async function activate1688Tab(tabId) {
  if (!Number.isInteger(tabId)) return;
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return;
  await chrome.tabs.update(tabId, { active: true }).catch(() => null);
  if (Number.isInteger(tab.windowId)) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => null);
}

async function mapped1688TabsForRequest(requestId) {
  if (!requestId) return [];
  const all = await tdt1688Storage.get(null);
  const result = [];
  for (const [key, value] of Object.entries(all || {})) {
    if (!key.startsWith(TDT_1688_TAB_PREFIX) || String(value || "") !== requestId) continue;
    const tabId = Number(key.slice(TDT_1688_TAB_PREFIX.length));
    if (Number.isInteger(tabId)) result.push(tabId);
  }
  return result;
}

async function remove1688ActiveRecordsForRequest(requestId) {
  if (!requestId) return;
  const all = await tdt1688Storage.get(null);
  const keys = Object.entries(all || {})
    .filter(([key, value]) => key.startsWith(TDT_1688_ACTIVE_PREFIX) && String(value?.requestId || "") === requestId)
    .map(([key]) => key);
  if (keys.length) await tdt1688Storage.remove(keys);
}

async function collect1688UploaderTabs(requestId, winnerTabId) {
  if (!requestId) return [];
  const all = await tdt1688Storage.get(null);
  const pending = all?.[tdt1688PendingKey(requestId)];
  const candidates = new Set(await mapped1688TabsForRequest(requestId));
  if (Number.isInteger(pending?.uploadTabId)) candidates.add(pending.uploadTabId);
  for (const [key, value] of Object.entries(all || {})) {
    if (key.startsWith(TDT_1688_ACTIVE_PREFIX) && String(value?.requestId || "") === requestId && Number.isInteger(value?.tabId)) {
      candidates.add(value.tabId);
    }
  }
  const tabs = await chrome.tabs.query({ url: ["https://1688.com/*", "https://*.1688.com/*"] }).catch(() => []);
  for (const tab of tabs) {
    if (!Number.isInteger(tab?.id) || tab.id === winnerTabId || is1688ImageResultUrl(tab.url || "")) continue;
    try {
      const url = new URL(String(tab.url || ""));
      if (url.searchParams.get("tdtRequest") === requestId) candidates.add(tab.id);
    } catch (_error) { /* Ignore invalid URL. */ }
  }
  candidates.delete(winnerTabId);
  const aliveUploaders = [];
  for (const tabId of candidates) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || is1688ImageResultUrl(tab.url || "")) continue;
    aliveUploaders.push(tabId);
  }
  return aliveUploaders;
}

async function dedupe1688ResultTabs(winnerTabId, signature) {
  if (!Number.isInteger(winnerTabId) || !signature) return [];
  const tabs = await chrome.tabs.query({});
  const duplicateIds = tabs
    .filter((tab) => Number.isInteger(tab?.id)
      && tab.id !== winnerTabId
      && is1688ImageResultUrl(tab.url || "")
      && tdt1688ResultSignature(tab.url || "") === signature)
    .map((tab) => tab.id);
  for (const duplicateId of duplicateIds) await chrome.tabs.remove(duplicateId).catch(() => null);
  return duplicateIds;
}

function enqueue1688Finalize(lockKey, task) {
  const previous = tdt1688FinalizeFlights.get(lockKey) || Promise.resolve();
  const next = previous.catch(() => null).then(task);
  tdt1688FinalizeFlights.set(lockKey, next);
  void next.finally(() => {
    if (tdt1688FinalizeFlights.get(lockKey) === next) tdt1688FinalizeFlights.delete(lockKey);
  });
  return next;
}

async function finalize1688ResultTab(tabId, tabInfo = null) {
  if (!Number.isInteger(tabId)) return;
  const tab = tabInfo || await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || !is1688ImageResultUrl(tab.url || "")) return;

  const resolved = await resolve1688RequestForTab(tabId, tab);
  const requestId = String(resolved.requestId || "");
  const signature = tdt1688ResultSignature(tab.url || "");
  const lockKey = requestId || `sig-${signature}` || `tab-${tabId}`;

  return enqueue1688Finalize(lockKey, async () => {
    const resultKey = tdt1688ResultKey(lockKey);
    const stored = await tdt1688Storage.get({ [resultKey]: null });
    let winner = stored[resultKey];
    const winnerAlive = winner && await tdt1688TabExists(Number(winner.tabId));
    if (!winnerAlive || (winner.signature && signature && winner.signature !== signature)) winner = null;

    if (!winner) {
      winner = {
        tabId,
        requestId,
        signature,
        resultUrl: String(tab.url || "").slice(0, 3000),
        completedAt: Date.now()
      };
      await tdt1688Storage.set({ [resultKey]: winner });
    }

    const winnerTabId = Number(winner.tabId);
    if (winnerTabId !== tabId) {
      await tdt1688Storage.remove(tdt1688TabKey(tabId));
      await chrome.tabs.remove(tabId).catch(() => null);
      await activate1688Tab(winnerTabId);
      return { winnerTabId, duplicateClosed: tabId };
    }

    // Gắn mapping của tab kết quả trước khi đóng tab upload để onRemoved không
    // xóa pending request trong khoảng race giữa hai tab.
    if (requestId) await tdt1688Storage.set({ [tdt1688TabKey(tabId)]: requestId });
    const mappedTabs = requestId ? await mapped1688TabsForRequest(requestId) : [tabId];
    const explicitUploaderIds = requestId ? await collect1688UploaderTabs(requestId, tabId) : [];
    const duplicateResultIds = await dedupe1688ResultTabs(tabId, signature);
    const hiddenOrDuplicateIds = new Set([...mappedTabs, ...explicitUploaderIds, ...duplicateResultIds]);
    hiddenOrDuplicateIds.delete(tabId);
    for (const otherTabId of hiddenOrDuplicateIds) await chrome.tabs.remove(otherTabId).catch(() => null);

    await activate1688Tab(tabId);

    const removeKeys = [...hiddenOrDuplicateIds].map(tdt1688TabKey);
    if (requestId) removeKeys.push(tdt1688PendingKey(requestId));
    if (removeKeys.length) await tdt1688Storage.remove(removeKeys);
    if (requestId) await remove1688ActiveRecordsForRequest(requestId);

    // Keep the winner mapping/result record briefly. If 1688 emits another
    // result tab a moment later, it is attached to the same request and closed.
    if (requestId) await tdt1688Storage.set({ [tdt1688TabKey(tabId)]: requestId });
    return { winnerTabId: tabId, closedTabs: [...hiddenOrDuplicateIds] };
  });
}
async function update1688PendingStatus(sender, status, error = "") {
  const pending = await get1688PendingForSender(sender);
  if (pending?.requestId) {
    await tdt1688Storage.set({
      [tdt1688PendingKey(pending.requestId)]: {
        ...pending,
        status: String(status || ""),
        error: String(error || "").slice(0, 500),
        updatedAt: Date.now()
      }
    });
  }
  // Do not bring a stale uploader tab to the front after a separate result tab
  // has already completed and removed the pending request.
  if (status === "failed" && pending && Number.isInteger(sender?.tab?.id)) await activate1688Tab(sender.tab.id);
  return Boolean(pending);
}

chrome.tabs.onCreated?.addListener((tab) => {
  if (!Number.isInteger(tab?.id)) return;
  if (Number.isInteger(tab?.openerTabId)) void resolve1688RequestForTab(tab.id, tab).catch(() => {});
  if (is1688ImageResultUrl(tab?.url || "")) void finalize1688ResultTab(tab.id, tab).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = String(changeInfo.url || tab?.url || "");
  if (is1688ImageResultUrl(url)) void finalize1688ResultTab(tabId, tab).catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const tabKey = tdt1688TabKey(tabId);
  void tdt1688Storage.get(null).then(async (all) => {
    const requestId = String(all?.[tabKey] || "");
    const removeKeys = [tabKey];

    for (const [key, value] of Object.entries(all || {})) {
      if (key.startsWith(TDT_1688_ACTIVE_PREFIX) && Number(value?.tabId) === tabId) removeKeys.push(key);
      if (key.startsWith(TDT_1688_RESULT_PREFIX) && Number(value?.tabId) === tabId) removeKeys.push(key);
    }

    await tdt1688Storage.remove(removeKeys);

    // Removing one duplicate/uploader tab must not cancel the shared request
    // while another mapped tab is still alive.
    if (requestId) {
      const remainingTabs = await mapped1688TabsForRequest(requestId);
      const alive = [];
      for (const otherTabId of remainingTabs) {
        if (otherTabId !== tabId && await tdt1688TabExists(otherTabId)) alive.push(otherTabId);
      }
      if (!alive.length) {
        await tdt1688Storage.remove(tdt1688PendingKey(requestId));
        await remove1688ActiveRecordsForRequest(requestId);
      }
    }
  }).catch(() => {});
});

function handleRuntimeMessage(message, _sender, sendResponse) {
  if (!message || typeof message.type !== "string") return false;

  if (message.type === "PROXY_GET_STATUS") {
    readProxySettings()
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không thể đọc trạng thái proxy." }));
    return true;
  }

  if (message.type === "PROXY_SET_ENABLED") {
    const action = enqueueProxyMutation(() => message.enabled ? rotateTikTokProxy(String(message.country || "")) : disableTikTokProxy());
    action
      .then((settings) => {
        void recordRemoteUsage("proxyChanges");
        sendResponse({ ok: true, settings });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không thể thay đổi proxy." }));
    return true;
  }

  if (message.type === "PROXY_ROTATE") {
    enqueueProxyMutation(() => rotateTikTokProxy(String(message.country || "")))
      .then((settings) => {
        void recordRemoteUsage("proxyChanges");
        sendResponse({ ok: true, settings });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không thể đổi proxy." }));
    return true;
  }

  if (message.type === "PROXY_SET_COUNTRY") {
    enqueueProxyMutation(() => setTikTokProxyCountry(String(message.country || "")))
      .then((settings) => {
        void recordRemoteUsage("proxyChanges");
        sendResponse({ ok: true, settings });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không thể đổi quốc gia proxy." }));
    return true;
  }

  if (message.type === "PROXY_MEASURE_LATENCY") {
    measureActiveProxyLatency()
      .then((settings) => {
        void recordRemoteUsage("proxyLatencyTests");
        sendResponse({ ok: true, settings });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không thể đo độ trễ proxy." }));
    return true;
  }

  if (message.type === "GET_CURRENT_TAB_URL") {
    const tabUrl = String(_sender.tab?.url || "");
    sendResponse({
      ok: Boolean(tabUrl),
      url: tabUrl,
      canonicalUrl: canonicalTikTokVideoUrl(tabUrl),
      tabId: Number.isInteger(_sender.tab?.id) ? _sender.tab.id : null
    });
    return false;
  }

  if (message.type === "TDT_MEDIA_PLAYING") {
    const tabId = Number.isInteger(_sender.tab?.id) ? _sender.tab.id : null;
    handleTikTokMediaPlaying(tabId)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không thể điều phối phát media." }));
    return true;
  }

  if (message.type === "TRANSLATE_TEXT") {
    const text = String(message.text || "").trim();
    const requestedLanguage = String(message.targetLanguage || "en").trim().toLowerCase();
    const targetLanguage = ["en", "lo", "th", "km", "vi"].includes(requestedLanguage) ? requestedLanguage : "en";
    if (!text) {
      sendResponse({ ok: false, error: "Chưa có từ khóa để dịch." });
      return false;
    }
    translateOne(text, targetLanguage)
      .then((translation) => {
        void recordRemoteUsage("keywordTranslations");
        sendResponse({ ok: true, translation });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không thể dịch từ khóa." }));
    return true;
  }

  if (message.type === "OPEN_TRANSCRIPT365_BACKGROUND") {
    openTranscript365Background(String(message.pageUrl || ""), String(message.requestId || ""), _sender.tab?.windowId)
      .then((worker) => {
        void recordRemoteUsage("subtitleRequests");
        sendResponse({ ok: true, tabId: worker.tabId, windowId: worker.windowId });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không thể mở Transcript365 dưới nền." }));
    return true;
  }

  if (message.type === "CLOSE_TRANSCRIPT365_BACKGROUND") {
    const windowId = Number.isInteger(message.windowId) ? message.windowId : null;
    const tabId = Number.isInteger(message.tabId) ? message.tabId : null;
    closeTranscript365Safely(windowId, tabId)
      .then((closed) => sendResponse({ ok: true, closed }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không thể đóng tab Transcript365." }));
    return true;
  }

  if (message.type === "TRANSCRIPT365_NO_SUB_READY") {
    const tabId = _sender.tab?.id;
    const windowId = _sender.tab?.windowId;
    const tabUrl = _sender.tab?.url || "";
    const expectedRequestId = Number.isInteger(windowId) ? transcriptWorkerWindows.get(windowId) : "";
    const requestMatches = !expectedRequestId || expectedRequestId === String(message.requestId || "");
    sendResponse({ ok: true });
    chrome.storage.local.remove([TRANSCRIPT365_REQUEST_KEY, TRANSCRIPT365_SUBMIT_GUARD_KEY]);
    if (Number.isInteger(tabId) && isTranscript365Url(tabUrl) && requestMatches) {
      void readSettings().then((settings) => {
        if (!settings.autoCloseTranscriptWindow) return;
        setTimeout(() => {
          if (Number.isInteger(windowId) && transcriptWorkerWindows.has(windowId)) {
            void closeTranscript365Safely(windowId, tabId);
          } else {
            chrome.tabs.remove(tabId).catch(() => {});
          }
        }, 80);
      });
    }
    return false;
  }

  if (message.type === "TRANSCRIPT365_RESULT_READY") {
    const tabId = _sender.tab?.id;
    const windowId = _sender.tab?.windowId;
    const tabUrl = _sender.tab?.url || "";
    const expectedRequestId = Number.isInteger(windowId) ? transcriptWorkerWindows.get(windowId) : "";
    const requestMatches = !expectedRequestId || expectedRequestId === String(message.requestId || "");
    sendResponse({ ok: true });
    chrome.storage.local.remove([TRANSCRIPT365_REQUEST_KEY, TRANSCRIPT365_SUBMIT_GUARD_KEY]);
    if (Number.isInteger(tabId) && isTranscript365Url(tabUrl) && requestMatches) {
      void readSettings().then((settings) => {
        if (!settings.autoCloseTranscriptWindow) return;
        setTimeout(() => {
          if (Number.isInteger(windowId) && transcriptWorkerWindows.has(windowId)) {
            void closeTranscript365Safely(windowId, tabId);
          } else {
            chrome.tabs.remove(tabId).catch(() => {});
          }
        }, 80);
      });
    }
    return false;
  }



  if (message.type === "TDT_1688_CAPTURE_VISIBLE_TAB") {
    captureVisibleTabFor1688(_sender)
      .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không chụp được màn hình TikTok." }));
    return true;
  }

  if (message.type === "TDT_1688_SEARCH_IMAGE") {
    open1688ImageSearch(String(message.dataUrl || ""), {
      imageUrl: message.imageUrl,
      sourceUrl: message.sourceUrl,
      sourceKind: message.sourceKind,
      videoTime: message.videoTime
    })
      .then((result) => {
        void recordRemoteUsage("imageSearch1688");
        sendResponse({ ok: true, ...result });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không mở được tìm kiếm ảnh 1688." }));
    return true;
  }

  if (message.type === "TDT_1688_GET_PENDING") {
    get1688PendingForSender(_sender)
      .then((pending) => sendResponse({ ok: Boolean(pending), pending, error: pending ? "" : "Không tìm thấy ảnh chờ tìm kiếm." }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không đọc được ảnh tìm kiếm." }));
    return true;
  }

  if (message.type === "TDT_1688_MARK_DONE") {
    complete1688Search(_sender, String(message.requestId || ""))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không dọn được dữ liệu ảnh tạm." }));
    return true;
  }

  if (message.type === "TDT_1688_UPLOAD_STATUS") {
    update1688PendingStatus(_sender, String(message.status || ""), String(message.error || ""))
      .then((found) => sendResponse({ ok: true, found }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không cập nhật được trạng thái tìm kiếm 1688." }));
    return true;
  }

  if (message.type === "TDT_1688_RESULT_STATUS") {
    get1688ResultStatus(String(message.requestId || ""))
      .then((result) => sendResponse({ ok: true, ready: Boolean(result), result: result || null }))
      .catch((error) => sendResponse({ ok: false, ready: false, error: error.message || "Không đọc được trạng thái kết quả 1688." }));
    return true;
  }

  if (message.type === "TDT_1688_RESULT_READY") {
    const tabId = Number.isInteger(_sender?.tab?.id) ? _sender.tab.id : null;
    if (!Number.isInteger(tabId)) {
      sendResponse({ ok: false, error: "Không xác định được tab kết quả 1688." });
      return false;
    }
    finalize1688ResultTab(tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không mở được tab kết quả 1688." }));
    return true;
  }

  if (message.type === "GET_VIDEO_INFO") {
    fetchVideoInfo(String(message.url || ""), { force: Boolean(message.force) })
      .then((data) => {
        void recordRemoteUsage("videoInfoRequests");
        sendResponse({ ok: true, data });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không thể lấy video." }));
    return true;
  }

  if (message.type === "TRANSLATE_SUBTITLES") {
    translateSubtitles(message.texts, String(message.targetLanguage || "vi"))
      .then((result) => {
        void recordRemoteUsage("subtitleTranslations");
        sendResponse({ ok: true, ...result });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không thể dịch phụ đề." }));
    return true;
  }

  if (message.type === "DOWNLOAD_VIDEO") {
    const videoUrl = String(message.videoUrl || "");
    if (!/^https:\/\//i.test(videoUrl)) {
      sendResponse({ ok: false, error: "Đường dẫn tải video không hợp lệ." });
      return false;
    }

    const filename = `TikTok/${safeFilename(message.filename)}.mp4`;
    chrome.downloads.download({ url: videoUrl, filename, saveAs: true }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      void recordRemoteUsage("downloads");
      sendResponse({ ok: true, downloadId });
    });
    return true;
  }

  return false;
}

async function ensureVerifiedRemoteAccess() {
  await remoteStateReady;
  if (remoteAccessLeaseValid()) return remoteAccessState;
  const stableBlocked = remoteAccessState.allowed === false
    && ["locked", "blacklisted", "not_whitelisted", "login_required"].includes(remoteAccessState.status);
  if (stableBlocked && realtimeStreamsFresh()) {
    await applyVercelRealtimeDecision();
    if (Date.now() - Number(remoteAccessState.checkedAt || 0) < 5000) return remoteAccessState;
  }
  return syncRemoteAccess(true);
}

function sendRemoteBlocked(sendResponse) {
  sendResponse({
    ok: false,
    locked: true,
    error: remoteAccessState.reason || "Extension chưa được Vercel cấp quyền sử dụng.",
    state: { ...remoteAccessState }
  });
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message?.type !== "TDT_GOOGLE_AUTH_RESULT_V3") return false;
  void (async () => {
    let senderOrigin = "";
    try { senderOrigin = new URL(sender?.url || "").origin; } catch (_error) { /* Invalid sender below. */ }
    if (!GOOGLE_AUTH_PAGE_ORIGINS.has(senderOrigin)) {
      throw new Error("Nguồn trả kết quả đăng nhập không hợp lệ.");
    }
    const nonce = String(message.nonce || "").trim().toLowerCase();
    const stored = await authSessionGet({ [GOOGLE_AUTH_PENDING_KEY]: null });
    const pending = stored[GOOGLE_AUTH_PENDING_KEY];
    if (!pending || pending.extensionId !== chrome.runtime.id || pending.nonce !== nonce || Date.now() - Number(pending.createdAt || 0) > 190_000) {
      throw new Error("Phiên đăng nhập đã hết hạn hoặc mã xác minh không đúng.");
    }
    const result = message.ok === true
      ? {
          ok: true,
          nonce,
          idToken: String(message.idToken || ""),
          refreshToken: String(message.refreshToken || ""),
          uid: String(message.uid || ""),
          expiresIn: Math.max(300, Number(message.expiresIn) || 3600),
          email: String(message.email || "").slice(0, 320),
          displayName: String(message.displayName || "").slice(0, 200),
          photoURL: String(message.photoURL || "").slice(0, 1500),
          receivedAt: Date.now()
        }
      : {
          ok: false,
          nonce,
          error: String(message.error || "Đăng nhập Google thất bại.").slice(0, 700),
          receivedAt: Date.now()
        };
    if (result.ok && (!result.idToken || !result.refreshToken || !result.uid)) {
      throw new Error("Kết quả Vercel thiếu ID token, refresh token hoặc UID.");
    }
    await authSessionSet({ [GOOGLE_AUTH_RESULT_KEY]: result });
    sendResponse({ ok: true });
  })().catch((error) => sendResponse({ ok: false, error: error?.message || "Không nhận được kết quả đăng nhập." }));
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return false;
  if (message.target === "tdt-google-auth-offscreen") return false;

  if (message.type === "KALODATA_VIDEO_ANALYTICS") {
    void fetchKaloDataVideoAnalytics(message.videoId, { force: message.force === true })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "Không gọi được Kalodata API." }));
    return true;
  }

  if (message.type === "ECHOTIK_VIDEO_ANALYTICS") {
    void fetchEchoTikVideoAnalytics(message.videoId, { force: message.force === true })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "Không gọi được EchoTik API." }));
    return true;
  }

  if (message.type === "PRIVATE_UPDATE_GET") {
    void getPrivateUpdateState()
      .then(async ({ state, settings }) => sendResponse({ ok: true, state: await reconcilePrivateUpdateDownload(state), settings, config: { enabled: PRIVATE_UPDATE_CONFIG.enabled, manifestUrl: PRIVATE_UPDATE_CONFIG.manifestUrl } }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không đọc được trạng thái cập nhật." }));
    return true;
  }

  if (message.type === "PRIVATE_UPDATE_CHECK") {
    void checkPrivateUpdate(true)
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không kiểm tra được cập nhật." }));
    return true;
  }

  if (message.type === "PRIVATE_UPDATE_APPLY") {
    void applyPrivateUpdate()
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không thể áp dụng cập nhật." }));
    return true;
  }

  if (message.type === "PRIVATE_UPDATE_SET_AUTO_DOWNLOAD") {
    void (async () => {
      const autoDownload = message.autoDownload !== false;
      await proxyStorageSet({ [PRIVATE_UPDATE_SETTINGS_KEY]: { autoDownload } });
      const { state } = await getPrivateUpdateState();
      if (autoDownload && state.available && state.downloadUrl && state.downloadedVersion !== state.latestVersion) {
        const next = await downloadPrivateUpdatePackage(state, false);
        sendResponse({ ok: true, state: next, settings: { autoDownload } });
        return;
      }
      sendResponse({ ok: true, state, settings: { autoDownload } });
    })().catch((error) => sendResponse({ ok: false, error: error.message || "Không lưu được cài đặt cập nhật." }));
    return true;
  }

  if (message.type === "PRIVATE_UPDATE_OPEN_RELEASE") {
    void (async () => {
      const { state } = await getPrivateUpdateState();
      const url = privateUpdateTrustedUrl(state.releasePageUrl || PRIVATE_UPDATE_CONFIG.releasePageUrl, true);
      if (!url) throw new Error("Chưa cấu hình trang phát hành.");
      await new Promise((resolve, reject) => chrome.tabs.create({ url }, () => chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve()));
      sendResponse({ ok: true });
    })().catch((error) => sendResponse({ ok: false, error: error.message || "Không mở được trang phát hành." }));
    return true;
  }

  if (message.type === "AUTH_STATUS_GET") {
    void getStoredVercelAuth()
      .then(async (storedAuth) => {
        const publicAuth = publicAuthState(storedAuth);
        if (!publicAuth.signedIn) {
          sendResponse({ ok: true, auth: publicAuth, state: { ...remoteAccessState, allowed: false, status: "login_required", reason: "Đăng nhập Google để sử dụng extension." } });
          return;
        }
        // Trả trạng thái đã đăng nhập ngay từ refresh token bền vững. Việc làm mới
        // idToken chạy sau, tránh popup nhảy về màn hình đăng nhập khi mạng chập chờn.
        sendResponse({ ok: true, auth: publicAuth, state: { ...effectiveRemoteAccessState(remoteAccessState) } });
        void getVercelAuth(false).then(async () => {
          await syncRemoteAccess(false);
          await runOnlineSync("auth-status", false).catch(() => {});
        }).catch(() => {});
      })
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không đọc được trạng thái đăng nhập." }));
    return true;
  }

  if (message.type === "AUTH_GOOGLE_SIGN_IN") {
    void signInWithGoogle()
      .then((auth) => sendResponse({ ok: true, auth: publicAuthState(auth), state: { ...remoteAccessState } }))
      .catch((error) => sendResponse({ ok: false, error: String(error.message || "Đăng nhập Google thất bại.").replace(/^LOGIN_REQUIRED:\s*/, "") }));
    return true;
  }

  if (message.type === "AUTH_SIGN_OUT") {
    void (async () => {
      vercelRealtimeGeneration += 1;
      stopVercelRealtime();
      await new Promise((resolve) => chrome.storage.local.remove([FIREBASE_AUTH_KEY, FIREBASE_AUTH_LAST_OK_KEY], resolve));
      const state = await storeRemoteAccessState({
        ...DEFAULT_REMOTE_ACCESS_STATE,
        clientId: await getRemoteClientId(),
        checkedAt: Date.now(),
        status: "login_required",
        reason: "Đăng nhập Google để sử dụng extension.",
        source: "signed-out"
      });
      const syncMeta = await getOnlineSyncMeta();
      await storeOnlineSyncMeta({ ...syncMeta, status: "signed_out", reason: "Đăng nhập Google để đồng bộ online.", accountUid: "", accountEmail: "", error: "" });
      sendResponse({ ok: true, auth: publicAuthState({}), state });
    })().catch((error) => sendResponse({ ok: false, error: error.message || "Không thể đăng xuất." }));
    return true;
  }

  if (message.type === "ONLINE_SYNC_GET_STATUS") {
    void getOnlineSyncMeta()
      .then((meta) => sendResponse({ ok: true, sync: onlineSyncPublicStatus(meta) }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không đọc được trạng thái đồng bộ." }));
    return true;
  }

  if (message.type === "ONLINE_SYNC_NOW") {
    void runOnlineSync("manual", true)
      .then((sync) => sendResponse({ ok: true, sync }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không thể đồng bộ online.", sync: error.syncStatus || null }));
    return true;
  }

  if (message.type === "ONLINE_SYNC_SET_ENABLED") {
    void getOnlineSyncMeta().then(async (meta) => {
      const enabled = message.enabled !== false;
      const next = await storeOnlineSyncMeta({ ...meta, enabled, status: enabled ? "pending" : "disabled", reason: enabled ? "Đang chờ đồng bộ." : "Đã tắt đồng bộ online.", error: "" });
      if (enabled) void runOnlineSync("enabled", true).catch(() => {});
      sendResponse({ ok: true, sync: onlineSyncPublicStatus(next) });
    }).catch((error) => sendResponse({ ok: false, error: error.message || "Không lưu được cài đặt đồng bộ." }));
    return true;
  }

  if (message.type === "REMOTE_ACCESS_GET") {
    void remoteStateReady.then(async () => {
      await ensureVerifiedRemoteAccess();
      sendResponse({ ok: true, state: { ...effectiveRemoteAccessState(remoteAccessState) } });
    }).catch((error) => sendResponse({ ok: false, error: error.message || "Không thể kiểm tra quyền sử dụng." }));
    return true;
  }

  if (message.type === "REMOTE_ACCESS_REFRESH") {
    void syncRemoteAccess(true)
      .then((state) => sendResponse({ ok: true, state: { ...effectiveRemoteAccessState(state) } }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không thể kiểm tra quyền sử dụng." }));
    return true;
  }

  if (message.type === "REMOTE_USAGE_EVENT") {
    void recordRemoteUsage(String(message.counter || ""), message.amount)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Không thể ghi thống kê." }));
    return true;
  }

  if (["CLOSE_TRANSCRIPT365_BACKGROUND", "TRANSCRIPT365_NO_SUB_READY", "TRANSCRIPT365_RESULT_READY"].includes(message.type)) {
    return handleRuntimeMessage(message, sender, sendResponse);
  }

  void ensureVerifiedRemoteAccess()
    .then((state) => {
      if (state.allowed !== true || !remoteAccessLeaseValid(state)) {
        sendRemoteBlocked(sendResponse);
        return;
      }
      handleRuntimeMessage(message, sender, sendResponse);
    })
    .catch((error) => sendResponse({ ok: false, locked: true, error: error.message || "Không thể xác minh quyền sử dụng." }));
  return true;
});
