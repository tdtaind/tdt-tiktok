(() => {
  "use strict";

  if (window.top !== window.self || window.__TDT_SEARCH_FILTER_HOOK_V11__) return;
  window.__TDT_SEARCH_FILTER_HOOK_V11__ = true;

  const SOURCE = "tdt-search-filter-hook";
  const REQUEST_SOURCE = "tdt-search-filter-ui";
  const PRODUCT_SOURCE = "tdt-tiktok-product-hook";
  const PRODUCT_REQUEST_SOURCE = "tdt-tiktok-product-ui";
  const MEDIA_SOURCE = "tdt-tiktok-media-hook";
  const MEDIA_REQUEST_SOURCE = "tdt-tiktok-media-ui";
  const SEARCH_URL_RE = /(?:\/api\/[^?#]*(?:search|search_item)|search\/(?:general|item|full|video)|\/search(?:\/|\?|$)|[?&](?:keyword|search_id|search_type)=)/i;
  const VIDEO_DATA_URL_RE = /(?:\/api\/[^?#]*(?:item|post|feed|recommend|detail|related|search)|aweme|video\/detail|item_list)/i;
  const MAX_WALK_NODES = 8000;
  const MAX_ITEMS_PER_BATCH = 220;
  const MAX_CACHE_ITEMS = 3000;
  const statsCache = new Map();
  const productCache = new Map();
  const mediaCache = new Map();
  const scannedEmbeddedPayloads = new WeakSet();
  const scannedEmbeddedScripts = new WeakMap();
  let lastEmbeddedScanAt = 0;

  function count(value) {
    if (value && typeof value === 'object') value = value.value ?? value.count ?? value.total ?? null;
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const number = Number(String(value ?? '').replace(/[,_\s]/g, '').trim());
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function timestamp(value) {
    let number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return null;
    if (number < 10_000_000_000) number *= 1000;
    return number > 946684800000 && number < 4102444800000 ? number : null;
  }

  function normalizeCandidate(object) {
    if (!object || typeof object !== "object" || Array.isArray(object)) return null;
    const nestedItem = object.item || object.itemStruct || object.item_struct
      || object.itemInfo?.itemStruct || object.itemInfo?.item_struct
      || object.item_info?.itemStruct || object.item_info?.item_struct
      || object.aweme_info || object.awemeInfo || object.awemeDetail || null;
    const statsSources = [
      object.stats, object.statistics, object.statsV2, object.statisticsV2, object.statistic,
      nestedItem?.stats, nestedItem?.statistics, nestedItem?.statsV2, nestedItem?.statisticsV2,
      object.video?.stats, object.video?.statistics,
      object
    ].filter((value) => value && typeof value === 'object' && !Array.isArray(value));
    const readCount = (...keys) => {
      for (const source of statsSources) {
        for (const key of keys) {
          const parsed = count(source[key]);
          if (parsed !== null) return parsed;
        }
      }
      return null;
    };

    const id = String(
      object.id || object.itemId || object.item_id || object.awemeId || object.aweme_id || object.videoId || object.video_id
      || nestedItem?.id || nestedItem?.itemId || nestedItem?.item_id || nestedItem?.awemeId || nestedItem?.aweme_id || ""
    ).match(/\d{8,}/)?.[0] || "";
    if (!id) return null;

    const views = readCount('playCount', 'play_count', 'viewCount', 'view_count', 'views');
    const likes = readCount('diggCount', 'digg_count', 'likeCount', 'like_count', 'likes');
    const comments = readCount('commentCount', 'comment_count', 'comments');
    const shares = readCount('shareCount', 'share_count', 'shares');
    const saves = readCount('collectCount', 'collect_count', 'favoriteCount', 'favorite_count', 'favorites');
    if ([views, likes, comments, shares, saves].every((value) => value === null)) return null;

    const dateTs = timestamp(object.createTime ?? object.create_time ?? object.createTimestamp ?? object.create_timestamp
      ?? nestedItem?.createTime ?? nestedItem?.create_time ?? object.video?.createTime);
    const title = String(object.desc ?? object.description ?? object.title ?? nestedItem?.desc ?? nestedItem?.description ?? object.video?.desc ?? '').trim().slice(0, 1200);

    return { id, views, likes, comments, shares, saves, dateTs, title };
  }


  function cleanUrl(value) {
    const text = String(value || "").trim().replace(/\\u0026/g, "&");
    if (!/^https?:\/\//i.test(text)) return "";
    try { return new URL(text).href; } catch { return text; }
  }

  function urlFromAddress(value) {
    if (!value) return "";
    if (typeof value === "string") return cleanUrl(value);
    if (Array.isArray(value)) {
      for (const item of value) {
        const url = urlFromAddress(item);
        if (url) return url;
      }
      return "";
    }
    if (typeof value !== "object") return "";
    for (const key of ["urlList", "url_list", "UrlList", "src", "url", "URL", "playUrl", "play_url"]) {
      const url = urlFromAddress(value[key]);
      if (url) return url;
    }
    return "";
  }

  function normalizeMediaCandidate(object) {
    if (!object || typeof object !== "object" || Array.isArray(object)) return null;
    const item = object.item || object.itemStruct || object.item_struct
      || object.itemInfo?.itemStruct || object.itemInfo?.item_struct
      || object.item_info?.itemStruct || object.item_info?.item_struct
      || object.aweme_info || object.awemeInfo || object.awemeDetail || object;
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const id = String(item.id || item.itemId || item.item_id || item.awemeId || item.aweme_id || item.videoId || item.video_id || "").match(/\d{8,}/)?.[0] || "";
    const media = item.video || item.videoInfo || item.video_info || object.video || null;
    if (!id || !media || typeof media !== "object" || Array.isArray(media)) return null;

    const bitrateEntries = [
      ...(Array.isArray(media.bitRate) ? media.bitRate : []),
      ...(Array.isArray(media.bit_rate) ? media.bit_rate : []),
      ...(Array.isArray(media.bitrateInfo) ? media.bitrateInfo : []),
      ...(Array.isArray(media.bitrate_info) ? media.bitrate_info : [])
    ];
    const ranked = [];
    for (const entry of bitrateEntries) {
      if (!entry || typeof entry !== "object") continue;
      const url = urlFromAddress(entry.playAddr || entry.play_addr || entry.PlayAddr || entry.urlList || entry.url_list || entry);
      if (!url) continue;
      const bitrate = Number(entry.bitRate ?? entry.bit_rate ?? entry.Bitrate ?? entry.bitrate ?? 0) || 0;
      const width = Number(entry.width ?? entry.Width ?? entry.playAddr?.width ?? 0) || 0;
      const height = Number(entry.height ?? entry.Height ?? entry.playAddr?.height ?? 0) || 0;
      ranked.push({ url, bitrate, width, height });
    }
    ranked.sort((a, b) => (b.bitrate - a.bitrate) || (b.width * b.height - a.width * a.height));
    const direct = [
      media.downloadAddr, media.download_addr, media.DownloadAddr,
      media.playAddr, media.play_addr, media.PlayAddr,
      media.playApi, media.play_api, media.playUrl, media.play_url
    ].map(urlFromAddress).find(Boolean) || "";
    const selected = ranked[0] || (direct ? { url: direct, bitrate: 0, width: Number(media.width) || 0, height: Number(media.height) || 0 } : null);
    if (!selected?.url) return null;

    const author = item.author || item.authorInfo || item.author_info || {};
    const stats = item.stats || item.statistics || item.statsV2 || item.statisticsV2 || {};
    const title = String(item.desc || item.description || item.title || "").trim().slice(0, 2200);
    const countValue = (...keys) => {
      for (const key of keys) {
        const parsed = count(stats[key]);
        if (parsed !== null) return parsed;
      }
      return 0;
    };
    return {
      videoId: id,
      videoUrl: selected.url,
      bitrate: selected.bitrate,
      width: selected.width || Number(media.width) || 0,
      height: selected.height || Number(media.height) || 0,
      duration: Number(media.duration) || 0,
      createTime: Number(item.createTime || item.create_time) || 0,
      title,
      author: String(author.uniqueId || author.unique_id || author.nickname || ""),
      authorInfo: {
        uniqueId: String(author.uniqueId || author.unique_id || ""),
        nickname: String(author.nickname || ""),
        verified: author.verified === true || author.verified === 1
      },
      stats: {
        views: countValue("playCount", "play_count", "viewCount", "view_count"),
        likes: countValue("diggCount", "digg_count", "likeCount", "like_count"),
        comments: countValue("commentCount", "comment_count"),
        shares: countValue("shareCount", "share_count"),
        saves: countValue("collectCount", "collect_count", "favoriteCount", "favorite_count")
      },
      hashtags: Array.from(new Set(title.match(/#[\p{L}\p{N}_]+/gu) || [])),
      source: "tiktok-feed-hd",
      exact: true,
      downloadable: true
    };
  }

  function extractPayloadData(payload, { collectStats = true, collectProducts = true, collectMedia = true } = {}) {
    const result = new Map();
    const products = new Map();
    const mediaItems = new Map();
    if (!collectStats && !collectProducts && !collectMedia) return { items: [], products: [], media: [] };
    const stack = [payload];
    const visited = new WeakSet();
    let walked = 0;

    const needsMore = () => (collectStats && result.size < MAX_ITEMS_PER_BATCH)
      || (collectProducts && products.size < MAX_ITEMS_PER_BATCH)
      || (collectMedia && mediaItems.size < MAX_ITEMS_PER_BATCH);
    while (stack.length && walked < MAX_WALK_NODES && needsMore()) {
      const value = stack.pop();
      if (!value || typeof value !== "object") continue;
      if (visited.has(value)) continue;
      visited.add(value);
      walked += 1;

      // Search statistics are expensive to normalize. Never do this work on
      // Home/Profile/Video routes where only product anchors are consumed.
      if (collectStats && result.size < MAX_ITEMS_PER_BATCH) {
        const candidate = normalizeCandidate(value);
        if (candidate) result.set(candidate.id, candidate);
      }

      if (collectMedia && mediaItems.size < MAX_ITEMS_PER_BATCH) {
        const mediaCandidate = normalizeMediaCandidate(value);
        if (mediaCandidate) mediaItems.set(mediaCandidate.videoId, mediaCandidate);
      }

      if (collectProducts && products.size < MAX_ITEMS_PER_BATCH) {
        const nested = value.item || value.itemStruct || value.item_struct || value.itemInfo?.itemStruct || value.item_info?.item_struct || value.aweme_info || value.awemeInfo || null;
        const productCandidate = nested && typeof nested === "object" ? nested : value;
        const videoId = String(productCandidate.id || productCandidate.itemId || productCandidate.item_id || productCandidate.awemeId || productCandidate.aweme_id || "").match(/\d{8,}/)?.[0] || "";
        const anchors = Array.isArray(productCandidate.anchors) ? productCandidate.anchors : Array.isArray(productCandidate.anchor_list) ? productCandidate.anchor_list : null;
        if (videoId && anchors?.length && (productCandidate.isECVideo || anchors.some((anchor) => anchor?.type === 33 || /product_id|anchor_shop|TikTok Shop/i.test(String(anchor?.extra || ""))))) {
          products.set(videoId, { videoId, anchors });
        }
      }

      if (Array.isArray(value)) {
        for (let index = value.length - 1; index >= 0; index -= 1) stack.push(value[index]);
      } else {
        for (const child of Object.values(value)) {
          if (child && typeof child === "object") stack.push(child);
        }
      }
    }
    return { items: Array.from(result.values()), products: Array.from(products.values()), media: Array.from(mediaItems.values()) };
  }

  function postItems(items) {
    for (let index = 0; index < items.length; index += MAX_ITEMS_PER_BATCH) {
      window.postMessage({ source: SOURCE, type: "stats", items: items.slice(index, index + MAX_ITEMS_PER_BATCH) }, "*");
    }
  }

  function cacheItems(items) {
    for (const item of items) {
      const previous = statsCache.get(item.id) || {};
      const merged = { id: item.id };
      for (const key of ["views", "likes", "comments", "shares", "saves", "dateTs", "title"]) {
        merged[key] = item[key] === null || item[key] === undefined || item[key] === '' ? previous[key] ?? item[key] : item[key];
      }
      statsCache.set(item.id, merged);
      if (statsCache.size > MAX_CACHE_ITEMS) statsCache.delete(statsCache.keys().next().value);
    }
  }

  function isSearchRoute() {
    return location.pathname.startsWith("/search");
  }

  function publish(payload, options = {}) {
    try {
      const extracted = extractPayloadData(payload, options);
      if (extracted.products.length) {
        for (const item of extracted.products) productCache.set(item.videoId, item);
        window.postMessage({ source:PRODUCT_SOURCE, type:"products", items:extracted.products }, "*");
      }
      if (extracted.media.length) {
        for (const item of extracted.media) {
          mediaCache.set(item.videoId, item);
          if (mediaCache.size > MAX_CACHE_ITEMS) mediaCache.delete(mediaCache.keys().next().value);
        }
        window.postMessage({ source:MEDIA_SOURCE, type:"media", items:extracted.media }, "*");
      }
      if (extracted.items.length) {
        cacheItems(extracted.items);
        postItems(extracted.items.map((item) => statsCache.get(item.id)));
      }
    } catch {}
  }

  function scanEmbeddedSearchData() {
    const now = Date.now();
    if (now - lastEmbeddedScanAt < 1200) return;
    lastEmbeddedScanAt = now;
    for (const payload of [
      window.__UNIVERSAL_DATA_FOR_REHYDRATION__,
      window.SIGI_STATE,
      window.__NEXT_DATA__
    ]) {
      if (payload && typeof payload === 'object' && !scannedEmbeddedPayloads.has(payload)) {
        scannedEmbeddedPayloads.add(payload);
        publish(payload, { collectStats: isSearchRoute(), collectProducts: true, collectMedia: true });
      }
    }
    document.querySelectorAll('script[type="application/json"],script#__UNIVERSAL_DATA_FOR_REHYDRATION__').forEach((script) => {
      const text = String(script.textContent || '').trim();
      if (!text || text.length > 12_000_000 || !/(?:stats|statistics|playCount|commentCount|shareCount|product_id|anchor_shop|playAddr|play_addr|bitRate|bit_rate)/i.test(text)) return;
      const signature = `${text.length}:${text.slice(0, 96)}:${text.slice(-96)}`;
      if (scannedEmbeddedScripts.get(script) === signature) return;
      scannedEmbeddedScripts.set(script, signature);
      try { publish(JSON.parse(text), { collectStats: isSearchRoute(), collectProducts: true, collectMedia: true }); } catch {}
    });
  }

  window.addEventListener("message", (event) => {
    if (event.source === window && event.data?.source === MEDIA_REQUEST_SOURCE && event.data?.type === "request-media") {
      scanEmbeddedSearchData();
      const id = String(event.data.videoId || "");
      const items = id ? [mediaCache.get(id)].filter(Boolean) : Array.from(mediaCache.values());
      if (items.length) window.postMessage({ source:MEDIA_SOURCE, type:"media", items }, "*");
      return;
    }
    if (event.source === window && event.data?.source === PRODUCT_REQUEST_SOURCE && event.data?.type === "request-products") {
      scanEmbeddedSearchData();
      const id = String(event.data.videoId || "");
      const items = id ? [productCache.get(id)].filter(Boolean) : Array.from(productCache.values());
      if (items.length) window.postMessage({ source:PRODUCT_SOURCE, type:"products", items }, "*");
      return;
    }
    if (event.source !== window || event.data?.source !== REQUEST_SOURCE || event.data?.type !== "request-stats") return;
    scanEmbeddedSearchData();
    const ids = Array.isArray(event.data.ids) ? new Set(event.data.ids.map(String)) : null;
    const items = ids?.size
      ? Array.from(ids, (id) => statsCache.get(id)).filter(Boolean)
      : Array.from(statsCache.values());
    if (items.length) postItems(items);
  });

  function isSearchRequest(input) {
    try {
      const url = typeof input === "string" ? input : input?.url || input?.href;
      return SEARCH_URL_RE.test(String(url || ""));
    } catch {
      return false;
    }
  }

  function isVideoDataRequest(input) {
    try { return VIDEO_DATA_URL_RE.test(String(typeof input === "string" ? input : input?.url || input?.href || "")); }
    catch { return false; }
  }

  const nativeFetch = window.fetch;
  if (typeof nativeFetch === "function") {
    window.fetch = function (...args) {
      const responsePromise = nativeFetch.apply(this, args);
      const searchRequest = isSearchRequest(args[0]);
      const videoRequest = isVideoDataRequest(args[0]);
      if (!searchRequest && !videoRequest) return responsePromise;
      responsePromise.then((response) => {
        try {
          const options = { collectStats: searchRequest || isSearchRoute(), collectProducts: videoRequest, collectMedia: videoRequest };
          response.clone().json().then((payload) => publish(payload, options)).catch(() => {});
        } catch {}
      }).catch(() => {});
      return responsePromise;
    };
  }

  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__tdtSearchUrl = String(url || "");
    this.__tdtSearchRequest = isSearchRequest(this.__tdtSearchUrl);
    this.__tdtVideoRequest = isVideoDataRequest(this.__tdtSearchUrl);
    return nativeOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    if (!this.__tdtSearchRequest && !this.__tdtVideoRequest) return nativeSend.apply(this, args);
    this.addEventListener("load", () => {
      try {
        const options = { collectStats: this.__tdtSearchRequest || isSearchRoute(), collectProducts: this.__tdtVideoRequest, collectMedia: this.__tdtVideoRequest };
        if (this.responseType === "json") publish(this.response, options);
        else if (!this.responseType || this.responseType === "text") publish(JSON.parse(this.responseText), options);
      } catch {}
    }, { once: true });
    return nativeSend.apply(this, args);
  };
})();
