"use strict";

(() => {
  const STORAGE_TO_WIRE = Object.freeze({
    tdt_settings_v17: "settings",
    tdt_subtitle_font_size: "fontSize",
    tdt_search_translate_settings_v1: "searchTranslate",
    tdt_search_filter_settings_v251: "searchFilter",
    tdt_watch_analytics_v1: "watchAnalytics",
    tdt_video_stats_position_v4: "videoStatsPosition",
    tdt_private_update_settings_v1: "privateUpdateSettings"
  });
  const WIRE_TO_STORAGE = Object.freeze(Object.fromEntries(Object.entries(STORAGE_TO_WIRE).map(([storage, wire]) => [wire, storage])));
  const WATCH_HISTORY_LIMIT = 200;

  function clone(value, fallback = null) {
    try { return structuredClone(value); } catch (_error) {
      try { return JSON.parse(JSON.stringify(value)); } catch (_secondError) { return fallback; }
    }
  }

  function uniqueStrings(values, limit = 10000) {
    const result = [];
    const seen = new Set();
    for (const value of Array.isArray(values) ? values : []) {
      const normalized = String(value || "").trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(normalized);
    }
    return result.slice(-limit);
  }

  function normalizeWatch(value) {
    const source = value && typeof value === "object" ? value : {};
    const days = {};
    for (const [key, day] of Object.entries(source.days && typeof source.days === "object" ? source.days : {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !day || typeof day !== "object") continue;
      days[key] = {
        watchedSeconds: Math.max(0, Math.floor(Number(day.watchedSeconds) || 0)),
        videoIds: uniqueStrings(day.videoIds, 2000)
      };
    }
    const history = (Array.isArray(source.history) ? source.history : [])
      .filter((item) => item && typeof item === "object" && String(item.videoId || "").trim())
      .map((item) => ({ ...clone(item, {}), videoId: String(item.videoId), watchedSeconds: Math.max(0, Math.floor(Number(item.watchedSeconds) || 0)), firstWatchedAt: Math.max(0, Number(item.firstWatchedAt) || 0), lastWatchedAt: Math.max(0, Number(item.lastWatchedAt) || 0) }))
      .sort((a, b) => b.lastWatchedAt - a.lastWatchedAt)
      .slice(0, WATCH_HISTORY_LIMIT);
    return {
      version: 1,
      updatedAt: Math.max(0, Number(source.updatedAt) || 0),
      totalWatchedSeconds: Math.max(0, Math.floor(Number(source.totalWatchedSeconds) || 0)),
      allTimeVideoIds: uniqueStrings(source.allTimeVideoIds, 10000),
      days,
      history
    };
  }

  function mergeHistoryItem(current, incoming) {
    if (!current) return incoming;
    if (!incoming) return current;
    const newer = Number(incoming.lastWatchedAt || 0) >= Number(current.lastWatchedAt || 0) ? incoming : current;
    const positiveFirst = [Number(current.firstWatchedAt) || 0, Number(incoming.firstWatchedAt) || 0].filter((value) => value > 0);
    return {
      ...current,
      ...incoming,
      ...newer,
      firstWatchedAt: positiveFirst.length ? Math.min(...positiveFirst) : 0,
      lastWatchedAt: Math.max(Number(current.lastWatchedAt) || 0, Number(incoming.lastWatchedAt) || 0),
      watchedSeconds: Math.max(Number(current.watchedSeconds) || 0, Number(incoming.watchedSeconds) || 0),
      hashtags: uniqueStrings([...(current.hashtags || []), ...(incoming.hashtags || [])], 30),
      products: Array.isArray(newer.products) ? newer.products.slice(0, 12) : []
    };
  }

  function compactWatch(value) {
    const source = normalizeWatch(value);
    const days = {};
    for (const [key, day] of Object.entries(source.days).sort((a, b) => a[0].localeCompare(b[0])).slice(-90)) {
      days[key] = { watchedSeconds: day.watchedSeconds, videoIds: uniqueStrings(day.videoIds, 120) };
    }
    const history = source.history.slice(0, 100).map((item) => ({
      ...item,
      url: String(item.url || "").slice(0, 700),
      author: String(item.author || "").slice(0, 120),
      caption: String(item.caption || "").slice(0, 500),
      thumbnail: String(item.thumbnail || "").slice(0, 900),
      hashtags: uniqueStrings(item.hashtags, 20),
      products: (Array.isArray(item.products) ? item.products : []).slice(0, 4).map((product) => ({
        id: String(product?.id || product?.productId || "").slice(0, 100),
        title: String(product?.title || product?.name || "").slice(0, 220),
        imageUrl: String(product?.imageUrl || product?.image || product?.cover || "").slice(0, 700),
        url: String(product?.url || product?.productUrl || product?.shopUrl || "").slice(0, 700),
        sellerId: String(product?.sellerId || "").slice(0, 100),
        skuId: String(product?.skuId || "").slice(0, 100)
      }))
    }));
    return {
      version: 1,
      updatedAt: source.updatedAt,
      totalWatchedSeconds: source.totalWatchedSeconds,
      allTimeVideoIds: uniqueStrings(source.allTimeVideoIds, 5000),
      days,
      history
    };
  }

  function mergeWatch(localValue, remoteValue) {
    const local = normalizeWatch(localValue);
    const remote = normalizeWatch(remoteValue);
    const days = { ...local.days };
    for (const [key, day] of Object.entries(remote.days)) {
      const previous = days[key] || { watchedSeconds: 0, videoIds: [] };
      days[key] = {
        watchedSeconds: Math.max(Number(previous.watchedSeconds) || 0, Number(day.watchedSeconds) || 0),
        videoIds: uniqueStrings([...(previous.videoIds || []), ...(day.videoIds || [])], 2000)
      };
    }
    const history = new Map();
    for (const item of [...local.history, ...remote.history]) history.set(item.videoId, mergeHistoryItem(history.get(item.videoId), item));
    return normalizeWatch({
      version: 1,
      updatedAt: Math.max(local.updatedAt, remote.updatedAt),
      totalWatchedSeconds: Math.max(local.totalWatchedSeconds, remote.totalWatchedSeconds),
      allTimeVideoIds: uniqueStrings([...local.allTimeVideoIds, ...remote.allTimeVideoIds], 10000),
      days,
      history: [...history.values()]
    });
  }

  function equal(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (_error) { return false; }
  }

  globalThis.TDT_ONLINE_SYNC_CORE = Object.freeze({ STORAGE_TO_WIRE, WIRE_TO_STORAGE, clone, normalizeWatch, compactWatch, mergeWatch, equal });
})();
