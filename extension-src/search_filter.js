(() => {
  "use strict";

  if (window.top !== window.self || globalThis.__TDT_TIKTOK_SEARCH_FILTER_V300__) return;
  globalThis.__TDT_TIKTOK_SEARCH_FILTER_V300__ = true;

  const STORAGE_KEY = "tdt_search_filter_settings_v251";
  const LEGACY_KEY = "tdt_search_filter_settings_v1";
  const SOURCE = "tdt-search-filter-hook";
  const REQUEST_SOURCE = "tdt-search-filter-ui";
  const REMOTE_ACCESS_STATE_KEY = "tdt_remote_access_state_v1";
  const MAX_STATS = 3000;
  const SEARCH_INPUT_SELECTOR = 'input[data-e2e="search-user-input"],form[data-e2e="search-box"] input,input[name="q"]';
  // TikTok Search mixes regular videos and photo/carousel posts in the same
  // result grid. Both kinds must participate in one filter/sort operation.
  const SEARCH_ITEM_LINK_SELECTOR = 'a[href*="/video/"],a[href*="/photo/"]';
  const SEARCH_CARD_SELECTOR = [
    '[data-e2e="search_top-item"]',
    '[data-e2e="search-video-item"]',
    '[data-e2e="search-video-card"]',
    '[data-e2e="search_top-video-item"]',
    '[data-testid*="video-card" i]',
    '[class*="DivItemContainerForSearch"]',
    '[class*="SearchVideoItem"]'
  ].join(',');
  const SORT_KEYS = new Set(["default", "date_desc", "date_asc", "views", "likes", "comments", "shares", "saves", "er"]);
  const TYPE_KEYS = new Set(["all", "video", "photo"]);
  const DEFAULTS = Object.freeze({
    enabled: true,
    type: "all",
    keyword: "",
    startDate: "",
    endDate: "",
    minViews: null,
    maxViews: null,
    minLikes: null,
    maxLikes: null,
    minComments: null,
    maxComments: null,
    minShares: null,
    maxShares: null,
    minSaves: null,
    maxSaves: null,
    minER: null,
    maxER: null,
    sortBy: "default",
    sortDirection: "desc"
  });

  let settings = { ...DEFAULTS };
  let remoteAccessLocked = true;
  let remoteAccessLeaseTimer = null;
  let host = null;
  let shadow = null;
  let applyTimer = null;
  let routeTimer = null;
  let uiRefreshFrame = 0;
  let applying = false;
  let suspendFiltering = false;
  let loadingMore = false;
  let loadMoreToken = 0;
  let statsRevision = 0;
  let stabilizationToken = 0;
  let manualScrollTimer = null;
  let manualScrollToken = 0;
  let lastSearchVideoSignature = '';
  let originalOrderCounter = 0;
  let internalMoveClearTimer = null;
  const statsById = new Map();
  const wrapperOrder = new WeakMap();
  const wrapperOriginalDisplay = new WeakMap();
  const wrapperVideoId = new WeakMap();
  const wrapperHome = new WeakMap();
  const projectedWrappers = new Set();
  let cardDomCache = new WeakMap();
  let internalMoveBatch = new Set();
  const refs = {};

  function isSearchPage() {
    return location.hostname.endsWith("tiktok.com") && location.pathname.startsWith("/search");
  }

  function numberOrNull(value, max = Number.MAX_SAFE_INTEGER) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(String(value).replace(/%/g, "").trim());
    return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, max)) : null;
  }

  function normalizeSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    const text = (key) => String(source[key] ?? "").trim();
    const numeric = (key, max = Number.MAX_SAFE_INTEGER) => numberOrNull(source[key], max);
    const normalized = {
      enabled: source.enabled !== false,
      type: TYPE_KEYS.has(source.type) ? source.type : DEFAULTS.type,
      keyword: text("keyword"),
      startDate: /^\d{4}-\d{2}-\d{2}$/.test(text("startDate")) ? text("startDate") : "",
      endDate: /^\d{4}-\d{2}-\d{2}$/.test(text("endDate")) ? text("endDate") : "",
      minViews: numeric("minViews"),
      maxViews: numeric("maxViews"),
      minLikes: numeric("minLikes"),
      maxLikes: numeric("maxLikes"),
      minComments: numeric("minComments"),
      maxComments: numeric("maxComments"),
      minShares: numeric("minShares"),
      maxShares: numeric("maxShares"),
      minSaves: numeric("minSaves"),
      maxSaves: numeric("maxSaves"),
      minER: numeric("minER", 1000),
      maxER: numeric("maxER", 1000),
      sortBy: SORT_KEYS.has(source.sortBy) ? source.sortBy : DEFAULTS.sortBy,
      sortDirection: source.sortDirection === "asc" ? "asc" : "desc"
    };
    for (const [minKey, maxKey] of [
      ["minViews", "maxViews"], ["minLikes", "maxLikes"], ["minComments", "maxComments"],
      ["minShares", "maxShares"], ["minSaves", "maxSaves"], ["minER", "maxER"]
    ]) {
      if (normalized[minKey] !== null && normalized[maxKey] !== null && normalized[minKey] > normalized[maxKey]) {
        [normalized[minKey], normalized[maxKey]] = [normalized[maxKey], normalized[minKey]];
      }
    }
    return normalized;
  }

  function storageGet(key, fallback) {
    return new Promise((resolve) => chrome.storage.local.get({ [key]: fallback }, (result) => {
      if (chrome.runtime.lastError) {
        resolve(fallback);
        return;
      }
      resolve(result?.[key] ?? fallback);
    }));
  }

  function storageSet() {
    return new Promise((resolve) => chrome.storage.local.set({ [STORAGE_KEY]: settings }, () => {
      void chrome.runtime.lastError;
      resolve();
    }));
  }

  function applyTrustedRemoteAccess(state) {
    remoteAccessLocked = !(state?.allowed === true && Number(state?.leaseExpiresAt) > Date.now());
    clearTimeout(remoteAccessLeaseTimer);
    remoteAccessLeaseTimer = null;
    if (!remoteAccessLocked) {
      remoteAccessLeaseTimer = setTimeout(() => applyTrustedRemoteAccess(null), Math.max(250, Number(state.leaseExpiresAt) - Date.now() + 100));
    }
    if (remoteAccessLocked) {
      restoreProjectedWrappers();
      getCardRecords().forEach(restoreRecord);
      if (host) host.style.display = 'none';
    }
    updateRoute();
  }

  function refreshRemoteAccess() {
    chrome.runtime.sendMessage({ type: "REMOTE_ACCESS_GET" }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) return applyTrustedRemoteAccess(null);
      applyTrustedRemoteAccess(response.state);
    });
  }

  function parseCompactNumber(value) {
    const raw = String(value || "")
      .trim()
      .replace(/\s+/g, "")
      .replace(/triệu/gi, "M")
      .replace(/tỷ/gi, "B")
      .replace(/tr(?=$|[^a-z])/gi, "M")
      .replace(/n(?=$|[^a-z])/gi, "K");
    if (!raw) return null;
    const match = raw.replace(/%/g, "").match(/(\d[\d.,]*)(?:\s*)([KMBT])?/i);
    if (!match) return null;
    const suffix = String(match[2] || "").toUpperCase();
    let numeric = match[1];
    if (suffix) {
      const lastComma = numeric.lastIndexOf(",");
      const lastDot = numeric.lastIndexOf(".");
      const decimalIndex = Math.max(lastComma, lastDot);
      if (decimalIndex >= 0) {
        numeric = `${numeric.slice(0, decimalIndex).replace(/[.,]/g, "")}.${numeric.slice(decimalIndex + 1).replace(/[.,]/g, "")}`;
      }
    } else if (numeric.includes(",") || numeric.includes(".")) {
      const separators = numeric.match(/[.,]/g) || [];
      const groups = numeric.split(/[.,]/);
      const looksGrouped = groups.length > 1 && groups.slice(1).every((group) => group.length === 3);
      if (looksGrouped || separators.length > 1) numeric = numeric.replace(/[.,]/g, "");
      else {
        const separatorIndex = Math.max(numeric.lastIndexOf(","), numeric.lastIndexOf("."));
        numeric = `${numeric.slice(0, separatorIndex)}.${numeric.slice(separatorIndex + 1)}`;
      }
    }
    const parsed = Number(numeric);
    if (!Number.isFinite(parsed)) return null;
    const multiplier = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[suffix] || 1;
    return Math.max(0, parsed * multiplier);
  }

  function formatCompact(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    if (number >= 1e9) return `${(number / 1e9).toFixed(number >= 1e10 ? 0 : 1).replace(/\.0$/, "")}B`;
    if (number >= 1e6) return `${(number / 1e6).toFixed(number >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`;
    if (number >= 1e3) return `${(number / 1e3).toFixed(number >= 1e4 ? 0 : 1).replace(/\.0$/, "")}K`;
    return String(Math.round(number));
  }

  function searchItemFromHref(href) {
    const match = String(href || "").match(/\/(video|photo)\/(\d+)/);
    return match ? { type: match[1], id: match[2] } : null;
  }

  function getCardTitle(item) {
    const candidates = [
      '[data-e2e="search-card-desc"]',
      '[data-e2e="search-video-desc"]',
      '[data-e2e="search-card-title"]',
      '[data-e2e="search-card-video-caption"]',
      '[data-e2e="search-card-video-text"]',
      '[class*="DivDescription"]',
      'img[alt]',
      'a[title]'
    ];
    for (const selector of candidates) {
      const node = item.querySelector(selector);
      const text = node?.getAttribute?.('alt') || node?.getAttribute?.('title') || node?.textContent || '';
      if (String(text).trim()) return String(text).trim();
    }
    return String(item.textContent || '').trim();
  }

  function parseDateCandidate(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    let match = raw.match(/(20\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
    if (match) {
      const y = Number(match[1]);
      const m = Number(match[2]) - 1;
      const d = Number(match[3]);
      const ts = new Date(y, m, d).getTime();
      return Number.isFinite(ts) ? ts : null;
    }
    match = raw.match(/(^|\s)(\d{1,2})-(\d{1,2})(\s|$)/);
    if (match) {
      const now = new Date();
      const y = now.getFullYear();
      const m = Number(match[2]) - 1;
      const d = Number(match[3]);
      const ts = new Date(y, m, d).getTime();
      return Number.isFinite(ts) ? ts : null;
    }
    return null;
  }

  function getCardDateTs(item) {
    const texts = [];
    item.querySelectorAll('span,div,time').forEach((node) => {
      const text = String(node.textContent || '').trim();
      if (text) texts.push(text);
    });
    for (const text of texts) {
      const ts = parseDateCandidate(text);
      if (ts) return ts;
    }
    return null;
  }

  function searchItemIdsWithin(element) {
    if (!(element instanceof Element)) return [];
    const ids = new Set();
    if (element.matches?.(SEARCH_ITEM_LINK_SELECTOR)) {
      const ownItem = searchItemFromHref(element.getAttribute?.('href') || element.href);
      if (ownItem?.id) ids.add(ownItem.id);
    }
    element.querySelectorAll?.(SEARCH_ITEM_LINK_SELECTOR).forEach((link) => {
      const searchItem = searchItemFromHref(link.getAttribute?.('href') || link.href);
      if (searchItem?.id) ids.add(searchItem.id);
    });
    return Array.from(ids);
  }

  function directVideoCardChildren(container, cache = null) {
    if (!(container instanceof Element)) return [];
    if (cache?.has(container)) return cache.get(container);
    const children = Array.from(container.children).filter((child) => {
      // A real result wrapper represents one post. Higher layout sections can
      // contain an entire grid (many IDs) and must never be mistaken for one
      // card, otherwise only the first post of each section is filterable.
      return searchItemIdsWithin(child).length === 1;
    });
    cache?.set(container, children);
    return children;
  }

  function findSearchCardStructure(anchor, directCardsCache = null) {
    if (!(anchor instanceof Element)) return null;
    const explicitItem = anchor.closest(SEARCH_CARD_SELECTOR);
    const item = explicitItem || anchor.closest('li,article') || anchor.parentElement || anchor;
    let wrapper = item;
    for (let depth = 0; wrapper?.parentElement && depth < 10; depth += 1) {
      const container = wrapper.parentElement;
      const directCards = directVideoCardChildren(container, directCardsCache);
      // Use the nearest list/grid with at least two one-post children. Choosing
      // a higher ancestor by child count selects whole result sections and
      // collapses dozens of posts into a single record after TikTok loads more.
      if (directCards.includes(wrapper) && directCards.length >= 2) return { item, wrapper, container };
      if (container === document.body || container === document.documentElement) break;
      wrapper = container;
    }
    if (explicitItem?.parentElement) {
      return { item: explicitItem, wrapper: explicitItem, container: explicitItem.parentElement };
    }
    return null;
  }

  function restoreWrapperOrder(wrapper) {
    const original = wrapperOriginalDisplay.get(wrapper);
    if (original?.orderValue) wrapper.style.setProperty('order', original.orderValue, original.orderPriority || '');
    else wrapper.style.removeProperty('order');
  }

  function restoreWrapperDisplay(wrapper) {
    const original = wrapperOriginalDisplay.get(wrapper);
    if (original?.value && original.value !== 'none') wrapper.style.setProperty('display', original.value, original.priority || '');
    else wrapper.style.removeProperty('display');
  }

  function markInternalMoves(wrappers) {
    for (const wrapper of wrappers) internalMoveBatch.add(wrapper);
    clearTimeout(internalMoveClearTimer);
    internalMoveClearTimer = setTimeout(() => { internalMoveBatch = new Set(); }, 0);
  }

  function rememberWrapperHome(wrapper) {
    if (wrapperHome.has(wrapper) || !wrapper?.parentElement) return;
    wrapperHome.set(wrapper, {
      parent: wrapper.parentElement,
      nextSibling: wrapper.nextSibling,
      index: Array.prototype.indexOf.call(wrapper.parentElement.children, wrapper)
    });
  }

  function restoreProjectedWrappers() {
    const tracked = Array.from(projectedWrappers, (wrapper) => ({ wrapper, home: wrapperHome.get(wrapper) }));
    const entries = tracked
      .filter(({ wrapper, home }) => wrapper?.isConnected && home?.parent?.isConnected);
    for (const { wrapper } of tracked) {
      if (!wrapper?.isConnected || !wrapperHome.get(wrapper)?.parent?.isConnected) {
        projectedWrappers.delete(wrapper);
        wrapperHome.delete(wrapper);
      }
    }
    if (!entries.length) {
      projectedWrappers.clear();
      return 0;
    }
    markInternalMoves(entries.map(({ wrapper }) => wrapper));
    const byParent = new Map();
    for (const entry of entries) {
      if (!byParent.has(entry.home.parent)) byParent.set(entry.home.parent, []);
      byParent.get(entry.home.parent).push(entry);
    }
    for (const [parent, group] of byParent) {
      group.sort((a, b) => b.home.index - a.home.index);
      for (const { wrapper, home } of group) {
        let reference = home.nextSibling?.parentNode === parent ? home.nextSibling : null;
        if (!reference) reference = parent.children[Math.max(0, home.index)] || null;
        if (wrapper.parentNode !== parent || wrapper.nextSibling !== reference) parent.insertBefore(wrapper, reference);
      }
    }
    for (const { wrapper } of entries) {
      projectedWrappers.delete(wrapper);
      wrapperHome.delete(wrapper);
    }
    return entries.length;
  }

  function compareRecords(a, b) {
    if (settings.sortBy === 'default') return a.order - b.order;
    const aValue = metricValue(a, settings.sortBy);
    const bValue = metricValue(b, settings.sortBy);
    const aKnown = aValue >= 0;
    const bKnown = bValue >= 0;
    if (aKnown !== bKnown) return aKnown ? -1 : 1;
    if (!aKnown && !bKnown) return a.order - b.order;
    const delta = aValue - bValue;
    if (delta === 0) return a.order - b.order;
    const direction = (settings.sortBy === 'date_asc' || settings.sortDirection === 'asc') ? 1 : -1;
    return delta * direction;
  }

  function projectSortedRecords(sorted) {
    const connected = sorted.filter((record) => record.wrapper?.isConnected && record.container?.isConnected);
    if (connected.length < 2) return false;
    const containerCounts = new Map();
    for (const record of connected) containerCounts.set(record.container, (containerCounts.get(record.container) || 0) + 1);
    const primaryEntry = Array.from(containerCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    const primaryContainer = primaryEntry?.[0];
    if (!primaryContainer?.isConnected || Number(primaryEntry?.[1] || 0) < 2) return false;

    const connectedWrappers = new Set(connected.map((record) => record.wrapper));
    const current = Array.from(primaryContainer.children).filter((child) => connectedWrappers.has(child));
    const alreadyProjected = connected.every((record) => record.wrapper.parentElement === primaryContainer);
    const alreadySorted = alreadyProjected && connected.every((record, index) => current[index] === record.wrapper);
    if (alreadySorted) return false;

    for (const record of connected) rememberWrapperHome(record.wrapper);
    markInternalMoves(connected.map((record) => record.wrapper));
    for (const record of connected) {
      primaryContainer.appendChild(record.wrapper);
      projectedWrappers.add(record.wrapper);
    }
    return true;
  }

  function prepareWrapperForVideo(wrapper, id) {
    const previousId = wrapperVideoId.get(wrapper);
    if (previousId && previousId !== id) {
      restoreWrapperDisplay(wrapper);
      restoreWrapperOrder(wrapper);
      delete wrapper.dataset.tdtFilteredOut;
      wrapperOriginalDisplay.delete(wrapper);
      wrapperOrder.delete(wrapper);
    }
    wrapperVideoId.set(wrapper, id);
  }

  function getCardRecords() {
    const records = [];
    const seenWrappers = new WeakSet();
    const directCardsCache = new WeakMap();
    for (const anchor of document.querySelectorAll(SEARCH_ITEM_LINK_SELECTOR)) {
      const searchItem = searchItemFromHref(anchor.getAttribute?.('href') || anchor.href);
      if (!searchItem) continue;
      const { id, type } = searchItem;
      const structure = findSearchCardStructure(anchor, directCardsCache);
      if (!structure) continue;
      const { item, wrapper, container } = structure;
      if (!wrapper?.isConnected || !container?.isConnected) continue;
      if (seenWrappers.has(wrapper)) continue;
      seenWrappers.add(wrapper);
      prepareWrapperForVideo(wrapper, id);
      if (!wrapperOrder.has(wrapper)) wrapperOrder.set(wrapper, originalOrderCounter++);
      if (!wrapperOriginalDisplay.has(wrapper)) {
        const extensionHidden = wrapper.dataset.tdtFilteredOut === '1';
        wrapperOriginalDisplay.set(wrapper, {
          value: extensionHidden ? '' : wrapper.style.getPropertyValue('display'),
          priority: extensionHidden ? '' : (wrapper.style.getPropertyPriority?.('display') || ''),
          orderValue: wrapper.style.getPropertyValue('order'),
          orderPriority: wrapper.style.getPropertyPriority?.('order') || ''
        });
      }
      let domData = cardDomCache.get(item);
      if (!domData || domData.id !== id) {
        const metricText = (selector) => {
          const node = item.querySelector(selector);
          return String(node?.textContent || node?.getAttribute?.('aria-label') || node?.getAttribute?.('title') || '');
        };
        // Despite its legacy name, `video-views` is the number beside the heart
        // on current TikTok search cards. Treating it as views made Likes sorting
        // depend entirely on API data and fail for newly loaded/photo posts.
        domData = {
          id,
          views: parseCompactNumber(metricText('[data-e2e="video-view-count"],[data-e2e="view-count"],[data-e2e="play-count"]')),
          likes: parseCompactNumber(metricText('[data-e2e="video-views"],[data-e2e="search-card-like-count"],[data-e2e*="like-count" i],[aria-label*="like" i],[aria-label*="thích" i]')),
          comments: parseCompactNumber(metricText('[data-e2e*="comment-count" i],[aria-label*="comment" i],[aria-label*="bình luận" i]')),
          shares: parseCompactNumber(metricText('[data-e2e*="share-count" i],[aria-label*="share" i],[aria-label*="chia sẻ" i]')),
          saves: parseCompactNumber(metricText('[data-e2e*="collect-count" i],[data-e2e*="save-count" i],[aria-label*="save" i],[aria-label*="lưu" i]')),
          dateTs: getCardDateTs(item),
          title: getCardTitle(item)
        };
        cardDomCache.set(item, domData);
      }
      const stats = statsById.get(id) || {};
      const views = Number.isFinite(stats.views) ? stats.views : domData.views;
      const likes = Number.isFinite(stats.likes) ? stats.likes : domData.likes;
      const comments = Number.isFinite(stats.comments) ? stats.comments : domData.comments;
      const shares = Number.isFinite(stats.shares) ? stats.shares : domData.shares;
      const saves = Number.isFinite(stats.saves) ? stats.saves : domData.saves;
      const er = views > 0 && [likes, comments, shares, saves].some(Number.isFinite)
        ? ((likes || 0) + (comments || 0) + (shares || 0) + (saves || 0)) / views * 100
        : null;
      const dateTs = Number.isFinite(stats.dateTs) ? stats.dateTs : domData.dateTs;
      const title = String(stats.title || domData.title || '').trim();
      records.push({
        id,
        type,
        item,
        wrapper,
        container,
        views,
        likes,
        comments,
        shares,
        saves,
        er,
        title,
        dateTs,
        statsKnown: [views, likes, comments, shares, saves].some(Number.isFinite),
        order: wrapperOrder.get(wrapper)
      });
    }
    return records;
  }

  function metricValue(record, key) {
    if (key === 'default') return record.order;
    if (key === 'date_desc' || key === 'date_asc') return Number.isFinite(record.dateTs) ? record.dateTs : -1;
    const value = record[key];
    return Number.isFinite(value) ? value : -1;
  }

  function passesRange(value, min, max) {
    if (min === null && max === null) return true;
    // Khi người dùng đã đặt ngưỡng, card chưa có thống kê không được xem là
    // đạt điều kiện. Hook sẽ tự áp dụng lại ngay khi dữ liệu đến.
    if (!Number.isFinite(value)) return false;
    if (min !== null && value < min) return false;
    if (max !== null && value > max) return false;
    return true;
  }

  function passes(record) {
    if (settings.type !== 'all' && record.type !== settings.type) return false;
    if (settings.keyword) {
      const q = settings.keyword.toLowerCase();
      const haystack = `${record.title} ${record.item.textContent || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (settings.startDate || settings.endDate) {
      if (!Number.isFinite(record.dateTs)) return false;
      const startTs = settings.startDate ? new Date(settings.startDate + 'T00:00:00').getTime() : null;
      const endTs = settings.endDate ? new Date(settings.endDate + 'T23:59:59').getTime() : null;
      if (startTs !== null && record.dateTs < startTs) return false;
      if (endTs !== null && record.dateTs > endTs) return false;
    }
    if (!passesRange(record.views, settings.minViews, settings.maxViews)) return false;
    if (!passesRange(record.likes, settings.minLikes, settings.maxLikes)) return false;
    if (!passesRange(record.comments, settings.minComments, settings.maxComments)) return false;
    if (!passesRange(record.shares, settings.minShares, settings.maxShares)) return false;
    if (!passesRange(record.saves, settings.minSaves, settings.maxSaves)) return false;
    if (!passesRange(record.er, settings.minER, settings.maxER)) return false;
    return true;
  }

  function restoreRecord(record) {
    restoreWrapperDisplay(record.wrapper);
    delete record.wrapper.dataset.tdtFilteredOut;
  }

  function updateStatus(total, visible, known) {
    if (refs.totalCount) refs.totalCount.textContent = String(total);
    if (refs.status) {
      refs.status.textContent = `${visible}/${total}`;
      refs.status.title = `${visible} nội dung đạt bộ lọc · ${known}/${total} nội dung có thống kê`;
    }
    if (refs.info) refs.info.textContent = known ? `${known} nội dung đã có dữ liệu` : 'Đang đọc dữ liệu';
  }

  function activeFilterCount() {
    let count = 0;
    if (settings.type !== DEFAULTS.type) count += 1;
    if (settings.keyword) count += 1;
    if (settings.startDate || settings.endDate) count += 1;
    for (const key of ['minViews','maxViews','minLikes','maxLikes','minComments','maxComments','minShares','maxShares','minSaves','maxSaves','minER','maxER']) {
      if (settings[key] !== null) count += 1;
    }
    return count;
  }

  function updateFilterBadge() {
    if (!refs.filterButton) return;
    const count = activeFilterCount();
    refs.filterButton.dataset.count = count ? String(count) : '';
    refs.filterButton.dataset.active = String(count > 0);
    refs.filterButton.title = count ? `Mở bộ lọc · ${count} điều kiện đang bật` : 'Mở bộ lọc';
    if (refs.reapplyButton) {
      refs.reapplyButton.dataset.active = String(count > 0 || settings.sortBy !== DEFAULTS.sortBy);
      refs.reapplyButton.title = 'Đặt lại bộ lọc và chuyển về sắp xếp mặc định · Shift+click để lọc lại nội dung đã tải';
    }
  }

  async function resetAllFilters() {
    clearTimeout(applyTimer);
    clearTimeout(manualScrollTimer);
    manualScrollToken += 1;
    stabilizationToken += 1;
    restoreProjectedWrappers();
    settings = { ...DEFAULTS, enabled: true };
    if (refs.sortSelect) refs.sortSelect.value = DEFAULTS.sortBy;
    syncUiFromSettings();
    const records = getCardRecords();
    records.forEach((record) => {
      restoreRecord(record);
      restoreWrapperOrder(record.wrapper);
      wrapperOriginalDisplay.delete(record.wrapper);
      wrapperOrder.delete(record.wrapper);
      wrapperVideoId.delete(record.wrapper);
    });
    document.querySelectorAll('[data-tdt-filtered-out]').forEach((element) => {
      restoreWrapperDisplay(element);
      restoreWrapperOrder(element);
      delete element.dataset.tdtFilteredOut;
      wrapperOriginalDisplay.delete(element);
      wrapperOrder.delete(element);
      wrapperVideoId.delete(element);
    });
    originalOrderCounter = 0;
    await storageSet();
    applyFilters(true);
    stabilizeFilters();
    requestCachedStats();
    lastSearchVideoSignature = currentSearchVideoSignature();
    updateFilterBadge();
    if (refs.info) refs.info.textContent = 'Đã đặt lại toàn bộ bộ lọc';
  }

  async function reapplyLoadedResults() {
    clearTimeout(applyTimer);
    stabilizationToken += 1;
    restoreProjectedWrappers();
    const records = getCardRecords();
    for (const record of records) {
      restoreRecord(record);
      restoreWrapperOrder(record.wrapper);
    }
    if (refs.info) refs.info.textContent = `Đang lọc lại ${records.length} nội dung…`;
    await waitForStatsRefresh(460);
    applyFilters(true);
    stabilizeFilters();
    if (refs.info) refs.info.textContent = `Đã lọc lại ${records.length} nội dung`;
  }

  function applyFilters(force = false) {
    if (remoteAccessLocked || applying || (suspendFiltering && !force)) return;
    applying = true;
    try {
      if (!settings.enabled || settings.sortBy === 'default') restoreProjectedWrappers();
      const records = getCardRecords();
      if (!records.length) {
        updateStatus(0, 0, 0);
        return;
      }

      if (!settings.enabled) {
        records.forEach((record) => {
          restoreRecord(record);
          restoreWrapperOrder(record.wrapper);
        });
        updateStatus(records.length, records.length, records.filter((r) => r.statsKnown).length);
        return;
      }

      let visible = 0;
      for (const record of records) {
        const show = passes(record);
        record.wrapper.dataset.tdtFilteredOut = show ? '0' : '1';
        if (show) {
          restoreRecord(record);
          record.wrapper.dataset.tdtFilteredOut = '0';
          visible += 1;
        } else {
          record.wrapper.style.setProperty('display', 'none', 'important');
        }
      }

      const sorted = [...records].sort(compareRecords);
      if (settings.sortBy === 'default') {
        for (const record of records) restoreWrapperOrder(record.wrapper);
      } else {
        // KOLSprite-style projection: reorder the real direct children of the
        // TikTok result list. This is deterministic for every loaded batch and
        // does not depend on CSS grid/flex honoring the `order` property.
        for (const record of records) restoreWrapperOrder(record.wrapper);
        projectSortedRecords(sorted);
      }
      updateStatus(records.length, visible, records.filter((r) => r.statsKnown).length);
    } finally {
      applying = false;
    }
  }

  function scheduleApply(delay = 120) {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(() => requestAnimationFrame(applyFilters), delay);
  }

  function stabilizeFilters() {
    const token = ++stabilizationToken;
    if (!loadingMore) applyFilters(true);
    for (const delay of [100, 320, 850]) {
      setTimeout(() => {
        if (token !== stabilizationToken || loadingMore || !isSearchPage()) return;
        requestCachedStats();
        applyFilters();
      }, delay);
    }
  }

  function currentSearchItemIds() {
    const ids = new Set();
    document.querySelectorAll(SEARCH_ITEM_LINK_SELECTOR).forEach((link) => {
      const searchItem = searchItemFromHref(link.getAttribute?.('href') || link.href);
      if (searchItem?.id) ids.add(searchItem.id);
    });
    return Array.from(ids);
  }

  function currentSearchVideoSignature(ids = currentSearchItemIds()) {
    let hash = 2166136261;
    for (const id of ids) {
      for (let index = 0; index < id.length; index += 1) {
        hash ^= id.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
    }
    return `${ids.length}:${hash >>> 0}`;
  }

  function searchVideoLinkCount() {
    return currentSearchItemIds().length;
  }

  function requestCachedStats() {
    const ids = currentSearchItemIds();
    if (!ids.length) return;
    window.postMessage({ source: REQUEST_SOURCE, type: 'request-stats', ids }, '*');
  }

  function waitForStatsRefresh(timeoutMs = 420) {
    const initialRevision = statsRevision;
    requestCachedStats();
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const check = () => {
        if (statsRevision > initialRevision || Date.now() - startedAt >= timeoutMs) {
          resolve(statsRevision > initialRevision);
          return;
        }
        setTimeout(check, 40);
      };
      check();
    });
  }

  function scheduleManualScrollRefresh(delay = 180) {
    if (!isSearchPage() || loadingMore) return;
    clearTimeout(manualScrollTimer);
    const token = ++manualScrollToken;
    manualScrollTimer = setTimeout(async () => {
      if (token !== manualScrollToken || loadingMore || !isSearchPage()) return;
      const ids = currentSearchItemIds();
      const signature = currentSearchVideoSignature(ids);
      const cardsChanged = signature !== lastSearchVideoSignature;
      lastSearchVideoSignature = signature;
      if (cardsChanged) {
        applyFilters();
        await waitForStatsRefresh(360);
      }
      else requestCachedStats();
      if (token !== manualScrollToken || loadingMore || !isSearchPage()) return;
      stabilizeFilters();
    }, delay);
  }

  function findSearchScrollTarget() {
    const firstRecord = getCardRecords()[0];
    let node = firstRecord?.container || null;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      try {
        const style = getComputedStyle(node);
        if (/(?:auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 120) return node;
      } catch {}
    }
    return document.scrollingElement || document.documentElement;
  }

  function scrollSearchToBottom(target = findSearchScrollTarget()) {
    const top = Math.max(target?.scrollHeight || 0, document.documentElement.scrollHeight || 0, document.body?.scrollHeight || 0);
    if (target === document.scrollingElement || target === document.documentElement || target === document.body) {
      window.scrollTo({ top, behavior: 'auto' });
    } else if (target) {
      target.scrollTo({ top: target.scrollHeight, behavior: 'auto' });
    }
  }

  function searchScrollExtent(target = findSearchScrollTarget()) {
    if (target === document.scrollingElement || target === document.documentElement || target === document.body) {
      return Math.max(
        Number(document.scrollingElement?.scrollHeight || 0),
        Number(document.documentElement?.scrollHeight || 0),
        Number(document.body?.scrollHeight || 0)
      );
    }
    return Number(target?.scrollHeight || 0);
  }

  function lockSearchViewport() {
    const scrollTarget = findSearchScrollTarget();
    const windowLeft = Number(window.scrollX || document.documentElement.scrollLeft || 0);
    const windowTop = Number(window.scrollY || document.documentElement.scrollTop || 0);
    const targetTop = Number(scrollTarget?.scrollTop || 0);
    const originalHostStyle = host?.getAttribute?.('style') || '';
    const originalHostParent = host?.parentNode || null;
    const originalHostNextSibling = host?.nextSibling || null;
    let placeholder = null;
    let backdrop = null;

    if (host?.isConnected) {
      const rect = host.getBoundingClientRect();
      backdrop = document.createElement('div');
      backdrop.dataset.tdtSearchBackgroundScan = 'true';
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.style.cssText = 'position:fixed;inset:0;z-index:2147482999;background:rgba(3,6,12,.82);backdrop-filter:blur(3px);pointer-events:auto;cursor:progress;';
      (document.body || document.documentElement).appendChild(backdrop);
      placeholder = document.createElement('div');
      placeholder.dataset.tdtSearchFilterPlaceholder = 'true';
      placeholder.style.cssText = `display:block;width:${Math.max(1, rect.width)}px;height:${Math.max(1, rect.height)}px;visibility:hidden;pointer-events:none;`;
      host.insertAdjacentElement('beforebegin', placeholder);
      (document.body || document.documentElement).appendChild(host);
      host.style.setProperty('position', 'fixed', 'important');
      host.style.setProperty('left', `${Math.max(0, rect.left)}px`, 'important');
      const viewportHeight = Number(window.innerHeight || document.documentElement.clientHeight || 900);
      host.style.setProperty('top', `${Math.max(6, Math.min(rect.top, viewportHeight - rect.height - 6))}px`, 'important');
      host.style.setProperty('width', `${Math.max(1, rect.width)}px`, 'important');
      host.style.setProperty('z-index', '2147483000', 'important');
    }

    const restorePosition = () => {
      if (scrollTarget && scrollTarget !== document.scrollingElement && scrollTarget !== document.documentElement && scrollTarget !== document.body) {
        try { scrollTarget.scrollTo({ top: targetTop, behavior: 'auto' }); } catch { scrollTarget.scrollTop = targetTop; }
      }
      try { window.scrollTo({ left: windowLeft, top: windowTop, behavior: 'auto' }); } catch {}
    };

    return {
      scrollTarget,
      restorePosition,
      release() {
        restorePosition();
        if (host) host.setAttribute('style', originalHostStyle);
        if (host && originalHostParent?.isConnected) {
          if (originalHostNextSibling?.parentNode === originalHostParent) originalHostParent.insertBefore(host, originalHostNextSibling);
          else originalHostParent.appendChild(host);
        }
        placeholder?.remove();
        backdrop?.remove();
        requestAnimationFrame(restorePosition);
        setTimeout(restorePosition, 120);
      }
    };
  }

  function findNativeLoadMoreButton() {
    return Array.from(document.querySelectorAll('button,[role="button"]')).find((button) => {
      if (host?.contains?.(button)) return false;
      const text = String(button.textContent || button.getAttribute?.('aria-label') || '').replace(/\s+/g, ' ').trim();
      if (!/^(?:(?:tải|xem)\s*thêm|load\s*more)$/i.test(text)) return false;
      const rect = button.getBoundingClientRect();
      return rect.width > 20 && rect.height > 18;
    }) || null;
  }

  function waitForScanTick(delay = 650) {
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  function signalSearchAutoScroll(target) {
    scrollSearchToBottom(target);
    try { target?.dispatchEvent?.(new Event('scroll', { bubbles: true })); } catch {}
    try { window.dispatchEvent(new Event('scroll')); } catch {}
  }

  async function scanSearchResults(target, initialCount, token) {
    const startedAt = Date.now();
    const discoveredIds = new Set(currentSearchItemIds());
    let currentCount = Math.max(initialCount, discoveredIds.size);
    let lastGrowthAt = startedAt;
    let lastNativeClickAt = 0;
    let previousSignature = currentSearchVideoSignature();
    let previousExtent = searchScrollExtent(target);

    // KOLSprite-style auto-scroll: keep the real page at its current bottom,
    // allow each lazy-loaded batch to settle, then signal the new bottom. Stop
    // only after the result count has stayed unchanged for a sustained period.
    for (let tick = 0; tick < 120 && token === loadMoreToken; tick += 1) {
      signalSearchAutoScroll(target);
      await waitForScanTick(tick === 0 ? 760 : 620);
      if (token !== loadMoreToken) break;

      const currentIds = currentSearchItemIds();
      const nextSignature = currentSearchVideoSignature(currentIds);
      const nextExtent = searchScrollExtent(target);
      const before = discoveredIds.size;
      currentIds.forEach((id) => discoveredIds.add(id));
      const contentChanged = nextSignature !== previousSignature;
      const extentGrew = nextExtent > previousExtent + 80;
      previousSignature = nextSignature;
      previousExtent = Math.max(previousExtent, nextExtent);
      currentCount = Math.max(currentCount, discoveredIds.size, currentIds.length);
      if (discoveredIds.size > before || contentChanged || extentGrew) {
        lastGrowthAt = Date.now();
        requestCachedStats();
        if (refs.status) refs.status.textContent = `${currentCount} · đang quét`;
        if (refs.info) refs.info.textContent = `Đã quét ${currentCount} nội dung · đang chờ lô tiếp theo`;
        continue;
      }

      const now = Date.now();
      if (now - lastGrowthAt >= 1900 && now - lastNativeClickAt >= 2600) {
        const nativeButton = findNativeLoadMoreButton();
        if (nativeButton) {
          nativeButton.click();
          lastNativeClickAt = now;
        }
      }
      if (now - lastGrowthAt >= 6500 && now - startedAt >= 6500) break;
    }
    return Math.max(currentCount, discoveredIds.size);
  }

  async function loadMoreSearchVideos(button) {
    if (loadingMore) {
      loadMoreToken += 1;
      button.title = 'Đang dừng quét…';
      if (refs.status) refs.status.textContent = 'đang dừng…';
      return;
    }
    if (!isSearchPage()) return;
    restoreProjectedWrappers();
    loadingMore = true;
    suspendFiltering = true;
    const token = ++loadMoreToken;
    const initialCount = searchVideoLinkCount();
    let currentCount = initialCount;
    let loadError = false;
    const viewport = lockSearchViewport();
    getCardRecords().forEach(restoreRecord);
    button.disabled = false;
    button.dataset.loading = 'true';
    button.title = 'Đang tự cuộn quét nội dung · bấm lần nữa để dừng';
    if (refs.status) refs.status.textContent = 'đang quét…';
    try {
      currentCount = await scanSearchResults(viewport.scrollTarget, initialCount, token);
      if (token === loadMoreToken) await waitForStatsRefresh(620);
    } catch {
      loadError = true;
    } finally {
      const stopped = token !== loadMoreToken;
      suspendFiltering = false;
      loadingMore = false;
      stabilizeFilters();
      viewport.release();
      const added = Math.max(0, currentCount - initialCount);
      if (refs.info) refs.info.textContent = loadError
        ? 'Có lỗi khi quét thêm · bấm để thử lại'
        : stopped ? `Đã dừng · tải thêm ${added} nội dung và áp dụng bộ lọc`
          : added ? `Đã tải thêm ${added} nội dung và áp dụng bộ lọc` : 'Không còn nội dung mới để tải';
      button.title = loadError
        ? 'Quét thêm chưa hoàn tất · bấm để thử lại'
        : stopped ? `Đã dừng quét sau khi tải thêm ${added} nội dung · bấm để quét tiếp`
          : added ? `Đã tải thêm ${added} nội dung · bộ lọc đã được áp dụng` : 'Chưa tìm thấy nội dung mới · bấm để thử lại';
      button.disabled = false;
      button.dataset.loading = 'false';
      scheduleUiRefresh();
    }
  }

  function scheduleUiRefresh() {
    if (uiRefreshFrame || loadingMore) return;
    uiRefreshFrame = requestAnimationFrame(() => {
      uiRefreshFrame = 0;
      placeUiBelowTabs();
      updateSearchOverlapState();
      scheduleApply(140);
    });
  }

  function findSearchTabRow() {
    const buttons = Array.from(document.querySelectorAll('[data-testid="tux-web-tab-bar"]'));
    if (buttons.length < 2) return null;
    const labels = buttons.map((button) => String(button.textContent || '').trim().toLowerCase());
    const hasTop = labels.some((text) => /^(?:top|hàng đầu|tất cả)$/.test(text));
    const hasVideo = labels.some((text) => /video|videos/.test(text));
    if (!hasTop || !hasVideo) return null;
    const row = buttons[0].closest('[class*="tux-tabbar__item-container"]');
    if (row && buttons.every((button) => row.contains(button))) return row;
    let node = buttons[0].parentElement;
    while (node && node !== document.body) {
      if (buttons.every((button) => node.contains(button)) && node.getBoundingClientRect().width > 300) return node;
      node = node.parentElement;
    }
    return null;
  }

  function placeUiBelowTabs() {
    if (!host?.isConnected) return false;
    const anchor = findSearchTabRow();
    if (!anchor?.parentElement) return false;
    if (host.previousElementSibling !== anchor || host.parentElement !== anchor.parentElement) {
      anchor.insertAdjacentElement('afterend', host);
    }
    host.style.display = 'block';
    updateSearchOverlapState();
    return true;
  }

  function createTextInput(placeholder, key) {
    const input = document.createElement('input');
    input.className = 'sf-input';
    input.type = 'text';
    input.placeholder = placeholder;
    input.dataset.key = key;
    return input;
  }

  function createDateInput(key) {
    const input = document.createElement('input');
    input.className = 'sf-input';
    input.type = 'date';
    input.dataset.key = key;
    return input;
  }

  function createRangeBlock(label, minKey, maxKey, minPlaceholder, maxPlaceholder) {
    const block = document.createElement('div');
    block.className = 'sf-block';
    const title = document.createElement('div');
    title.className = 'sf-block-title';
    title.textContent = label;
    const row = document.createElement('div');
    row.className = 'sf-range-row';
    const min = createTextInput(minPlaceholder, minKey);
    const max = createTextInput(maxPlaceholder, maxKey);
    const sep = document.createElement('div');
    sep.className = 'sf-sep';
    sep.textContent = '~';
    row.append(min, sep, max);
    block.append(title, row);
    return block;
  }

  function isSearchExpanded() {
    const input = document.querySelector(SEARCH_INPUT_SELECTOR);
    if (!(input instanceof HTMLInputElement) || !input.isConnected) return false;
    if (document.activeElement === input) return true;
    if (input.getAttribute("aria-expanded") === "true") return true;
    const popupSelectors = [
      '[data-e2e="search-suggestion-container"]',
      '[data-e2e="search-suggestion-list"]',
      '[role="listbox"]'
    ];
    return popupSelectors.some((selector) => Array.from(document.querySelectorAll(selector)).some((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 120 && rect.height > 60 && style.display !== "none" && style.visibility !== "hidden";
    }));
  }

  function updateSearchOverlapState() {
    if (!host?.isConnected) return;
    const hidden = isSearchExpanded() && !refs.overlay?.classList.contains("open");
    host.style.visibility = hidden ? "hidden" : "visible";
    host.style.pointerEvents = hidden ? "none" : "auto";
    host.style.maxHeight = hidden ? "0px" : "none";
    host.style.overflow = hidden ? "hidden" : "visible";
  }

  function ensureUi() {
    if (host?.isConnected) {
      placeUiBelowTabs();
      return;
    }
    host = document.createElement('div');
    host.id = 'tdt-search-filter-host';
    host.style.cssText = 'all:initial;display:block;position:relative;width:100%;max-width:100%;z-index:120;box-sizing:border-box;';
    const anchor = findSearchTabRow();
    if (anchor?.parentElement) anchor.insertAdjacentElement('afterend', host); else document.documentElement.appendChild(host);
    shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host{all:initial;display:block;width:100%;max-width:100%;box-sizing:border-box}
      *{box-sizing:border-box;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
      button,input,select{font:inherit}
      #shell{padding:5px 0 7px}
      #toolbar{display:flex;align-items:center;gap:7px;flex-wrap:nowrap;padding:6px 8px;border-radius:12px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;background:linear-gradient(180deg,#0f1320,#0b0f1a);border:1px solid rgba(86,114,255,.16);box-shadow:0 9px 24px rgba(0,0,0,.24)}
      .summary{display:flex;align-items:center;gap:6px;min-width:126px;max-width:150px;padding:5px 7px;border-radius:10px;background:linear-gradient(180deg,rgba(13,18,32,.96),rgba(11,14,24,.98));border:1px solid rgba(79,119,255,.22);box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
      .summary-copy{display:flex;flex-direction:column;gap:0;min-width:0}.summary-title{font-size:11px;font-weight:800;letter-spacing:-.01em;color:#f7f9ff;white-space:nowrap}.summary-sub{display:none;font-size:8px;color:#7b8bb5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px}.summary-count{margin-left:auto;min-width:30px;height:30px;padding:0 7px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#10275d,#143587);color:#8fb0ff;font-size:15px;font-weight:900;letter-spacing:-.02em;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
      .toolbar-actions{display:flex;align-items:center;gap:7px;flex:1 1 auto;min-width:0}
      .icon-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:34px;height:34px;border:none;border-radius:10px;cursor:pointer;color:#fff;background:linear-gradient(180deg,#6691ff,#4b74ea);box-shadow:0 9px 22px rgba(75,116,234,.24);transition:transform .16s ease, filter .16s ease}.icon-btn:hover{filter:brightness(1.05)}.icon-btn:active{transform:scale(.98)}.icon-btn:disabled{cursor:wait;opacity:.62}
      .icon-btn svg{width:15px;height:15px;stroke:currentColor;stroke-width:2.2;fill:none;stroke-linecap:round;stroke-linejoin:round}
      .icon-btn[data-active="true"]{background:linear-gradient(180deg,#21a3d1,#1684b4)}.icon-btn[data-count]:not([data-count=""])::after{content:attr(data-count);position:absolute;right:-4px;top:-5px;display:grid;place-items:center;min-width:15px;height:15px;padding:0 3px;border-radius:999px;background:#fe2c55;color:#fff;font-size:8px;font-weight:900;border:1px solid #fff}
      #reapplyFilterBtn[data-active="false"]{background:linear-gradient(180deg,#36415d,#273149);box-shadow:none;opacity:.82}#reapplyFilterBtn[data-active="true"]{background:linear-gradient(180deg,#ff8a5c,#e85a36)}
      #loadMoreBtn[data-loading="true"] svg{animation:loadMoreBounce .72s ease-in-out infinite alternate}
      .sort-box{display:flex;align-items:center;gap:8px;flex:1 1 auto;height:34px;padding:0 10px;border-radius:10px;border:1px solid #5681ff;background:linear-gradient(180deg,#0c1227,#0a1121);box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
      .sort-box select{flex:1 1 auto;height:100%;border:none;background:transparent;color:#dce7ff;font-size:12px;font-weight:700;outline:none;appearance:none;min-width:0}.sort-box select option{color:#111}
      .sort-caret{color:#84a6ff;font-size:16px;line-height:1;pointer-events:none}
      .status-chip{flex:0 0 auto;min-width:38px;padding:0 2px;color:#17d1ff;font-size:10px;font-weight:800;text-align:right}
      #overlay{position:fixed;inset:0;display:none;align-items:flex-start;justify-content:center;padding:18px 12px;background:rgba(2,5,12,.72);z-index:9999}
      #toolbar::-webkit-scrollbar{display:none}
      #overlay.open{display:flex}
      .modal{width:min(620px,100%);max-height:calc(100vh - 36px);overflow:auto;border-radius:17px;background:#f6f7fb;border:1px solid rgba(0,0,0,.08);box-shadow:0 24px 64px rgba(0,0,0,.4);padding:15px 16px 14px}
      .modal::-webkit-scrollbar{width:10px}.modal::-webkit-scrollbar-thumb{background:#cfd4df;border-radius:999px}
      .modal-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px}.modal-title{font-size:22px;font-weight:900;color:#1b1d28;letter-spacing:-.02em}.close-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:none;border-radius:11px;background:#fff;color:#8a8f9b;cursor:pointer;box-shadow:0 6px 18px rgba(30,37,56,.08);font-size:20px;line-height:1}
      .sf-grid{display:grid;grid-template-columns:1fr;gap:9px}
      .sf-label{display:block;font-size:11px;font-weight:800;color:#555e71;margin:0 0 4px 3px}
      .sf-select,.sf-input{width:100%;height:40px;border:1px solid #d7dcea;border-radius:10px;background:#fff;padding:0 11px;color:#1e2435;font-size:13px;outline:none;transition:border-color .16s ease, box-shadow .16s ease}.sf-select:focus,.sf-input:focus{border-color:#5f8bff;box-shadow:0 0 0 3px rgba(95,139,255,.12)}
      .sf-row-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.sf-col{display:grid;gap:7px}.sf-block{display:flex;flex-direction:column}.sf-block-title{font-size:11px;font-weight:800;color:#555e71;margin:0 0 4px 3px}.sf-range-row{display:grid;grid-template-columns:minmax(0,1fr) 24px minmax(0,1fr);align-items:center;gap:7px}.sf-sep{text-align:center;font-size:18px;color:#666}.sf-date-row{display:grid;grid-template-columns:minmax(0,1fr) 24px minmax(0,1fr);align-items:center;gap:7px}
      .modal-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.ghost-btn,.primary-btn{height:38px;padding:0 18px;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer}.ghost-btn{border:1px solid #d7dcea;background:#fff;color:#2c3140}.primary-btn{border:none;background:linear-gradient(180deg,#6691ff,#4b74ea);color:#fff;box-shadow:0 10px 24px rgba(75,116,234,.24)}
      @keyframes loadMoreBounce{from{transform:translateY(-2px)}to{transform:translateY(3px)}}
      @media (max-width: 900px){.summary{min-width:116px;max-width:126px}.toolbar-actions{min-width:300px}.status-chip{text-align:right}}
      @media (max-width: 700px){.summary{min-width:108px;max-width:116px}.toolbar-actions{min-width:270px;gap:6px}.sf-row-2{grid-template-columns:1fr}.modal{padding:13px}.modal-title{font-size:20px}}
    `;

    const shell = document.createElement('div');
    shell.id = 'shell';
    const toolbar = document.createElement('div');
    toolbar.id = 'toolbar';

    const summary = document.createElement('div');
    summary.className = 'summary';
    summary.innerHTML = `
      <div class="summary-copy">
        <div class="summary-title">Total posts</div>
        <div class="summary-sub" id="summarySub">Đang đọc dữ liệu</div>
      </div>
      <div class="summary-count" id="totalCount">0</div>`;
    refs.totalCount = summary.querySelector('#totalCount');
    refs.info = summary.querySelector('#summarySub');

    const toolbarActions = document.createElement('div');
    toolbarActions.className = 'toolbar-actions';

    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.id = 'loadMoreBtn';
    loadMoreBtn.className = 'icon-btn';
    loadMoreBtn.type = 'button';
    loadMoreBtn.title = 'Quét nền và tải thêm nội dung · không rời thanh bộ lọc';
    loadMoreBtn.dataset.loading = 'false';
    loadMoreBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="m6 7 6 6 6-6"></path><path d="m6 13 6 6 6-6"></path></svg>`;
    refs.loadMoreButton = loadMoreBtn;

    const reapplyFilterBtn = document.createElement('button');
    reapplyFilterBtn.id = 'reapplyFilterBtn';
    reapplyFilterBtn.className = 'icon-btn';
    reapplyFilterBtn.type = 'button';
    reapplyFilterBtn.dataset.active = 'false';
    reapplyFilterBtn.title = 'Đặt lại bộ lọc và chuyển về sắp xếp mặc định · Shift+click để lọc lại nội dung đã tải';
    reapplyFilterBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M4 7v5h5"></path><path d="M5.5 16.5A8 8 0 1 0 6 6l-2 6"></path></svg>`;
    refs.reapplyButton = reapplyFilterBtn;

    const sortBox = document.createElement('div');
    sortBox.className = 'sort-box';
    const sortSelect = document.createElement('select');
    sortSelect.id = 'sortBy';
    sortSelect.innerHTML = `
      <option value="default">Sắp xếp mặc định</option>
      <option value="date_desc">Theo ngày đăng mới → cũ</option>
      <option value="date_asc">Theo ngày đăng cũ → mới</option>
      <option value="views">Theo số lượt xem</option>
      <option value="likes">Số lượt thích</option>
      <option value="comments">Số bình luận</option>
      <option value="shares">Số lượt chia sẻ</option>
      <option value="saves">Số lượt lưu</option>
      <option value="er">Điểm chất lượng (ER)</option>`;
    refs.sortSelect = sortSelect;
    const caret = document.createElement('div');
    caret.className = 'sort-caret';
    caret.textContent = '⌄';
    sortBox.append(sortSelect, caret);

    const filterBtn = document.createElement('button');
    filterBtn.className = 'icon-btn';
    filterBtn.type = 'button';
    filterBtn.title = 'Mở bộ lọc';
    filterBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M4 5h16l-6.5 7.5v5.5l-3 1.8v-7.3z"></path></svg>`;
    refs.filterButton = filterBtn;

    const statusChip = document.createElement('div');
    statusChip.className = 'status-chip';
    statusChip.textContent = '0/0';
    refs.status = statusChip;

    toolbarActions.append(loadMoreBtn, reapplyFilterBtn, sortBox, filterBtn, statusChip);
    toolbar.append(summary, toolbarActions);
    shell.append(toolbar);

    const overlay = document.createElement('div');
    overlay.id = 'overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="Bộ lọc video TikTok">
        <div class="modal-head">
          <div class="modal-title">Lọc</div>
          <button class="close-btn" type="button" aria-label="Đóng">×</button>
        </div>
        <div class="sf-grid">
          <div>
            <label class="sf-label">Loại</label>
            <select class="sf-select" data-key="type">
              <option value="all">Tất cả các loại</option>
              <option value="video">Video</option>
              <option value="photo">Bài ảnh</option>
            </select>
          </div>
          <div>
            <label class="sf-label">Từ khóa</label>
            <input class="sf-input" type="text" placeholder="Vui lòng nhập từ khóa" data-key="keyword">
          </div>
          <div>
            <label class="sf-label">Khoảng ngày</label>
            <div class="sf-date-row">
              <input class="sf-input" type="date" data-key="startDate">
              <div class="sf-sep">→</div>
              <input class="sf-input" type="date" data-key="endDate">
            </div>
          </div>
          <div class="sf-row-2" id="metricsGrid"></div>
        </div>
        <div class="modal-foot">
          <button class="ghost-btn" type="button" id="resetAll">Đặt lại</button>
          <button class="primary-btn" type="button" id="applyAll">Lọc</button>
        </div>
      </div>`;

    const metricsGrid = overlay.querySelector('#metricsGrid');
    const leftCol = document.createElement('div');
    const rightCol = document.createElement('div');
    leftCol.className = 'sf-col';
    rightCol.className = 'sf-col';
    [
      ['Lượt xem', 'minViews', 'maxViews', 'Tối thiểuLượt xem', 'Tối đaLượt xem'],
      ['Lượt thích', 'minLikes', 'maxLikes', 'Tối thiểuLượt thích', 'Tối đaLượt thích'],
      ['Lượt bình luận', 'minComments', 'maxComments', 'Tối thiểuLượt bình luận', 'Tối đaLượt bình luận'],
      ['Lượt chia sẻ', 'minShares', 'maxShares', 'Tối thiểuLượt chia sẻ', 'Tối đaLượt chia sẻ']
    ].forEach((args) => leftCol.appendChild(createRangeBlock(...args)));
    [
      ['Lượt lưu', 'minSaves', 'maxSaves', 'Tối thiểuLượt lưu', 'Tối đaLượt lưu'],
      ['Điểm chất lượng', 'minER', 'maxER', 'Tối thiểuĐiểm chất lượng', 'Tối đaĐiểm chất lượng']
    ].forEach((args) => rightCol.appendChild(createRangeBlock(...args)));
    metricsGrid.append(leftCol, rightCol);

    shadow.append(style, shell, overlay);
    refs.overlay = overlay;

    function openOverlay() { overlay.classList.add('open'); updateSearchOverlapState(); }
    function closeOverlay() { overlay.classList.remove('open'); updateSearchOverlapState(); }

    loadMoreBtn.addEventListener('click', () => { void loadMoreSearchVideos(loadMoreBtn); });
    reapplyFilterBtn.addEventListener('click', (event) => {
      if (event.shiftKey) void reapplyLoadedResults();
      else void resetAllFilters();
    });
    filterBtn.addEventListener('click', openOverlay);
    sortSelect.addEventListener('change', async () => {
      settings.sortBy = sortSelect.value;
      settings.sortDirection = /_asc$/.test(sortSelect.value) ? 'asc' : 'desc';
      updateFilterBadge();
      await storageSet();
      await waitForStatsRefresh(320);
      stabilizeFilters();
    });
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target.classList.contains('close-btn')) closeOverlay();
    });
    overlay.querySelector('#resetAll').addEventListener('click', async () => {
      await resetAllFilters();
      closeOverlay();
    });
    overlay.querySelector('#applyAll').addEventListener('click', async () => {
      const next = { ...settings, enabled: true };
      overlay.querySelectorAll('[data-key]').forEach((el) => {
        const key = el.dataset.key;
        if (["keyword", "startDate", "endDate", "type"].includes(key)) next[key] = el.value || "";
        else next[key] = parseCompactNumber(el.value);
      });
      next.sortBy = refs.sortSelect.value;
      settings = normalizeSettings(next);
      syncUiFromSettings();
      await storageSet();
      closeOverlay();
      await waitForStatsRefresh(420);
      stabilizeFilters();
      chrome.runtime.sendMessage({ type: "REMOTE_USAGE_EVENT", counter: "searchFilterRuns" }).catch(() => {});
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && overlay.classList.contains('open')) closeOverlay();
    });

    placeUiBelowTabs();
    syncUiFromSettings();
  }

  function syncUiFromSettings() {
    if (!shadow) return;
    if (refs.sortSelect) refs.sortSelect.value = settings.sortBy;
    shadow.querySelectorAll('#overlay [data-key]').forEach((el) => {
      const key = el.dataset.key;
      const value = settings[key];
      if (el.tagName === 'SELECT' || el.type === 'date' || key === 'keyword') el.value = value ?? '';
      else el.value = value === null ? '' : formatCompact(value);
    });
    updateFilterBadge();
  }

  function updateRoute() {
    clearTimeout(routeTimer);
    routeTimer = setTimeout(() => {
      syncSearchObserver();
      if (!remoteAccessLocked && isSearchPage() && settings.enabled) {
        ensureUi();
        placeUiBelowTabs();
        requestCachedStats();
        scheduleApply(100);
      } else if (host) {
        restoreProjectedWrappers();
        host.style.display = 'none';
        const records = getCardRecords();
        records.forEach(restoreRecord);
      }
    }, 80);
  }

  window.addEventListener('message', (event) => {
    if (remoteAccessLocked || event.source !== window || event.data?.source !== SOURCE || event.data?.type !== 'stats' || !Array.isArray(event.data.items)) return;
    for (const item of event.data.items) {
      const id = String(item?.id || '');
      if (!/^\d{8,}$/.test(id)) continue;
      const previous = statsById.get(id) || {};
      const metric = (value) => {
        if (value === null || value === undefined || value === '') return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
      };
      const mergedMetric = (value, key) => metric(value) ?? previous[key] ?? null;
      statsById.set(id, {
        views: mergedMetric(item.views, 'views'),
        likes: mergedMetric(item.likes, 'likes'),
        comments: mergedMetric(item.comments, 'comments'),
        shares: mergedMetric(item.shares, 'shares'),
        saves: mergedMetric(item.saves, 'saves'),
        dateTs: mergedMetric(item.dateTs, 'dateTs'),
        title: String(item.title || previous.title || '').trim().slice(0, 1200)
      });
      if (statsById.size > MAX_STATS) statsById.delete(statsById.keys().next().value);
    }
    statsRevision += 1;
    scheduleApply(40);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[REMOTE_ACCESS_STATE_KEY]) {
      if (changes[REMOTE_ACCESS_STATE_KEY].newValue?.allowed !== true) {
        remoteAccessLocked = true;
        restoreProjectedWrappers();
        getCardRecords().forEach(restoreRecord);
        if (host) host.style.display = 'none';
        updateRoute();
      }
    }
    if (changes[STORAGE_KEY]) {
      settings = normalizeSettings(changes[STORAGE_KEY].newValue);
      syncUiFromSettings();
      updateRoute();
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "TDT_REMOTE_ACCESS_CHANGED") return false;
    applyTrustedRemoteAccess(message.state);
    return false;
  });

  function mutationNodeTouchesSearch(node) {
    const element = node instanceof Element ? node : node?.parentElement;
    if (!(element instanceof Element)) return false;
    if (element === host) return true;
    if (host?.contains?.(element)) return false;
    if (element.matches?.(`${SEARCH_ITEM_LINK_SELECTOR},${SEARCH_CARD_SELECTOR},[data-testid="tux-web-tab-bar"]`)) return true;
    return Boolean(element.querySelector?.(`${SEARCH_ITEM_LINK_SELECTOR},${SEARCH_CARD_SELECTOR},[data-testid="tux-web-tab-bar"]`));
  }

  let searchObserverActive = false;
  const observer = new MutationObserver((records) => {
    if (remoteAccessLocked || applying || !isSearchPage()) return;
    const searchCardsChanged = records.some((record) => {
      if (record.type === 'childList') {
        const changedNodes = [...record.addedNodes, ...record.removedNodes].filter((node) => node instanceof Element);
        if (changedNodes.length && changedNodes.every((node) => internalMoveBatch.has(node))) return false;
        if (host?.contains?.(record.target)) return false;
        if (record.target instanceof Element && record.target.closest?.(SEARCH_CARD_SELECTOR)) return true;
        return [...record.addedNodes, ...record.removedNodes].some(mutationNodeTouchesSearch);
      }
      if (record.type === 'attributes') {
        if (!(record.target instanceof Element)) return false;
        if (record.attributeName === 'href') return record.target.matches(SEARCH_ITEM_LINK_SELECTOR);
        return (record.attributeName === 'aria-label' || record.attributeName === 'title') && Boolean(record.target.closest?.(SEARCH_CARD_SELECTOR));
      }
      return false;
    });
    if (searchCardsChanged) {
      cardDomCache = new WeakMap();
      scheduleUiRefresh();
      scheduleManualScrollRefresh(120);
    }
  });
  function syncSearchObserver() {
    const shouldObserve = !remoteAccessLocked && settings.enabled && isSearchPage();
    if (shouldObserve === searchObserverActive) return;
    observer.disconnect();
    searchObserverActive = shouldObserve;
    if (shouldObserve) {
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href', 'aria-label', 'title']
      });
    }
  }

  const nativePushState = history.pushState;
  const nativeReplaceState = history.replaceState;
  history.pushState = function (...args) { const result = nativePushState.apply(this, args); updateRoute(); return result; };
  history.replaceState = function (...args) { const result = nativeReplaceState.apply(this, args); updateRoute(); return result; };
  window.addEventListener('popstate', updateRoute);
  window.addEventListener('pageshow', updateRoute);
  window.addEventListener('scroll', () => { if (isSearchPage()) scheduleManualScrollRefresh(180); }, { passive: true, capture: true });
  document.addEventListener('scroll', () => { if (isSearchPage()) scheduleManualScrollRefresh(180); }, { passive: true, capture: true });
  document.addEventListener('touchend', () => { if (isSearchPage()) scheduleManualScrollRefresh(120); }, { passive: true, capture: true });
  document.addEventListener('wheel', () => { if (isSearchPage()) scheduleManualScrollRefresh(220); }, { passive: true, capture: true });
  setInterval(() => {
    if (remoteAccessLocked || document.hidden || !settings.enabled || !isSearchPage() || loadingMore) return;
    const signature = currentSearchVideoSignature();
    if (signature !== lastSearchVideoSignature) scheduleManualScrollRefresh(40);
  }, 4000);
  document.addEventListener('focusin', updateSearchOverlapState, true);
  document.addEventListener('focusout', () => setTimeout(updateSearchOverlapState, 180), true);
  document.addEventListener('click', () => setTimeout(updateSearchOverlapState, 80), true);

  Promise.all([
    storageGet(STORAGE_KEY, null),
    storageGet(LEGACY_KEY, null),
    storageGet(REMOTE_ACCESS_STATE_KEY, null)
  ]).then(([current, legacy, accessState]) => {
    settings = normalizeSettings(current || legacy || DEFAULTS);
    remoteAccessLocked = true;
    if (!current && legacy) chrome.storage.local.set({ [STORAGE_KEY]: settings });
    refreshRemoteAccess();
  });
})();
