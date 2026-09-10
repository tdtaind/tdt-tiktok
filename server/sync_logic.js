"use strict";

export const SYNC_KEYS = Object.freeze([
  "settings",
  "fontSize",
  "searchTranslate",
  "searchFilter",
  "watchAnalytics",
  "videoStatsPosition",
  "privateUpdateSettings"
]);

const MAIN_KEYS = SYNC_KEYS.filter((key) => key !== "watchAnalytics");
const WATCH_HISTORY_LIMIT = 100;
const WATCH_ALL_TIME_LIMIT = 5000;
const WATCH_DAY_LIMIT = 90;
const WATCH_DAY_VIDEO_LIMIT = 120;

function number(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function text(value, maxLength = 500) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, maxLength);
}

function safeJson(value, options = {}, depth = 0) {
  const maxDepth = Math.max(1, Number(options.maxDepth) || 5);
  const maxArray = Math.max(1, Number(options.maxArray) || 100);
  const maxKeys = Math.max(1, Number(options.maxKeys) || 100);
  const maxString = Math.max(1, Number(options.maxString) || 1000);
  if (depth > maxDepth || value === null) return value === null ? null : undefined;
  if (typeof value === "string") return text(value, maxString);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (Array.isArray(value)) {
    return value.slice(0, maxArray).map((item) => safeJson(item, options, depth + 1)).filter((item) => item !== undefined);
  }
  if (!value || typeof value !== "object") return undefined;
  const result = {};
  for (const [rawKey, rawValue] of Object.entries(value).slice(0, maxKeys)) {
    const key = text(rawKey, 80).replace(/[.$#[\]/]/g, "_");
    if (!key || ["__proto__", "prototype", "constructor"].includes(key)) continue;
    const normalized = safeJson(rawValue, options, depth + 1);
    if (normalized !== undefined) result[key] = normalized;
  }
  return result;
}

function uniqueTextList(value, limit, itemMax = 80) {
  const result = [];
  const seen = new Set();
  for (const item of Array.isArray(value) ? value : []) {
    const normalized = text(item, itemMax).trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result.slice(-limit);
}

function normalizeStats(value) {
  const source = value && typeof value === "object" ? value : {};
  const result = {};
  for (const key of ["views", "likes", "comments", "shares", "saves", "downloads", "er"]) {
    if (source[key] !== undefined) result[key] = number(source[key], 0, 1_000_000_000_000);
  }
  return result;
}

function normalizeMusic(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    title: text(source.title || source.name, 180),
    author: text(source.author || source.artist, 120)
  };
}

function normalizeProduct(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    id: text(source.id || source.productId, 100),
    title: text(source.title || source.name, 220),
    imageUrl: text(source.imageUrl || source.image || source.cover, 700),
    url: text(source.url || source.productUrl || source.shopUrl, 700),
    sellerId: text(source.sellerId, 100),
    skuId: text(source.skuId, 100)
  };
}

function normalizeHistoryItem(value) {
  const source = value && typeof value === "object" ? value : {};
  const videoId = text(source.videoId, 100).trim();
  if (!videoId) return null;
  return {
    videoId,
    url: text(source.url, 700),
    author: text(source.author, 120),
    caption: text(source.caption, 500),
    thumbnail: text(source.thumbnail, 900),
    duration: number(source.duration, 0, 86_400),
    firstWatchedAt: number(source.firstWatchedAt, 0),
    lastWatchedAt: number(source.lastWatchedAt, 0),
    watchedSeconds: Math.floor(number(source.watchedSeconds, 0, 31_536_000)),
    stats: normalizeStats(source.stats),
    music: normalizeMusic(source.music),
    hashtags: uniqueTextList(source.hashtags, 20, 80),
    products: (Array.isArray(source.products) ? source.products : []).slice(0, 4).map(normalizeProduct)
  };
}

export function normalizeWatchAnalytics(value) {
  const source = value && typeof value === "object" ? value : {};
  const days = {};
  const dayEntries = Object.entries(source.days && typeof source.days === "object" ? source.days : {})
    .filter(([key, day]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && day && typeof day === "object")
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-WATCH_DAY_LIMIT);
  for (const [key, day] of dayEntries) {
    days[key] = {
      watchedSeconds: Math.floor(number(day.watchedSeconds, 0, 86_400)),
      videoIds: uniqueTextList(day.videoIds, WATCH_DAY_VIDEO_LIMIT, 100)
    };
  }
  const history = (Array.isArray(source.history) ? source.history : [])
    .map(normalizeHistoryItem)
    .filter(Boolean)
    .sort((a, b) => b.lastWatchedAt - a.lastWatchedAt)
    .slice(0, WATCH_HISTORY_LIMIT);
  return {
    version: 1,
    totalWatchedSeconds: Math.floor(number(source.totalWatchedSeconds, 0, 315_360_000)),
    allTimeVideoIds: uniqueTextList(source.allTimeVideoIds, WATCH_ALL_TIME_LIMIT, 100),
    days,
    history
  };
}

function mergeHistoryItem(current, incoming) {
  if (!current) return incoming;
  if (!incoming) return current;
  const newer = Number(incoming.lastWatchedAt || 0) >= Number(current.lastWatchedAt || 0) ? incoming : current;
  return {
    ...current,
    ...newer,
    firstWatchedAt: Math.min(...[current.firstWatchedAt, incoming.firstWatchedAt].filter((value) => Number(value) > 0)),
    lastWatchedAt: Math.max(Number(current.lastWatchedAt) || 0, Number(incoming.lastWatchedAt) || 0),
    watchedSeconds: Math.max(Number(current.watchedSeconds) || 0, Number(incoming.watchedSeconds) || 0),
    hashtags: uniqueTextList([...(current.hashtags || []), ...(incoming.hashtags || [])], 20, 80),
    products: (newer.products || current.products || incoming.products || []).slice(0, 4)
  };
}

export function mergeWatchAnalytics(currentValue, incomingValue) {
  const current = normalizeWatchAnalytics(currentValue);
  const incoming = normalizeWatchAnalytics(incomingValue);
  const days = { ...current.days };
  for (const [key, day] of Object.entries(incoming.days)) {
    const previous = days[key] || { watchedSeconds: 0, videoIds: [] };
    days[key] = {
      watchedSeconds: Math.max(Number(previous.watchedSeconds) || 0, Number(day.watchedSeconds) || 0),
      videoIds: uniqueTextList([...(previous.videoIds || []), ...(day.videoIds || [])], WATCH_DAY_VIDEO_LIMIT, 100)
    };
  }
  const historyMap = new Map();
  for (const item of [...current.history, ...incoming.history]) {
    historyMap.set(item.videoId, mergeHistoryItem(historyMap.get(item.videoId), item));
  }
  return normalizeWatchAnalytics({
    version: 1,
    totalWatchedSeconds: Math.max(current.totalWatchedSeconds, incoming.totalWatchedSeconds),
    allTimeVideoIds: uniqueTextList([...current.allTimeVideoIds, ...incoming.allTimeVideoIds], WATCH_ALL_TIME_LIMIT, 100),
    days,
    history: [...historyMap.values()]
  });
}

export function normalizeSyncPayload(value) {
  const source = value && typeof value === "object" ? value : {};
  const data = source.data && typeof source.data === "object" ? source.data : {};
  const modified = source.modifiedAtByKey && typeof source.modifiedAtByKey === "object" ? source.modifiedAtByKey : {};
  const presentKeys = SYNC_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(data, key));
  return {
    firstSync: source.firstSync === true,
    presentKeys,
    data: {
      settings: safeJson(data.settings, { maxDepth: 5, maxArray: 32, maxKeys: 80, maxString: 500 }) || {},
      fontSize: Math.round(number(data.fontSize, 12, 64)),
      searchTranslate: safeJson(data.searchTranslate, { maxDepth: 4, maxArray: 32, maxKeys: 60, maxString: 500 }) || {},
      searchFilter: safeJson(data.searchFilter, { maxDepth: 4, maxArray: 64, maxKeys: 80, maxString: 500 }) || {},
      watchAnalytics: normalizeWatchAnalytics(data.watchAnalytics),
      videoStatsPosition: safeJson(data.videoStatsPosition, { maxDepth: 2, maxArray: 8, maxKeys: 12, maxString: 100 }) || {},
      privateUpdateSettings: safeJson(data.privateUpdateSettings, { maxDepth: 2, maxArray: 8, maxKeys: 12, maxString: 100 }) || {}
    },
    modifiedAtByKey: Object.fromEntries(SYNC_KEYS.map((key) => [key, Math.floor(number(modified[key], 0))]))
  };
}

export function mergeMainSyncDocument(currentValue, incomingPayload, now = Date.now()) {
  const current = currentValue && typeof currentValue === "object" ? currentValue : {};
  const incoming = normalizeSyncPayload(incomingPayload);
  const currentData = current.data && typeof current.data === "object" ? current.data : {};
  const currentModified = current.modifiedAtByKey && typeof current.modifiedAtByKey === "object" ? current.modifiedAtByKey : {};
  const data = { ...currentData };
  const modifiedAtByKey = { ...currentModified };
  for (const key of MAIN_KEYS) {
    if (!incoming.presentKeys.includes(key)) continue;
    const hasCurrent = Object.prototype.hasOwnProperty.call(currentData, key);
    const incomingAt = Number(incoming.modifiedAtByKey[key]) || 0;
    const currentAt = Number(currentModified[key]) || 0;
    if (!hasCurrent || (!incoming.firstSync && incomingAt >= currentAt)) {
      data[key] = incoming.data[key];
      modifiedAtByKey[key] = Math.max(incomingAt, now);
    }
  }
  return {
    schemaVersion: 1,
    data,
    modifiedAtByKey,
    revision: Math.max(0, Number(current.revision) || 0) + 1,
    createdAt: Number(current.createdAt) || now,
    updatedAt: now
  };
}

export function publicSyncPayload(mainValue, watchValue, profile = {}) {
  const main = mainValue && typeof mainValue === "object" ? mainValue : {};
  const watch = watchValue && typeof watchValue === "object" ? watchValue : {};
  const modifiedAtByKey = { ...(main.modifiedAtByKey || {}), watchAnalytics: Number(watch.updatedAt) || 0 };
  return {
    schemaVersion: 1,
    revision: Math.max(Number(main.revision) || 0, Number(watch.revision) || 0),
    updatedAt: Math.max(Number(main.updatedAt) || 0, Number(watch.updatedAt) || 0),
    modifiedAtByKey,
    account: {
      uid: text(profile.uid, 128),
      email: text(profile.email, 254),
      displayName: text(profile.displayName, 120),
      photoURL: text(profile.photoURL, 700)
    },
    data: {
      ...(main.data || {}),
      watchAnalytics: normalizeWatchAnalytics(watch.data)
    }
  };
}
