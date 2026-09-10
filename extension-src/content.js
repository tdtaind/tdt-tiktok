(() => {
  "use strict";

  if (window.top !== window.self || globalThis.__TDT_TIKTOK_INLINE_PLAYER_V300__) return;
  globalThis.__TDT_TIKTOK_INLINE_PLAYER_V300__ = true;

  const FONT_SIZE_KEY = "tdt_subtitle_font_size";
  const SETTINGS_KEY = "tdt_settings_v17";
  const SUBTITLE_CACHE_KEY = "tdt_subtitle_cache_v1";
  const DEFAULT_FONT_SIZE = 22;
  const MIN_FONT_SIZE = 12;
  const MAX_FONT_SIZE = 42;
  const TRANSCRIPT365_RESULT_KEY = "tdt_transcript365_latest";
  const TRANSCRIPT365_REQUEST_KEY = "tdt_transcript365_request";
  const TRANSCRIPT365_NO_SUB_KEY = "tdt_transcript365_no_sub_latest";
  const SUBTITLE_SCAN_TIMEOUT_MS = 36000;
  const PLAYER_RETRY_MS = 4500;
  const PLAYER_MOUNT_TIMEOUT_MS = 18000;
  const SUBTITLE_CACHE_MAX_ENTRIES = 80;
  const SUBTITLE_CACHE_MAX_CHARS = 6000000;
  const SUBTITLE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const LIFECYCLE_SCAN_DEBOUNCE_MS = 55;
  const STARTUP_SCAN_DELAYS_MS = Object.freeze([0, 60, 180, 500, 1200, 2600]);
  const CURRENT_TAB_URL_REFRESH_MIN_INTERVAL_MS = 450;
  const EXTERNAL_TRANSCRIPT_SCAN_INTERVAL_MS = 2400;
  const EXTERNAL_TRANSCRIPT_MAX_TEXT_NODES = 8000;
  const EXTERNAL_TIMESTAMP_RE = /^(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?$/;
  const PRODUCT_SCAN_MAX_NODES = 12000;
  const PRODUCT_SCAN_MAX_ITEMS = 100;
  const PRODUCT_CACHE_MAX_ENTRIES = 80;
  const DEFAULT_SETTINGS = Object.freeze({
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
  });
  const MIN_SUBTITLE_OPACITY = 0;
  const MAX_SUBTITLE_OPACITY = 0.95;
  const MIN_PLAYBACK_RATE = 0.25;
  const MAX_PLAYBACK_RATE = 4;
  const MIN_PLAYBACK_VOLUME = 0;
  const MAX_PLAYBACK_VOLUME = 1;
  const PLAYBACK_RATE_STEPS = Object.freeze([0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4]);
  const VIDEO_ZOOM_LEVELS = Object.freeze([1, 1.25, 1.5, 2]);
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
  const TIKTOK_SHOP_APP_NOTICE_TEXT = "Xem video TikTok Shop trong ứng dụng TikTok";
  const VIDEO_STATS_POSITION_KEY = "tdt_video_stats_position_v4";
  const PRODUCT_HOOK_SOURCE = "tdt-tiktok-product-hook";
  const PRODUCT_REQUEST_SOURCE = "tdt-tiktok-product-ui";
  const MEDIA_HOOK_SOURCE = "tdt-tiktok-media-hook";
  const MEDIA_REQUEST_SOURCE = "tdt-tiktok-media-ui";
  const MEDIA_HOOK_WAIT_MS = 160;
  const MEDIA_HOOK_CACHE_MAX_ENTRIES = 120;
  const RECENT_NATIVE_PLAY_WINDOW_MS = 2600;
  const SEARCH_SELECTION_FALLBACK_MS = 30000;
  const DETAIL_PRIMARY_MIN_HEIGHT_RATIO = 0.50;
  const DETAIL_PRIMARY_MIN_AREA_RATIO = 0.10;
  const DETAIL_PRIMARY_MAX_CENTER_X_RATIO = 0.68;
  const WATCH_ANALYTICS_KEY = "tdt_watch_analytics_v1";
  const WATCH_HISTORY_LIMIT = 200;
  const WATCH_SAVE_DELAY_MS = 1800;

  let host = null;
  let mediaLayer = null;
  let mediaStyle = null;
  let shadow = null;
  let panel = null;
  let mountElement = null;
  let nativeVideo = null;
  let nativeSnapshot = null;
  let video = null;
  let captionOverlay = null;
  let captionTranslatedEl = null;
  let captionOriginalEl = null;
  let currentPageUrl = "";
  let currentVideoId = "";
  let currentVideoInfo = null;
  let videoStatsPanel = null;
  let videoStatsDate = null;
  let videoStatsViews = null;
  let videoStatsEr = null;
  let videoStatsLikes = null;
  let videoStatsComments = null;
  let videoStatsShares = null;
  let videoStatsSaves = null;
  let latestExternalStats = null;
  let statsDragState = null;
  let extensionSettings = { ...DEFAULT_SETTINGS };
  let settingsReady = false;
  let currentRequestToken = 0;
  let subtitleTaskToken = 0;
  let subtitleBlobUrls = [];
  let subtitleCues = [];
  let subtitlesVisible = true;
  let subtitleStatusEl = null;
  let subtitleRetryBtn = null;
  let subtitleToggleBtn = null;
  let latestTranscript365Vtt = "";
  let latestTranscript365Signature = "";
  let subtitleFontSize = DEFAULT_FONT_SIZE;
  let sizeRange = null;
  let sizeValue = null;
  let subtitleGate = null;
  let subtitleGateText = null;
  let videoGateLocked = true;
  let currentTranscriptTabId = null;
  let currentTranscriptWindowId = null;
  let currentTranscriptRequestId = "";
  let suppressedUrl = "";
  let mounting = false;
  let mountEpoch = 0;
  let lifecycleScanTimer = null;
  let lifecycleObserver = null;
  let scrollLifecycleTimer = null;
  let startupScanTimers = [];
  let authoritativeTabUrl = "";
  let lastCurrentTabUrlRefreshAt = 0;
  let currentTabUrlRefreshPromise = null;
  let portalGeometryFrame = 0;
  let portalResizeObserver = null;
  let playerRootObserver = null;
  let playerLoadStartedAt = 0;
  let lastPlayerRecoveryAt = 0;
  let playerTargetCache = null;
  let playerTargetCacheAt = 0;
  let controlWidgetHost = null;
  let controlWidgetShadow = null;
  let controlWidgetPanel = null;
  let controlWidgetStatus = null;
  let controlWidgetScanButton = null;
  let controlWidgetOpen = false;
  let prefetchVideoInfoPromise = null;
  let lastPrefetchedVideoUrl = "";
  let subtitleOpacityRange = null;
  let subtitleOpacityValue = null;
  let playerSpeedButton = null;
  let playerVolumeButton = null;
  let playerVolumePopover = null;
  let playerVolumeRange = null;
  let playerVolumeValue = null;
  let playerProgressRange = null;
  let playerInfoButton = null;
  let playerPlayButton = null;
  let playerCurrentTime = null;
  let playerDuration = null;
  let playerProgressPlayed = null;
  let playerProgressBuffered = null;
  let playerProgressThumb = null;
  let playerProgressTip = null;
  let playerProgressTipTime = null;
  let playerPipButton = null;
  let playerWebFullscreenButton = null;
  let playerProgressDragging = false;
  let webFullscreenActive = false;
  let webFullscreenPreviousHtmlOverflow = "";
  let webFullscreenPreviousBodyOverflow = "";
  let productWidget = null;
  let productWidgetPanel = null;
  let productWidgetButton = null;
  let productScanSignature = "";
  let lastProductDomScanAt = 0;
  let latestDomProductScan = { videoId:"", products:[] };
  const productInfoCache = new Map();
  const hookMediaCache = new Map();
  const hookMediaWaiters = new Map();
  const guardedNativeStates = new Map();
  const hdSourceRetryAttempts = new Map();
  let lastNativePlayVideo = null;
  let lastNativePlayAt = 0;
  let lastNativePlayUrl = "";
  let pendingSearchVideoUrl = "";
  let pendingSearchVideoId = "";
  let pendingSearchSelectionAt = 0;
  let lockedDetailVideoId = "";
  let lockedDetailMount = null;

  function cacheProductInfo(videoId, value) {
    const key = String(videoId || "");
    if (!key) return;
    if (productInfoCache.has(key)) productInfoCache.delete(key);
    productInfoCache.set(key, value);
    while (productInfoCache.size > PRODUCT_CACHE_MAX_ENTRIES) {
      const oldestKey = productInfoCache.keys().next().value;
      if (oldestKey === undefined) break;
      productInfoCache.delete(oldestKey);
    }
  }

  function normalizedInfoVideoId(info) {
    return String(info?.videoId || info?.requestedVideoId || info?.id || "").match(/\d{8,}/)?.[0] || "";
  }

  function videoInfoMatchesUrl(info, pageUrl) {
    const expected = videoIdFromUrl(pageUrl);
    const received = normalizedInfoVideoId(info);
    // A source without a verifiable ID is unsafe when a concrete TikTok ID is
    // requested. This fail-closed check prevents a late/stale API response from
    // replacing the selected card with another video.
    return !expected || Boolean(received && expected === received);
  }

  function normalizeHookMediaInfo(value) {
    if (!value || typeof value !== "object") return null;
    const videoId = normalizedInfoVideoId(value);
    const videoUrl = String(value.videoUrl || "").trim();
    if (!videoId || !/^https?:\/\//i.test(videoUrl)) return null;
    return {
      ...value,
      videoId,
      requestedVideoId: videoId,
      videoUrl,
      title: String(value.title || ""),
      author: String(value.author || value.authorInfo?.uniqueId || value.authorInfo?.nickname || ""),
      authorInfo: value.authorInfo && typeof value.authorInfo === "object" ? value.authorInfo : {},
      stats: value.stats && typeof value.stats === "object" ? value.stats : {},
      hashtags: Array.isArray(value.hashtags) ? value.hashtags : Array.from(new Set(String(value.title || "").match(/#[\p{L}\p{N}_]+/gu) || [])),
      source: "tiktok-feed-hd",
      exact: true,
      downloadable: true
    };
  }

  function cacheHookMediaInfo(value) {
    const info = normalizeHookMediaInfo(value);
    if (!info) return null;
    if (hookMediaCache.has(info.videoId)) hookMediaCache.delete(info.videoId);
    hookMediaCache.set(info.videoId, info);
    while (hookMediaCache.size > MEDIA_HOOK_CACHE_MAX_ENTRIES) hookMediaCache.delete(hookMediaCache.keys().next().value);
    const waiters = hookMediaWaiters.get(info.videoId);
    if (waiters?.size) {
      hookMediaWaiters.delete(info.videoId);
      for (const resolve of waiters) resolve(info);
    }
    return info;
  }

  function requestHookMedia(videoId) {
    const id = String(videoId || "").match(/\d{8,}/)?.[0] || "";
    if (!id) return;
    window.postMessage({ source:MEDIA_REQUEST_SOURCE, type:"request-media", videoId:id }, "*");
  }

  function waitForHookMedia(videoId, timeoutMs = MEDIA_HOOK_WAIT_MS) {
    const id = String(videoId || "").match(/\d{8,}/)?.[0] || "";
    if (!id) return Promise.resolve(null);
    const cached = hookMediaCache.get(id);
    if (cached?.videoUrl) return Promise.resolve(cached);
    requestHookMedia(id);
    return new Promise((resolve) => {
      let settled = false;
      let timer = null;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        const set = hookMediaWaiters.get(id);
        set?.delete(finish);
        if (set && !set.size) hookMediaWaiters.delete(id);
        resolve(value || null);
      };
      const set = hookMediaWaiters.get(id) || new Set();
      set.add(finish);
      hookMediaWaiters.set(id, set);
      timer = setTimeout(() => finish(hookMediaCache.get(id) || null), Math.max(20, Number(timeoutMs) || MEDIA_HOOK_WAIT_MS));
    });
  }

  function captureNativeGuardState(target) {
    if (!(target instanceof HTMLVideoElement)) return null;
    let state = guardedNativeStates.get(target);
    if (!state) {
      state = {
        muted: target.muted,
        defaultMuted: target.defaultMuted,
        volume: target.volume,
        autoplay: target.autoplay,
        autoplayAttribute: target.hasAttribute("autoplay"),
        loop: target.loop,
        controls: target.controls,
        playsInline: target.playsInline,
        paused: target.paused,
        currentTime: Number(target.currentTime) || 0
      };
      guardedNativeStates.set(target, state);
      while (guardedNativeStates.size > 40) {
        const oldest = guardedNativeStates.keys().next().value;
        if (!oldest) break;
        guardedNativeStates.delete(oldest);
      }
    }
    return state;
  }

  function isLikelyPrimaryNativePlayback(target) {
    if (!(target instanceof HTMLVideoElement) || !target.isConnected) return false;
    if (target === nativeVideo) return true;
    if (isSearchResultPreviewElement(target) || isSideRecommendationElement(target) || candidateConflictsWithCurrentRoute(target)) return false;
    const rect = target.getBoundingClientRect?.();
    if (!rect || rect.width < 120 || rect.height < 120 || rect.bottom <= 0 || rect.top >= innerHeight) return false;
    const visibleW = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
    const visibleH = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
    const visibleArea = visibleW * visibleH;
    const ownArea = Math.max(1, rect.width * rect.height);
    return visibleArea / ownArea >= 0.35;
  }

  function guardNativeVideoAudio(target) {
    if (!(target instanceof HTMLVideoElement) || target === video || target.matches?.('[data-tdt-replacement="true"]')) return;
    if (!settingsReady || !extensionSettings.autoReplace || !remoteAccessReady || remoteAccessLocked) return;
    captureNativeGuardState(target);

    // Never silence the primary TikTok media element before the HD replacement is
    // ready. On the homepage this element is also our safest audio source. Older
    // builds muted it immediately in the bubbling "play" event; if mounting or a
    // signed HD URL was delayed, the user was left with a visually playing but
    // silent clip.
    if ((nativeAudioBridgeActive && target === nativeVideo) || isLikelyPrimaryNativePlayback(target)) {
      try {
        target.controls = false;
        target.playsInline = true;
      } catch {}
      return;
    }

    try {
      target.autoplay = false;
      target.removeAttribute("autoplay");
      target.loop = false;
      target.muted = true;
      target.defaultMuted = true;
      target.volume = 0;
      if (!target.paused) target.pause();
    } catch {}
  }

  function restoreGuardedNativeVideos() {
    for (const [target, state] of guardedNativeStates.entries()) {
      if (!(target instanceof HTMLVideoElement) || target === nativeVideo) continue;
      try {
        target.muted = state.muted;
        target.defaultMuted = state.defaultMuted;
        target.volume = state.volume;
        target.loop = state.loop;
        target.controls = state.controls;
        target.playsInline = state.playsInline;
        target.autoplay = state.autoplay;
        if (state.autoplayAttribute) target.setAttribute("autoplay", "");
        else target.removeAttribute("autoplay");
      } catch {}
      guardedNativeStates.delete(target);
    }
  }

  let playerSpeedMenu = null;
  let centerPlaybackButton = null;
  let centerPlaybackHideTimer = null;
  let videoMetadataOverlay = null;
  let controlWidgetSubtitleButton = null;
  let remoteAccessState = { allowed: false, status: "checking", reason: "Đang xác minh quyền sử dụng với Vercel…", serverReachable: false, leaseExpiresAt: 0 };
  let remoteAccessReady = false;
  let remoteAccessLocked = true;
  let remoteAccessLeaseTimer = null;
  let playbackUnlockRequired = false;
  let autoplayMutedFallback = false;
  let autoplaySoundRecoveryTimer = null;
  let autoplaySoundRecoveryToken = 0;
  let suppressNextVideoClick = false;
  let hiddenPlaybackKeepAliveTimer = null;
  // Audio Studio v3.2.6: shared context + resilient processing chain per ACTIVE video.
  // This keeps effects active when TikTok switches/reuses video elements.
  let audioContext = null;
  const audioEngines = new Map();
  // Promise entries are source-aware so a late CORS probe for clip A can never
  // attach Web Audio after TikTok has recycled the same <video> for clip B.
  const audioEnginePromises = new WeakMap();
  const audioAttachGeneration = new WeakMap();
  // Sources that failed a CORS media load must never be attached to Web Audio on
  // the same element.  createMediaElementSource() permanently takes over an
  // HTMLMediaElement, so a failed CORS attempt can otherwise leave it silent.
  const audioCorsBypassSources = new Set();
  const audioCorsProbeCache = new Map();
  const audioCorsProbeWaiters = new Map();
  let audioCorsProbeSequence = 0;
  let audioStudioScanTimer = null;
  let audioStudioSupervisorTimer = null;
  let audioStudioSupervisorBusy = false;
  let audioContextRecoveryTimer = null;
  let audioBypassNoticeShown = false;
  let audioStudioReadyNoticeShown = false;
  // v3.2.5: replacement audio is the fail-safe/default output.  The hidden
  // TikTok video becomes an Audio Studio bridge ONLY after a verified Web Audio
  // engine is running.  If that graph ever stops, sound falls back immediately
  // to the replacement instead of leaving the player silent.
  let nativeAudioBridgeActive = false;
  let nativeAudioBridgeFailureCount = 0;
  let nativeAudioBridgeMonitorTimer = null;
  let replacementPlaybackStarted = false;
  let nativeActionRail = null;
  let nativeActionRailSnapshot = null;
  let nativeActionRailHost = null;
  let nativeActionRailHostPosition = "";
  let pausedBySmartAutoPause = false;
  let shouldResumeFromBackground = false;
  // Preserve an explicit user pause across DOM remounts, subtitle completion,
  // audio unlocks and visibility changes for the same TikTok video.
  let manuallyPausedVideoId = "";
  let manuallyPausedAt = 0;
  let videoZoomIndex = 0;
  let watchUiHost = null;
  let watchUiShadow = null;
  let watchModal = null;
  let watchAnalytics = null;
  let watchAnalyticsReady = false;
  let watchCurrentSnapshot = null;
  let watchTicker = null;
  let watchSaveTimer = null;
  let watchToastTimer = null;
  let noticeHideTimer = null;
  let autoScrollInFlight = false;
  let lastAutoScrollAt = 0;
  let autoScrollEndSignature = "";
  let externalSubtitleObserver = null;
  let externalSubtitleSearchTimer = null;
  let externalSubtitleDocumentObserver = null;
  let cachedOpenSubtitleRoots = [];
  let lastOpenSubtitleRootScanAt = 0;
  let lastPlayerDeepRootRefreshAt = 0;
  let lastTranslatorPromotionAt = 0;
  let externalSubtitleTranslatedText = "";
  let externalSubtitleOriginalText = "";
  let externalSubtitleCues = [];
  let externalSubtitleCueSignature = "";
  let lastExternalSubtitleCueScanAt = 0;
  let externalSubtitleRoot = null;
  let externalSubtitleSessionVideoId = "";
  let externalSubtitleSessionStartedAt = 0;
  let cachedTranscriptPanelRoots = [];
  let lastTranscriptPanelScanAt = 0;
  const staleExternalSubtitleRoots = new WeakMap();
  const concealedExternalSubtitleRoots = new Map();
  const promotedTranslatorPanels = new Map();
  let lastNativeSubtitleSyncAt = 0;
  let nativeSyncCleanup = [];
  let nativeInitialPlayback = { paused: true, currentTime: 0 };
  const pageVideoInfoCache = new Map();
  const resolvedVideoUrlCache = new WeakMap();
  const cleanHiddenForeignElements = new Map();

  const PLAYER_CSS = `
    :host { all: initial; position: absolute; inset: 0; display: block; width: 100%; height: 100%; z-index: 30; pointer-events: none; }
    * { box-sizing: border-box; }
    button, input, select { font: inherit; }
    #panel {
      position: absolute; inset: 0; width: 100%; height: 100%; overflow: hidden;
      color: #f8fafc; background: transparent; font: 12px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;
      isolation: isolate; user-select: none; pointer-events: none;
    }
    #panel[data-clean-mode="true"] .control-dock,
    #panel[data-clean-mode="true"] .volume-control,
    #panel[data-clean-mode="true"] .hd-download-widget,
    #panel[data-clean-mode="true"] .tpt-ctrlbar,
    #panel[data-clean-mode="true"] .caption-overlay,
    #panel[data-clean-mode="true"] .video-meta,
    #panel[data-clean-mode="true"] .video-stats-panel,
    #panel[data-clean-mode="true"] .source-note,
    #panel[data-clean-mode="true"] .center-playback-button,
    #panel[data-clean-mode="true"] .product-widget,
    #panel[data-clean-mode="true"] #notice { display:none!important; }
    .clean-restore-button { position:absolute; right:14px; top:50%; z-index:70; display:none; place-items:center; width:38px; height:38px; padding:0; border:1px solid rgba(255,255,255,.24); border-radius:50%; color:#fff; background:rgba(20,20,24,.30); box-shadow:0 5px 18px rgba(0,0,0,.30); backdrop-filter:blur(8px); cursor:pointer; opacity:.32; transform:translateY(-50%); transition:opacity .16s ease,background .16s ease,transform .16s ease; pointer-events:auto; }
    #panel[data-clean-mode="true"] .clean-restore-button { display:grid; }
    .clean-restore-button:hover,.clean-restore-button:focus-visible { opacity:.92; background:rgba(39,39,42,.78); transform:translateY(-50%) scale(1.06); }
    .clean-restore-button svg { width:19px; height:19px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
    .product-widget { position:absolute; right:14px; bottom:138px; z-index:56; display:none; width:min(420px,calc(100% - 28px)); pointer-events:auto; font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif; }
    .product-widget[data-has-products="true"] { display:block; animation:productWidgetIn .28s cubic-bezier(.2,.75,.25,1) both; }
    .product-widget-button { display:flex; align-items:center; justify-content:flex-start; gap:0; width:50px; min-height:50px; margin-left:auto; padding:7px; overflow:hidden; border:1px solid rgba(255,255,255,.52); border-radius:999px; color:#fff; background:linear-gradient(135deg,#fe2c55 0%,#ff4777 58%,#ff5d8b 100%); box-shadow:0 12px 34px rgba(254,44,85,.30),0 8px 24px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.25); cursor:pointer; font-size:13px; font-weight:900; letter-spacing:.05px; text-align:left; transition:width .28s cubic-bezier(.2,.75,.25,1),transform .16s ease,filter .16s ease,box-shadow .16s ease,padding .28s ease; }
    .product-widget-button:hover,.product-widget-button:focus-visible { width:min(100%,410px); padding-right:17px; filter:brightness(1.07); transform:translateY(-2px); box-shadow:0 15px 38px rgba(254,44,85,.38),0 9px 26px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.30); }
    .product-widget-button:active { transform:translateY(0) scale(.985); }
    .product-cart-icon { display:grid; place-items:center; flex:0 0 auto; width:34px; height:34px; border-radius:50%; color:#fff; background:rgba(255,255,255,.16); box-shadow:inset 0 0 0 1px rgba(255,255,255,.14); }
    .product-cart-icon svg { width:19px; height:19px; fill:none; stroke:currentColor; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; }
    .product-widget-title-window { min-width:0; max-width:0; margin-left:0; overflow:hidden; opacity:0; white-space:nowrap; transition:max-width .28s cubic-bezier(.2,.75,.25,1),margin-left .24s ease,opacity .18s ease; }
    .product-widget-button:hover .product-widget-title-window,.product-widget-button:focus-visible .product-widget-title-window { max-width:330px; margin-left:10px; opacity:1; }
    .product-widget-title-track { display:inline-block; min-width:max-content; white-space:nowrap; will-change:transform; }
    .product-widget-button:hover[data-marquee="true"] .product-widget-title-track,.product-widget-button:focus-visible[data-marquee="true"] .product-widget-title-track { animation:productTitleMarquee var(--product-marquee-duration,6s) ease-in-out .35s infinite alternate; }
    .product-widget-panel { position:absolute; right:0; bottom:62px; display:grid; gap:12px; width:min(390px,100%); max-height:min(500px,68vh); padding:14px; overflow:auto; border:1px solid rgba(255,255,255,.20); border-radius:20px; color:#fff; background:linear-gradient(155deg,rgba(30,30,36,.97),rgba(12,12,16,.97)); box-shadow:0 24px 70px rgba(0,0,0,.62); backdrop-filter:blur(22px) saturate(145%); transform-origin:bottom right; animation:productPanelIn .20s ease-out both; }
    .product-widget-panel[hidden] { display:none; }
    .product-widget-head { display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:32px; color:#fff; font-size:11px; font-weight:950; letter-spacing:.8px; text-transform:uppercase; }
    .product-widget-head span:first-child { display:flex; align-items:center; gap:7px; }
    .product-widget-head span:first-child::before { content:""; width:8px; height:8px; border-radius:50%; background:#fe2c55; box-shadow:0 0 0 5px rgba(254,44,85,.14); }
    .product-widget-close { width:30px; height:30px; padding:0; border:1px solid rgba(255,255,255,.10); border-radius:10px; color:#fff; background:rgba(255,255,255,.07); cursor:pointer; font-size:18px; line-height:1; }
    .product-widget-close:hover { background:rgba(255,255,255,.14); }
    .product-item { display:grid; grid-template-columns:86px minmax(0,1fr); gap:12px; padding:12px; border:1px solid rgba(255,255,255,.09); border-radius:15px; background:rgba(255,255,255,.045); }
    .product-item:first-of-type { border-top:1px solid rgba(255,255,255,.09); }
    .product-image-wrap { position:relative; width:86px; height:86px; overflow:hidden; border-radius:13px; }
    .product-image { width:100%; height:100%; border:1px solid rgba(255,255,255,.10); border-radius:13px; object-fit:cover; background:#08080a; }
    .product-search-1688 { position:absolute; top:5px; right:5px; z-index:3; display:grid; place-items:center; width:27px; height:27px; padding:0; border:1px solid rgba(255,255,255,.76); border-radius:8px; color:#fff; background:linear-gradient(145deg,#ff7a00,#f45100); box-shadow:0 5px 14px rgba(0,0,0,.34); cursor:pointer; font-size:7px; font-weight:950; letter-spacing:-.4px; line-height:1; }
    .product-search-1688:hover { filter:brightness(1.1); transform:scale(1.05); }
    .product-name { display:-webkit-box; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:2; color:#fff; font-size:13px; font-weight:850; line-height:1.35; }
    .product-price { margin-top:5px; color:#ff6685; font-size:16px; font-weight:950; }
    .product-meta { display:-webkit-box; margin-top:4px; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:2; color:rgba(255,255,255,.60); font-size:9px; line-height:1.4; }
    .product-open { display:inline-flex; align-items:center; justify-content:center; min-height:32px; margin-top:7px; padding:6px 10px; border:1px solid rgba(255,255,255,.22); border-radius:10px; color:#fff!important; background:linear-gradient(135deg,#fe2c55,#ff4777); text-decoration:none!important; font-size:10px; font-weight:900; }
    @keyframes productWidgetIn { from { opacity:0; transform:translateY(10px) scale(.97); } to { opacity:1; transform:none; } }
    @keyframes productPanelIn { from { opacity:0; transform:translateY(8px) scale(.97); } to { opacity:1; transform:none; } }
    @keyframes productTitleMarquee { 0%,12% { transform:translateX(0); } 88%,100% { transform:translateX(var(--product-marquee-distance,0px)); } }
    @media (max-width:620px) {
      .product-widget { right:9px; bottom:70px; width:min(360px,calc(100% - 18px)); }
      .product-widget-button { width:44px; min-height:44px; padding:6px; font-size:11px; }
      .product-widget-button:hover,.product-widget-button:focus-visible { width:min(100%,350px); padding-right:13px; }
      .product-cart-icon { width:31px; height:31px; }
      .product-widget-panel { bottom:54px; width:min(350px,100%); max-height:62vh; padding:11px; border-radius:16px; }
      .product-item { grid-template-columns:72px minmax(0,1fr); gap:10px; padding:9px; }
      .product-image-wrap { width:72px; height:72px; }
      .product-image { width:100%; height:100%; }
    }
    .video-wrap { position: absolute; inset: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; pointer-events: none; }
    .control-dock,.volume-control,.hd-download-widget,.tpt-ctrlbar,.subtitle-gate,.speed-menu,.notice,.video-meta { pointer-events: auto; }
    .center-playback-button {
      position:absolute; left:50%; top:50%; z-index:34; display:grid; place-items:center; width:84px; height:84px; padding:0;
      border:0; border-radius:50%; color:#fff; background:rgba(0,0,0,.48); box-shadow:0 12px 38px rgba(0,0,0,.38);
      backdrop-filter:blur(5px); opacity:0; visibility:hidden; pointer-events:none!important; transform:translate(-50%,-50%) scale(.72);
    }
    .center-playback-button[data-visible="true"] { visibility:visible; animation:playbackZoomOut .62s cubic-bezier(.2,.72,.2,1) both; }
    .center-playback-button svg { width:46px; height:46px; color:currentColor; }
    .center-playback-button[data-state="play"] svg { transform:translateX(3px); }
    .video-meta {
      position:absolute; left:15px; right:76px; bottom:108px; z-index:31; min-width:0; max-width:min(680px,calc(100% - 92px));
      color:#fff; text-align:left; font-family:system-ui,-apple-system,"Segoe UI",sans-serif; text-shadow:0 2px 5px rgba(0,0,0,.95);
      filter:drop-shadow(0 2px 3px rgba(0,0,0,.42));
    }
    .video-meta[hidden] { display:none!important; }
    .video-meta-author { display:flex; align-items:center; gap:7px; width:max-content; max-width:100%; margin-bottom:7px; color:#fff; font-size:18px; font-weight:800; line-height:1.15; }
    .video-meta-author-name { min-width:0; overflow:hidden; color:#fff; text-overflow:ellipsis; white-space:nowrap; text-decoration:underline; text-underline-offset:3px; cursor:pointer; }
    .video-meta-author-name:hover { color:#bffcff; }
    .video-meta-verified { display:grid; place-items:center; flex:0 0 auto; width:21px; height:21px; color:#20c9e8; filter:none; text-shadow:none; }
    .video-meta-verified svg { display:block; width:21px; height:21px; overflow:visible; }
    .video-meta-caption-row { display:flex; align-items:flex-end; gap:7px; min-width:0; }
    .video-meta-caption { display:-webkit-box; min-width:0; max-width:100%; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:2; color:#fff; font-size:15px; font-weight:500; line-height:1.36; overflow-wrap:anywhere; }
    .video-meta-caption a { color:#fff; font-weight:750; text-decoration:none; cursor:pointer; }
    .video-meta-caption a:hover { color:#bffcff; text-decoration:underline; }
    .video-meta-caption[data-expanded="true"] { display:block; overflow:visible; -webkit-line-clamp:unset; }
    .video-meta-more { flex:0 0 auto; padding:0 1px 1px; border:0; color:#fff; background:transparent; font-size:14px; font-weight:800; text-shadow:inherit; cursor:pointer; }
    #panel[data-has-video-meta="true"] .caption-overlay { bottom:198px; }
    .control-dock {
      position: absolute; top: 12px; left: 50%; z-index: 42; display: flex; align-items: center; justify-content: center; gap: 5px;
      min-height: 34px; max-width: calc(100% - 112px); overflow: visible;
      padding: 2px 5px; border: 1px solid rgba(255,255,255,.24); border-radius: 999px;
      background: rgba(24,24,27,.52); box-shadow: 0 9px 26px rgba(0,0,0,.34);
      backdrop-filter: blur(12px) saturate(130%); transform: translateX(-50%);
      transition: max-width .18s ease, opacity .18s ease, transform .18s ease;
    }
    .control-dock[data-speed-open="true"] { max-width: calc(100% - 12px); }
    .player-icon-btn {
      position: relative; display: grid; place-items: center; width: 32px; height: 32px; padding: 0; flex: 0 0 auto;
      border: 1px solid rgba(255,255,255,.30); border-radius: 50%; color: #fff;
      background: rgba(39,39,42,.70); box-shadow: inset 0 1px 0 rgba(255,255,255,.10),0 5px 14px rgba(0,0,0,.25);
      cursor: pointer; transition: transform .14s ease, background .14s ease, border-color .14s ease, opacity .14s ease;
    }
    .player-icon-btn:hover { transform: translateY(-1px) scale(1.025); background: rgba(63,63,70,.88); border-color: rgba(255,255,255,.50); }
    .player-icon-btn:active { transform: scale(.96); }
    .player-icon-btn:disabled { cursor: wait; opacity: .5; transform: none; }
    .player-icon-btn svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .player-icon-btn[data-active="true"] { color: #6ee7b7; background: rgba(5,150,105,.42); border-color: rgba(110,231,183,.58); }
    .tdt-1688-control-button { color:#ffb067; background:rgba(244,81,0,.30); border-color:rgba(255,157,72,.62); }
    .tdt-1688-control-button:hover { color:#fff; background:rgba(244,81,0,.62); border-color:rgba(255,188,128,.88); }
    .speed-label { font-size: 10px; font-weight: 900; letter-spacing: -.2px; }
    .volume-fab {
      position: absolute; top: 14px; left: 14px; z-index: 43; display: grid; place-items: center;
      width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%; color: #fff;
      background: rgba(15,15,18,.26); text-shadow: 0 2px 8px #000; cursor: pointer;
      filter: drop-shadow(0 3px 7px rgba(0,0,0,.55));
    }
    .volume-fab:hover { background: rgba(15,15,18,.48); }
    .volume-fab svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
    .volume-fab svg path:first-child { fill: currentColor; stroke: none; }
    .volume-control { position: absolute; top: 14px; left: 14px; z-index: 44; display: flex; align-items: center; gap: 7px; }
    .volume-control .volume-fab { position: relative; top: auto; left: auto; z-index: 2; flex: 0 0 auto; }
    .volume-popover {
      display: flex; align-items: center; gap: 7px; width: 0; max-width: 172px; opacity: 0; overflow: hidden; pointer-events: none;
      padding: 6px 0; border: 1px solid rgba(255,255,255,.22); border-radius: 999px; background: rgba(24,24,27,.82);
      box-shadow: 0 10px 30px rgba(0,0,0,.42); backdrop-filter: blur(14px) saturate(130%); transition: width .18s ease, opacity .18s ease, padding .18s ease;
    }
    .volume-control[data-open="true"] .volume-popover,
    .volume-control:hover .volume-popover,
    .volume-control:focus-within .volume-popover { width: 150px; opacity: 1; pointer-events: auto; padding: 6px 9px; }
    .volume-slider { width: 96px; accent-color: #fe2c55; cursor: pointer; }
    .volume-value { min-width: 31px; color: #fff; font-size: 10px; font-weight: 800; text-align: right; }
    .speed-control { position: relative; display: flex; align-items: center; justify-content: center; gap: 3px; min-width: 32px; }
    .speed-menu:not([hidden]) { display: contents; }
    .speed-menu[hidden] { display: none; }
    .speed-wing { display:flex; align-items:center; gap:3px; max-width:0; opacity:0; overflow:hidden; transition:max-width .18s ease,opacity .14s ease; }
    .speed-menu:not([hidden]) .speed-wing { max-width:260px; opacity:1; }
    .speed-wing.speed-left { order:-1; }
    .speed-wing.speed-right { order:1; }
    .speed-option {
      width:30px; height:28px; padding:0 2px; flex:0 0 auto; border:1px solid rgba(255,255,255,.14); border-radius:999px;
      color:#fff; background:rgba(255,255,255,.07); cursor:pointer; font-size:9px; font-weight:850; line-height:1;
      transition:background .12s ease,border-color .12s ease,transform .12s ease;
    }
    .speed-option:hover { background:rgba(255,255,255,.16); transform:translateY(-1px); }
    .speed-option[data-active="true"] { display:none; }
    /* TikTok-style bottom control bar — compact, aspect-aware v3.2. */
    .tpt-ctrlbar {
      position:absolute;left:0;right:0;bottom:0;z-index:48;display:block;min-height:70px;padding:6px 16px 8px;color:#fff;pointer-events:auto;
      background:linear-gradient(to top,rgba(0,0,0,.80) 0%,rgba(0,0,0,.50) 50%,rgba(0,0,0,0) 100%);transition:opacity .18s ease,transform .18s ease;
    }
    .tpt-cb-seek{position:relative;height:14px;margin:0 0 3px;cursor:pointer;touch-action:none}
    .tpt-cb-seek::before{content:"";position:absolute;left:0;right:0;top:6px;height:4px;border-radius:999px;background:rgba(255,255,255,.30);box-shadow:0 1px 2px rgba(0,0,0,.28)}
    .tpt-cb-buf,.tpt-cb-played{position:absolute;left:0;top:6px;height:4px;border-radius:999px;pointer-events:none}
    .tpt-cb-buf{width:0;background:rgba(255,255,255,.43)}.tpt-cb-played{width:0;background:#fe2c55;box-shadow:0 0 5px rgba(254,44,85,.18)}
    .tpt-cb-thumb{position:absolute;top:3px;left:0;width:10px;height:10px;border-radius:50%;background:#fe2c55;box-shadow:0 1px 5px rgba(0,0,0,.42);transform:translateX(-50%) scale(.72);opacity:0;pointer-events:none;transition:opacity .12s ease,transform .12s ease}
    .tpt-cb-seek:hover .tpt-cb-thumb,.tpt-cb-seek:focus-within .tpt-cb-thumb{opacity:1;transform:translateX(-50%) scale(1)}
    .tpt-cb-seekinput{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:.001;cursor:pointer;z-index:3}
    .tpt-cb-tip{position:absolute;bottom:20px;left:0;display:none;min-width:40px;padding:4px 7px;border-radius:6px;color:#fff;background:rgba(0,0,0,.84);box-shadow:0 5px 18px rgba(0,0,0,.35);font-size:10px;font-variant-numeric:tabular-nums;text-align:center;transform:translateX(-50%);pointer-events:none}
    .tpt-cb-seek:hover .tpt-cb-tip{display:block}
    .tpt-cb-row{display:flex;align-items:center;min-height:41px;gap:8px;overflow:visible}
    .tpt-cb-btn{display:grid;place-items:center;flex:0 0 auto;width:34px;height:34px;padding:0;border:0;border-radius:8px;color:#fff;background:transparent;cursor:pointer;text-shadow:0 2px 5px #000;transition:background .14s ease,transform .12s ease,opacity .14s ease}
    .tpt-cb-btn:hover,.tpt-cb-btn:focus-visible{background:rgba(255,255,255,.11);outline:none}.tpt-cb-btn:active{transform:scale(.92)}.tpt-cb-btn[data-active="true"]{background:rgba(255,255,255,.15)}.tpt-cb-btn:disabled{opacity:.42;cursor:not-allowed}
    .tpt-cb-btn svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 2px 3px rgba(0,0,0,.52))}
    .tpt-cb-play svg{width:23px;height:23px;fill:currentColor;stroke:none}
    .tpt-cb-time{display:flex;align-items:center;gap:5px;min-width:max-content;color:#fff;font-size:18px;font-weight:550;line-height:1;letter-spacing:-.35px;font-variant-numeric:tabular-nums;text-shadow:0 2px 5px rgba(0,0,0,.88)}
    .tpt-cb-sep{color:rgba(255,255,255,.68)}.tpt-cb-spacer{flex:1 1 auto;min-width:8px}
    .tpt-cb-vol{position:relative;display:flex;align-items:center;gap:0}.tpt-cb-volslider{width:0;height:4px;margin:0;opacity:0;accent-color:#fe2c55;cursor:pointer;transition:width .16s ease,opacity .12s ease,margin .16s ease}
    .tpt-cb-vol:hover .tpt-cb-volslider,.tpt-cb-vol:focus-within .tpt-cb-volslider{width:72px;margin:0 4px 0 1px;opacity:1}
    .tpt-cb-speed{position:relative;flex:0 0 auto}.tpt-cb-speedbtn{width:41px;font-size:14px;font-weight:850;letter-spacing:-.3px}.tpt-cb-speedbtn .speed-label{font-size:14px;font-weight:850}
    .tpt-cb-menu{position:absolute;right:0;bottom:40px;display:grid;grid-template-columns:repeat(2,minmax(54px,1fr));gap:4px;min-width:124px;padding:6px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(15,15,18,.96);box-shadow:0 14px 36px rgba(0,0,0,.48);backdrop-filter:blur(14px)}
    .tpt-cb-menu[hidden]{display:none}.tpt-cb-menu-item{min-height:29px;padding:0 8px;border:0;border-radius:7px;color:#fff;background:transparent;cursor:pointer;font-size:11px;font-weight:750;text-align:center}.tpt-cb-menu-item:hover,.tpt-cb-menu-item[data-active="true"]{background:rgba(255,255,255,.12)}
    .tpt-cb-pip svg rect:last-child{fill:currentColor;stroke:none}.tpt-cb-shot{margin-left:1px}

    #panel[data-video-shape="portrait"] .tpt-ctrlbar{min-height:67px;padding:6px 13px 7px}
    #panel[data-video-shape="portrait"] .tpt-cb-row{min-height:39px;gap:6px}
    #panel[data-video-shape="portrait"] .tpt-cb-btn{width:32px;height:32px;border-radius:8px}
    #panel[data-video-shape="portrait"] .tpt-cb-btn svg{width:23px;height:23px}#panel[data-video-shape="portrait"] .tpt-cb-play svg{width:22px;height:22px}
    #panel[data-video-shape="portrait"] .tpt-cb-time{font-size:17px;gap:4px}#panel[data-video-shape="portrait"] .tpt-cb-speedbtn{width:38px}#panel[data-video-shape="portrait"] .tpt-cb-speedbtn .speed-label{font-size:13px}
    #panel[data-video-shape="portrait"] .tpt-cb-vol:hover .tpt-cb-volslider,#panel[data-video-shape="portrait"] .tpt-cb-vol:focus-within .tpt-cb-volslider{width:58px}

    #panel[data-video-shape="square"] .tpt-ctrlbar{min-height:68px;padding:6px 14px 7px}#panel[data-video-shape="square"] .tpt-cb-row{min-height:39px;gap:7px}
    #panel[data-video-shape="square"] .tpt-cb-btn{width:32px;height:32px}#panel[data-video-shape="square"] .tpt-cb-btn svg{width:23px;height:23px}#panel[data-video-shape="square"] .tpt-cb-time{font-size:17px}
    #panel[data-video-shape="square"] .tpt-cb-speedbtn{width:38px}#panel[data-video-shape="square"] .tpt-cb-speedbtn .speed-label{font-size:13px}

    #panel[data-video-shape="landscape"] .tpt-ctrlbar{min-height:68px;padding:6px 18px 7px}#panel[data-video-shape="landscape"] .tpt-cb-row{min-height:39px;gap:9px}
    #panel[data-video-shape="landscape"] .tpt-cb-btn{width:32px;height:32px}#panel[data-video-shape="landscape"] .tpt-cb-btn svg{width:23px;height:23px}#panel[data-video-shape="landscape"] .tpt-cb-play svg{width:22px;height:22px}
    #panel[data-video-shape="landscape"] .tpt-cb-time{font-size:17px}#panel[data-video-shape="landscape"] .tpt-cb-speedbtn{width:39px}#panel[data-video-shape="landscape"] .tpt-cb-speedbtn .speed-label{font-size:13px}

    #panel[data-control-density="compact"] .tpt-ctrlbar{min-height:62px;padding:5px 9px 6px}
    #panel[data-control-density="compact"] .tpt-cb-seek{height:12px;margin-bottom:2px}
    #panel[data-control-density="compact"] .tpt-cb-seek::before,#panel[data-control-density="compact"] .tpt-cb-buf,#panel[data-control-density="compact"] .tpt-cb-played{top:5px;height:3px}
    #panel[data-control-density="compact"] .tpt-cb-thumb{top:2px;width:9px;height:9px}#panel[data-control-density="compact"] .tpt-cb-row{min-height:36px;gap:3px}
    #panel[data-control-density="compact"] .tpt-cb-btn{width:29px;height:29px;border-radius:7px}#panel[data-control-density="compact"] .tpt-cb-btn svg{width:21px;height:21px}#panel[data-control-density="compact"] .tpt-cb-play svg{width:20px;height:20px}
    #panel[data-control-density="compact"] .tpt-cb-time{font-size:14px;gap:3px}#panel[data-control-density="compact"] .tpt-cb-spacer{min-width:1px}#panel[data-control-density="compact"] .tpt-cb-speedbtn{width:34px}#panel[data-control-density="compact"] .tpt-cb-speedbtn .speed-label{font-size:12px}
    #panel[data-control-density="compact"] .tpt-cb-vol:hover .tpt-cb-volslider,#panel[data-control-density="compact"] .tpt-cb-vol:focus-within .tpt-cb-volslider{width:44px}

    #panel[data-control-density="micro"] .tpt-ctrlbar{min-height:58px;padding:4px 6px 5px}
    #panel[data-control-density="micro"] .tpt-cb-seek{height:11px;margin-bottom:1px}
    #panel[data-control-density="micro"] .tpt-cb-seek::before,#panel[data-control-density="micro"] .tpt-cb-buf,#panel[data-control-density="micro"] .tpt-cb-played{top:5px;height:3px}
    #panel[data-control-density="micro"] .tpt-cb-thumb{top:2px;width:9px;height:9px}#panel[data-control-density="micro"] .tpt-cb-row{min-height:34px;gap:1px}
    #panel[data-control-density="micro"] .tpt-cb-btn{width:27px;height:27px;border-radius:6px}#panel[data-control-density="micro"] .tpt-cb-btn svg{width:19px;height:19px}#panel[data-control-density="micro"] .tpt-cb-play svg{width:18px;height:18px}
    #panel[data-control-density="micro"] .tpt-cb-time{font-size:12px;gap:2px;letter-spacing:-.25px}#panel[data-control-density="micro"] .tpt-cb-spacer{min-width:0}#panel[data-control-density="micro"] .tpt-cb-speedbtn{width:30px}#panel[data-control-density="micro"] .tpt-cb-speedbtn .speed-label{font-size:11px}
    #panel[data-control-density="micro"] .tpt-cb-volslider{display:none}

    #panel[data-video-shape] .video-meta{bottom:82px}#panel[data-video-shape] .caption-overlay{bottom:86px}#panel[data-video-shape][data-has-video-meta="true"] .caption-overlay{bottom:144px}
    #panel[data-control-density="compact"] .video-meta,#panel[data-control-density="micro"] .video-meta{bottom:73px}
    #panel[data-control-density="compact"] .caption-overlay,#panel[data-control-density="micro"] .caption-overlay{bottom:76px}
    #panel[data-control-density="compact"][data-has-video-meta="true"] .caption-overlay,#panel[data-control-density="micro"][data-has-video-meta="true"] .caption-overlay{bottom:132px}

    .video-stats-panel {
      position:absolute; top:76px; left:50%; z-index:46; width:max-content; max-width:calc(100% - 44px);
      color:rgba(255,255,255,.92); pointer-events:auto; cursor:grab; user-select:none;
      font:600 9px/1.05 system-ui,-apple-system,"Segoe UI",sans-serif;
      transform:translateX(-50%);
      -webkit-backdrop-filter:none!important; backdrop-filter:none!important;
    }
    .video-stats-panel:active { cursor:grabbing; }
    .video-stats-panel[hidden] { display:none!important; }
    .video-stats-panel .vs-box {
      position:relative; width:max-content; max-width:100%; min-height:0; padding:5px 8px; overflow:hidden;
      border:1px solid rgba(255,255,255,.20); border-radius:12px;
      background:rgba(41,34,36,.66); box-shadow:0 5px 16px rgba(0,0,0,.25);
      transition:background-color .14s ease,border-color .14s ease;
      -webkit-backdrop-filter:none!important; backdrop-filter:none!important;
    }
    .video-stats-panel:hover .vs-box { background:rgba(41,34,36,.76); border-color:rgba(255,255,255,.29); }
    .video-stats-panel .vs-row { display:flex; align-items:center; flex-wrap:nowrap; min-height:22px; white-space:nowrap; }
    .video-stats-panel .vs-grp { display:flex; align-items:center; gap:5px; min-width:0; padding:0 7px; }
    .video-stats-panel .vs-grp:first-child { padding-left:0; }
    .video-stats-panel .vs-grp + .vs-grp { border-left:1px solid rgba(255,255,255,.14); }
    .video-stats-panel .vs-date,
    .video-stats-panel .vs-views,
    .video-stats-panel .vs-er,
    .video-stats-panel .vs-m { display:inline-flex; align-items:center; gap:3px; white-space:nowrap; }
    .video-stats-panel .vs-date {
      min-height:20px; padding:2px 7px; border:1px solid rgba(255,255,255,.38); border-radius:999px;
      background:rgba(255,255,255,.015);
    }
    .video-stats-panel .vs-i { width:11px; height:11px; flex:0 0 auto; color:rgba(255,255,255,.78); }
    .video-stats-panel b { color:#fff; font-size:11px; font-weight:800; letter-spacing:0; }
    .video-stats-panel i { display:none!important; }
    .video-stats-panel .vs-er b { font-size:11px; }
    .video-stats-panel .vs-grp-detail { gap:7px; padding-right:0; }
    .video-stats-panel .vs-m { gap:3px; }
    .video-stats-panel .vs-hint,
    .video-stats-panel .vs-copied { display:none!important; }
    @media (max-width:560px) {
      .video-stats-panel { top:64px; max-width:calc(100% - 20px); }
      .video-stats-panel .vs-box { padding:4px 6px; border-radius:10px; }
      .video-stats-panel .vs-grp { padding:0 5px; gap:4px; }
      .video-stats-panel .vs-grp-detail { gap:5px; }
      .video-stats-panel b { font-size:10px; }
      .video-stats-panel .vs-i { width:10px; height:10px; }
      .video-stats-panel .vs-date { min-height:18px; padding:1px 5px; }
    }
    @media (max-width:420px) {
      .video-stats-panel .vs-grp { padding:0 4px; }
      .video-stats-panel .vs-grp-detail { gap:4px; }
      .video-stats-panel b { font-size:9px; }
      .video-stats-panel .vs-i { width:9px; height:9px; }
    }
    .subtitle-gate {
      position: absolute; inset: 0; z-index: 35; display: grid; place-items: center; padding: 22px;
      color: #fff; text-align: center; background: radial-gradient(circle at center,rgba(104,10,40,.66),rgba(0,0,0,.94) 72%);
      backdrop-filter: blur(8px); transition: opacity .22s ease, visibility .22s ease;
    }
    .subtitle-gate.is-hidden { opacity: 0; visibility: hidden; pointer-events: none; }
    .gate-box { display: grid; justify-items: center; gap: 12px; max-width: 360px; font-weight: 850; }
    .cat-loader { position: relative; width: 66px; height: 66px; }
    .cat-loader::before {
      content: "😺"; position: absolute; inset: 0; display: grid; place-items: center; font-size: 39px;
      animation: catPulse .85s ease-in-out infinite alternate; filter: drop-shadow(0 7px 12px rgba(0,0,0,.45));
    }
    .cat-loader::after {
      content: ""; position: absolute; inset: 0; border: 3px solid rgba(255,255,255,.18); border-top-color: #fe2c55;
      border-right-color: #25f4ee; border-radius: 50%; animation: spin .72s linear infinite;
    }
    .gate-text { font-size: 15px; line-height: 1.45; text-shadow: 0 2px 8px #000; }
    .loading-dots { animation: textPulse 1s ease-in-out infinite alternate; }
    .caption-overlay {
      --tdt-caption-size: 22px;
      position: absolute; left: 4%; right: 4%; bottom: 118px; z-index: 28; display: none;
      padding: 13px 18px 13px 28px; border-radius: 16px; color: #fff; background: rgba(67,67,62,.82);
      text-align: left; overflow-wrap: anywhere; pointer-events: none;
      text-shadow: 0 2px 5px rgba(0,0,0,.86); font-family: system-ui,-apple-system,"Segoe UI",sans-serif;
      line-height: 1.25; box-shadow: 0 6px 24px rgba(0,0,0,.34);
      -webkit-backdrop-filter: none !important; backdrop-filter: none !important;
      transition: background-color .18s ease, opacity .18s ease;
    }
    .caption-overlay::before {
      content: ""; position: absolute; left: 14px; top: 14px; bottom: 14px; width: 6px;
      border-radius: 999px; background: #fe2c55; box-shadow: 0 0 12px rgba(254,44,85,.28);
    }
    .caption-translated {
      color: #fff; font-size: var(--tdt-caption-size); font-weight: 750; line-height: 1.18;
      letter-spacing: -.015em; white-space: pre-wrap;
    }
    .caption-original {
      margin-top: 5px; color: rgba(255,255,255,.82); font-size: max(12px,calc(var(--tdt-caption-size) * .64));
      font-weight: 400; line-height: 1.24; white-space: pre-wrap;
    }
    .caption-original:empty { display: none; }
    .source-note {
      position: absolute; right: 12px; bottom: 108px; z-index: 29; padding: 4px 8px; border-radius: 999px;
      color: rgba(255,255,255,.66); background: rgba(0,0,0,.38); font-size: 9px; pointer-events: none;
      backdrop-filter: blur(8px);
    }
    .hd-download-widget {
      position: absolute; top: 14px; right: 14px; z-index: 44; display: grid; place-items: center;
      width: 34px; height: 34px; padding: 0; border: 1px solid rgba(255,255,255,.32); border-radius: 50%;
      color: #fff; background: rgba(39,39,42,.76); box-shadow: 0 10px 30px rgba(0,0,0,.42);
      backdrop-filter: blur(12px); cursor: pointer; transition: transform .16s ease, filter .16s ease;
    }
    .hd-download-widget svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .hd-download-widget::after { content: "HD"; position: absolute; right: -2px; bottom: -2px; padding: 1px 4px; border-radius: 999px; color: #fff; background: #ff4777; border: 1px solid rgba(255,255,255,.55); font-size: 8px; font-weight: 950; line-height: 1.3; }
    .hd-download-widget:hover { filter: brightness(1.16); transform: translateY(-1px) scale(1.035); }
    .hd-download-widget:disabled { cursor: wait; opacity: .62; transform: none; }
    .error-box { display: grid; justify-items: center; gap: 10px; max-width: 360px; }
    .retry-video { min-height: 38px; padding: 8px 14px; border: 0; border-radius: 999px; color: white; background: linear-gradient(135deg,#fe2c55,#ff4777); cursor: pointer; font-weight: 850; }
    #notice {
      --notice-accent:#60a5fa;
      position:absolute;top:10px;left:50%;z-index:70;display:flex;align-items:center;gap:9px;
      width:max-content;max-width:min(430px,calc(100% - 22px));min-height:42px;padding:6px 13px 6px 7px;
      overflow:hidden;border:1px solid rgba(255,255,255,.14);border-radius:999px;color:#fff;
      background:linear-gradient(180deg,rgba(8,10,15,.97),rgba(3,4,8,.96));
      box-shadow:0 16px 46px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.10),0 0 0 1px rgba(0,0,0,.38);
      opacity:0;transform:translate(-50%,-16px) scale(.74);transform-origin:top center;
      transition:opacity .22s ease,transform .38s cubic-bezier(.2,.88,.22,1.16),max-width .25s ease;
      pointer-events:none;isolation:isolate;backdrop-filter:blur(18px) saturate(145%);
      font:800 11px/1.35 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;
    }
    #notice[data-open="true"]{opacity:1;transform:translate(-50%,0) scale(1)}
    #notice[data-state="success"]{--notice-accent:#34d399}
    #notice[data-state="error"]{--notice-accent:#fb7185}
    #notice[data-state="loading"]{--notice-accent:#fbbf24}
    #notice .notice-icon{display:grid;place-items:center;flex:0 0 auto;width:29px;height:29px;border-radius:50%;color:#fff;background:color-mix(in srgb,var(--notice-accent) 28%,rgba(255,255,255,.04));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--notice-accent) 55%,transparent),0 0 18px color-mix(in srgb,var(--notice-accent) 24%,transparent);font-size:14px;font-weight:950}
    #notice[data-state="loading"] .notice-icon{font-size:0}
    #notice[data-state="loading"] .notice-icon::before{content:"";width:12px;height:12px;border:2px solid rgba(255,255,255,.34);border-top-color:#fff;border-radius:50%;animation:noticeSpin .7s linear infinite}
    #notice .notice-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 1px 8px rgba(0,0,0,.45)}
    #notice::after{content:"";position:absolute;left:12px;right:12px;bottom:0;height:2px;border-radius:999px;background:var(--notice-accent);transform-origin:left;animation:noticeLife 3.55s linear forwards;opacity:.9}
    @keyframes noticeSpin{to{transform:rotate(360deg)}}
    @keyframes noticeLife{from{transform:scaleX(1)}to{transform:scaleX(0)}}
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes catPulse { from { transform: scale(.92) rotate(-4deg); } to { transform: scale(1.08) rotate(4deg); } }
    @keyframes textPulse { from { opacity: .62; transform: translateY(1px); } to { opacity: 1; transform: translateY(-1px); } }
    @keyframes playbackZoomOut {
      0% { opacity:0; transform:translate(-50%,-50%) scale(1.12); }
      16% { opacity:1; transform:translate(-50%,-50%) scale(1); }
      100% { opacity:0; transform:translate(-50%,-50%) scale(.62); }
    }
    @media (max-width: 620px) {
      #notice{top:8px;max-width:calc(100% - 16px);min-height:38px;padding:5px 11px 5px 6px;font-size:10px}
      #notice .notice-icon{width:27px;height:27px}
      .control-dock { top: 9px; gap: 4px; min-height: 32px; max-width: calc(100% - 96px); padding: 2px 4px; }
      .control-dock[data-speed-open="true"] { max-width:calc(100% - 8px); }
      .player-icon-btn { width: 30px; height: 30px; }
      .player-icon-btn svg { width: 15px; height: 15px; }
      .volume-control { top: 9px; left: 9px; }
      .volume-fab,.hd-download-widget { width: 32px; height: 32px; }
      .volume-fab svg { width: 20px; height: 20px; }
      .hd-download-widget svg { width: 16px; height: 16px; }
      .speed-option { width:27px; height:26px; font-size:8px; }
      .hd-download-widget { top: 10px; right: 10px; }
      .volume-control[data-open="true"] .volume-popover,
      .volume-control:hover .volume-popover,
      .volume-control:focus-within .volume-popover { width: 122px; }
      .volume-slider { width: 72px; }
      .tpt-ctrlbar { min-height:76px; padding:7px 10px 8px; }
      .tpt-cb-seek { height:15px; margin-bottom:3px; }
      .tpt-cb-seek::before,.tpt-cb-buf,.tpt-cb-played { top:6px; height:4px; }
      .tpt-cb-thumb { top:3px; width:10px; height:10px; }
      .tpt-cb-row { min-height:43px; gap:4px; }
      .tpt-cb-btn { width:34px; height:34px; border-radius:7px; }
      .tpt-cb-btn svg { width:23px; height:23px; }
      .tpt-cb-play svg { width:22px; height:22px; }
      .tpt-cb-time { gap:4px; font-size:14px; }
      .tpt-cb-spacer { min-width:2px; }
      .tpt-cb-speedbtn { width:36px; font-size:12px; }
      .tpt-cb-speedbtn .speed-label { font-size:12px; }
      .tpt-cb-vol:hover .tpt-cb-volslider,.tpt-cb-vol:focus-within .tpt-cb-volslider { width:58px; }
      .caption-overlay { left: 3%; right: 3%; bottom: 94px; padding: 10px 13px 10px 24px; border-radius: 13px; }
      #panel[data-has-video-meta="true"] .caption-overlay { bottom:158px; }
      .video-meta { left:11px; right:58px; bottom:89px; max-width:calc(100% - 69px); }
      .video-meta-author { margin-bottom:5px; font-size:14px; }
      .video-meta-verified { width:16px; height:16px; font-size:11px; }
      .video-meta-verified svg { width:16px; height:16px; }
      .video-meta-caption { font-size:12px; }
      .video-meta-more { font-size:12px; }
      .center-playback-button { width:70px; height:70px; }
      .center-playback-button svg { width:38px; height:38px; }
      .caption-overlay::before { left: 11px; top: 11px; bottom: 11px; width: 5px; }
      .source-note { display: none; }

    }
    @media (max-width: 430px) {
      .control-dock { gap: 3px; max-width: calc(100% - 98px); padding: 0 4px; }
      .player-icon-btn { width: 30px; height: 30px; }
      .player-icon-btn svg { width: 15px; height: 15px; }
      .speed-label { font-size: 10px; }
      .volume-fab,.hd-download-widget { width: 32px; height: 32px; }
      .volume-control { top: 10px; left: 8px; }
      .hd-download-widget { top: 10px; right: 8px; }

    }
  `;

  function normalizeUiText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function concealTikTokShopNoticeElement(element) {
    if (!(element instanceof Element) || element.dataset.tdtShopNoticeHidden === "1") return false;
    let target = element;
    let cursor = element;
    for (let depth = 0; cursor && cursor !== document.body && depth < 7; depth += 1, cursor = cursor.parentElement) {
      const text = normalizeUiText(cursor.textContent);
      if (!text.includes(TIKTOK_SHOP_APP_NOTICE_TEXT)) continue;
      const role = String(cursor.getAttribute("role") || "").toLowerCase();
      const style = getComputedStyle(cursor);
      if (role === "status" || role === "alert" || cursor.hasAttribute("data-sonner-toast") || /toast/i.test(String(cursor.className || "")) || style.position === "fixed") {
        target = cursor;
        break;
      }
      target = cursor;
    }
    target.dataset.tdtShopNoticeHidden = "1";
    target.setAttribute("aria-hidden", "true");
    target.style.setProperty("display", "none", "important");
    target.style.setProperty("visibility", "hidden", "important");
    target.style.setProperty("pointer-events", "none", "important");
    return true;
  }

  function suppressTikTokShopAppNotice(root = document) {
    const candidates = [];
    const noticeSelector = '[role="status"],[role="alert"],[data-sonner-toast],[class*="toast" i]';
    if (root instanceof Element && !["SCRIPT", "STYLE", "NOSCRIPT"].includes(root.tagName)) {
      const compactRoot = root.childElementCount <= 10;
      const rootText = compactRoot ? normalizeUiText(root.textContent) : "";
      if (root.matches(noticeSelector) || (rootText.length < 320 && rootText.includes(TIKTOK_SHOP_APP_NOTICE_TEXT))) candidates.push(root);
    }
    const scope = root instanceof Document || root instanceof Element ? root : null;
    if (scope?.querySelectorAll) {
      scope.querySelectorAll(noticeSelector).forEach((element) => candidates.push(element));
    }
    for (const element of candidates) {
      const text = normalizeUiText(element.textContent);
      if (text && text.length < 320 && text.includes(TIKTOK_SHOP_APP_NOTICE_TEXT)) concealTikTokShopNoticeElement(element);
    }
  }

  function updateControlWidgetStatus(message, state = "") {
    if (!controlWidgetStatus) return;
    controlWidgetStatus.textContent = String(message || "Sẵn sàng");
    controlWidgetStatus.dataset.state = state;
  }

  function playerIcon(name) {
    const icons = {
      captions: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M7 10h3M14 10h3M7 14h4M13 14h4"></path></svg>',
      refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"></path><path d="M20 4v7h-7"></path></svg>',
      download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 20h14"></path></svg>',
      more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"></circle><circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none"></circle></svg>',
      fullscreen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"></path></svg>',
      clean: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"></path><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7"></path><path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c5.4 0 9 5 9 5a17 17 0 0 1-2.1 2.6M6.6 6.7C4.3 8.2 3 10 3 10s3.6 5 9 5c1 0 1.9-.2 2.7-.4"></path></svg>',
      cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1"></circle><circle cx="19" cy="20" r="1"></circle><path d="M3 3h2l2.4 11.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6"></path></svg>',
      play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.8v14.4c0 .9 1 1.45 1.78.98l11.05-7.2a1.15 1.15 0 0 0 0-1.96L8.78 3.82A1.15 1.15 0 0 0 7 4.8Z" fill="currentColor" stroke="none"></path></svg>',
      pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="4" width="4.5" height="16" rx="1.2" fill="currentColor" stroke="none"></rect><rect x="14" y="4" width="4.5" height="16" rx="1.2" fill="currentColor" stroke="none"></rect></svg>',
      volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"></path><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"></path></svg>',
      mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"></path><path d="m17 9 4 4M21 9l-4 4"></path></svg>',
      settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"></path></svg>',
      info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 10.5v6"></path><circle cx="12" cy="7.2" r="1" fill="currentColor" stroke="none"></circle></svg>',
      imageSearch: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h2l1.2-1.5h4.6L15.5 5h2A2.5 2.5 0 0 1 20 7.5v8A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5Z"></path><circle cx="12" cy="11.5" r="3.2"></circle><path d="m16.8 16.3 2.3 2.3"></path></svg>',
      snapshot: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h2.2l1.25-1.6h5.1L15.8 5H18a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 18 19H6.5A2.5 2.5 0 0 1 4 16.5Z"></path><circle cx="12.25" cy="12" r="3.6"></circle></svg>',
      cleanEye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.8 12s3.8-7 10.2-7 10.2 7 10.2 7-3.8 7-10.2 7S1.8 12 1.8 12Z"></path><circle cx="12" cy="12" r="3.2"></circle></svg>',
      pip: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="2"></rect><rect x="12.5" y="12" width="6.5" height="5" rx=".8" fill="currentColor" stroke="none"></rect></svg>',
      webFullscreen: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="2"></rect><rect x="6.2" y="8" width="11.6" height="8" rx="1"></rect></svg>'
    };
    return icons[name] || "";
  }

  function setControlWidgetOpen(open) {
    controlWidgetOpen = Boolean(open);
    if (controlWidgetPanel) controlWidgetPanel.hidden = !controlWidgetOpen;
    const button = controlWidgetShadow?.getElementById("tdt-control-toggle");
    if (button) button.setAttribute("aria-expanded", String(controlWidgetOpen));
  }

  function ensureControlWidgetOnTop() {
    if (controlWidgetHost && !controlWidgetHost.isConnected) document.documentElement.appendChild(controlWidgetHost);
  }

  function createControlWidget() {
    if (controlWidgetHost?.isConnected) return;
    controlWidgetHost = document.createElement("div");
    controlWidgetHost.id = "tdt-control-widget-host";
    controlWidgetHost.style.cssText = "all:initial;position:fixed;left:18px;bottom:18px;z-index:2147483647;display:block;pointer-events:auto;";
    document.documentElement.appendChild(controlWidgetHost);
    controlWidgetShadow = controlWidgetHost.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host{all:initial}*{box-sizing:border-box}button{font:inherit}
      #wrap{position:relative;color:#fff;font:12px/1.35 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
      #tdt-control-toggle{display:flex;align-items:center;gap:10px;width:auto;max-width:min(222px,calc(100vw - 28px));min-width:198px;height:62px;padding:8px 14px 8px 8px;border:1px solid rgba(255,255,255,.12);border-radius:22px;color:#fff;background:linear-gradient(155deg,rgba(13,15,23,.965),rgba(7,8,14,.955));box-shadow:0 14px 36px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.095);cursor:pointer;text-align:left;transition:transform .18s ease,filter .18s ease,width .2s ease,min-width .2s ease,padding .2s ease;backdrop-filter:blur(17px) saturate(140%)}
      #tdt-control-toggle:hover{filter:brightness(1.06);transform:translateY(-1px);box-shadow:0 18px 42px rgba(0,0,0,.54),inset 0 1px 0 rgba(255,255,255,.11)}
      .tdt-control-logo{display:grid;place-items:center;flex:0 0 44px;width:44px;height:44px;border:0;border-radius:16px;color:#fff;background:linear-gradient(145deg,#fe2c55,#ff4f7d);box-shadow:0 10px 22px rgba(254,44,85,.28),inset 0 1px 0 rgba(255,255,255,.24);font-size:27px;font-weight:950;font-style:italic;line-height:1}
      .tdt-control-watch{display:grid;gap:2px;min-width:0;padding-right:2px;font-style:normal}
      .tdt-control-watch strong{overflow:hidden;color:#f8f8fb;font-size:18px;font-weight:900;font-variant-numeric:tabular-nums;letter-spacing:.2px;line-height:1.06;text-overflow:ellipsis;white-space:nowrap}
      .tdt-control-watch span{overflow:hidden;color:#a8afbd;font-size:11px;font-weight:700;line-height:1.2;text-overflow:ellipsis;white-space:nowrap}
      #tdt-control-watch-close{position:absolute;top:-7px;right:-7px;display:grid;place-items:center;width:24px;height:24px;padding:0;border:2px solid rgba(16,16,20,.98);border-radius:50%;color:#fff;background:#ff315f;box-shadow:0 5px 14px rgba(0,0,0,.44);cursor:pointer;font-size:16px;font-weight:950;line-height:1;z-index:3;opacity:0;visibility:hidden;pointer-events:none;transform:scale(.82);transition:opacity .14s ease,visibility .14s ease,transform .14s ease,filter .14s ease}
      #wrap:hover #tdt-control-watch-close,#wrap:focus-within #tdt-control-watch-close{opacity:1;visibility:visible;pointer-events:auto;transform:scale(1)}
      #tdt-control-watch-close:hover{filter:brightness(1.12);transform:scale(1.06)!important}
      #wrap.watch-hidden #tdt-control-toggle{min-width:48px;width:48px;height:48px;padding:0;border:0;border-radius:16px;background:transparent;box-shadow:none;backdrop-filter:none}
      #wrap.watch-hidden .tdt-control-logo{flex-basis:48px;width:48px;height:48px;border-radius:16px;color:#fff;background:linear-gradient(145deg,#fe2c55,#ff4777);font-size:29px}
      #wrap.watch-hidden .tdt-control-watch,#wrap.watch-hidden #tdt-control-watch-close{display:none}
      #panel{position:absolute;left:0;bottom:72px;width:min(320px,calc(100vw - 28px));padding:12px;border:1px solid rgba(255,255,255,.16);border-radius:18px;background:linear-gradient(160deg,rgba(20,20,24,.98),rgba(8,8,12,.98));box-shadow:0 24px 70px rgba(0,0,0,.62);backdrop-filter:blur(22px) saturate(135%)}
      #panel[hidden]{display:none}.head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}.identity{display:flex;align-items:center;gap:9px}.mini-logo{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:linear-gradient(145deg,#fe2c55,#ff4777);font-size:18px;font-weight:950;font-style:italic}.head strong{display:block;font-size:14px}.head small{display:block;color:#a6adbd;font-size:9px}.close{display:grid;place-items:center;width:30px;height:30px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.055);color:#fff;cursor:pointer}.close:hover{background:rgba(255,255,255,.12)}
      .status{padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.075);color:#cbd5e1;font-size:10px;overflow-wrap:anywhere}.status[data-state="ok"]{color:#8fffe9;background:rgba(37,244,238,.12)}.status[data-state="error"]{color:#fecaca;background:rgba(185,28,28,.20)}.status[data-state="loading"]{color:#ffd0db;background:rgba(254,44,85,.20)}
      .quick{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.quick button{min-height:42px;border:1px solid rgba(255,255,255,.12);border-radius:13px;color:#fff;background:rgba(255,255,255,.075);cursor:pointer;font-weight:850}.quick button:first-child{background:linear-gradient(135deg,#fe2c55,#ff4777);border:0}.quick button:hover{filter:brightness(1.1)}.quick button:disabled{opacity:.55;cursor:wait}
      .hint{margin-top:9px;color:#8992a5;font-size:9px;text-align:center}
      @media(max-width:520px){#tdt-control-toggle{max-width:min(202px,calc(100vw - 20px));min-width:184px;height:58px;padding:7px 12px 7px 7px;border-radius:20px}.tdt-control-logo{flex-basis:40px;width:40px;height:40px;border-radius:14px;font-size:24px}.tdt-control-watch strong{font-size:16px}.tdt-control-watch span{font-size:10px}#panel{bottom:66px;width:min(298px,calc(100vw - 18px))}}
    `;

    const wrap = document.createElement("div");
    wrap.id = "wrap";
    const toggle = document.createElement("button");
    toggle.id = "tdt-control-toggle";
    toggle.type = "button";
    toggle.title = "Mở công cụ nhanh TikTok Sub VI";
    toggle.setAttribute("aria-expanded", "false");
    const toggleLogo = document.createElement("span");
    toggleLogo.className = "tdt-control-logo";
    toggleLogo.textContent = "T";
    const toggleWatch = document.createElement("span");
    toggleWatch.className = "tdt-control-watch";
    const toggleWatchTime = document.createElement("strong");
    toggleWatchTime.id = "tdt-control-watch-time";
    toggleWatchTime.textContent = "00:00:00";
    const toggleWatchVideos = document.createElement("span");
    toggleWatchVideos.id = "tdt-control-watch-videos";
    toggleWatchVideos.textContent = "0 videos today";
    toggleWatch.append(toggleWatchTime, toggleWatchVideos);
    toggle.append(toggleLogo, toggleWatch);
    toggle.addEventListener("click", () => setControlWidgetOpen(!controlWidgetOpen));

    const watchClose = document.createElement("button");
    watchClose.id = "tdt-control-watch-close";
    watchClose.type = "button";
    watchClose.textContent = "×";
    watchClose.title = "Ẩn thông tin thời gian xem, giữ lại nút T";
    watchClose.setAttribute("aria-label", "Ẩn thông tin thời gian xem");
    watchClose.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      extensionSettings = { ...extensionSettings, watchWidgetEnabled: false };
      chrome.storage.local.set({ [SETTINGS_KEY]: extensionSettings });
      renderWatchToolbar();
      showWatchToast("Đã thu gọn widget, nút T vẫn hoạt động.");
    });

    controlWidgetPanel = document.createElement("section");
    controlWidgetPanel.id = "panel";
    controlWidgetPanel.hidden = true;

    const head = document.createElement("div");
    head.className = "head";
    const identity = document.createElement("div");
    identity.className = "identity";
    const miniLogo = document.createElement("span");
    miniLogo.className = "mini-logo";
    miniLogo.textContent = "T";
    const titleBox = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "TikTok Sub VI";
    const subtitle = document.createElement("small");
    subtitle.textContent = "Công cụ nhanh";
    titleBox.append(title, subtitle);
    identity.append(miniLogo, titleBox);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "close";
    close.textContent = "✕";
    close.addEventListener("click", () => setControlWidgetOpen(false));
    head.append(identity, close);

    controlWidgetStatus = document.createElement("div");
    controlWidgetStatus.className = "status";
    controlWidgetStatus.textContent = "Đang nhận diện video…";

    const quick = document.createElement("div");
    quick.className = "quick";
    controlWidgetScanButton = document.createElement("button");
    controlWidgetScanButton.type = "button";
    controlWidgetScanButton.textContent = "Quét video";
    controlWidgetScanButton.addEventListener("click", async () => {
      controlWidgetScanButton.disabled = true;
      try {
        await forceScanCurrentVideo();
      } catch (error) {
        updateControlWidgetStatus(error.message || "Không thể hiển thị video.", "error");
      } finally {
        controlWidgetScanButton.disabled = remoteAccessLocked;
      }
    });

    controlWidgetSubtitleButton = document.createElement("button");
    controlWidgetSubtitleButton.type = "button";
    controlWidgetSubtitleButton.textContent = "Lấy sub";
    controlWidgetSubtitleButton.addEventListener("click", async () => {
      if (!video) {
        controlWidgetScanButton.click();
        return;
      }
      if (!extensionSettings.placeBelowSubtitleTranslator && !extensionSettings.scanSubtitles) {
        extensionSettings = { ...extensionSettings, scanSubtitles: true };
        chrome.storage.local.set({ [SETTINGS_KEY]: extensionSettings });
      }
      controlWidgetSubtitleButton.disabled = true;
      try {
        const externalReady = extensionSettings.placeBelowSubtitleTranslator
          ? await forceReadExternalSubtitles()
          : false;
        if (!externalReady) await autoLoadSubtitles(true);
      }
      finally { controlWidgetSubtitleButton.disabled = remoteAccessLocked; }
    });
    quick.append(controlWidgetScanButton, controlWidgetSubtitleButton);

    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "Toàn bộ cài đặt nằm trong popup extension";
    controlWidgetPanel.append(head, controlWidgetStatus, quick, hint);
    wrap.append(controlWidgetPanel, toggle, watchClose);
    controlWidgetShadow.append(style, wrap);
    renderWatchToolbar();
  }

  function syncControlWidgetSettings() {
    // Cài đặt được quản lý trong popup; widget trên trang chỉ giữ công cụ nhanh.
  }

  function clampFontSize(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_FONT_SIZE;
    return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(parsed)));
  }

  function clampSubtitleOpacity(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_SETTINGS.subtitleBackgroundOpacity;
    return Math.min(MAX_SUBTITLE_OPACITY, Math.max(MIN_SUBTITLE_OPACITY, Math.round(parsed * 100) / 100));
  }

  function clampPlaybackRate(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, Math.round(parsed * 4) / 4));
  }

  function clampPlaybackVolume(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(MAX_PLAYBACK_VOLUME, Math.max(MIN_PLAYBACK_VOLUME, Math.round(parsed * 100) / 100));
  }

  function formatPlaybackRate(value) {
    const rate = clampPlaybackRate(value);
    return Number.isInteger(rate) ? String(rate) : String(rate).replace(/0+$/, "").replace(/\.$/, "");
  }

  function applyFontSize(value, persist = false) {
    subtitleFontSize = clampFontSize(value);
    if (captionOverlay) captionOverlay.style.setProperty("--tdt-caption-size", `${subtitleFontSize}px`);
    if (sizeRange) sizeRange.value = String(subtitleFontSize);
    if (sizeValue) sizeValue.textContent = `${subtitleFontSize}px`;
    const widgetRange = controlWidgetShadow?.querySelector("input[data-widget-font-size]");
    if (widgetRange) {
      widgetRange.value = String(subtitleFontSize);
      const widgetValue = widgetRange.parentElement?.querySelector(".range-value");
      if (widgetValue) widgetValue.textContent = `${subtitleFontSize}px`;
    }
    if (persist) chrome.storage.local.set({ [FONT_SIZE_KEY]: subtitleFontSize });
  }

  function applySubtitleOpacity(value, persist = false) {
    const opacity = clampSubtitleOpacity(value);
    extensionSettings = { ...extensionSettings, subtitleBackgroundOpacity: opacity };
    if (captionOverlay) captionOverlay.style.backgroundColor = `rgba(67,67,62,${opacity})`;
    if (subtitleOpacityRange) subtitleOpacityRange.value = String(Math.round(opacity * 100));
    if (subtitleOpacityValue) subtitleOpacityValue.textContent = `${Math.round(opacity * 100)}%`;
    syncControlWidgetSettings();
    if (persist) chrome.storage.local.set({ [SETTINGS_KEY]: extensionSettings });
  }

  function applyPlaybackRate(value, persist = false) {
    const rate = clampPlaybackRate(value);
    extensionSettings = { ...extensionSettings, playbackRate: rate };
    if (video) {
      try {
        video.defaultPlaybackRate = rate;
        video.playbackRate = rate;
        video.preservesPitch = true;
      } catch {}
    }
    if (nativeAudioBridgeActive && nativeVideo?.isConnected) {
      try {
        nativeVideo.defaultPlaybackRate = rate;
        nativeVideo.playbackRate = rate;
        nativeVideo.preservesPitch = true;
      } catch {}
    }
    if (playerSpeedButton) {
      playerSpeedButton.querySelector(".speed-label").textContent = `${formatPlaybackRate(rate)}×`;
      playerSpeedButton.title = `Chọn tốc độ phát: ${formatPlaybackRate(rate)}x`;
    }
    if (playerSpeedMenu) {
      playerSpeedMenu.querySelectorAll("[data-rate]").forEach((item) => {
        item.dataset.active = String(Math.abs(Number(item.dataset.rate) - rate) < 0.001);
      });
    }
    syncControlWidgetSettings();
    if (persist) chrome.storage.local.set({ [SETTINGS_KEY]: extensionSettings });
  }

  function stepPlaybackRate(direction) {
    const current = clampPlaybackRate(video?.playbackRate || extensionSettings.playbackRate);
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    PLAYBACK_RATE_STEPS.forEach((rate, index) => {
      const distance = Math.abs(rate - current);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    const nextIndex = Math.max(0, Math.min(PLAYBACK_RATE_STEPS.length - 1, nearestIndex + Math.sign(direction)));
    const nextRate = PLAYBACK_RATE_STEPS[nextIndex];
    applyPlaybackRate(nextRate, true);
    showNotice(`Tốc độ ${formatPlaybackRate(nextRate)}×`, true);
  }

  function cycleVideoZoom() {
    if (!video) return;
    videoZoomIndex = (videoZoomIndex + 1) % VIDEO_ZOOM_LEVELS.length;
    const zoom = VIDEO_ZOOM_LEVELS[videoZoomIndex];
    video.style.setProperty('transform', `scale(${zoom})`, 'important');
    video.style.setProperty('transform-origin', 'center center', 'important');
    video.style.setProperty('transition', 'transform 160ms ease', 'important');
    showNotice(`Zoom ${zoom}×`, true);
  }

  function updateVolumeUi() {
    const volume = clampPlaybackVolume(extensionSettings.playbackVolume);
    const audible = volume > 0 && !autoplayMutedFallback;
    if (playerVolumeRange) playerVolumeRange.value = String(Math.round(volume * 100));
    if (playerVolumeValue) playerVolumeValue.textContent = `${Math.round(volume * 100)}%`;
    if (playerVolumeButton) {
      playerVolumeButton.dataset.active = String(audible);
      playerVolumeButton.title = autoplayMutedFallback
        ? "Chrome đang tạm chặn autoplay có tiếng · extension sẽ tự bật lại khi được phép"
        : volume > 0 ? `Âm lượng ${Math.round(volume * 100)}%` : "Đang tắt âm thanh";
      playerVolumeButton.setAttribute("aria-label", playerVolumeButton.title);
      playerVolumeButton.innerHTML = playerIcon(audible ? "volume" : "mute");
    }
  }

  function nativeAudioBridgeCanRun(target = nativeVideo) {
    if (!extensionSettings.autoReplace || !(target instanceof HTMLVideoElement) || !target.isConnected || target.error) return false;
    const source = String(target.currentSrc || target.src || "").trim();
    return Boolean(source);
  }

  function audioStudioTarget(target = video) {
    if (nativeAudioBridgeActive && nativeAudioBridgeCanRun(nativeVideo) && (target === video || target == null)) return nativeVideo;
    return target;
  }

  function activeNativeAudioEngine() {
    if (!(nativeVideo instanceof HTMLVideoElement)) return null;
    const engine = audioEngines.get(nativeVideo) || null;
    if (!engine || engine.context?.state !== "running") return null;
    return engine;
  }

  function captureEngineOutputScale(engine) {
    if (!engine || engine.sourceMode !== "capture-stream") return 1;
    if (Number.isFinite(Number(engine.forcedOutputVolume))) return clampPlaybackVolume(engine.forcedOutputVolume);
    // The replacement player owns the extension volume slider. captureStream()
    // ignores the element's speaker volume once we mute the direct path, so the
    // graph must reproduce that volume explicitly.
    if (engine.video === video) return autoplayMutedFallback ? 0 : clampPlaybackVolume(extensionSettings.playbackVolume);
    const state = engine.captureDirectState;
    if (!state) return 1;
    return state.muted ? 0 : clampPlaybackVolume(state.volume);
  }

  function restoreCaptureDirectAudio(engine) {
    if (!engine || engine.sourceMode !== "capture-stream" || !engine.video) return false;
    const targetVideo = engine.video;
    const state = engine.captureDirectState;
    if (!state || !targetVideo.isConnected) return false;
    try {
      targetVideo.muted = Boolean(state.muted);
      targetVideo.defaultMuted = Boolean(state.defaultMuted);
      targetVideo.volume = clampPlaybackVolume(state.volume);
      engine.captureDirectRestored = true;
      return true;
    } catch {
      return false;
    }
  }

  function engageCaptureStreamAudio(engine) {
    if (!engine || engine.sourceMode !== "capture-stream" || !engine.video || engine.context?.state !== "running") return false;
    const targetVideo = engine.video;
    try {
      targetVideo.muted = true;
      targetVideo.defaultMuted = true;
      engine.captureDirectRestored = false;
      return true;
    } catch {
      return false;
    }
  }

  function setNativeAudioBridgeVolume() {
    if (!nativeAudioBridgeActive || !nativeAudioBridgeCanRun(nativeVideo)) return false;
    const engine = activeNativeAudioEngine();
    if (!engine) return false;

    const volume = clampPlaybackVolume(extensionSettings.playbackVolume);
    try {
      if (video) {
        video.defaultMuted = true;
        video.muted = true;
        video.volume = 0;
      }

      if (engine.sourceMode === "capture-stream") {
        engine.forcedOutputVolume = volume;
        nativeVideo.defaultMuted = true;
        nativeVideo.muted = true;
        nativeVideo.volume = 1;
        engageCaptureStreamAudio(engine);
        applyAudioSettingsToEngine(engine);
      } else {
        engine.forcedOutputVolume = null;
        nativeVideo.defaultMuted = volume <= 0;
        nativeVideo.muted = volume <= 0;
        nativeVideo.volume = volume;
      }
      nativeVideo.controls = false;
      nativeVideo.playsInline = true;
    } catch {}
    return true;
  }

  function activateNativeAudioBridgeForStudio(target = nativeVideo) {
    if (!extensionSettings.audioEnabled || target !== nativeVideo || !(video instanceof HTMLVideoElement) || !nativeAudioBridgeCanRun(target)) return false;
    const engine = audioEngines.get(target);
    if (!engine || engine.context?.state !== "running") return false;
    nativeAudioBridgeActive = true;
    nativeAudioBridgeFailureCount = 0;
    setNativeAudioBridgeVolume();
    void ensureNativeAudioBridgePlayback({ force:true });
    updateVolumeUi();
    return true;
  }

  function deactivateNativeAudioBridge(reason = "", notify = false) {
    if (!nativeAudioBridgeActive) return false;
    nativeAudioBridgeActive = false;
    nativeAudioBridgeFailureCount = 0;

    const nativeEngine = nativeVideo instanceof HTMLVideoElement ? audioEngines.get(nativeVideo) : null;
    if (nativeEngine?.sourceMode === "capture-stream") {
      nativeEngine.forcedOutputVolume = null;
      restoreCaptureDirectAudio(nativeEngine);
    }

    try {
      if (nativeVideo) {
        nativeVideo.muted = true;
        nativeVideo.defaultMuted = true;
        nativeVideo.volume = 0;
        if (!nativeVideo.paused) nativeVideo.pause();
      }
    } catch {}

    const volume = clampPlaybackVolume(extensionSettings.playbackVolume);
    try {
      if (video) {
        const muted = volume <= 0 || autoplayMutedFallback;
        video.defaultMuted = muted;
        video.muted = muted;
        video.volume = volume;
      }
    } catch {}
    updateVolumeUi();
    if (notify && reason) showNotice(`Đã chuyển sang âm thanh video HD · ${reason}`, true);
    if (extensionSettings.audioEnabled) scheduleAudioStudioScan(120);
    return true;
  }

  async function ensureNativeAudioBridgePlayback({ force = false } = {}) {
    if (!nativeAudioBridgeActive) return false;
    const engine = activeNativeAudioEngine();
    if (!engine || !nativeAudioBridgeCanRun(nativeVideo) || !(video instanceof HTMLVideoElement)) {
      deactivateNativeAudioBridge("Audio Studio chưa sẵn sàng");
      return false;
    }
    setNativeAudioBridgeVolume();
    try {
      if (Math.abs((nativeVideo.playbackRate || 1) - (video.playbackRate || 1)) > 0.01) nativeVideo.playbackRate = video.playbackRate || 1;
      const drift = Math.abs((nativeVideo.currentTime || 0) - (video.currentTime || 0));
      if (force || drift > 0.22) nativeVideo.currentTime = Number(video.currentTime) || 0;
      const shouldPlayNative = !isCurrentVideoManuallyPaused()
        && (!replacementPlaybackStarted ? extensionSettings.autoplay : (!video.paused && !videoGateLocked));
      if (!shouldPlayNative) {
        if (!nativeVideo.paused) nativeVideo.pause();
        nativeAudioBridgeFailureCount = 0;
        return true;
      }
      if (nativeVideo.paused) await nativeVideo.play();
      nativeAudioBridgeFailureCount = 0;
      return true;
    } catch (error) {
      nativeAudioBridgeFailureCount += 1;
      if (nativeAudioBridgeFailureCount >= 2) {
        console.warn("[TikTok Sub VI] Audio Studio native bridge failed; restoring replacement audio:", error);
        deactivateNativeAudioBridge("native audio bị gián đoạn", true);
        ensureVideoSound();
      }
      return false;
    }
  }

  function applyPlaybackVolume(value, persist = false) {
    const volume = clampPlaybackVolume(value);
    extensionSettings = { ...extensionSettings, playbackVolume: volume };
    if (!setNativeAudioBridgeVolume() && video) {
      const engine = audioEngines.get(video);
      const muted = volume <= 0 || autoplayMutedFallback;
      if (engine?.sourceMode === "capture-stream" && engine.context?.state === "running") {
        // Do not unmute the HTMLMediaElement while captureStream is feeding the
        // graph: doing so creates a second direct speaker path (double/unstable
        // audio). Keep the desired volume inside the graph instead.
        engine.forcedOutputVolume = muted ? 0 : volume;
        if (engine.captureDirectState) {
          engine.captureDirectState.volume = volume;
          engine.captureDirectState.muted = muted;
          engine.captureDirectState.defaultMuted = muted;
        }
        engageCaptureStreamAudio(engine);
        applyAudioSettingsToEngine(engine);
      } else {
        try {
          video.defaultMuted = muted;
          video.muted = muted;
          video.volume = volume;
        } catch {}
      }
    }
    updateVolumeUi();
    if (persist) chrome.storage.local.set({ [SETTINGS_KEY]: extensionSettings });
  }

  function ensureVideoSound() {
    if (!video) return;
    if (setNativeAudioBridgeVolume()) return;
    applyPlaybackVolume(extensionSettings.playbackVolume, false);
  }

  function isAutoplayPolicyError(error) {
    const name = String(error?.name || "");
    const message = String(error?.message || "").toLowerCase();
    return name === "NotAllowedError" || message.includes("user didn't interact") || message.includes("user gesture") || message.includes("autoplay");
  }

  function cancelAutoplaySoundRecovery() {
    autoplaySoundRecoveryToken += 1;
    clearTimeout(autoplaySoundRecoveryTimer);
    autoplaySoundRecoveryTimer = null;
  }

  async function tryRestoreAutoplaySound({ forcePlayback = false, notify = false } = {}) {
    const targetVideo = video;
    if (!autoplayMutedFallback || !(targetVideo instanceof HTMLVideoElement) || targetVideo !== video) return false;
    if (clampPlaybackVolume(extensionSettings.playbackVolume) <= 0 || isCurrentVideoManuallyPaused() || videoGateLocked) return false;
    const targetVolume = clampPlaybackVolume(extensionSettings.playbackVolume);
    try {
      // Do this BEFORE play() so a real page-level user activation (keyboard,
      // click anywhere on TikTok, etc.) is consumed by the audible play request.
      targetVideo.defaultMuted = false;
      targetVideo.muted = false;
      targetVideo.volume = targetVolume;
      if (forcePlayback || targetVideo.paused) await targetVideo.play();
      await Promise.resolve();
      if (targetVideo !== video || targetVideo.muted || targetVideo.paused) throw new DOMException("Audible autoplay is still blocked", "NotAllowedError");
      autoplayMutedFallback = false;
      playbackUnlockRequired = false;
      cancelAutoplaySoundRecovery();
      updateVolumeUi();
      if (extensionSettings.audioEnabled) {
        void ensureAudioContext({ resume:true }).then((context) => {
          if (context?.state === "running") void ensureAudioEngine(audioStudioTarget(targetVideo));
        });
      }
      if (notify) showNotice("Âm thanh đã tự bật lại.", true);
      return true;
    } catch {
      if (targetVideo === video) {
        autoplayMutedFallback = true;
        try { targetVideo.defaultMuted = true; targetVideo.muted = true; targetVideo.volume = targetVolume; } catch {}
        updateVolumeUi();
      }
      return false;
    }
  }

  function scheduleAutoplaySoundRecovery(delay = 350, attempts = 8) {
    clearTimeout(autoplaySoundRecoveryTimer);
    const activation = navigator.userActivation;
    // If Chrome says this origin has never been activated and the first audible
    // play was rejected, blind retries cannot bypass the autoplay policy. Wait
    // for any trusted page-level interaction instead of repeatedly pausing/unmuting.
    if (activation && !activation.isActive && !activation.hasBeenActive) return;
    const token = ++autoplaySoundRecoveryToken;
    let remaining = Math.max(1, Number(attempts) || 1);
    const run = async () => {
      if (token !== autoplaySoundRecoveryToken || !autoplayMutedFallback || !video || isCurrentVideoManuallyPaused()) return;
      const restored = await tryRestoreAutoplaySound({ forcePlayback:true });
      if (restored || --remaining <= 0 || token !== autoplaySoundRecoveryToken) return;
      autoplaySoundRecoveryTimer = setTimeout(run, Math.max(250, Number(delay) || 350));
    };
    autoplaySoundRecoveryTimer = setTimeout(run, Math.max(0, Number(delay) || 0));
  }

  function unlockAutoplaySound() {
    if (!autoplayMutedFallback || !video) return false;
    const targetVideo = video;
    const shouldContinue = !isCurrentVideoManuallyPaused() && !videoGateLocked && (extensionSettings.autoplay || !targetVideo.paused);
    autoplayMutedFallback = false;
    suppressNextVideoClick = false;
    try {
      targetVideo.defaultMuted = false;
      targetVideo.muted = false;
      targetVideo.volume = clampPlaybackVolume(extensionSettings.playbackVolume);
      if (shouldContinue && targetVideo.paused) {
        const promise = targetVideo.play();
        promise?.catch?.(() => {
          if (targetVideo !== video) return;
          autoplayMutedFallback = true;
          ensureVideoSound();
          scheduleAutoplaySoundRecovery(300, 6);
        });
      }
    } catch {}
    updateVolumeUi();
    if (extensionSettings.audioEnabled) {
      void ensureAudioContext({ resume:true }).then((context) => {
        if (context?.state === "running" && targetVideo === video) void ensureAudioEngine(audioStudioTarget(targetVideo));
      });
    }
    return true;
  }

  function clampEqGain(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(-12, Math.min(12, Math.round(parsed))) : 0;
  }

  function normalizeEqBands(value) {
    const source = Array.isArray(value) ? value : DEFAULT_SETTINGS.eqBands;
    return EQ_FREQUENCIES.map((_, index) => clampEqGain(source[index]));
  }

  function setAudioParam(param, value, context = audioContext, smoothing = 0.025) {
    if (!param || !context) return;
    const now = context.currentTime;
    try { param.cancelScheduledValues(now); param.setTargetAtTime(value, now, smoothing); }
    catch { try { param.value = value; } catch {} }
  }

  function setSpatialPosition(engine, x, y, z) {
    const node = engine?.spatial, context = engine?.context || audioContext;
    if (!node || !context) return;
    if (node.positionX) {
      setAudioParam(node.positionX, x, context); setAudioParam(node.positionY, y, context); setAudioParam(node.positionZ, z, context);
    } else if (typeof node.setPosition === "function") { try { node.setPosition(x, y, z); } catch {} }
  }

  function stopAudioTimers(engine) {
    if (!engine) return;
    clearInterval(engine.normalizerTimer); clearInterval(engine.spatialTimer);
    engine.normalizerTimer = null; engine.spatialTimer = null;
  }

  function startAdaptiveNormalizer(engine) {
    if (!engine) return;
    if (!extensionSettings.audioEnabled || !extensionSettings.adaptiveNormalizer || !engine.analyser || !engine.normalizerGain) {
      clearInterval(engine.normalizerTimer);
      engine.normalizerTimer = null;
      return;
    }
    // applyAudioSettingsToEngine() is intentionally called often by the SPA
    // supervisor. Never tear down/recreate this timer on every scan.
    if (engine.normalizerTimer) return;
    const samples = new Uint8Array(engine.analyser.fftSize);
    engine.normalizerTimer = setInterval(() => {
      const targetVideo = engine.video, context = engine.context;
      if (!context || context.state !== "running" || !targetVideo?.isConnected || targetVideo.paused || targetVideo.ended) return;
      engine.analyser.getByteTimeDomainData(samples);
      let energy = 0;
      for (const sample of samples) { const normalized = (sample - 128) / 128; energy += normalized * normalized; }
      const rms = Math.sqrt(energy / samples.length);
      const desired = rms < 0.008 ? 1 : Math.max(0.72, Math.min(2.35, 0.18 / rms));
      setAudioParam(engine.normalizerGain.gain, desired, context, 0.18);
    }, 160);
  }

  function startSpatialMotion(engine) {
    if (!engine) return;
    if (!extensionSettings.audioEnabled || !extensionSettings.spatialAudio || !engine.spatial) {
      clearInterval(engine.spatialTimer);
      engine.spatialTimer = null;
      setSpatialPosition(engine, 0, 0, -1);
      return;
    }
    // Keep one continuous spatial clock. Recreating it every supervisor pass
    // repeatedly reset the 360-degree motion phase and wasted timers.
    if (engine.spatialTimer) return;
    const startedAt = performance.now();
    engine.spatialTimer = setInterval(() => {
      const targetVideo = engine.video, context = engine.context;
      if (!context || context.state !== "running" || !targetVideo?.isConnected || targetVideo.paused || targetVideo.ended) return;
      const intensity = Math.max(0, Math.min(1, Number(extensionSettings.spatialIntensity) || 0));
      const angle = ((performance.now() - startedAt) / 9000) * Math.PI * 2, radius = 0.35 + intensity * 1.65;
      setSpatialPosition(engine, Math.sin(angle) * radius, Math.sin(angle * 0.5) * 0.12 * intensity, -Math.cos(angle) * radius);
    }, 80);
  }

  function applyAudioSettingsToEngine(engine) {
    if (!engine?.context || !engine?.video) return;
    const enabled = extensionSettings.audioEnabled && engine.processingReady !== false;
    const bands = normalizeEqBands(extensionSettings.eqBands);
    (engine.filters || []).forEach((filter, index) => setAudioParam(filter.gain, enabled && extensionSettings.equalizerEnabled ? bands[index] : 0, engine.context));
    const normalize = enabled && extensionSettings.adaptiveNormalizer;
    // The normalizer timer continuously adjusts this gain. Resetting it to 1 on
    // every supervisor scan made Adaptive Normalizer pulse/lose effect.
    if (!normalize || engine.lastNormalizerEnabled !== normalize) {
      setAudioParam(engine.normalizerGain?.gain, 1, engine.context, 0.08);
    }
    engine.lastNormalizerEnabled = normalize;
    setAudioParam(engine.compressor?.threshold, normalize ? -22 : 0, engine.context);
    setAudioParam(engine.compressor?.knee, normalize ? 18 : 0, engine.context);
    setAudioParam(engine.compressor?.ratio, normalize ? 3.5 : 1, engine.context);
    setAudioParam(engine.compressor?.attack, normalize ? 0.005 : 0.003, engine.context);
    setAudioParam(engine.compressor?.release, normalize ? 0.25 : 0.08, engine.context);
    // A permanent dry route is created before the effect graph. Capture-stream
    // fallback ignores the media element's own mute/volume, so reproduce the
    // intended level in the graph. MediaElementSource keeps its native semantics.
    const outputScale = engine.sourceMode === "capture-stream" ? captureEngineOutputScale(engine) : 1;
    setAudioParam(engine.dryGain?.gain, enabled ? 0 : outputScale, engine.context, 0.012);
    setAudioParam(engine.wetGain?.gain, enabled ? outputScale : 0, engine.context, 0.012);
    if (engine.sourceMode === "capture-stream" && engine.context.state === "running") engageCaptureStreamAudio(engine);
    if (enabled) { startAdaptiveNormalizer(engine); startSpatialMotion(engine); }
    else { stopAudioTimers(engine); setSpatialPosition(engine, 0, 0, -1); }
  }

  function applyAudioSettings() {
    for (const engine of audioEngines.values()) applyAudioSettingsToEngine(engine);
    if (extensionSettings.audioEnabled && audioContext?.state === "running") scheduleAudioStudioScan(0);
  }

  function audioSourceNeedsCors(source) {
    try {
      const parsed = new URL(String(source || ""), location.href);
      return /^https?:$/i.test(parsed.protocol) && parsed.origin !== location.origin;
    } catch { return false; }
  }

  function rememberAudioBypassSource(source) {
    const value = String(source || "").trim();
    if (!value) return;
    audioCorsBypassSources.add(value);
    while (audioCorsBypassSources.size > 80) {
      const oldest = audioCorsBypassSources.values().next().value;
      if (!oldest) break;
      audioCorsBypassSources.delete(oldest);
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "tdt-audio-cors-probe-main" || data.type !== "probe-result") return;
    const waiter = audioCorsProbeWaiters.get(String(data.id || ""));
    if (!waiter) return;
    audioCorsProbeWaiters.delete(String(data.id));
    clearTimeout(waiter.timer);
    waiter.resolve(Boolean(data.ok));
  }, false);

  function cacheAudioCorsProbe(source, ok) {
    const key = String(source || "");
    if (!key) return;
    audioCorsProbeCache.set(key, { ok:Boolean(ok), at:Date.now() });
    while (audioCorsProbeCache.size > 80) {
      const oldest = audioCorsProbeCache.keys().next().value;
      if (!oldest) break;
      audioCorsProbeCache.delete(oldest);
    }
  }

  function probeAudioCorsInMainWorld(targetVideo, source) {
    if (!audioSourceNeedsCors(source)) return Promise.resolve(true);
    const cached = audioCorsProbeCache.get(source);
    if (cached && Date.now() - cached.at < 8 * 60 * 1000) return Promise.resolve(Boolean(cached.ok));
    const id = `audio-${Date.now()}-${++audioCorsProbeSequence}`;
    const credentials = targetVideo?.crossOrigin === "use-credentials" ? "include" : "omit";
    return new Promise((resolve) => {
      const finish = (ok) => { cacheAudioCorsProbe(source, ok); resolve(Boolean(ok)); };
      const timer = setTimeout(() => {
        audioCorsProbeWaiters.delete(id);
        finish(false);
      }, 2800);
      audioCorsProbeWaiters.set(id, { resolve:finish, timer });
      try {
        window.postMessage({ source:"tdt-audio-cors-probe-ui", type:"probe", id, url:source, credentials }, "*");
      } catch {
        clearTimeout(timer);
        audioCorsProbeWaiters.delete(id);
        finish(false);
      }
    });
  }

  async function verifyAudioSourceForWebAudio(targetVideo) {
    if (!(targetVideo instanceof HTMLVideoElement)) return false;
    const source = String(targetVideo.currentSrc || targetVideo.src || "").trim();
    if (!source || audioCorsBypassSources.has(source)) return false;
    if (!audioSourceNeedsCors(source)) return true;
    if (!targetVideo.crossOrigin || targetVideo.dataset.tdtCorsConfirmed !== "true") return false;

    // v3.2.4: loadedmetadata/canplay on TikTok's native element while the
    // crossorigin attribute is active is stronger evidence than a second fetch().
    // TikTok CDN endpoints can reject HEAD/Range probes even though the media
    // request itself was CORS-authorized, which previously made Audio Studio skip
    // otherwise valid videos. Trust the browser-validated native media request.
    const isNativeTikTokMedia = targetVideo !== video && !targetVideo.matches?.('[data-tdt-replacement="true"]');
    if (isNativeTikTokMedia) {
      if (targetVideo.dataset.tdtAudioBypassSource === source) delete targetVideo.dataset.tdtAudioBypassSource;
      return true;
    }

    // Replacement/foreign media keeps the stricter page-origin probe because a
    // MediaElementSource created for an unsafe signed CDN URL can become silent.
    const ok = await probeAudioCorsInMainWorld(targetVideo, source);
    if (!ok) {
      targetVideo.dataset.tdtAudioBypassSource = source;
      return false;
    }
    if (targetVideo.dataset.tdtAudioBypassSource === source) delete targetVideo.dataset.tdtAudioBypassSource;
    return true;
  }

  function markAudioCorsConfirmed(targetVideo) {
    if (!(targetVideo instanceof HTMLVideoElement) || targetVideo.error || targetVideo.readyState < (Number(targetVideo.HAVE_METADATA) || 1)) return false;
    const source = String(targetVideo.currentSrc || targetVideo.src || "").trim();
    if (!source) return false;
    if (targetVideo.dataset.tdtAudioBypassSource && targetVideo.dataset.tdtAudioBypassSource !== source) {
      delete targetVideo.dataset.tdtAudioBypass;
      delete targetVideo.dataset.tdtAudioBypassSource;
      delete targetVideo.dataset.tdtAudioBypassReason;
    }
    if (!audioSourceNeedsCors(source)) {
      targetVideo.dataset.tdtCorsConfirmed = "true";
      if (targetVideo.dataset.tdtAudioBypassSource === source) delete targetVideo.dataset.tdtAudioBypassSource;
      return true;
    }
    // loadedmetadata/canplay on an element whose crossorigin request is active is
    // reliable proof that this actual media request completed in CORS mode.
    if (targetVideo.crossOrigin) {
      targetVideo.dataset.tdtCorsConfirmed = "true";
      if (targetVideo.dataset.tdtAudioBypassSource === source) delete targetVideo.dataset.tdtAudioBypassSource;
      return true;
    }
    return false;
  }

  function audioVideoIsUsable(targetVideo) {
    if (!(targetVideo instanceof HTMLVideoElement) || !targetVideo.isConnected || targetVideo.error) return false;
    const source = String(targetVideo.currentSrc || targetVideo.src || "").trim();

    if (targetVideo.dataset.tdtAudioBypassSource && targetVideo.dataset.tdtAudioBypassSource !== source) {
      delete targetVideo.dataset.tdtAudioBypass;
      delete targetVideo.dataset.tdtAudioBypassSource;
      delete targetVideo.dataset.tdtAudioBypassReason;
    }
    if (targetVideo.dataset.tdtAudioBypass === "true" && targetVideo.dataset.tdtAudioBypassSource === source) return false;
    if (targetVideo.dataset.tdtAudioBypassSource === source || audioCorsBypassSources.has(source)) return false;

    if (!source || targetVideo.readyState < (Number(targetVideo.HAVE_METADATA) || 1)) return false;
    if (audioSourceNeedsCors(source)) {
      if (!targetVideo.crossOrigin || targetVideo.dataset.tdtCorsConfirmed !== "true") return false;
    }
    return true;
  }

  function rebuildReplacementForDirectAudio(reason = "webaudio") {
    const failedVideo = video;
    const info = currentVideoInfo;
    if (!(failedVideo instanceof HTMLVideoElement) || !info?.videoUrl || failedVideo.dataset.tdtAudioRecovering === "true") return false;
    const sourceUrl = String(info.videoUrl || failedVideo.currentSrc || failedVideo.src || "");
    if (!sourceUrl) return false;
    failedVideo.dataset.tdtAudioRecovering = "true";
    const resumeTime = Number.isFinite(failedVideo.currentTime) ? failedVideo.currentTime : 0;
    const shouldResume = !failedVideo.paused && !isCurrentVideoManuallyPaused() && !videoGateLocked;
    rememberAudioBypassSource(sourceUrl);
    try { failedVideo.dataset.tdtAudioBypass = "true"; } catch {}
    try {
      renderVideo(info);
      const restored = video;
      if (!(restored instanceof HTMLVideoElement)) return false;
      restored.dataset.tdtAudioBypass = "true";
      restored.dataset.tdtAudioRecoveryReason = String(reason || "webaudio");
      const restore = () => {
        try {
          if (resumeTime > 0 && Number.isFinite(restored.duration)) restored.currentTime = Math.min(resumeTime, Math.max(0, restored.duration - 0.05));
        } catch {}
        autoplayMutedFallback = false;
        ensureVideoSound();
        applyPlaybackRate(extensionSettings.playbackRate, false);
        if (shouldResume && restored === video && !videoGateLocked) {
          restored.play().catch((error) => {
            if (isAutoplayPolicyError(error)) {
              autoplayMutedFallback = true;
              ensureVideoSound();
              restored.play().catch(() => {});
              scheduleAutoplaySoundRecovery(250, 10);
            }
          });
        }
      };
      if (restored.readyState >= (Number(restored.HAVE_METADATA) || 1)) restore();
      else restored.addEventListener("loadedmetadata", restore, { once:true });
      return true;
    } catch (error) {
      console.warn("[TikTok Sub VI] Không thể dựng lại đường âm thanh trực tiếp:", error);
      return false;
    }
  }

  function scheduleAudioContextRecovery(delay = 0) {
    clearTimeout(audioContextRecoveryTimer);
    audioContextRecoveryTimer = setTimeout(async () => {
      audioContextRecoveryTimer = null;
      if (!audioContext || audioContext.state === "closed" || (!extensionSettings.audioEnabled && audioEngines.size === 0)) return;

      if (audioContext.state !== "running") {
        for (const engine of audioEngines.values()) {
          if (engine?.sourceMode === "capture-stream") restoreCaptureDirectAudio(engine);
        }
      }

      if (audioContext.state !== "running") { try { await audioContext.resume(); } catch {} }
      if (audioContext.state === "running") {
        for (const engine of audioEngines.values()) {
          engine.contextRecoveryFailures = 0;
          if (engine.sourceMode === "capture-stream") engageCaptureStreamAudio(engine);
          applyAudioSettingsToEngine(engine);
        }
        scheduleAudioStudioScan(0);
        return;
      }

      const activeAudioTarget = audioStudioTarget(video);
      const currentEngine = activeAudioTarget instanceof HTMLVideoElement ? audioEngines.get(activeAudioTarget) : null;
      if (currentEngine && !document.hidden && video && !video.paused) {
        currentEngine.contextRecoveryFailures = Number(currentEngine.contextRecoveryFailures || 0) + 1;
        if (nativeAudioBridgeActive) {
          deactivateNativeAudioBridge("AudioContext bị tạm dừng", true);
          ensureVideoSound();
          return;
        }
        if (currentEngine.contextRecoveryFailures >= 3 && activeAudioTarget === video) {
          rebuildReplacementForDirectAudio("audio-context-suspended");
          return;
        }
        scheduleAudioContextRecovery(260);
      }
    }, Math.max(0, Number(delay) || 0));
  }

  async function ensureAudioContext({ resume = true } = {}) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      if (!audioBypassNoticeShown) { audioBypassNoticeShown = true; showNotice("Trình duyệt này chưa hỗ trợ Audio Studio."); }
      return null;
    }
    if (!audioContext || audioContext.state === "closed") {
      try {
        audioContext = new AudioContextClass({ latencyHint: "interactive" });
        audioContext.addEventListener?.("statechange", () => {
          if (audioContext?.state !== "running" && (extensionSettings.audioEnabled || audioEngines.size > 0) && !document.hidden) scheduleAudioContextRecovery(80);
        });
      }
      catch (error) { console.warn("[TikTok Sub VI] Không thể tạo AudioContext:", error); return null; }
    }
    if (resume && audioContext.state !== "running") { try { await audioContext.resume(); } catch {} }
    return audioContext;
  }

  function disconnectAudioEngine(targetVideo = null) {
    const targets = targetVideo instanceof HTMLVideoElement ? [targetVideo] : targetVideo === "all" ? Array.from(audioEngines.keys()) : [];
    for (const target of targets) {
      const engine = audioEngines.get(target);
      if (!engine) continue;
      if (target === nativeVideo && nativeAudioBridgeActive) deactivateNativeAudioBridge("", false);
      if (engine.sourceMode === "capture-stream") restoreCaptureDirectAudio(engine);
      stopAudioTimers(engine);
      for (const node of [engine.source, ...(engine.filters || []), engine.analyser, engine.normalizerGain, engine.compressor, engine.spatial, engine.dryGain, engine.wetGain]) { try { node?.disconnect(); } catch {} }
      try { engine.mediaStream?.getTracks?.().forEach((track) => track.stop()); } catch {}
      audioEngines.delete(target);
      audioEnginePromises.delete(target);
      audioAttachGeneration.set(target, Number(audioAttachGeneration.get(target) || 0) + 1);
    }
  }

  function pruneAudioEngines() {
    // Do not destroy MediaElementSourceNodes for temporarily detached TikTok
    // players. A media element may only be routed through createMediaElementSource
    // once; keeping its engine lets TikTok detach/reinsert/reuse that same video
    // without losing Audio Studio on the next clip.
    for (const [targetVideo, engine] of audioEngines.entries()) {
      if (targetVideo?.isConnected) continue;
      stopAudioTimers(engine);
    }
  }

  async function createAudioEngine(targetVideo, { notify = false, expectedSource = "", generation = 0 } = {}) {
    if (!extensionSettings.audioEnabled || !audioVideoIsUsable(targetVideo)) return false;
    let currentSource = String(targetVideo.currentSrc || targetVideo.src || "").trim();
    const attachSource = String(expectedSource || currentSource).trim();
    const attachGeneration = Number(generation || audioAttachGeneration.get(targetVideo) || 0);
    const attemptStillCurrent = () => {
      const liveSource = String(targetVideo.currentSrc || targetVideo.src || "").trim();
      return targetVideo.isConnected
        && liveSource === attachSource
        && (!attachGeneration || Number(audioAttachGeneration.get(targetVideo) || 0) === attachGeneration);
    };
    if (!attachSource || currentSource !== attachSource || !attemptStillCurrent()) return false;

    if (audioEngines.has(targetVideo)) {
      const engine = audioEngines.get(targetVideo);
      if (engine.sourceUrl && currentSource && engine.sourceUrl !== currentSource) {
        if (engine.sourceMode === "capture-stream") {
          disconnectAudioEngine(targetVideo);
          return false;
        }
        const sourceBeingVerified = currentSource;
        const safe = await verifyAudioSourceForWebAudio(targetVideo);
        currentSource = String(targetVideo.currentSrc || targetVideo.src || "").trim();
        if (currentSource !== sourceBeingVerified) return false;
        if (!safe) {
          targetVideo.dataset.tdtAudioBypass = "true";
          targetVideo.dataset.tdtAudioBypassSource = currentSource;
          targetVideo.dataset.tdtAudioBypassReason = "source-changed-cors";
          if (targetVideo === video) rebuildReplacementForDirectAudio("source-changed");
          return false;
        }
        engine.sourceUrl = currentSource;
      }
      if (engine.context.state !== "running") { try { await engine.context.resume(); } catch {} }
      if (engine.context.state === "running") {
        if (engine.sourceMode === "capture-stream") engageCaptureStreamAudio(engine);
        applyAudioSettingsToEngine(engine);
        if (targetVideo === nativeVideo && video instanceof HTMLVideoElement) activateNativeAudioBridgeForStudio(targetVideo);
        return true;
      }
      if (targetVideo === video && !targetVideo.paused) scheduleAudioContextRecovery(0);
      return false;
    }

    const context = await ensureAudioContext({ resume: true });
    if (!context || context.state !== "running" || !attemptStillCurrent()) return false;
    if (!(await verifyAudioSourceForWebAudio(targetVideo))) {
      if (!audioBypassNoticeShown && targetVideo === video) {
        audioBypassNoticeShown = true;
        showNotice("Nguồn HD này không an toàn với Web Audio · giữ âm thanh trực tiếp.", true);
      }
      return false;
    }
    if (!attemptStillCurrent()) return false;
    currentSource = String(targetVideo.currentSrc || targetVideo.src || "").trim();

    let source = null;
    let sourceMode = "media-element";
    let mediaStream = null;
    let captureDirectState = null;
    let mediaElementError = null;

    try {
      source = context.createMediaElementSource(targetVideo);
    } catch (error) {
      mediaElementError = error;
      const capture = targetVideo.captureStream || targetVideo.mozCaptureStream;
      if (typeof capture === "function" && !audioSourceNeedsCors(currentSource)) {
        try {
          mediaStream = capture.call(targetVideo);
          const audioTracks = mediaStream?.getAudioTracks?.() || [];
          if (!audioTracks.length) throw new Error("captureStream has no audio track");
          source = context.createMediaStreamSource(mediaStream);
          sourceMode = "capture-stream";
          captureDirectState = {
            muted: Boolean(targetVideo.muted),
            defaultMuted: Boolean(targetVideo.defaultMuted),
            volume: clampPlaybackVolume(targetVideo.volume)
          };
        } catch (captureError) {
          console.warn("[TikTok Sub VI] Audio Studio media+capture fallback đều lỗi:", mediaElementError, captureError);
        }
      }
    }

    if (!source) {
      console.warn("[TikTok Sub VI] Không thể nối nguồn Audio Studio; giữ âm thanh trực tiếp:", mediaElementError);
      targetVideo.dataset.tdtAudioBypass = "true";
      targetVideo.dataset.tdtAudioBypassSource = currentSource;
      targetVideo.dataset.tdtAudioBypassReason = String(mediaElementError?.name || "source-create-failed");
      if (!audioBypassNoticeShown) {
        audioBypassNoticeShown = true;
        showNotice("Video này dùng đường âm thanh trực tiếp; Audio Studio sẽ thử lại khi TikTok đổi nguồn.", true);
      }
      return false;
    }

    let dryGain = null;
    try {
      dryGain = context.createGain();
      dryGain.gain.value = sourceMode === "capture-stream"
        ? (captureDirectState?.muted ? 0 : clampPlaybackVolume(captureDirectState?.volume))
        : 1;
      source.connect(dryGain);
      dryGain.connect(context.destination);
    } catch (error) {
      try { source.disconnect(); } catch {}
      try { mediaStream?.getTracks?.().forEach((track) => track.stop()); } catch {}
      console.warn("[TikTok Sub VI] Không thể tạo dry passthrough:", error);
      targetVideo.dataset.tdtAudioBypass = "true";
      targetVideo.dataset.tdtAudioBypassSource = currentSource;
      targetVideo.dataset.tdtAudioBypassReason = "dry-route-failed";
      return false;
    }

    const engine = {
      video:targetVideo,
      context,
      source,
      sourceMode,
      sourceUrl:currentSource,
      mediaStream,
      captureDirectState,
      captureDirectRestored:false,
      forcedOutputVolume:sourceMode === "capture-stream" && targetVideo === video
        ? (autoplayMutedFallback ? 0 : clampPlaybackVolume(extensionSettings.playbackVolume))
        : null,
      dryGain,
      wetGain:null,
      filters:[],
      analyser:null,
      normalizerGain:null,
      compressor:null,
      spatial:null,
      normalizerTimer:null,
      spatialTimer:null,
      processingReady:false,
      contextRecoveryFailures:0
    };
    audioEngines.set(targetVideo, engine);

    try {
      const filters = EQ_FREQUENCIES.map((frequency, index) => {
        const filter = context.createBiquadFilter();
        filter.type = index === 0 ? "lowshelf" : index === EQ_FREQUENCIES.length - 1 ? "highshelf" : "peaking";
        filter.frequency.value = frequency;
        filter.Q.value = index === 0 || index === EQ_FREQUENCIES.length - 1 ? 0.7 : 0.9;
        return filter;
      });
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.72;
      const normalizerGain = context.createGain();
      const compressor = context.createDynamicsCompressor();
      const spatial = context.createPanner();
      const wetGain = context.createGain();
      wetGain.gain.value = 0;
      spatial.panningModel = "HRTF";
      spatial.distanceModel = "inverse";
      spatial.refDistance = 1;
      spatial.maxDistance = 10;
      spatial.rolloffFactor = 0.18;
      spatial.coneInnerAngle = 360;
      spatial.coneOuterAngle = 360;

      let previous = source;
      for (const filter of filters) { previous.connect(filter); previous = filter; }
      previous.connect(analyser);
      analyser.connect(normalizerGain);
      normalizerGain.connect(compressor);
      compressor.connect(spatial);
      spatial.connect(wetGain);
      wetGain.connect(context.destination);

      Object.assign(engine, { filters, analyser, normalizerGain, compressor, spatial, wetGain, processingReady:true });
      if (sourceMode === "capture-stream") engageCaptureStreamAudio(engine);
      applyAudioSettingsToEngine(engine);

      delete targetVideo.dataset.tdtAudioBypass;
      if (targetVideo.dataset.tdtAudioBypassSource === currentSource) delete targetVideo.dataset.tdtAudioBypassSource;
      delete targetVideo.dataset.tdtAudioBypassReason;

      if (targetVideo === nativeVideo && video instanceof HTMLVideoElement) activateNativeAudioBridgeForStudio(targetVideo);
      if (notify && !audioStudioReadyNoticeShown) {
        audioStudioReadyNoticeShown = true;
        showNotice(sourceMode === "capture-stream"
          ? "Audio Studio đã áp dụng bằng chế độ tương thích."
          : "Audio Studio đã áp dụng an toàn cho video TikTok.", true);
      }
      return true;
    } catch (error) {
      engine.processingReady = false;
      try { engine.wetGain?.disconnect(); } catch {}
      if (sourceMode === "capture-stream") engageCaptureStreamAudio(engine);
      applyAudioSettingsToEngine(engine);
      console.warn("[TikTok Sub VI] Audio Studio chuyển sang dry passthrough:", error);
      if (!audioBypassNoticeShown) {
        audioBypassNoticeShown = true;
        showNotice("Audio Studio gặp lỗi hiệu ứng; âm thanh vẫn được giữ.", true);
      }
      if (targetVideo === nativeVideo && video instanceof HTMLVideoElement) activateNativeAudioBridgeForStudio(targetVideo);
      return true;
    }
  }

  function refreshAudioBypassForCurrentSource(targetVideo) {
    if (!(targetVideo instanceof HTMLVideoElement)) return "";
    const source = String(targetVideo.currentSrc || targetVideo.src || "").trim();
    if (targetVideo.dataset.tdtAudioBypassSource && targetVideo.dataset.tdtAudioBypassSource !== source) {
      delete targetVideo.dataset.tdtAudioBypass;
      delete targetVideo.dataset.tdtAudioBypassSource;
      delete targetVideo.dataset.tdtAudioBypassReason;
      delete targetVideo.dataset.tdtCorsConfirmed;
    }
    return source;
  }

  function shouldAttachAudioToVideo(targetVideo) {
    if (!(targetVideo instanceof HTMLVideoElement) || !targetVideo.isConnected || targetVideo.error) return false;
    refreshAudioBypassForCurrentSource(targetVideo);
    if (targetVideo.dataset.tdtAudioBypass === "true") return false;

    // Audio Studio and Auto Replace are intentionally independent in v3.2.4.
    // Preview/grid videos must NEVER be replaced, but if TikTok actually starts
    // playing one, Audio Studio should still follow that native media element.
    if (nativeAudioBridgeActive && targetVideo === nativeVideo) return true;

    // The HD replacement is picture-only while Native Audio Bridge is active.
    // Capturing both elements would create duplicate/competing audio graphs.
    if (targetVideo === video || targetVideo.matches?.('[data-tdt-replacement="true"]')) {
      return targetVideo === video && !nativeAudioBridgeActive;
    }

    // A hidden native subtitle clock is eligible only when it is the active bridge.
    if (targetVideo.dataset.tdtNativeSubtitleClock === "true") return targetVideo === nativeVideo && nativeAudioBridgeActive;

    // Every other real TikTok video can be enhanced when it is actively playing.
    // Safety is still enforced later by metadata/CORS verification before
    // createMediaElementSource(), so unsupported sources keep native direct audio.
    return true;
  }

  function ensureAudioEngine(targetVideo = video, options = {}) {
    if (!extensionSettings.audioEnabled || !shouldAttachAudioToVideo(targetVideo) || !audioVideoIsUsable(targetVideo)) return Promise.resolve(false);
    const currentSource = String(targetVideo.currentSrc || targetVideo.src || "").trim();
    let existing = audioEngines.get(targetVideo);

    // TikTok frequently recycles one <video> node. A MediaElementSource follows
    // the node automatically but still needs the new source re-validated; a
    // captureStream engine must be rebuilt because its MediaStream tracks belong
    // to the previous source.
    if (existing?.sourceUrl && currentSource && existing.sourceUrl !== currentSource && existing.sourceMode === "capture-stream") {
      disconnectAudioEngine(targetVideo);
      existing = null;
    }

    if (existing && (!existing.sourceUrl || existing.sourceUrl === currentSource)) {
      applyAudioSettingsToEngine(existing);
      if (existing.context.state === "running") {
        if (existing.sourceMode === "capture-stream") engageCaptureStreamAudio(existing);
        if (targetVideo === nativeVideo && video instanceof HTMLVideoElement) activateNativeAudioBridgeForStudio(targetVideo);
        return Promise.resolve(true);
      }
      return existing.context.resume().then(() => {
        const running = existing.context.state === "running";
        if (running) {
          if (existing.sourceMode === "capture-stream") engageCaptureStreamAudio(existing);
          applyAudioSettingsToEngine(existing);
          if (targetVideo === nativeVideo && video instanceof HTMLVideoElement) activateNativeAudioBridgeForStudio(targetVideo);
        } else if (targetVideo === video && !targetVideo.paused) scheduleAudioContextRecovery(0);
        return running;
      }).catch(() => {
        if (targetVideo === video && !targetVideo.paused) scheduleAudioContextRecovery(0);
        return false;
      });
    }

    const pending = audioEnginePromises.get(targetVideo);
    if (pending?.promise && pending.source === currentSource) return pending.promise;

    // Invalidate any slower attach/re-validation attempt for the previous source.
    const generation = Number(audioAttachGeneration.get(targetVideo) || 0) + 1;
    audioAttachGeneration.set(targetVideo, generation);
    const promise = createAudioEngine(targetVideo, { ...options, expectedSource:currentSource, generation })
      .finally(() => {
        const latest = audioEnginePromises.get(targetVideo);
        if (latest?.promise === promise) audioEnginePromises.delete(targetVideo);
      });
    audioEnginePromises.set(targetVideo, { source:currentSource, generation, promise });
    return promise;
  }

  function audioStudioCandidates() {
    const ranked = [];
    const seen = new Set();
    const add = (targetVideo, priority = 0) => {
      if (!(targetVideo instanceof HTMLVideoElement) || seen.has(targetVideo)) return;
      markAudioCorsConfirmed(targetVideo);
      if (!shouldAttachAudioToVideo(targetVideo) || !audioVideoIsUsable(targetVideo)) return;

      const bridge = nativeAudioBridgeActive && targetVideo === nativeVideo;
      const replacement = targetVideo === video;
      const studioNativeFallback = !nativeAudioBridgeActive
        && targetVideo === nativeVideo
        && video instanceof HTMLVideoElement
        && extensionSettings.audioEnabled;

      if (!bridge && !replacement && !studioNativeFallback && (targetVideo.paused || targetVideo.ended)) return;

      let visibleScore = 0;
      try {
        const rect = targetVideo.getBoundingClientRect();
        const visibleW = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
        const visibleH = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
        visibleScore = visibleW * visibleH;
        if (!bridge && !replacement && !studioNativeFallback && (rect.width < 24 || rect.height < 24 || visibleScore < 576)) return;
      } catch {}

      seen.add(targetVideo);
      ranked.push({ targetVideo, score: priority + visibleScore });
    };

    if (nativeAudioBridgeActive && nativeAudioBridgeCanRun(nativeVideo)) add(nativeVideo, 3_000_000_000);
    if (!nativeAudioBridgeActive && nativeAudioBridgeCanRun(nativeVideo) && video instanceof HTMLVideoElement) {
      add(nativeVideo, 2_900_000_000);
    }
    if (video instanceof HTMLVideoElement && !nativeAudioBridgeActive) add(video, 2_500_000_000);
    for (const targetVideo of document.querySelectorAll("video")) add(targetVideo, targetVideo.paused ? 0 : 1_000_000_000);

    ranked.sort((a, b) => b.score - a.score);
    return ranked.slice(0, 12).map((item) => item.targetVideo);
  }

  async function audioStudioSupervisorTick() {
    if (!settingsReady || !extensionSettings.audioEnabled || document.hidden || audioStudioSupervisorBusy) return false;
    audioStudioSupervisorBusy = true;
    try {
      const context = await ensureAudioContext({ resume:true });
      if (!context || context.state !== "running") return false;
      return await applyAudioStudioToPage();
    } finally {
      audioStudioSupervisorBusy = false;
    }
  }

  function startAudioStudioSupervisor() {
    if (audioStudioSupervisorTimer) return;
    // Media events handle the fast path; this is only a fail-safe sweep for SPA
    // transitions that do not emit a reliable event. A slower cadence cuts DOM
    // scans substantially without changing responsiveness.
    audioStudioSupervisorTimer = setInterval(() => { void audioStudioSupervisorTick(); }, 1200);
    void audioStudioSupervisorTick();
  }

  function stopAudioStudioSupervisor() {
    clearInterval(audioStudioSupervisorTimer);
    audioStudioSupervisorTimer = null;
    audioStudioSupervisorBusy = false;
    clearTimeout(audioStudioScanTimer);
    audioStudioScanTimer = null;
  }

  async function applyAudioStudioToPage({ notify = false } = {}) {
    if (!extensionSettings.audioEnabled) return false;
    const context = await ensureAudioContext({ resume:true });
    if (!context || context.state !== "running") return false;
    pruneAudioEngines();
    const candidates = audioStudioCandidates(); if (!candidates.length) return false;
    const results = await Promise.allSettled(candidates.map(targetVideo => ensureAudioEngine(targetVideo)));
    const applied = results.some(result => result.status === "fulfilled" && result.value);
    if (applied && notify && !audioStudioReadyNoticeShown) { audioStudioReadyNoticeShown = true; showNotice("Audio Studio đã áp dụng cho video đang phát và sẽ tự theo video tiếp theo.", true); }
    return applied;
  }

  function scheduleAudioStudioScan(delay = 90) {
    clearTimeout(audioStudioScanTimer);
    audioStudioScanTimer = setTimeout(() => {
      audioStudioScanTimer = null;
      if (!extensionSettings.audioEnabled || audioContext?.state !== "running") return;
      void applyAudioStudioToPage();
    }, Math.max(0, Number(delay) || 0));
  }

  async function unlockAudioStudioForPage() {
    if (!extensionSettings.audioEnabled) return false;
    const context = await ensureAudioContext({ resume:true });
    if (!context || context.state !== "running") return false;
    return applyAudioStudioToPage({ notify:true });
  }

  function notifyPlaybackStarted() {
    runtimeMessage({ type: "TDT_MEDIA_PLAYING" }).catch(() => {});
  }

  function playbackIntentVideoId() {
    return String(currentVideoId || video?.dataset?.tdtVideoId || videoIdFromUrl(currentPageUrl) || "");
  }

  function isCurrentVideoManuallyPaused() {
    const id = playbackIntentVideoId();
    return Boolean(id && manuallyPausedVideoId === id);
  }

  function setManualPauseIntent(paused) {
    const id = playbackIntentVideoId();
    if (!id) return;
    if (paused) {
      manuallyPausedVideoId = id;
      manuallyPausedAt = Date.now();
      shouldResumeFromBackground = false;
      stopHiddenPlaybackKeepAlive();
    } else if (manuallyPausedVideoId === id) {
      manuallyPausedVideoId = "";
      manuallyPausedAt = 0;
    }
  }

  function preparePlaybackIntentForVideo(videoId) {
    const id = String(videoId || "");
    if (!id) return;
    if (manuallyPausedVideoId && manuallyPausedVideoId !== id) {
      manuallyPausedVideoId = "";
      manuallyPausedAt = 0;
    }
  }

  function stopHiddenPlaybackKeepAlive() {
    clearInterval(hiddenPlaybackKeepAliveTimer);
    hiddenPlaybackKeepAliveTimer = null;
  }

  function startHiddenPlaybackKeepAlive() {
    stopHiddenPlaybackKeepAlive();
    if (!extensionSettings.backgroundPlay || !document.hidden || !video || videoGateLocked) return;
    hiddenPlaybackKeepAliveTimer = setInterval(() => {
      if (!extensionSettings.backgroundPlay || !document.hidden || !video || videoGateLocked) {
        stopHiddenPlaybackKeepAlive();
        return;
      }
      ensureVideoSound();
      if (video.paused && !pausedBySmartAutoPause && !isCurrentVideoManuallyPaused()) video.play().catch(() => {});
    }, 1800);
  }

  function configureMediaSession(info = {}) {
    if (!("mediaSession" in navigator)) return;
    try {
      if (typeof MediaMetadata === "function") {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: String(info.title || "TikTok video"),
          artist: String(info.author || "TikTok Sub VI"),
          album: "TikTok Tài Đẹp Trai"
        });
      }
      navigator.mediaSession.setActionHandler("play", () => {
        if (!video || videoGateLocked) return;
        setManualPauseIntent(false);
        ensureVideoSound();
        video.play().catch(() => {});
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (!video) return;
        setManualPauseIntent(true);
        video.pause();
      });
      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        if (!video) return;
        video.currentTime = Math.max(0, video.currentTime - (details.seekOffset || 10));
      });
      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        if (!video) return;
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + (details.seekOffset || 10));
      });
    } catch {}
  }

  function clearMediaSession() {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = null;
      ["play", "pause", "seekbackward", "seekforward"].forEach((action) => {
        try { navigator.mediaSession.setActionHandler(action, null); } catch {}
      });
    } catch {}
  }

  function restoreFullscreenStructure() {
    mediaLayer?.removeAttribute("data-tdt-fullscreen-root");
    if (!host?.isConnected || !mountElement?.isConnected) return;
    if (webFullscreenActive) {
      if (mediaLayer?.isConnected && host.parentNode !== mediaLayer) mediaLayer.appendChild(host);
      updatePortalGeometry();
      return;
    }
    if (host.parentNode !== mountElement) mountElement.appendChild(host);
    updatePortalGeometry();
  }

  async function togglePlayerFullscreen() {
    if (!mediaLayer?.isConnected || !video?.isConnected) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        restoreFullscreenStructure();
      }
      else {
        if (webFullscreenActive) setWebFullscreen(false);
        mediaLayer.setAttribute("data-tdt-fullscreen-root", "true");
        mediaLayer.appendChild(host);
        await mediaLayer.requestFullscreen({ navigationUI: "hide" });
        requestAnimationFrame(() => {
          if (!video?.isConnected) return;
          updatePortalGeometry();
          if (!video.paused && !videoGateLocked) video.play().catch(() => {});
        });
      }
    } catch {
      restoreFullscreenStructure();
      showNotice("Trình duyệt chưa cho phép mở toàn màn hình.");
    }
  }

  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement === mediaLayer) {
      requestAnimationFrame(() => updatePortalGeometry());
      return;
    }
    restoreFullscreenStructure();
  });

  function normalizeSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    const placeBelowSubtitleTranslator = source.placeBelowSubtitleTranslator !== false;
    const eqPreset = Object.hasOwn(EQ_PRESETS, source.eqPreset) || source.eqPreset === "custom" ? source.eqPreset : "flat";
    return {
      autoReplace: source.autoReplace !== false,
      scanSubtitles: !placeBelowSubtitleTranslator && source.scanSubtitles === true,
      translateVietnamese: source.translateVietnamese !== false,
      autoplay: source.autoplay !== false,
      useSubtitleCache: source.useSubtitleCache !== false,
      autoCloseTranscriptWindow: source.autoCloseTranscriptWindow !== false,
      subtitleBackgroundOpacity: clampSubtitleOpacity(source.subtitleBackgroundOpacity),
      backgroundPlay: source.backgroundPlay === true,
      playbackRate: clampPlaybackRate(source.playbackRate),
      playbackVolume: clampPlaybackVolume(source.playbackVolume),
      smartAutoPause: source.smartAutoPause === true,
      placeBelowSubtitleTranslator,
      audioEnabled: source.audioEnabled === true,
      equalizerEnabled: source.equalizerEnabled !== false,
      eqPreset,
      eqBands: normalizeEqBands(source.eqBands),
      adaptiveNormalizer: source.adaptiveNormalizer === true,
      spatialAudio: source.spatialAudio === true,
      spatialIntensity: Math.max(0, Math.min(1, Number.isFinite(Number(source.spatialIntensity)) ? Number(source.spatialIntensity) : DEFAULT_SETTINGS.spatialIntensity)),
      cleanMode: source.cleanMode === true,
      productWidgetEnabled: source.productWidgetEnabled !== false,
      watchWidgetEnabled: source.watchWidgetEnabled !== false,
      showVideoStats: source.showVideoStats !== false,
      showVideoMeta: source.showVideoMeta !== false,
      autoScrollEnabled: source.autoScrollEnabled !== false
    };
  }

  function restoreForeignCleanUi() {
    for (const [element, originalStyle] of cleanHiddenForeignElements) {
      if (!(element instanceof HTMLElement)) continue;
      element.removeAttribute("data-tdt-clean-foreign-hidden");
      element.style.cssText = originalStyle;
    }
    cleanHiddenForeignElements.clear();
  }

  function concealForeignCleanUi() {
    if (!extensionSettings.cleanMode || !mountElement?.isConnected) return;
    const selectors = [
      "#tt-sub-actions", "[id^='tt-sub-actions']", "[data-tt-sub-actions]",
      "[data-shortkit-controls]", "[data-shortkit-toolbar]", "[data-tpt-controls]", "[data-tpt-toolbar]",
      ".tpt-tool-ui", ".tpt-video-toolbar", ".tpt-product-btn", ".tpt-product-panel", ".tpt-shop-unlock",
      "[id*='shortkit-controls' i]", "[class*='shortkit-controls' i]", "[id*='subtitle-actions' i]",
      "[class*='subtitle-actions' i]", "[id*='translator-actions' i]", "[class*='translator-actions' i]"
    ];
    const candidates = new Set();
    const playerRect = mountElement.getBoundingClientRect?.();
    for (const selector of selectors) {
      mountElement.querySelectorAll?.(selector).forEach((node) => candidates.add(node));
      deepQuerySubtitleElements([selector]).forEach((node) => {
        const rect = node.getBoundingClientRect?.();
        if (!rect || !playerRect) return;
        if (rect.right > playerRect.left && rect.left < playerRect.right && rect.bottom > playerRect.top && rect.top < playerRect.bottom) candidates.add(node);
      });
    }
    for (const element of candidates) {
      if (!(element instanceof HTMLElement) || element === host || element === mediaLayer || host?.contains(element) || mediaLayer?.contains(element)) continue;
      if (!cleanHiddenForeignElements.has(element)) cleanHiddenForeignElements.set(element, element.style.cssText);
      element.setAttribute("data-tdt-clean-foreign-hidden", "true");
      element.style.setProperty("opacity", "0", "important");
      element.style.setProperty("visibility", "hidden", "important");
      element.style.setProperty("pointer-events", "none", "important");
    }
  }

  function applyCleanMode() {
    if (panel) panel.dataset.cleanMode = String(extensionSettings.cleanMode === true);
    if (extensionSettings.cleanMode) concealForeignCleanUi(); else restoreForeignCleanUi();
  }

  function toggleCleanMode() {
    extensionSettings = { ...extensionSettings, cleanMode: !extensionSettings.cleanMode };
    applyCleanMode();
    chrome.storage.local.set({ [SETTINGS_KEY]: extensionSettings });
    chrome.runtime.sendMessage({ type: "REMOTE_USAGE_EVENT", counter: "cleanModeToggles" }).catch(() => {});
    if (!extensionSettings.cleanMode) showNotice("Clean Mode đã tắt.", true);
  }


  function applyPlayerLayerMode() {
    if (mediaLayer) mediaLayer.style.zIndex = "20";
    if (host) host.style.zIndex = extensionSettings.placeBelowSubtitleTranslator ? "28" : "40";
  }

  function setCaptionLines(translated = "", original = "") {
    if (!captionOverlay || !captionTranslatedEl || !captionOriginalEl) return;
    const top = String(translated || "").replace(/\s+/g, " ").trim();
    const bottom = String(original || "").replace(/\s+/g, " ").trim();
    captionTranslatedEl.textContent = top || bottom;
    captionOriginalEl.textContent = top && bottom && top !== bottom ? bottom : "";
    captionOverlay.style.display = (top || bottom) ? "block" : "none";
  }

  function elementText(element) {
    return String(element?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function subtitleRootText(root) {
    if (!root) return { translated: "", original: "" };
    const translated = findWithinOrSelf(root, '.tt-sub-inline-translated,[data-tt-sub-translated]');
    const original = findWithinOrSelf(root, '.tt-sub-inline-original,[data-tt-sub-original]');
    const known = { translated: elementText(translated), original: elementText(original) };
    if (known.translated || known.original) return known;

    if (root.getAttribute?.('data-tdt-transcript-source') === 'true') {
      const cue = activeExternalCue();
      const cueLines = String(cue?.text || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
      if (cueLines.length) return { translated: cueLines[0], original: cueLines.slice(1).join(' ') };
      const activeRow = root.querySelector?.('[aria-current="true"],[aria-selected="true"],[data-active="true"],[class*="active" i],[class*="current" i]');
      const activeText = transcriptTextFromRow(activeRow);
      const activeLines = activeText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
      if (activeLines.length) return { translated: activeLines[0], original: activeLines.slice(1).join(' ') };
    }
    return known;
  }

  function concealExternalSubtitleRoot(root) {
    if (!(root instanceof HTMLElement) || root === captionOverlay) return;
    if (root.getAttribute('data-tdt-transcript-source') === 'true') return;
    if (!concealedExternalSubtitleRoots.has(root)) {
      concealedExternalSubtitleRoots.set(root, {
        opacity: root.style.getPropertyValue("opacity"),
        opacityPriority: root.style.getPropertyPriority("opacity"),
        pointerEvents: root.style.getPropertyValue("pointer-events"),
        pointerEventsPriority: root.style.getPropertyPriority("pointer-events")
      });
    }
    root.setAttribute("data-tdt-subtitle-source-hidden", "true");
    if (root.style.getPropertyValue("opacity") !== "0" || root.style.getPropertyPriority("opacity") !== "important") {
      root.style.setProperty("opacity", "0", "important");
    }
    if (root.style.getPropertyValue("pointer-events") !== "none" || root.style.getPropertyPriority("pointer-events") !== "important") {
      root.style.setProperty("pointer-events", "none", "important");
    }
  }

  function restoreConcealedExternalSubtitles() {
    for (const [root, state] of concealedExternalSubtitleRoots.entries()) {
      if (!(root instanceof HTMLElement)) continue;
      root.removeAttribute("data-tdt-subtitle-source-hidden");
      root.removeAttribute("data-tdt-bound-video-id");
      if (state.opacity) root.style.setProperty("opacity", state.opacity, state.opacityPriority || "");
      else root.style.removeProperty("opacity");
      if (state.pointerEvents) root.style.setProperty("pointer-events", state.pointerEvents, state.pointerEventsPriority || "");
      else root.style.removeProperty("pointer-events");
    }
    concealedExternalSubtitleRoots.clear();
  }

  function scanOpenSubtitleRoots(force = false) {
    const now = Date.now();
    // TikTok's normal player lives in the light DOM. Shadow-root discovery is
    // kept only as a compatibility fallback and is deliberately throttled.
    if (!force && now - lastOpenSubtitleRootScanAt < 5000) return cachedOpenSubtitleRoots;
    lastOpenSubtitleRootScanAt = now;
    const roots = [];
    const seen = new Set();
    const queue = [document.body || document.documentElement];
    let walked = 0;
    const maxWalk = 1800;
    for (let cursor = 0; cursor < queue.length && walked < maxWalk; cursor += 1) {
      const node = queue[cursor];
      if (!(node instanceof Element) || seen.has(node)) continue;
      seen.add(node);
      walked += 1;
      if (node.shadowRoot && node.shadowRoot.mode === 'open') {
        roots.push(node.shadowRoot);
        for (const child of node.shadowRoot.children || []) {
          if (queue.length < maxWalk) queue.push(child);
        }
      }
      for (const child of node.children || []) {
        if (queue.length < maxWalk) queue.push(child);
      }
    }
    cachedOpenSubtitleRoots = roots;
    return roots;
  }

  function directQueryElements(selectors, root = document) {
    const found = new Set();
    for (const selector of selectors) {
      try { root.querySelectorAll?.(selector).forEach((node) => found.add(node)); } catch {}
    }
    return Array.from(found);
  }

  function deepQuerySubtitleElements(selectors) {
    const found = new Set(directQueryElements(selectors));
    // Subtitle Translator may render inside an open shadow root. Keep this
    // compatibility path, but reuse the throttled/root-limited cache above.
    for (const root of scanOpenSubtitleRoots(false)) {
      for (const selector of selectors) {
        try { root.querySelectorAll?.(selector).forEach((node) => found.add(node)); } catch {}
      }
    }
    return Array.from(found);
  }

  function exactTimestampText(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return EXTERNAL_TIMESTAMP_RE.test(text) ? text : '';
  }

  function timestampTextNodesInRoot(root, maxNodes = EXTERNAL_TRANSCRIPT_MAX_TEXT_NODES) {
    const base = root instanceof Document ? (root.body || root.documentElement) : root;
    if (!base) return [];
    const found = [];
    let walked = 0;
    const walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node && walked < maxNodes; node = walker.nextNode()) {
      walked += 1;
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(parent.tagName)) continue;
      const ownerRoot = parent.getRootNode?.();
      if (ownerRoot === shadow || ownerRoot === controlWidgetShadow) continue;
      if (!exactTimestampText(node.nodeValue)) continue;
      found.push(node);
      if (found.length >= 240) break;
    }
    return found;
  }

  function transcriptTextFromRow(row) {
    if (!(row instanceof Element)) return '';
    const raw = String(row.innerText || row.textContent || '').replace(/\u200b/g, '').trim();
    if (!raw || raw.length > 900) return '';
    const timeToken = /(?:^|\s)(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?(?=\s|$)/g;
    const ignored = /^(?:copy|copied|download|translate|translation|subtitle|transcript|play|pause|views?|likes?|comments?|shares?|saves?)$/i;
    const cleanLine = (value) => String(value || '').replace(timeToken, ' ').replace(/\s+/g, ' ').trim();
    const leafLines = Array.from(row.querySelectorAll('*')).filter((node) => node.children.length === 0).map((node) => cleanLine(node.textContent));
    const sourceLines = leafLines.some((line) => /\p{L}/u.test(line)) ? leafLines : raw.split(/\n+/).map(cleanLine);
    const lines = sourceLines.filter((line) => {
      return line && line.length <= 420 && /\p{L}/u.test(line) && !ignored.test(line);
    });
    return [...new Set(lines)].join('\n').trim();
  }

  function transcriptRowForTimestampNode(textNode) {
    const timestamp = exactTimestampText(textNode?.nodeValue);
    if (!timestamp) return null;
    let row = textNode.parentElement;
    for (let depth = 0; row && depth < 6; depth += 1, row = row.parentElement) {
      if (row === document.body || row === document.documentElement || row === mountElement || row === mediaLayer) break;
      if (row.closest?.('#tdt-control-widget-host,#tdt-tiktok-extension-host')) break;
      if (row.querySelector?.('input[type="range"],video')) continue;
      const raw = String(row.innerText || row.textContent || '').trim();
      if (!raw || raw.length > 900) continue;
      const timestampCount = (raw.match(/(?:^|\s)(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?(?=\s|$)/g) || []).length;
      if (timestampCount !== 1) continue;
      const text = transcriptTextFromRow(row);
      if (!text) continue;
      const start = parseTimestamp(timestamp);
      if (!Number.isFinite(start)) continue;
      return { row, start, text };
    }
    return null;
  }

  function transcriptRowsInRoot(root, maxNodes = 3000) {
    const rows = [];
    const seenRows = new Set();
    for (const timestampNode of timestampTextNodesInRoot(root, maxNodes)) {
      const item = transcriptRowForTimestampNode(timestampNode);
      if (!item || seenRows.has(item.row)) continue;
      seenRows.add(item.row);
      rows.push(item);
    }
    return rows;
  }

  function normalizeExternalCueList(source) {
    const duration = Math.max(0, Number(video?.duration || currentVideoInfo?.duration) || 0);
    const byStart = new Map();
    for (const item of Array.isArray(source) ? source : []) {
      const start = Math.max(0, Number(item?.start));
      const end = Number(item?.end);
      const text = decodeSubtitleText(item?.text || '').replace(/\n{3,}/g, '\n\n').trim();
      if (!Number.isFinite(start) || !text || (duration > 0 && start > duration + 2)) continue;
      const key = start.toFixed(3);
      const existing = byStart.get(key);
      if (existing) {
        if (!existing.text.split('\n').includes(text)) existing.text = `${existing.text}\n${text}`;
        if (Number.isFinite(end) && end > existing.end) existing.end = end;
      } else {
        byStart.set(key, { start, end: Number.isFinite(end) ? end : 0, text });
      }
      if (byStart.size >= 500) break;
    }
    const cues = Array.from(byStart.values()).sort((a, b) => a.start - b.start);
    for (let index = 0; index < cues.length; index += 1) {
      const cue = cues[index];
      const nextStart = cues[index + 1]?.start;
      const inferredEnd = Number.isFinite(nextStart) && nextStart > cue.start
        ? nextStart
        : duration > cue.start
          ? duration + 0.05
          : cue.start + 6;
      if (!Number.isFinite(cue.end) || cue.end <= cue.start) cue.end = inferredEnd;
      if (Number.isFinite(nextStart) && cue.end > nextStart) cue.end = nextStart;
      cue.end = Math.max(cue.start + 0.12, cue.end);
    }
    return cues;
  }

  function transcriptCuesFromRoot(root) {
    if (!(root instanceof Element || root instanceof DocumentFragment || root instanceof Document)) return [];
    return normalizeExternalCueList(transcriptRowsInRoot(root, 5000));
  }

  function discoverTranscriptPanelRoots(force = false) {
    const connected = cachedTranscriptPanelRoots.filter((root) => root instanceof Element && root.isConnected);
    const now = Date.now();
    if (!force && connected.length && now - lastTranscriptPanelScanAt < EXTERNAL_TRANSCRIPT_SCAN_INTERVAL_MS * 3) {
      cachedTranscriptPanelRoots = connected;
      return connected;
    }
    if (!force && now - lastTranscriptPanelScanAt < EXTERNAL_TRANSCRIPT_SCAN_INTERVAL_MS) return connected;
    lastTranscriptPanelScanAt = now;

    const grouped = new Map();
    const domRoots = [document, ...scanOpenSubtitleRoots(force)];
    for (const domRoot of domRoots) {
      for (const item of transcriptRowsInRoot(domRoot, EXTERNAL_TRANSCRIPT_MAX_TEXT_NODES)) {
        let container = item.row.parentElement;
        for (let depth = 0; container && depth < 4; depth += 1, container = container.parentElement) {
          if (container === document.body || container === document.documentElement || container === mountElement || container === mediaLayer) break;
          const length = String(container.textContent || '').length;
          if (length > 16000) break;
          if (!grouped.has(container)) grouped.set(container, new Set());
          grouped.get(container).add(item.row);
        }
      }
    }

    const candidates = [];
    for (const [container, rows] of grouped.entries()) {
      const hint = `${container.id || ''} ${String(container.className || '')} ${container.getAttribute?.('aria-label') || ''}`;
      const hinted = /sub(?:title)?|caption|transcript|translate|language/i.test(hint);
      if (rows.size < 2 && !hinted) continue;
      const cues = transcriptCuesFromRoot(container);
      if (cues.length < (hinted ? 1 : 2)) continue;
      const textLength = String(container.textContent || '').length;
      const score = cues.length * 100 + (hinted ? 250 : 0) - textLength / 500;
      candidates.push({ container, score });
    }
    candidates.sort((a, b) => b.score - a.score);
    cachedTranscriptPanelRoots = candidates.slice(0, 5).map(({ container }) => {
      container.setAttribute('data-tdt-transcript-source', 'true');
      return container;
    });
    return cachedTranscriptPanelRoots;
  }

  function readExternalTextTrackCues() {
    const ownTracks = new Set(Array.from(video?.querySelectorAll?.('track[data-tdt-subtitle]') || []).map((track) => track.track));
    const videos = [];
    const addVideo = (candidate) => {
      if (candidate instanceof HTMLVideoElement && candidate.isConnected && !videos.includes(candidate)) videos.push(candidate);
    };
    addVideo(nativeVideo);
    addVideo(video);
    document.querySelectorAll('video').forEach(addVideo);

    const inspectTracks = () => {
      let best = [];
      let bestScore = -Infinity;
      for (const candidate of videos.slice(0, 24)) {
        for (const track of Array.from(candidate.textTracks || [])) {
          if (ownTracks.has(track)) continue;
          let cueList = [];
          try { cueList = Array.from(track.cues || []); } catch { cueList = []; }
          if (!cueList.length) continue;
          const cues = normalizeExternalCueList(cueList.map((cue) => ({ start: cue.startTime, end: cue.endTime, text: cue.text })));
          if (!cues.length) continue;
          const label = `${track.label || ''} ${track.language || ''}`;
          const score = cues.length * 10 + (/vi|viet|translated|translation/i.test(label) ? 500 : 0) + (candidate === nativeVideo ? 60 : 0);
          if (score > bestScore) {
            best = cues;
            bestScore = score;
          }
        }
      }
      return best;
    };

    let best = inspectTracks();
    if (best.length) return best;
    deepQuerySubtitleElements(['video']).forEach(addVideo);
    best = inspectTracks();
    return best;
  }

  function externalCueSignature(cues) {
    return cues.map((cue) => `${cue.start.toFixed(3)}>${cue.end.toFixed(3)}:${cue.text}`).join('|');
  }

  function refreshExternalSubtitleCues(root = null, force = false) {
    if (!extensionSettings.placeBelowSubtitleTranslator) return false;
    const now = Date.now();
    if (!force && now - lastExternalSubtitleCueScanAt < 700) return externalSubtitleCues.length > 0;
    lastExternalSubtitleCueScanAt = now;
    let cues = readExternalTextTrackCues();
    if (!cues.length && root) cues = transcriptCuesFromRoot(root);
    const inlineDirectRoot = root && root.getAttribute?.('data-tdt-transcript-source') !== 'true';
    if (!cues.length && !inlineDirectRoot) {
      let best = [];
      for (const panelRoot of discoverTranscriptPanelRoots(force)) {
        const candidate = transcriptCuesFromRoot(panelRoot);
        if (candidate.length > best.length) best = candidate;
      }
      cues = best;
    }
    if (!cues.length) return false;
    const signature = externalCueSignature(cues);
    if (signature === externalSubtitleCueSignature) return true;
    externalSubtitleCues = cues;
    externalSubtitleCueSignature = signature;
    setSubtitleStatus(`đã nhận ${cues.length} câu từ TikTok Subtitle Translator`, 'ok');
    updateCaptionOverlay();
    return true;
  }

  function activeExternalCue(time = Number(video?.currentTime) || 0) {
    for (const cue of externalSubtitleCues) {
      if (time >= cue.start && time < cue.end) return cue;
      if (cue.start > time) break;
    }
    return null;
  }

  function inferredSubtitleVideoId(root) {
    if (!(root instanceof Element)) return '';
    const direct = String(root.getAttribute('data-tdt-bound-video-id') || root.getAttribute('data-video-id') || root.getAttribute('data-item-id') || '');
    if (/^\d{8,}$/.test(direct)) return direct;
    let scope = root;
    for (let depth = 0; scope && depth < 7; depth += 1, scope = scope.parentElement) {
      const own = String(scope.id || '').match(/xgwrapper-\d+-(\d{8,})/)?.[1]
        || String(scope.getAttribute?.('data-video-id') || '').match(/\d{8,}/)?.[0]
        || String(scope.getAttribute?.('data-item-id') || '').match(/\d{8,}/)?.[0]
        || String(scope.getAttribute?.('data-aweme-id') || '').match(/\d{8,}/)?.[0];
      if (own) return own;
      const player = scope.querySelector?.('[id^="xgwrapper-"],[data-video-id],[data-item-id],[data-aweme-id]');
      const nested = String(player?.id || '').match(/xgwrapper-\d+-(\d{8,})/)?.[1]
        || String(player?.getAttribute?.('data-video-id') || '').match(/\d{8,}/)?.[0]
        || String(player?.getAttribute?.('data-item-id') || '').match(/\d{8,}/)?.[0]
        || String(player?.getAttribute?.('data-aweme-id') || '').match(/\d{8,}/)?.[0];
      if (nested) return nested;
    }
    return '';
  }

  function normalizeExternalSubtitleRoot(node) {
    if (!(node instanceof Element)) return null;
    const rootSelector = '#tt-sub-inline,.tt-sub-inline--inflow,.tt-sub-inline--videoanchor,[data-tt-sub-inline],[data-tdt-transcript-source="true"]';
    if (node.matches?.(rootSelector)) return node;
    return node.closest?.(rootSelector) || null;
  }

  function externalSubtitleCandidates() {
    const selectors = [
      '#tt-sub-inline',
      '.tt-sub-inline--inflow',
      '.tt-sub-inline--videoanchor',
      '[data-tt-sub-inline]',
      '.tt-sub-inline-translated',
      '.tt-sub-inline-original'
    ];
    const roots = new Set();
    for (const node of deepQuerySubtitleElements(selectors)) {
      const root = normalizeExternalSubtitleRoot(node);
      if (root instanceof Element && root.isConnected && root !== captionOverlay) roots.add(root);
    }
    const currentId = String(externalSubtitleSessionVideoId || currentTikTokVideoId() || '');
    const hasCurrentInlineRoot = Array.from(roots).some((root) => {
      const inferredId = inferredSubtitleVideoId(root);
      return subtitleRootSharesActivePlayer(root) || Boolean(currentId && inferredId && currentId === inferredId);
    });
    if (!hasCurrentInlineRoot) {
      discoverTranscriptPanelRoots(false).forEach((root) => {
        if (root instanceof Element && root.isConnected && root !== captionOverlay) roots.add(root);
      });
    }
    return Array.from(roots);
  }

  function subtitleRootSharesActivePlayer(root) {
    if (!(root instanceof Element) || !root.isConnected) return false;
    if (mediaLayer?.contains(root) || mountElement?.contains(root)) return true;

    const activeVideo = nativeVideo?.isConnected ? nativeVideo : (video?.isConnected ? video : null);
    if (!activeVideo) return false;

    let scope = root;
    for (let depth = 0; scope && depth < 10; depth += 1, scope = scope.parentElement) {
      if (scope.contains?.(activeVideo)) return true;
    }

    const rootCard = root.closest?.('article,[data-e2e="recommend-list-item-container"],[data-e2e="feed-video"],[role="dialog"],section[id^="media-card-"]');
    const activeCard = activeVideo.closest?.('article,[data-e2e="recommend-list-item-container"],[data-e2e="feed-video"],[role="dialog"],section[id^="media-card-"]');
    if (rootCard && activeCard && rootCard === activeCard) return true;

    const rootRect = root.getBoundingClientRect?.();
    const videoRect = activeVideo.getBoundingClientRect?.();
    if (!rootRect || !videoRect || !videoRect.width || !videoRect.height) return false;
    const horizontalOverlap = Math.max(0, Math.min(rootRect.right, videoRect.right) - Math.max(rootRect.left, videoRect.left));
    const verticalDistance = Math.max(0, Math.max(videoRect.top - rootRect.bottom, rootRect.top - videoRect.bottom));
    return horizontalOverlap >= Math.min(rootRect.width || 0, videoRect.width) * 0.35 && verticalDistance <= 220;
  }

  function markExistingExternalSubtitlesStale() {
    const currentId = String(externalSubtitleSessionVideoId || currentTikTokVideoId() || '');
    for (const root of externalSubtitleCandidates()) {
      const text = subtitleRootText(root);
      const inferredId = inferredSubtitleVideoId(root);
      const sharesActivePlayer = subtitleRootSharesActivePlayer(root);
      const transcriptSource = root.getAttribute?.('data-tdt-transcript-source') === 'true';
      const isCurrent = transcriptSource || sharesActivePlayer || Boolean(currentId && inferredId && currentId === inferredId);
      if (isCurrent && (text.translated || text.original)) {
        staleExternalSubtitleRoots.delete(root);
        if (currentId) root.setAttribute('data-tdt-bound-video-id', currentId);
        continue;
      }
      staleExternalSubtitleRoots.set(root, {
        translated: text.translated,
        original: text.original,
        videoId: inferredId || currentId
      });
      concealExternalSubtitleRoot(root);
    }
  }

  function beginExternalSubtitleSession(videoId = currentTikTokVideoId()) {
    externalSubtitleObserver?.disconnect();
    externalSubtitleObserver = null;
    externalSubtitleDocumentObserver?.disconnect();
    externalSubtitleDocumentObserver = null;
    externalSubtitleRoot?.removeAttribute?.('data-tdt-bound-video-id');
    cachedTranscriptPanelRoots.forEach((root) => {
      root.removeAttribute?.('data-tdt-bound-video-id');
      root.removeAttribute?.('data-tdt-transcript-source');
    });
    externalSubtitleRoot = null;
    cachedOpenSubtitleRoots = [];
    lastOpenSubtitleRootScanAt = 0;
    clearInterval(externalSubtitleSearchTimer);
    externalSubtitleSearchTimer = null;
    externalSubtitleTranslatedText = "";
    externalSubtitleOriginalText = "";
    externalSubtitleCues = [];
    externalSubtitleCueSignature = "";
    lastExternalSubtitleCueScanAt = 0;
    cachedTranscriptPanelRoots = [];
    lastTranscriptPanelScanAt = 0;
    externalSubtitleSessionVideoId = String(videoId || "");
    externalSubtitleSessionStartedAt = Date.now();
    markExistingExternalSubtitlesStale();
    if (!subtitleCues.length) setCaptionLines("", "");
  }

  function stopExternalSubtitleBridge() {
    externalSubtitleObserver?.disconnect();
    externalSubtitleObserver = null;
    externalSubtitleDocumentObserver?.disconnect();
    externalSubtitleDocumentObserver = null;
    externalSubtitleRoot?.removeAttribute?.('data-tdt-bound-video-id');
    cachedTranscriptPanelRoots.forEach((root) => {
      root.removeAttribute?.('data-tdt-bound-video-id');
      root.removeAttribute?.('data-tdt-transcript-source');
    });
    externalSubtitleRoot = null;
    cachedOpenSubtitleRoots = [];
    lastOpenSubtitleRootScanAt = 0;
    clearInterval(externalSubtitleSearchTimer);
    externalSubtitleSearchTimer = null;
    restoreConcealedExternalSubtitles();
    externalSubtitleTranslatedText = "";
    externalSubtitleOriginalText = "";
    externalSubtitleCues = [];
    externalSubtitleCueSignature = "";
    lastExternalSubtitleCueScanAt = 0;
    cachedTranscriptPanelRoots = [];
    lastTranscriptPanelScanAt = 0;
    externalSubtitleSessionVideoId = "";
    externalSubtitleSessionStartedAt = 0;
    if (!subtitleCues.length) updateCaptionOverlay();
  }

  function subtitleRootBelongsToCurrentVideo(root) {
    if (!(root instanceof Element) || !root.isConnected) return false;
    const currentId = String(externalSubtitleSessionVideoId || currentTikTokVideoId() || '');
    const inferredId = inferredSubtitleVideoId(root);
    const sharesActivePlayer = subtitleRootSharesActivePlayer(root);

    if (sharesActivePlayer) {
      staleExternalSubtitleRoots.delete(root);
      if (currentId) root.setAttribute('data-tdt-bound-video-id', currentId);
      return true;
    }

    if (currentId && inferredId) {
      if (currentId !== inferredId) return false;
      staleExternalSubtitleRoots.delete(root);
      root.setAttribute('data-tdt-bound-video-id', currentId);
      return true;
    }

    const text = subtitleRootText(root);
    const stale = staleExternalSubtitleRoots.get(root);
    if (stale) {
      const unchanged = stale.translated === text.translated && stale.original === text.original;
      if (unchanged) return false;
      staleExternalSubtitleRoots.delete(root);
    }

    const boundId = String(root.getAttribute("data-tdt-bound-video-id") || "");
    if (boundId && currentId && boundId !== currentId) return false;

    if (root.getAttribute('data-tdt-transcript-source') === 'true') {
      staleExternalSubtitleRoots.delete(root);
      if (currentId) root.setAttribute('data-tdt-bound-video-id', currentId);
      return true;
    }

    const activeVideo = nativeVideo?.isConnected ? nativeVideo : video;
    const rootRect = root.getBoundingClientRect?.();
    const videoRect = activeVideo?.getBoundingClientRect?.();
    if (rootRect && videoRect && rootRect.width > 0 && rootRect.height > 0) {
      const cx = rootRect.left + rootRect.width / 2;
      const cy = rootRect.top + rootRect.height / 2;
      const insideOrNear = cx >= videoRect.left - 100 && cx <= videoRect.right + 100
        && cy >= videoRect.top - 100 && cy <= videoRect.bottom + 220;
      if (insideOrNear) return true;
    }
    return false;
  }

  function findExternalSubtitleRoot() {
    if (externalSubtitleRoot?.isConnected && subtitleRootBelongsToCurrentVideo(externalSubtitleRoot)) {
      return externalSubtitleRoot;
    }
    const candidates = externalSubtitleCandidates();
    if (!candidates.length) return null;

    const subtitleAnchorVideo = video?.isConnected ? video : nativeVideo;
    const videoScope = subtitleAnchorVideo?.closest?.(
      'article,[data-e2e="recommend-list-item-container"],[data-e2e="feed-video"],[role="dialog"],section[id^="media-card-"],.tpt-sm-videowrap,.tdt-lightdom-player'
    );
    const videoRect = subtitleAnchorVideo?.getBoundingClientRect?.();

    let best = null;
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      if (!subtitleRootBelongsToCurrentVideo(candidate)) continue;
      let score = 0;
      if (mediaLayer?.contains(candidate)) score += 3000;
      if (mountElement?.contains(candidate)) score += 1800;
      if (videoScope?.contains(candidate)) score += 1000;
      const candidateScope = candidate.closest?.(
        'article,[data-e2e="recommend-list-item-container"],[data-e2e="feed-video"],[role="dialog"],section[id^="media-card-"]'
      );
      if (videoScope && candidateScope === videoScope) score += 600;
      const parts = subtitleRootText(candidate);
      if (parts.translated) score += 100;
      if (parts.original) score += 30;
      if (candidate.isConnected) score += 10;
      if (videoRect) {
        const rect = candidate.getBoundingClientRect?.();
        if (rect) {
          const videoCenterX = videoRect.left + videoRect.width / 2;
          const videoCenterY = videoRect.top + videoRect.height / 2;
          const candidateCenterX = rect.left + rect.width / 2;
          const candidateCenterY = rect.top + rect.height / 2;
          score -= Math.hypot(videoCenterX - candidateCenterX, videoCenterY - candidateCenterY) / 1000;
        }
      }
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  }

  function findWithinOrSelf(scope, selector) {
    if (!scope) return null;
    if (scope.matches?.(selector)) return scope;
    return scope.querySelector?.(selector) || null;
  }

  function readExternalSubtitleParts(root = null) {
    const scope = root || findExternalSubtitleRoot();
    if (!scope || !subtitleRootBelongsToCurrentVideo(scope)) return { translated: "", original: "" };
    return subtitleRootText(scope);
  }

  function refreshExternalSubtitleText(force = false) {
    if (!extensionSettings.placeBelowSubtitleTranslator) return;
    const root = findExternalSubtitleRoot();
    const hasExternalCues = refreshExternalSubtitleCues(root, force);
    if (root && root !== externalSubtitleRoot) attachExternalSubtitleObserver(root);
    if (!root) {
      if (hasExternalCues) {
        updateCaptionOverlay();
        return;
      }
      if (externalSubtitleTranslatedText || externalSubtitleOriginalText) {
        externalSubtitleTranslatedText = "";
        externalSubtitleOriginalText = "";
        if (!subtitleCues.length) updateCaptionOverlay();
      }
      return;
    }
    concealExternalSubtitleRoot(root);
    const next = readExternalSubtitleParts(root);
    if (!force && next.translated === externalSubtitleTranslatedText && next.original === externalSubtitleOriginalText) return;
    externalSubtitleTranslatedText = next.translated;
    externalSubtitleOriginalText = next.original;
    if (!subtitleCues.length) updateCaptionOverlay();
  }

  function attachExternalSubtitleObserver(root = findExternalSubtitleRoot()) {
    if (!extensionSettings.placeBelowSubtitleTranslator || !root || !subtitleRootBelongsToCurrentVideo(root)) return false;
    if (root === externalSubtitleRoot && externalSubtitleObserver && root.isConnected) {
      refreshExternalSubtitleText(true);
      return true;
    }
    externalSubtitleObserver?.disconnect();
    externalSubtitleRoot = root;
    root.setAttribute("data-tdt-bound-video-id", externalSubtitleSessionVideoId || currentTikTokVideoId());
    concealExternalSubtitleRoot(root);
    externalSubtitleObserver = new MutationObserver(() => {
      if (!subtitleRootBelongsToCurrentVideo(root)) return;
      concealExternalSubtitleRoot(root);
      refreshExternalSubtitleCues(root, true);
      refreshExternalSubtitleText();
    });
    externalSubtitleObserver.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden']
    });
    refreshExternalSubtitleCues(root, true);
    refreshExternalSubtitleText(true);
    return true;
  }

  function translatorInfoPanelCandidates(root = document) {
    const selectors = ['#tt-vstats','.tt-vstats','[data-tt-vstats]','[data-tt-video-stats]','[id*="tt-vstats"]','[class*="tt-vstats"]'];
    const found = new Set();
    if (root instanceof Element && selectors.some((selector) => root.matches?.(selector))) found.add(root);
    if (root?.querySelectorAll) selectors.forEach((selector) => root.querySelectorAll(selector).forEach((node) => found.add(node)));
    if (root === document) deepQuerySubtitleElements(selectors).forEach((node) => found.add(node));
    return Array.from(found).filter((node) => node instanceof HTMLElement && node.isConnected && node !== videoStatsPanel);
  }

  function parseMetricText(value) {
    const raw = String(value || '').trim()
      .replace(/triệu/gi, 'M')
      .replace(/tỷ/gi, 'B')
      .replace(/tr(?=$|[^a-z])/gi, 'M')
      .replace(/n(?=$|[^a-z])/gi, 'K');
    const match = raw.match(/(\d[\d.,]*)\s*([KMBT])?/i);
    if (!match) return 0;
    const suffix = String(match[2] || '').toUpperCase();
    let numeric = match[1];
    if (suffix) {
      const decimalIndex = Math.max(numeric.lastIndexOf(','), numeric.lastIndexOf('.'));
      if (decimalIndex >= 0) numeric = `${numeric.slice(0, decimalIndex).replace(/[.,]/g, '')}.${numeric.slice(decimalIndex + 1).replace(/[.,]/g, '')}`;
    } else {
      const groups = numeric.split(/[.,]/);
      const looksGrouped = groups.length > 1 && groups.slice(1).every((group) => group.length === 3);
      if (looksGrouped || (numeric.match(/[.,]/g) || []).length > 1) numeric = numeric.replace(/[.,]/g, '');
      else numeric = numeric.replace(',', '.');
    }
    const mul = {K:1e3,M:1e6,B:1e9,T:1e12}[suffix] || 1;
    return Number(numeric) * mul || 0;
  }

  function formatStatsNumber(value) {
    const n = Math.max(0, Number(value) || 0);
    if (n >= 1e9) return `${(n/1e9).toFixed(n>=1e10?0:1).replace(/\.0$/,'')}B`;
    if (n >= 1e6) return `${(n/1e6).toFixed(n>=1e7?0:1).replace(/\.0$/,'')}M`;
    if (n >= 1e3) return `${(n/1e3).toFixed(n>=1e4?0:1).replace(/\.0$/,'')}K`;
    return String(Math.round(n));
  }

  function formatStatsDate(value) {
    const numeric = Number(value) || 0;
    if (numeric > 0) {
      const date = new Date(numeric < 1e12 ? numeric * 1000 : numeric);
      if (!Number.isNaN(date.getTime())) return `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;
    }
    return String(value || '').match(/20\d{2}[./-]\d{1,2}[./-]\d{1,2}/)?.[0]?.replace(/[/-]/g,'.') || '—';
  }

  function readTranslatorStats(panelNode) {
    if (!(panelNode instanceof Element)) return null;
    const metric = (title, fallbackSelector='') => {
      const node = panelNode.querySelector(`.vs-m[title="${title}"] b`) || (fallbackSelector ? panelNode.querySelector(fallbackSelector) : null);
      return parseMetricText(node?.textContent || '');
    };
    const date = panelNode.querySelector('.vs-date b')?.textContent || '';
    const views = parseMetricText(panelNode.querySelector('.vs-views b')?.textContent || '');
    const erText = panelNode.querySelector('.vs-er b')?.textContent || '';
    const likes = metric('Likes');
    const comments = metric('Comments');
    const shares = metric('Shares');
    const saves = metric('Saves');
    if (!date && !views && !likes && !comments && !shares && !saves) return null;
    return { date, views, er: Number(String(erText).replace('%','')) || 0, likes, comments, shares, saves };
  }

  function readNativeDomStats() {
    const scope = nativeVideo?.closest?.('article,[data-e2e="recommend-list-item-container"],[data-e2e="feed-video"],[role="dialog"],section')
      || mountElement?.closest?.('article,[data-e2e="recommend-list-item-container"],[data-e2e="feed-video"],[role="dialog"],section')
      || mountElement;
    const read = (selector) => parseMetricText(scope?.querySelector?.(selector)?.textContent || '');
    return {
      views: read('[data-e2e="video-views"],[data-e2e="view-count"],[data-e2e="play-count"]'),
      likes: read('[data-e2e="like-count"]'),
      comments: read('[data-e2e="comment-count"]'),
      shares: read('[data-e2e="share-count"]'),
      saves: read('[data-e2e="favorite-count"],[data-e2e="collect-count"]')
    };
  }

  function mergedVideoStats() {
    const api = currentVideoInfo?.stats || {};
    const dom = readNativeDomStats();
    const ext = latestExternalStats || {};
    const pick = (...values) => values.find((value) => Number(value) > 0) || 0;
    const views = pick(api.views, ext.views, dom.views);
    const likes = pick(api.likes, ext.likes, dom.likes);
    const comments = pick(api.comments, ext.comments, dom.comments);
    const shares = pick(api.shares, ext.shares, dom.shares);
    const saves = pick(api.saves, ext.saves, dom.saves);
    const er = Number(ext.er) > 0 ? Number(ext.er) : (views > 0 ? ((likes + comments + shares + saves) / views) * 100 : 0);
    return { date: formatStatsDate(currentVideoInfo?.createTime || ext.date), views, likes, comments, shares, saves, er };
  }

  function statsRelativeDate(dateText) {
    const match = String(dateText || '').match(/(20\d{2})[./-](\d{1,2})[./-](\d{1,2})/);
    if (!match) return '';
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
    if (days < 1) return '· today';
    if (days < 30) return `· ${days}d ago`;
    if (days < 365) return `· ${Math.max(1, Math.floor(days / 30))}mo ago`;
    return `· ${Math.max(1, Math.floor(days / 365))}y ago`;
  }

  function statsMetricRate(value, views) {
    return views > 0 ? `${((Number(value) || 0) / views * 100).toFixed(1)}%` : '0.0%';
  }

  function statsCopyText(data) {
    return [
      `Ngày đăng: ${data.date}`,
      `Lượt xem: ${formatStatsNumber(data.views)}`,
      `ER: ${data.er.toFixed(1)}%`,
      `Lượt thích: ${formatStatsNumber(data.likes)}`,
      `Bình luận: ${formatStatsNumber(data.comments)}`,
      `Chia sẻ: ${formatStatsNumber(data.shares)}`,
      `Lượt lưu: ${formatStatsNumber(data.saves)}`,
      currentPageUrl ? `URL: ${currentPageUrl}` : ''
    ].filter(Boolean).join('\n');
  }

  function updateCustomStatsPanel() {
    if (!videoStatsPanel?.isConnected) return;
    const data = mergedVideoStats();
    videoStatsDate.textContent = data.date;
    videoStatsViews.textContent = formatStatsNumber(data.views);
    videoStatsEr.textContent = `${data.er.toFixed(1)}%`;
    videoStatsLikes.textContent = formatStatsNumber(data.likes);
    videoStatsComments.textContent = formatStatsNumber(data.comments);
    videoStatsShares.textContent = formatStatsNumber(data.shares);
    videoStatsSaves.textContent = formatStatsNumber(data.saves);
    const relative = videoStatsPanel.querySelector('[data-stat="relative"]');
    if (relative) relative.textContent = statsRelativeDate(data.date);
    const rates = {
      likes: statsMetricRate(data.likes, data.views),
      comments: statsMetricRate(data.comments, data.views),
      shares: statsMetricRate(data.shares, data.views),
      saves: statsMetricRate(data.saves, data.views)
    };
    Object.entries(rates).forEach(([key, value]) => {
      const node = videoStatsPanel.querySelector(`[data-rate="${key}"]`);
      if (node) node.textContent = `· ${value}`;
    });
    videoStatsPanel.dataset.copyText = statsCopyText(data);
    applyVideoOverlayVisibility();
  }

  function applySavedStatsPosition(value) {
    if (!videoStatsPanel || !value || typeof value !== 'object') return;
    const x = Math.max(0, Math.min(1, Number(value.x)));
    const y = Math.max(0, Math.min(1, Number(value.y)));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    videoStatsPanel.style.left = `${x * 100}%`;
    videoStatsPanel.style.top = `${y * 100}%`;
    videoStatsPanel.style.transform = 'translate(-50%,-50%)';
  }

  function createCustomStatsPanel() {
    const root = document.createElement('div');
    root.id = 'tdt-vstats';
    root.className = 'video-stats-panel tt-vstats';
    root.hidden = extensionSettings.showVideoStats === false;
    root.title = 'Click to copy all metrics';
    root.innerHTML = `
      <div class="vs-box">
        <div class="vs-row">
          <div class="vs-grp vs-grp-date">
            <span class="vs-date">
              <svg class="vs-i" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M7 2v3M17 2v3M3.5 8.5h17M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>
              <b data-stat="date">—</b><i data-stat="relative"></i>
            </span>
          </div>
          <div class="vs-grp vs-grp-main">
            <span class="vs-views">
              <svg class="vs-i" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M5 3l14 9-14 9V3z"></path></svg>
              <b data-stat="views">0</b><i>Views</i>
            </span>
            <span class="vs-er"><b data-stat="er">0.0%</b><i>ER</i></span>
          </div>
          <div class="vs-grp vs-grp-detail">
            <span class="vs-m" title="Likes">
              <svg class="vs-i" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M12 21C5.5 16.3 2 12.6 2 8.8 2 6.1 4.1 4 6.8 4c1.6 0 3.1.8 4 2 .9-1.2 2.4-2 4-2C20.5 4 22 6.1 22 8.8c0 3.8-3.5 7.5-10 12.2z"></path></svg>
              <b data-stat="likes">0</b><i data-rate="likes">· 0.0%</i>
            </span>
            <span class="vs-m" title="Comments">
              <svg class="vs-i" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"></path></svg>
              <b data-stat="comments">0</b><i data-rate="comments">· 0.0%</i>
            </span>
            <span class="vs-m" title="Shares">
              <svg class="vs-i" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M14 3v4C7 8 4 13 3 19c2.6-3.6 6-5 11-5v4l7-7.5L14 3z"></path></svg>
              <b data-stat="shares">0</b><i data-rate="shares">· 0.0%</i>
            </span>
            <span class="vs-m" title="Saves">
              <svg class="vs-i" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"></path></svg>
              <b data-stat="saves">0</b><i data-rate="saves">· 0.0%</i>
            </span>
          </div>
        </div>
        <div class="vs-hint">
          <svg class="vs-i" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v14h2V4h8V2zm3 4H10a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9l-3-3z"></path></svg>
          <span>Click to copy</span>
        </div>
        <span class="vs-copied">
          <svg class="vs-i" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M9.55 17.6 4.4 12.45l1.4-1.4 3.75 3.75 8.25-8.25 1.4 1.4z"></path></svg>
          Copied
        </span>
      </div>`;
    videoStatsPanel = root;
    videoStatsDate = root.querySelector('[data-stat="date"]');
    videoStatsViews = root.querySelector('[data-stat="views"]');
    videoStatsEr = root.querySelector('[data-stat="er"]');
    videoStatsLikes = root.querySelector('[data-stat="likes"]');
    videoStatsComments = root.querySelector('[data-stat="comments"]');
    videoStatsShares = root.querySelector('[data-stat="shares"]');
    videoStatsSaves = root.querySelector('[data-stat="saves"]');
    chrome.storage.local.get({ [VIDEO_STATS_POSITION_KEY]: null }, (result) => applySavedStatsPosition(result?.[VIDEO_STATS_POSITION_KEY]));

    root.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const bounds = host?.getBoundingClientRect?.();
      if (!bounds?.width || !bounds?.height) return;
      statsDragState = { pointerId:event.pointerId, startX:event.clientX, startY:event.clientY, moved:false, bounds };
      root.setPointerCapture?.(event.pointerId);
    });
    root.addEventListener('pointermove', (event) => {
      if (!statsDragState || statsDragState.pointerId !== event.pointerId) return;
      const dx = event.clientX - statsDragState.startX;
      const dy = event.clientY - statsDragState.startY;
      if (Math.hypot(dx,dy) > 5) statsDragState.moved = true;
      if (!statsDragState.moved) return;
      const x = Math.max(0.04, Math.min(0.96, (event.clientX - statsDragState.bounds.left) / statsDragState.bounds.width));
      const y = Math.max(0.04, Math.min(0.45, (event.clientY - statsDragState.bounds.top) / statsDragState.bounds.height));
      root.style.left = `${x*100}%`;
      root.style.top = `${y*100}%`;
      root.style.transform = 'translate(-50%,-50%)';
    });
    const finish = (event) => {
      if (!statsDragState || statsDragState.pointerId !== event.pointerId) return;
      const moved = statsDragState.moved;
      const bounds = statsDragState.bounds;
      statsDragState = null;
      try { root.releasePointerCapture?.(event.pointerId); } catch {}
      if (moved) {
        const rect = root.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (rect.left + rect.width/2 - bounds.left) / bounds.width));
        const y = Math.max(0, Math.min(1, (rect.top + rect.height/2 - bounds.top) / bounds.height));
        chrome.storage.local.set({ [VIDEO_STATS_POSITION_KEY]: { x, y } });
      } else {
        navigator.clipboard?.writeText(root.dataset.copyText || '').then(() => {
          root.dataset.copied = 'true';
          setTimeout(() => { if (root) root.dataset.copied = 'false'; }, 1200);
        }).catch(() => {});
      }
    };
    root.addEventListener('pointerup', finish);
    root.addEventListener('pointercancel', finish);
    root.addEventListener('dblclick', () => {
      root.style.left = '50%'; root.style.top = '76px'; root.style.transform = 'translateX(-50%)';
      chrome.storage.local.remove(VIDEO_STATS_POSITION_KEY);
    });
    updateCustomStatsPanel();
    return root;
  }

  function restorePromotedTranslatorPanels() {
    for (const [panelNode, state] of promotedTranslatorPanels.entries()) {
      if (!(panelNode instanceof HTMLElement)) continue;
      panelNode.removeAttribute('data-tdt-hidden-vstats');
      panelNode.style.cssText = state.style;
    }
    promotedTranslatorPanels.clear();
  }

  function promoteSubtitleTranslatorPanels(root = document) {
    const candidates = translatorInfoPanelCandidates(root);
    for (const panelNode of candidates) {
      const parsed = readTranslatorStats(panelNode);
      if (parsed) latestExternalStats = parsed;
      if (!promotedTranslatorPanels.has(panelNode)) promotedTranslatorPanels.set(panelNode, { style: panelNode.style.cssText });
      panelNode.setAttribute('data-tdt-hidden-vstats','true');
      panelNode.style.setProperty('opacity','0','important');
      panelNode.style.setProperty('pointer-events','none','important');
      panelNode.style.setProperty('position','absolute','important');
      panelNode.style.setProperty('left','-99999px','important');
      panelNode.style.setProperty('top','0','important');
      panelNode.style.setProperty('z-index','-1','important');
    }
    updateCustomStatsPanel();
  }

  function stopNativePlaybackSync() {
    nativeSyncCleanup.forEach((cleanup) => {
      try { cleanup(); } catch {}
    });
    nativeSyncCleanup = [];
    clearInterval(nativeAudioBridgeMonitorTimer);
    nativeAudioBridgeMonitorTimer = null;
  }

  function addNativeSyncListener(target, type, handler, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, options);
    nativeSyncCleanup.push(() => target.removeEventListener(type, handler, options));
  }

  function suppressNativePlayback() {
    if (!nativeVideo) return;
    captureNativeGuardState(nativeVideo);
    if (nativeAudioBridgeActive && nativeAudioBridgeCanRun(nativeVideo)) {
      setNativeAudioBridgeVolume();
      void ensureNativeAudioBridgePlayback();
      return;
    }
    try {
      nativeVideo.autoplay = false;
      nativeVideo.removeAttribute("autoplay");
      nativeVideo.loop = false;
      nativeVideo.muted = true;
      nativeVideo.defaultMuted = true;
      nativeVideo.volume = 0;
      nativeVideo.controls = false;
      nativeVideo.playsInline = true;
      if (!nativeVideo.paused) nativeVideo.pause();
    } catch {}
  }

  function dispatchNativeClockEvent(type) {
    if (!nativeVideo?.isConnected) return;
    try { nativeVideo.dispatchEvent(new Event(type)); } catch {}
  }

  function syncNativeForSubtitleTranslator(force = false) {
    if (!nativeVideo || !video) {
      refreshExternalSubtitleText(force);
      return;
    }
    const now = performance.now();
    if (!force && now - lastNativeSubtitleSyncAt < 220) {
      refreshExternalSubtitleText(false);
      return;
    }
    lastNativeSubtitleSyncAt = now;
    try {
      if (nativeAudioBridgeActive && nativeAudioBridgeCanRun(nativeVideo)) {
        setNativeAudioBridgeVolume();
        if (Math.abs((nativeVideo.playbackRate || 1) - (video.playbackRate || 1)) > 0.01) nativeVideo.playbackRate = video.playbackRate || 1;
        const drift = Math.abs((nativeVideo.currentTime || 0) - (video.currentTime || 0));
        if (force || drift > 0.22) nativeVideo.currentTime = Number(video.currentTime) || 0;
        void ensureNativeAudioBridgePlayback({ force:false });
      } else {
        suppressNativePlayback();
        if (Math.abs((nativeVideo.playbackRate || 1) - (video.playbackRate || 1)) > 0.01) {
          nativeVideo.playbackRate = video.playbackRate || 1;
        }
        const drift = Math.abs((nativeVideo.currentTime || 0) - (video.currentTime || 0));
        if (force || drift > 0.18) nativeVideo.currentTime = Number(video.currentTime) || 0;
        dispatchNativeClockEvent('timeupdate');
      }
    } catch {}
    refreshExternalSubtitleText(force);
  }

  function startNativePlaybackSync() {
    stopNativePlaybackSync();
    if (!nativeVideo || !video) return;
    try {
      nativeVideo.style.visibility = "visible";
      nativeVideo.style.opacity = "0";
      nativeVideo.style.pointerEvents = "none";
      nativeVideo.style.zIndex = "0";
      if (nativeAudioBridgeActive) setNativeAudioBridgeVolume();
      else suppressNativePlayback();
    } catch {}

    const nativePlayMaintenance = () => {
      if (nativeAudioBridgeActive) {
        setNativeAudioBridgeVolume();
        void ensureNativeAudioBridgePlayback();
      } else {
        suppressNativePlayback();
      }
      refreshExternalSubtitleText(true);
    };
    addNativeSyncListener(nativeVideo, "play", nativePlayMaintenance, true);
    addNativeSyncListener(nativeVideo, "playing", nativePlayMaintenance, true);
    addNativeSyncListener(nativeVideo, "pause", () => {
      if (nativeAudioBridgeActive && video && !video.paused && !videoGateLocked && !isCurrentVideoManuallyPaused()) {
        setTimeout(() => void ensureNativeAudioBridgePlayback(), 0);
      }
    }, true);

    const sync = (force = false) => syncNativeForSubtitleTranslator(force);
    addNativeSyncListener(video, "play", () => {
      sync(true);
      if (!nativeAudioBridgeActive) {
        dispatchNativeClockEvent('play');
        dispatchNativeClockEvent('playing');
      }
    });
    addNativeSyncListener(video, "pause", () => {
      sync(true);
      if (nativeAudioBridgeActive) {
        try { if (!nativeVideo.paused) nativeVideo.pause(); } catch {}
      } else dispatchNativeClockEvent('pause');
    });
    addNativeSyncListener(video, "seeking", () => {
      sync(true);
      if (!nativeAudioBridgeActive) dispatchNativeClockEvent('seeking');
    });
    addNativeSyncListener(video, "seeked", () => {
      sync(true);
      if (!nativeAudioBridgeActive) dispatchNativeClockEvent('seeked');
    });
    addNativeSyncListener(video, "ratechange", () => {
      sync(true);
      if (!nativeAudioBridgeActive) dispatchNativeClockEvent('ratechange');
    });
    addNativeSyncListener(video, "loadedmetadata", () => {
      sync(true);
      if (!nativeAudioBridgeActive) {
        dispatchNativeClockEvent('loadedmetadata');
        dispatchNativeClockEvent('durationchange');
      }
    });
    addNativeSyncListener(nativeVideo, "volumechange", () => {
      if (nativeAudioBridgeActive) setNativeAudioBridgeVolume();
    }, true);

    clearInterval(nativeAudioBridgeMonitorTimer);
    nativeAudioBridgeMonitorTimer = setInterval(() => {
      if (!(video instanceof HTMLVideoElement) || !(nativeVideo instanceof HTMLVideoElement) || !video.isConnected || !nativeVideo.isConnected) return;
      if (nativeAudioBridgeActive) {
        const engine = activeNativeAudioEngine();
        if (!extensionSettings.audioEnabled || !engine) {
          deactivateNativeAudioBridge("Audio Studio không còn hoạt động", false);
          ensureVideoSound();
          return;
        }
        setNativeAudioBridgeVolume();
        if (!video.paused && !videoGateLocked && !isCurrentVideoManuallyPaused()) void ensureNativeAudioBridgePlayback();
      } else if (!video.paused && !videoGateLocked) {
        ensureVideoSound();
      }
    }, 240);
    sync(true);
  }

  function startExternalSubtitleBridge() {
    clearInterval(externalSubtitleSearchTimer);
    externalSubtitleSearchTimer = null;
    externalSubtitleDocumentObserver?.disconnect();
    externalSubtitleDocumentObserver = null;
    if (!extensionSettings.placeBelowSubtitleTranslator) return;
    if (externalSubtitleSessionVideoId !== currentTikTokVideoId()) beginExternalSubtitleSession(currentTikTokVideoId());
    scanOpenSubtitleRoots(true);
    attachExternalSubtitleObserver();
    externalSubtitleDocumentObserver = new MutationObserver((records) => {
      let relevant = false;
      for (const record of records) {
        for (const node of record.addedNodes || []) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.('#tt-sub-inline,[class*="tt-sub-inline"],[data-tt-sub-inline]') || node.querySelector?.('#tt-sub-inline,[class*="tt-sub-inline"],[data-tt-sub-inline]')) {
            relevant = true;
            break;
          }
          const addedText = String(node.textContent || '');
          if (addedText.length < 3000 && /(?:^|\s)(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?(?=\s|$)/.test(addedText) && /\p{L}/u.test(addedText)) {
            cachedTranscriptPanelRoots = [];
            lastTranscriptPanelScanAt = 0;
            relevant = true;
            break;
          }
          if (node.shadowRoot) {
            cachedOpenSubtitleRoots = [];
            lastOpenSubtitleRootScanAt = 0;
          }
        }
        if (relevant) break;
      }
      if (!relevant) return;
      queueMicrotask(() => {
        const nextRoot = findExternalSubtitleRoot();
        if (nextRoot !== externalSubtitleRoot) attachExternalSubtitleObserver(nextRoot);
        refreshExternalSubtitleText(true);
      });
    });
    externalSubtitleDocumentObserver.observe(document.documentElement, { childList:true, subtree:true });
    externalSubtitleSearchTimer = setInterval(() => {
      if (document.hidden) return;
      const nextRoot = findExternalSubtitleRoot();
      if (!externalSubtitleRoot?.isConnected || nextRoot !== externalSubtitleRoot) attachExternalSubtitleObserver(nextRoot);
      refreshExternalSubtitleText();
    }, EXTERNAL_TRANSCRIPT_SCAN_INTERVAL_MS);
  }

  async function forceReadExternalSubtitles(timeoutMs = 5200) {
    if (!video || !extensionSettings.placeBelowSubtitleTranslator) return false;
    setSubtitleStatus('đang đọc subtitle từ TikTok Subtitle Translator…', 'loading');
    cachedTranscriptPanelRoots = [];
    lastTranscriptPanelScanAt = 0;
    lastExternalSubtitleCueScanAt = 0;
    startExternalSubtitleBridge();
    const startedAt = Date.now();
    let firstScan = true;
    while (video && Date.now() - startedAt < timeoutMs) {
      refreshExternalSubtitleText(firstScan);
      firstScan = false;
      if (externalSubtitleCues.length || externalSubtitleTranslatedText || externalSubtitleOriginalText) {
        updateCaptionOverlay();
        const count = externalSubtitleCues.length;
        setSubtitleStatus(count ? `đã nhận ${count} câu từ TikTok Subtitle Translator` : 'đã nhận subtitle trực tiếp', 'ok');
        showNotice('Đã lấy subtitle từ TikTok Subtitle Translator.', true);
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 220));
    }
    setSubtitleStatus('không đọc được bảng subtitle · chuyển sang nguồn dự phòng', 'loading');
    return false;
  }

  chrome.storage.local.get({
    [FONT_SIZE_KEY]: DEFAULT_FONT_SIZE,
    [SETTINGS_KEY]: DEFAULT_SETTINGS
  }, (result) => {
    if (chrome.runtime.lastError) {
      console.warn("[TikTok Sub VI] Không đọc được cài đặt, dùng mặc định:", chrome.runtime.lastError.message);
    }
    try {
      applyFontSize(result?.[FONT_SIZE_KEY] ?? DEFAULT_FONT_SIZE, false);
      extensionSettings = normalizeSettings(result?.[SETTINGS_KEY]);
    } catch (error) {
      console.error("[TikTok Sub VI] Cài đặt không hợp lệ, đã khôi phục mặc định:", error);
      subtitleFontSize = DEFAULT_FONT_SIZE;
      extensionSettings = { ...DEFAULT_SETTINGS };
    }
    settingsReady = true;
    createControlWidget();
    void initWatchAnalyticsAndUi();
    applyFontSize(subtitleFontSize, false);
    applySubtitleOpacity(extensionSettings.subtitleBackgroundOpacity, false);
    applyPlaybackRate(extensionSettings.playbackRate, false);
    applyPlaybackVolume(extensionSettings.playbackVolume, false);
    syncControlWidgetSettings();
    if (extensionSettings.audioEnabled) {
      // Persisted AUDIO used to miss videos that had already started before
      // content.js finished loading. Start the supervisor immediately so every
      // currently-playing feed/detail/preview video is picked up automatically.
      startAudioStudioSupervisor();
      void ensureAudioContext({ resume:true }).then((context) => {
        if (context?.state === "running") scheduleAudioStudioScan(0);
      });
    }
    void refreshRemoteAccessState(false).finally(() => {
      if (remoteAccessLocked) return;
      scheduleStartupScans();
      if (extensionSettings.autoReplace) void mountPlayerForCurrentVideo();
    });
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[FONT_SIZE_KEY]) applyFontSize(changes[FONT_SIZE_KEY].newValue, false);
    if (!changes[SETTINGS_KEY]) return;
    const previous = extensionSettings;
    extensionSettings = normalizeSettings(changes[SETTINGS_KEY].newValue);
      if (video) video.loop = !extensionSettings.autoScrollEnabled;
    applySubtitleOpacity(extensionSettings.subtitleBackgroundOpacity, false);
    applyPlaybackRate(extensionSettings.playbackRate, false);
    applyPlaybackVolume(extensionSettings.playbackVolume, false);
    applyAudioSettings();
    applyPlayerLayerMode();
    applyCleanMode();
    applyVideoOverlayVisibility();
    if (extensionSettings.placeBelowSubtitleTranslator) startExternalSubtitleBridge(); else stopExternalSubtitleBridge();
    syncControlWidgetSettings();
    renderWatchToolbar();
    settingsReady = true;
    if (!extensionSettings.backgroundPlay) {
      stopHiddenPlaybackKeepAlive();
      shouldResumeFromBackground = false;
      if (document.hidden && video && !video.paused) video.pause();
    }
    if (previous.audioEnabled !== extensionSettings.audioEnabled) {
      audioBypassNoticeShown = false;
      audioStudioReadyNoticeShown = false;
      if (extensionSettings.audioEnabled) {
        showNotice("AUDIO đã bật · tự áp dụng cho mọi video TikTok đang phát.", true);
        startAudioStudioSupervisor();
        void ensureAudioContext({ resume:true }).then((context) => {
          if (context?.state === "running") scheduleAudioStudioScan(0);
        });
      } else {
        stopAudioStudioSupervisor();
        if (nativeAudioBridgeActive) deactivateNativeAudioBridge("", false);
        applyAudioSettings();
        ensureVideoSound();
        if (audioEngines.size) scheduleAudioContextRecovery(0);
      }
    }

    if (!extensionSettings.autoReplace) {
      if (host) closePlayer({ restoreNative: true });
      restoreGuardedNativeVideos();
      return;
    }

    if (host && previous.placeBelowSubtitleTranslator !== extensionSettings.placeBelowSubtitleTranslator) {
      closePlayer({ restoreNative: true });
      scheduleStartupScans();
      return;
    }

    if (!remoteAccessLocked && !previous.autoReplace && extensionSettings.autoReplace) void mountPlayerForCurrentVideo();

    if (host && previous.scanSubtitles !== extensionSettings.scanSubtitles) {
      if (!extensionSettings.scanSubtitles) {
        void closeTranscript365Worker(true);
        cleanupSubtitleMedia();
        setSubtitleStatus(extensionSettings.placeBelowSubtitleTranslator ? "đang dùng TikTok Subtitle Translator" : "quét sub đã tắt", "");
        setVideoGate(false);
        startReplacementVideo(false);
      } else if (video) {
        void autoLoadSubtitles(false);
      }
    } else if (host && video && previous.translateVietnamese !== extensionSettings.translateVietnamese && extensionSettings.scanSubtitles) {
      void autoLoadSubtitles(false);
    }
    if (host && video && !previous.autoplay && extensionSettings.autoplay && !videoGateLocked && !isCurrentVideoManuallyPaused()) startReplacementVideo(false);
    if (productWidget && previous.productWidgetEnabled !== extensionSettings.productWidgetEnabled) {
      if (extensionSettings.productWidgetEnabled) { productScanSignature = ""; scanCurrentVideoProducts(); }
      else productWidget.dataset.hasProducts = "false";
    }
  });

  function isTikTokUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      return url.protocol === "https:" && (url.hostname === "tiktok.com" || url.hostname.endsWith(".tiktok.com"));
    } catch {
      return false;
    }
  }

  function normalizeTikTokVideoUrl(rawUrl) {
    try {
      const url = new URL(rawUrl, location.href);
      if (!isTikTokUrl(url.toString())) return "";
      const match = url.pathname.match(/\/video\/(\d+)/);
      if (!match) return "";
      url.hash = "";
      url.search = "";
      return `${url.origin}${url.pathname}`;
    } catch {
      return "";
    }
  }

  function canonicalUrl(rawUrl) {
    return normalizeTikTokVideoUrl(rawUrl) || String(rawUrl || "");
  }

  function videoIdFromUrl(rawUrl) {
    return String(rawUrl || "").match(/\/video\/(\d+)/)?.[1] || "";
  }


  function isVisibleElement(element, minWidth = 1, minHeight = 1) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width < minWidth || rect.height < minHeight) return false;
    if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.01;
  }

  function isProfileGridRoute() {
    const path = String(location.pathname || "").replace(/\/+$/, "");
    return /^\/@[^/]+$/.test(path);
  }

  function hasVisibleProfileVideoDialog() {
    const directDialogs = directQueryElements(['[role="dialog"]']);
    const dialogs = directDialogs.length ? directDialogs : deepQuerySubtitleElements(['[role="dialog"]']);
    return dialogs.some((dialog) => {
      if (!isVisibleElement(dialog, 180, 180)) return false;
      return Boolean(dialog.querySelector('video,a[href*="/video/"],[data-e2e="browse-video-play"]'));
    });
  }

  function isBareProfileGridPage() {
    return isProfileGridRoute() && !hasVisibleProfileVideoDialog();
  }

  // v3.2.4: TikTok has many collection/grid routes (music, hashtag, profile,
  // discover, search, effects...). Their cards can spawn a real <video> while
  // hovering, but that is still only a preview. Auto Replace must never mount
  // into those tiles; only a genuine feed/detail player is eligible.
  function isCollectionGridRoute() {
    const path = String(location.pathname || '').replace(/\/+$/, '');
    if (!path || path === '/') return false;
    return /^\/search(?:\/|$)/.test(path)
      || /^\/music(?:\/|$)/.test(path)
      || /^\/tag(?:\/|$)/.test(path)
      || /^\/discover(?:\/|$)/.test(path)
      || /^\/effect(?:\/|$)/.test(path)
      || /^\/channel(?:\/|$)/.test(path)
      || /^\/topic(?:\/|$)/.test(path)
      || /^\/@[^/]+$/.test(path);
  }

  function isLargeOpenedVideoSurface(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const dialog = element.closest?.('[role="dialog"]');
    const rect = element.getBoundingClientRect?.();
    if (!rect) return false;
    const viewportArea = Math.max(1, innerWidth * innerHeight);
    const visibleArea = visibleIntersectionArea(rect);
    if (dialog && isVisibleElement(dialog, 180, 180)) {
      return rect.height >= innerHeight * 0.46
        && rect.width >= Math.min(260, innerWidth * 0.18)
        && visibleArea >= viewportArea * 0.075;
    }
    const directRouteId = videoIdFromUrl(String(location.href || ''));
    if (directRouteId) {
      const ownId = directVideoIdForElement(element);
      if (!ownId || ownId === directRouteId) {
        return rect.height >= innerHeight * 0.42 && visibleArea >= viewportArea * 0.06;
      }
    }
    return false;
  }

  function hasVisibleCollectionDetailPlayer() {
    if (!isCollectionGridRoute()) return false;
    for (const candidate of directQueryElements(["video"])) {
      if (isLargeOpenedVideoSurface(candidate)) return true;
    }
    const dialogs = directQueryElements(['[role="dialog"]']);
    return dialogs.some((dialog) => {
      if (!isVisibleElement(dialog, 180, 180)) return false;
      const candidate = dialog.querySelector?.('video,[data-e2e="browse-video"],[data-e2e="video-player"]');
      return candidate instanceof Element && isLargeOpenedVideoSurface(candidate);
    });
  }

  function isBareCollectionGridPage() {
    return isCollectionGridRoute() && !hasVisibleCollectionDetailPlayer();
  }

  function isGenericPreviewGridElement(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    if (isLargeOpenedVideoSurface(element)) return false;

    // Stable TikTok grid/card containers seen across profile/search/music/tag
    // surfaces. Keep this list narrow enough not to catch the normal For You feed.
    if (element.closest?.([
      '[data-e2e="user-post-item"]', '#user-post-item-list',
      '[data-e2e="search_top-item"]', '[data-e2e="search-video-item"]', '[data-e2e="search-video-card"]',
      '[id^="grid-item-container-"]', '[class*="DivItemContainerForSearch"]'
    ].join(','))) return true;

    const rect = element.getBoundingClientRect?.();
    if (!rect) return false;
    const smallCard = rect.width <= innerWidth * 0.52 && rect.height <= innerHeight * 0.82;
    if (isCollectionGridRoute() && smallCard && element.closest?.('[class*="VideoCard"],[class*="GridVideo"],[class*="VideoItem"]')) return true;
    const linkedVideo = element.closest?.('a[href*="/video/"]') || element.querySelector?.('a[href*="/video/"]');
    if (linkedVideo && smallCard && isCollectionGridRoute()) return true;

    // Generic fallback for collection pages whose class names change frequently:
    // a small child inside an ancestor containing several /video/ cards is a grid
    // preview, even when TikTok injects a <video> only after hover.
    let node = element;
    for (let depth = 0; node && node !== document.body && depth < 8; depth += 1, node = node.parentElement) {
      const links = node.querySelectorAll?.('a[href*="/video/"]').length || 0;
      if (links < 3) continue;
      const nodeRect = node.getBoundingClientRect?.();
      if (!nodeRect) continue;
      if (smallCard && nodeRect.width >= rect.width * 1.8) return true;
    }

    if (isCollectionGridRoute() && smallCard) {
      // Collection pages are preview-first by design. A large opened dialog/detail
      // was already allowed above, so remaining small media surfaces stay native.
      return true;
    }
    return false;
  }

  function isSearchRoute() {
    return /^\/search(?:\/|$)/.test(String(location.pathname || ""));
  }

  function searchResultCardForElement(element) {
    if (!(element instanceof Element)) return null;
    return element.closest?.([
      '[data-e2e="search_top-item"]', '[data-e2e="search-video-item"]', '[data-e2e="search-video-card"]',
      '[data-e2e="search_top-video-item"]', '[id^="grid-item-container-"]',
      '[class*="DivItemContainerForSearch"]', '[class*="SearchVideoItem"]'
    ].join(',')) || null;
  }

  function isSearchResultGridElement(element) {
    return Boolean(isSearchRoute() && searchResultCardForElement(element));
  }

  function searchCardVideoUrl(element) {
    const card = searchResultCardForElement(element);
    if (!card) return "";
    const link = card.matches?.('a[href*="/video/"]') ? card : card.querySelector?.('a[href*="/video/"]');
    return normalizeTikTokVideoUrl(link?.href || link?.getAttribute?.("href") || "");
  }

  function clickedSearchVideoUrl(element) {
    if (!(element instanceof Element)) return "";
    const directLink = element.closest?.('a[href*="/video/"]');
    const directUrl = normalizeTikTokVideoUrl(directLink?.href || directLink?.getAttribute?.("href") || "");
    return directUrl || searchCardVideoUrl(element);
  }

  function clearPendingSearchSelection() {
    pendingSearchVideoUrl = "";
    pendingSearchVideoId = "";
    pendingSearchSelectionAt = 0;
  }

  function registerPendingSearchSelection(rawUrl) {
    const url = normalizeTikTokVideoUrl(rawUrl);
    const id = videoIdFromUrl(url);
    if (!url || !id) return false;
    const changed = id !== pendingSearchVideoId;
    pendingSearchVideoUrl = url;
    pendingSearchVideoId = id;
    pendingSearchSelectionAt = Date.now();
    authoritativeTabUrl = String(location.href);
    playerTargetCache = null;
    playerTargetCacheAt = 0;
    if (changed) {
      mountEpoch += 1;
      currentRequestToken += 1;
      mounting = false;
      suppressedUrl = "";
      if (host) closePlayer({ restoreNative: true });
    }
    requestHookMedia(id);
    return true;
  }

  function pendingSearchSelectionIsUsable() {
    return Boolean(pendingSearchVideoId && pendingSearchVideoUrl);
  }

  function pendingSearchFallbackIsFresh() {
    return pendingSearchSelectionIsUsable() && Date.now() - pendingSearchSelectionAt <= SEARCH_SELECTION_FALLBACK_MS;
  }

  function searchCandidateMatchesPending(element, rawUrl = "") {
    if (!isSearchRoute()) return true;
    if (!pendingSearchSelectionIsUsable() || isSearchResultGridElement(element)) return false;
    const candidateId = videoIdFromUrl(rawUrl) || directVideoIdForElement(element);
    return !candidateId || candidateId === pendingSearchVideoId;
  }

  function isLikelySearchDetailSurface(element) {
    if (!(element instanceof Element) || !isSearchRoute() || isSearchResultGridElement(element) || isSideRecommendationElement(element)) return false;
    const rect = element.getBoundingClientRect();
    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    const visibleArea = visibleIntersectionArea(rect);
    return rect.height >= window.innerHeight * 0.56
      && rect.width >= Math.min(300, window.innerWidth * 0.22)
      && visibleArea >= viewportArea * 0.10;
  }

  function usernameFromVideoRoot(root, hintNode = null) {
    const scope = hintNode?.closest?.('article[data-e2e="recommend-list-item-container"],article,[data-e2e="feed-video"],[role="dialog"],section[id^="media-card-"]')
      || (root instanceof Element ? root.closest?.('article[data-e2e="recommend-list-item-container"],article,[data-e2e="feed-video"],[role="dialog"],section[id^="media-card-"]') : null)
      || root;
    const links = Array.from(scope?.querySelectorAll?.('a[href*="/@"]') || []);
    for (const link of links) {
      const href = String(link.getAttribute?.('href') || link.href || '');
      const match = href.match(/\/@([^/?#]+)/);
      if (!match || /^(?:music|tag|search)$/i.test(match[1])) continue;
      try { return decodeURIComponent(match[1]); } catch { return match[1]; }
    }
    const uniqueText = cleanMetadataText(scope?.querySelector?.('[data-e2e="video-author-uniqueid"],[data-e2e="browse-username"]')?.textContent || '');
    const normalized = cleanTikTokUsername(uniqueText);
    // A display nickname usually contains spaces; never turn it into a fake
    // username by deleting those spaces.
    return normalized && !/\s/.test(normalized) ? normalized : 'tdtfeed';
  }

  function cleanMetadataText(value) {
    return String(value || "")
      .replace(/[\u200b-\u200f\u2060\ufeff]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanTikTokUsername(value) {
    const text = cleanMetadataText(value);
    const fromUrl = text.match(/\/@([^/?#\s]+)/)?.[1];
    const username = String(fromUrl || text)
      .replace(/^@/, "")
      .replace(/\s*(?:✓|✔|đã xác minh|verified)\s*$/i, "")
      .trim();
    return username && username.length <= 80 ? username : "";
  }

  function videoMetadataRoots() {
    const roots = [];
    const seen = new Set();
    const add = (root) => {
      if (root instanceof Element && root.isConnected && !seen.has(root)) {
        seen.add(root);
        roots.push(root);
      }
    };
    const semanticSelector = '[role="dialog"],article[data-e2e="recommend-list-item-container"],article,section[id^="media-card-"],[data-e2e="feed-video"],[data-e2e="browse-video"]';
    for (const source of [nativeVideo, mountElement]) {
      add(source?.closest?.(semanticSelector));
      const feed = source?.closest?.('[data-e2e="feed-video"]');
      add(feed?.closest?.('section[id^="media-card-"]'));
      add(feed?.closest?.('article[data-e2e="recommend-list-item-container"],article'));
    }
    add(visibleDialogForElement(nativeVideo || mountElement));
    return roots;
  }

  function firstMetadataText(roots, selectors) {
    for (const root of roots) {
      for (const selector of selectors) {
        for (const node of root.querySelectorAll?.(selector) || []) {
          if (node === controlWidgetHost || host?.contains?.(node)) continue;
          const style = node instanceof Element ? getComputedStyle(node) : null;
          if (style && (style.display === 'none' || style.visibility === 'hidden')) continue;
          const text = cleanMetadataText(node.getAttribute?.("aria-label") || node.textContent);
          if (text) return text;
        }
      }
    }
    return "";
  }

  function readTikTokVideoMetadata(info = {}) {
    const roots = videoMetadataRoots();
    const uniqueAuthor = firstMetadataText(roots, [
      '[data-e2e="video-author-uniqueid"]',
      '[data-e2e="browse-username"]'
    ]);
    const displayAuthor = firstMetadataText(roots, [
      '[data-e2e="browse-user-name"]',
      '[data-e2e="video-author"]'
    ]);
    let linkAuthor = "";
    let profileUrl = "";
    for (const root of roots) {
      const profileLink = Array.from(root.querySelectorAll?.('a[href*="/@"]') || []).find((link) => /\/@[^/?#]+/.test(String(link.getAttribute?.("href") || link.href || "")));
      const rawProfileUrl = String(profileLink?.getAttribute?.("href") || profileLink?.href || "");
      linkAuthor = cleanTikTokUsername(rawProfileUrl);
      if (rawProfileUrl) {
        try {
          const parsed = new URL(rawProfileUrl, location.origin);
          if (parsed.hostname === "tiktok.com" || parsed.hostname.endsWith(".tiktok.com")) profileUrl = `${parsed.origin}${parsed.pathname}`;
        } catch {}
      }
      if (linkAuthor || profileUrl) break;
    }
    const apiAuthor = cleanTikTokUsername(info.authorInfo?.uniqueId) || cleanTikTokUsername(info.author);
    const exactUniqueAuthor = cleanTikTokUsername(uniqueAuthor);
    const safeDisplayAuthor = /\s/.test(cleanMetadataText(displayAuthor)) ? "" : cleanTikTokUsername(displayAuthor);
    // Profile URL is the most stable source on the home feed. Generic author
    // text can be a nickname, so it is deliberately the final fallback.
    const author = linkAuthor || exactUniqueAuthor || apiAuthor || safeDisplayAuthor;
    if (!profileUrl && author) profileUrl = `https://www.tiktok.com/@${encodeURIComponent(author)}`;

    let caption = firstMetadataText(roots, [
      '[data-e2e="video-desc"]',
      '[data-e2e="browse-video-desc"]',
      '[data-e2e="browse-video-title"]',
      '[data-e2e="video-caption"]',
      '[data-e2e="feed-video-desc"]',
      '[data-e2e="search-card-desc"]'
    ]);
    if (!caption) {
      caption = firstMetadataText(roots, ['[data-e2e*="video-cover"] img[alt]', 'img[alt*="#"]']);
    }
    caption = cleanMetadataText(caption || info.title)
      .replace(/\s+(?:…|\.\.\.)?\s*(?:thêm|more)\s*$/i, "")
      .trim();
    if (caption === author || caption === `@${author}` || caption === displayAuthor) caption = cleanMetadataText(info.title);

    const verifiedSelector = [
      '[data-e2e*="verified" i]',
      '[aria-label*="verified" i]',
      '[aria-label*="xác minh" i]',
      '[class*="verified" i]'
    ].join(",");
    const verified = Boolean(info.authorInfo?.verified || roots.some((root) => root.querySelector?.(verifiedSelector)));
    const hashtags = Array.from(new Set((caption.match(/#[\p{L}\p{N}_.]+/gu) || []).map((tag) => tag.slice(1))));
    return { author, caption, hashtags, verified, profileUrl };
  }

  function appendCaptionWithClickableHashtags(element, text) {
    const source = String(text || "");
    const hashtagPattern = /#[\p{L}\p{N}_]+/gu;
    let cursor = 0;
    let match;
    while ((match = hashtagPattern.exec(source))) {
      if (match.index > cursor) element.appendChild(document.createTextNode(source.slice(cursor, match.index)));
      const hashtag = match[0];
      const link = document.createElement("a");
      link.href = `https://www.tiktok.com/tag/${encodeURIComponent(hashtag.slice(1))}`;
      link.textContent = hashtag;
      link.title = `Mở hashtag ${hashtag}`;
      link.addEventListener("click", (event) => event.stopPropagation());
      element.appendChild(link);
      cursor = match.index + hashtag.length;
    }
    if (cursor < source.length) element.appendChild(document.createTextNode(source.slice(cursor)));
  }

  function createVideoMetadataOverlay(info = {}) {
    const metadata = readTikTokVideoMetadata(info);
    const overlay = document.createElement("div");
    overlay.className = "video-meta";
    overlay.dataset.hasMetadata = String(Boolean(metadata.author || metadata.caption));
    overlay.hidden = extensionSettings.showVideoMeta === false || (!metadata.author && !metadata.caption);
    overlay.setAttribute("aria-label", "Thông tin video TikTok");

    if (metadata.author) {
      const authorRow = document.createElement("div");
      authorRow.className = "video-meta-author";
      const authorName = document.createElement("a");
      authorName.className = "video-meta-author-name";
      authorName.textContent = metadata.author;
      authorName.href = metadata.profileUrl;
      authorName.title = `Mở trang @${metadata.author}`;
      authorName.addEventListener("click", (event) => event.stopPropagation());
      authorRow.appendChild(authorName);
      if (metadata.verified) {
        const badge = document.createElement("span");
        badge.className = "video-meta-verified";
        badge.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="currentColor"></circle><path d="m7.3 12.1 3.05 3.05 6.35-6.4" fill="none" stroke="#fff" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
        badge.title = "Tài khoản đã xác minh";
        badge.setAttribute("aria-label", "Tài khoản đã xác minh");
        authorRow.appendChild(badge);
      }
      overlay.appendChild(authorRow);
    }

    if (metadata.caption) {
      const captionRow = document.createElement("div");
      captionRow.className = "video-meta-caption-row";
      const caption = document.createElement("div");
      caption.className = "video-meta-caption";
      appendCaptionWithClickableHashtags(caption, metadata.caption);
      caption.dataset.expanded = "false";
      const more = document.createElement("button");
      more.type = "button";
      more.className = "video-meta-more";
      more.textContent = "thêm";
      more.hidden = true;
      more.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const expanded = caption.dataset.expanded !== "true";
        caption.dataset.expanded = String(expanded);
        more.textContent = expanded ? "thu gọn" : "thêm";
      });
      captionRow.append(caption, more);
      overlay.appendChild(captionRow);
      requestAnimationFrame(() => {
        if (!caption.isConnected) return;
        more.hidden = caption.scrollHeight <= caption.clientHeight + 2;
      });
    }
    return overlay;
  }


  function watchDayKey(timestamp = Date.now()) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function emptyWatchAnalytics() {
    return { version: 1, updatedAt: 0, totalWatchedSeconds: 0, allTimeVideoIds: [], days: {}, history: [] };
  }

  function normalizeWatchAnalytics(value) {
    const source = value && typeof value === "object" ? value : {};
    const result = emptyWatchAnalytics();
    result.updatedAt = Math.max(0, Number(source.updatedAt) || 0);
    result.totalWatchedSeconds = Math.max(0, Math.floor(Number(source.totalWatchedSeconds) || 0));
    result.allTimeVideoIds = Array.from(new Set((Array.isArray(source.allTimeVideoIds) ? source.allTimeVideoIds : [])
      .map((id) => String(id || "").trim()).filter(Boolean))).slice(-10000);
    const sourceDays = source.days && typeof source.days === "object" ? source.days : {};
    for (const [key, day] of Object.entries(sourceDays)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !day || typeof day !== "object") continue;
      result.days[key] = {
        watchedSeconds: Math.max(0, Math.floor(Number(day.watchedSeconds) || 0)),
        videoIds: Array.from(new Set((Array.isArray(day.videoIds) ? day.videoIds : []).map((id) => String(id || "").trim()).filter(Boolean))).slice(-2000)
      };
    }
    result.history = (Array.isArray(source.history) ? source.history : []).filter((item) => item && typeof item === "object")
      .map((item) => ({
        videoId: String(item.videoId || ""), url: String(item.url || ""), author: String(item.author || ""),
        caption: String(item.caption || ""), thumbnail: String(item.thumbnail || ""), duration: Math.max(0, Number(item.duration) || 0),
        firstWatchedAt: Math.max(0, Number(item.firstWatchedAt) || 0), lastWatchedAt: Math.max(0, Number(item.lastWatchedAt) || 0),
        watchedSeconds: Math.max(0, Math.floor(Number(item.watchedSeconds) || 0)),
        stats: item.stats && typeof item.stats === "object" ? item.stats : {},
        music: item.music && typeof item.music === "object" ? item.music : {},
        hashtags: Array.isArray(item.hashtags) ? item.hashtags.map(String).slice(0, 30) : [],
        products: Array.isArray(item.products) ? item.products.slice(0, 12) : []
      })).sort((a, b) => b.lastWatchedAt - a.lastWatchedAt).slice(0, WATCH_HISTORY_LIMIT);
    return result;
  }

  function watchStorageGet() {
    return new Promise((resolve) => chrome.storage.local.get({ [WATCH_ANALYTICS_KEY]: emptyWatchAnalytics() }, (result) => {
      resolve(chrome.runtime.lastError ? emptyWatchAnalytics() : result[WATCH_ANALYTICS_KEY]);
    }));
  }

  function saveWatchAnalyticsNow() {
    clearTimeout(watchSaveTimer);
    watchSaveTimer = null;
    if (!watchAnalyticsReady || !watchAnalytics) return Promise.resolve();
    return new Promise((resolve) => chrome.storage.local.set({ [WATCH_ANALYTICS_KEY]: watchAnalytics }, () => resolve()));
  }

  function scheduleWatchSave(immediate = false) {
    clearTimeout(watchSaveTimer);
    watchSaveTimer = null;
    if (immediate) return void saveWatchAnalyticsNow();
    watchSaveTimer = setTimeout(() => void saveWatchAnalyticsNow(), WATCH_SAVE_DELAY_MS);
  }

  function formatWatchTime(secondsValue, compact = false) {
    const total = Math.max(0, Math.floor(Number(secondsValue) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (compact) {
      if (hours) return `${hours}h ${minutes}m`;
      if (minutes) return `${minutes}m`;
      return `${seconds}s`;
    }
    if (hours) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  function formatWatchClock(secondsValue) {
    const total = Math.max(0, Math.floor(Number(secondsValue) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function formatHistoryDate(timestamp) {
    const value = Number(timestamp) || 0;
    if (!value) return "";
    return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(value));
  }

  function getWatchRange(daysCount) {
    const videoIds = new Set();
    let watchedSeconds = 0;
    for (let offset = 0; offset < daysCount; offset += 1) {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - offset);
      const day = watchAnalytics?.days?.[watchDayKey(date.getTime())];
      watchedSeconds += Math.max(0, Number(day?.watchedSeconds) || 0);
      (day?.videoIds || []).forEach((id) => videoIds.add(id));
    }
    return { watchedSeconds, videos: videoIds.size };
  }

  function watchThumbnailFromDom() {
    const poster = String(nativeVideo?.poster || "").trim();
    if (/^https?:/i.test(poster)) return poster;
    let best = { src: "", area: 0 };
    for (const root of videoMetadataRoots()) {
      for (const image of root.querySelectorAll?.("img") || []) {
        const src = String(image.currentSrc || image.src || "").trim();
        if (!/^https?:/i.test(src)) continue;
        const rect = image.getBoundingClientRect();
        const area = Math.max(0, rect.width) * Math.max(0, rect.height);
        if (area > best.area) best = { src, area };
      }
    }
    return best.src;
  }

  function readCurrentMusic(info = currentVideoInfo || {}) {
    const source = info.music && typeof info.music === "object" ? info.music : {};
    let title = String(source.title || info.musicTitle || "").trim();
    let author = String(source.author || info.musicAuthor || "").trim();
    let url = String(source.url || "").trim();
    for (const root of videoMetadataRoots()) {
      const musicLink = root.querySelector?.('a[href*="/music/"],[data-e2e="browse-music"] a,[data-e2e="browse-music"]');
      if (!musicLink) continue;
      const text = cleanMetadataText(musicLink.textContent || musicLink.getAttribute?.("aria-label"));
      if (!title && text) title = text.replace(/^♫\s*/, "").trim();
      const href = String(musicLink.getAttribute?.("href") || musicLink.href || "");
      if (!url && href) try { url = new URL(href, location.origin).href; } catch {}
      break;
    }
    if (!title && !author) title = "Âm thanh gốc / chưa xác định";
    return { id: String(source.id || ""), title, author, album: String(source.album || ""), url };
  }

  function currentProductsForInfo() {
    const videoId = currentTikTokVideoId();
    const records = [];
    const cached = productInfoCache.get(videoId)?.products;
    if (Array.isArray(cached)) records.push(...cached);
    try { records.push(...productsFromDom()); } catch {}
    const merged = new Map();
    for (const item of records) {
      if (!item?.id) continue;
      merged.set(String(item.id), { ...(merged.get(String(item.id)) || {}), ...item });
    }
    return Array.from(merged.values()).slice(0, 12);
  }

  function buildWatchSnapshot(info = currentVideoInfo || {}, products = null) {
    const metadata = readTikTokVideoMetadata(info);
    const videoId = currentTikTokVideoId();
    const caption = String(metadata.caption || info.title || "").trim();
    const hashtags = Array.from(new Set([...(Array.isArray(info.hashtags) ? info.hashtags : []), ...(caption.match(/#[\p{L}\p{N}_]+/gu) || [])]));
    return {
      videoId,
      url: normalizeTikTokVideoUrl(currentPageUrl) || normalizeTikTokVideoUrl(authoritativeTabUrl) || String(currentPageUrl || location.href),
      author: String(metadata.author || info.author || "").replace(/^@/, ""),
      caption,
      thumbnail: String(info.cover || watchThumbnailFromDom() || ""),
      duration: Math.max(0, Number(video?.duration || info.duration) || 0),
      stats: mergedVideoStats(),
      music: readCurrentMusic(info),
      hashtags,
      products: Array.isArray(products) ? products.slice(0, 12) : currentProductsForInfo()
    };
  }

  function refreshWatchCurrentSnapshot(products = null) {
    if (!currentVideoInfo || !currentTikTokVideoId()) return null;
    watchCurrentSnapshot = buildWatchSnapshot(currentVideoInfo, products);
    return watchCurrentSnapshot;
  }

  function updateWatchCurrentProducts(products) {
    if (!watchCurrentSnapshot || watchCurrentSnapshot.videoId !== currentTikTokVideoId()) refreshWatchCurrentSnapshot(products);
    else watchCurrentSnapshot = { ...watchCurrentSnapshot, products: Array.isArray(products) ? products.slice(0, 12) : [] };
  }

  function ensureWatchDay(key) {
    if (!watchAnalytics.days[key]) watchAnalytics.days[key] = { watchedSeconds: 0, videoIds: [] };
    return watchAnalytics.days[key];
  }

  function recordWatchSecond() {
    if (!watchAnalyticsReady || !watchAnalytics || remoteAccessLocked || !video || video.paused || video.ended || video.readyState < 2) return;
    const videoId = currentTikTokVideoId();
    if (!videoId) return;
    if (!watchCurrentSnapshot || watchCurrentSnapshot.videoId !== videoId) refreshWatchCurrentSnapshot();
    const snapshot = watchCurrentSnapshot;
    if (!snapshot?.videoId) return;
    const now = Date.now();
    const day = ensureWatchDay(watchDayKey(now));
    day.watchedSeconds += 1;
    if (!day.videoIds.includes(videoId)) day.videoIds.push(videoId);
    if (!watchAnalytics.allTimeVideoIds.includes(videoId)) watchAnalytics.allTimeVideoIds.push(videoId);
    if (watchAnalytics.allTimeVideoIds.length > 10000) watchAnalytics.allTimeVideoIds.splice(0, watchAnalytics.allTimeVideoIds.length - 10000);
    watchAnalytics.totalWatchedSeconds += 1;

    let entry = watchAnalytics.history.find((item) => item.videoId === videoId);
    if (!entry) {
      entry = { ...snapshot, firstWatchedAt: now, lastWatchedAt: now, watchedSeconds: 0 };
      watchAnalytics.history.unshift(entry);
    } else {
      Object.assign(entry, snapshot, { firstWatchedAt: entry.firstWatchedAt || now, lastWatchedAt: now });
      const index = watchAnalytics.history.indexOf(entry);
      if (index > 0) {
        watchAnalytics.history.splice(index, 1);
        watchAnalytics.history.unshift(entry);
      }
    }
    entry.watchedSeconds = Math.max(0, Number(entry.watchedSeconds) || 0) + 1;
    entry.lastWatchedAt = now;
    watchAnalytics.updatedAt = now;
    watchAnalytics.history = watchAnalytics.history.slice(0, WATCH_HISTORY_LIMIT);
    renderWatchToolbar();
    scheduleWatchSave();
  }

  function showWatchToast(message) {
    if (!watchUiShadow) return;
    const toast = watchUiShadow.getElementById("watch-toast");
    if (!toast) return;
    toast.textContent = String(message || "");
    toast.dataset.show = "true";
    clearTimeout(watchToastTimer);
    watchToastTimer = setTimeout(() => { toast.dataset.show = "false"; }, 1800);
  }

  async function copyWatchText(text) {
    const value = String(text || "");
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.cssText = "position:fixed;left:-9999px;top:-9999px";
      document.documentElement.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    showWatchToast("Đã sao chép");
  }

  function isVideoInfoOpen() {
    const infoPanel = watchUiShadow?.getElementById("video-info-panel");
    return Boolean(infoPanel && !infoPanel.hidden);
  }

  function applyVideoOverlayVisibility() {
    const infoOpen = isVideoInfoOpen();
    if (videoStatsPanel) videoStatsPanel.hidden = extensionSettings.showVideoStats === false || infoOpen;
    if (videoMetadataOverlay) {
      const hasMetadata = videoMetadataOverlay.dataset.hasMetadata !== "false";
      videoMetadataOverlay.hidden = extensionSettings.showVideoMeta === false || !hasMetadata;
      if (panel) panel.dataset.hasVideoMeta = String(!videoMetadataOverlay.hidden);
    }
  }

  function closeWatchModal() {
    if (watchModal) watchModal.hidden = true;
    const infoPanel = watchUiShadow?.getElementById("video-info-panel");
    if (infoPanel) infoPanel.hidden = true;
    applyVideoOverlayVisibility();
  }

  function createModalShell(title, subtitle = "") {
    createWatchUi();
    watchModal.hidden = false;
    const card = watchUiShadow.getElementById("watch-modal-card");
    card.replaceChildren();
    const head = document.createElement("header");
    head.className = "modal-head";
    const titles = document.createElement("div");
    const heading = document.createElement("h2"); heading.textContent = title;
    const sub = document.createElement("p"); sub.textContent = subtitle; sub.hidden = !subtitle;
    titles.append(heading, sub);
    const close = document.createElement("button"); close.className = "modal-close"; close.type = "button"; close.textContent = "×"; close.title = "Đóng";
    close.addEventListener("click", closeWatchModal);
    head.append(titles, close);
    const body = document.createElement("div"); body.className = "modal-body";
    card.append(head, body);
    return body;
  }

  function showWatchHistory() {
    const history = watchAnalytics?.history || [];
    const body = createModalShell("Watch History", `Tối đa ${WATCH_HISTORY_LIMIT} video bạn đã xem`);
    if (!history.length) {
      const empty = document.createElement("div"); empty.className = "empty-state"; empty.textContent = "Chưa có lịch sử xem. Phát video TikTok để bắt đầu ghi nhận."; body.appendChild(empty); return;
    }
    const grid = document.createElement("div"); grid.className = "history-grid";
    for (const item of history) {
      const card = document.createElement("button"); card.type = "button"; card.className = "history-card";
      const media = document.createElement("div"); media.className = "history-media";
      if (item.thumbnail) { const image = document.createElement("img"); image.src = item.thumbnail; image.alt = ""; image.loading = "lazy"; media.appendChild(image); }
      const duration = document.createElement("span"); duration.className = "history-duration"; duration.textContent = formatDuration(item.duration); media.appendChild(duration);
      const info = document.createElement("div"); info.className = "history-info";
      const author = document.createElement("strong"); author.textContent = item.author ? `@${item.author}` : "TikTok video";
      const time = document.createElement("small"); time.textContent = `${formatHistoryDate(item.lastWatchedAt)} · xem ${formatWatchTime(item.watchedSeconds, true)}`;
      info.append(author, time); card.append(media, info);
      card.addEventListener("click", () => { if (item.url) location.href = item.url; closeWatchModal(); });
      grid.appendChild(card);
    }
    body.appendChild(grid);
    const actions = document.createElement("div"); actions.className = "history-actions";
    const clear = document.createElement("button"); clear.type = "button"; clear.className = "history-clear"; clear.textContent = "Clear history";
    clear.addEventListener("click", async () => {
      watchAnalytics.history = [];
      await saveWatchAnalyticsNow();
      showWatchHistory();
      showWatchToast("Đã xóa lịch sử xem.");
    });
    actions.appendChild(clear); body.appendChild(actions);
  }

  function showWatchDashboard() {
    const today = getWatchRange(1);
    const last7 = getWatchRange(7);
    const all = { videos: watchAnalytics?.allTimeVideoIds?.length || 0, watchedSeconds: watchAnalytics?.totalWatchedSeconds || 0 };
    const body = createModalShell("Usage Statistics", "7 ngày gần nhất");
    const summary = document.createElement("div"); summary.className = "summary-grid";
    for (const [label, data] of [["HÔM NAY", today], ["7 NGÀY QUA", last7], ["TẤT CẢ", all]]) {
      const box = document.createElement("div"); box.className = "summary-box";
      const cap = document.createElement("span"); cap.textContent = label;
      const videos = document.createElement("strong"); videos.textContent = `${data.videos} videos`;
      const time = document.createElement("b"); time.textContent = formatWatchTime(data.watchedSeconds, true);
      box.append(cap, videos, time); summary.appendChild(box);
    }
    body.appendChild(summary);

    const days = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - offset);
      const key = watchDayKey(date.getTime());
      days.push({ key, label: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date), seconds: Number(watchAnalytics?.days?.[key]?.watchedSeconds) || 0 });
    }
    const max = Math.max(1, ...days.map((day) => day.seconds));
    const chart = document.createElement("div"); chart.className = "watch-chart";
    for (const day of days) {
      const column = document.createElement("div"); column.className = "chart-column"; column.title = `${day.key}: ${formatWatchTime(day.seconds)}`;
      const value = document.createElement("span"); value.className = "chart-value"; value.textContent = day.seconds ? formatWatchTime(day.seconds, true) : "";
      const barWrap = document.createElement("div"); barWrap.className = "chart-bar-wrap";
      const bar = document.createElement("div"); bar.className = "chart-bar"; bar.style.height = `${Math.max(day.seconds ? 7 : 2, (day.seconds / max) * 100)}%`;
      const label = document.createElement("small"); label.textContent = day.label;
      barWrap.appendChild(bar); column.append(value, barWrap, label); chart.appendChild(column);
    }
    body.appendChild(chart);
  }

  function metricCard(label, value, rate = "") {
    const card = document.createElement("div"); card.className = "metric-card";
    const cap = document.createElement("span"); cap.textContent = label;
    const number = document.createElement("strong"); number.textContent = value;
    const detail = document.createElement("small"); detail.textContent = rate; detail.hidden = !rate;
    card.append(cap, number, detail); return card;
  }

  function positionVideoInfoPanel(anchorElement = playerInfoButton) {
    const infoPanel = watchUiShadow?.getElementById("video-info-panel");
    if (!infoPanel || infoPanel.hidden) return;
    const viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    const edge = viewportWidth <= 760 ? 8 : 12;
    const gap = viewportWidth <= 760 ? 7 : 9;
    const anchorRect = anchorElement && typeof anchorElement.getBoundingClientRect === "function"
      ? anchorElement.getBoundingClientRect()
      : { left: viewportWidth - 390, right: viewportWidth - edge, bottom: 74, top: 32, width: 42, height: 42 };
    const panelWidth = Math.min(viewportWidth - edge * 2, viewportWidth <= 760 ? 360 : 390);
    let left = Math.round(anchorRect.left + anchorRect.width / 2 - panelWidth / 2);
    left = Math.max(edge, Math.min(left, viewportWidth - panelWidth - edge));
    const top = Math.max(edge, Math.round(anchorRect.bottom + gap));
    const availableHeight = Math.max(180, viewportHeight - top - edge);
    infoPanel.style.width = `${panelWidth}px`;
    infoPanel.style.left = `${left}px`;
    infoPanel.style.right = "auto";
    infoPanel.style.top = `${top}px`;
    infoPanel.style.maxHeight = `${availableHeight}px`;
  }

  function showVideoInfo(anchorElement = playerInfoButton) {
    if (!video || !host?.isConnected) { showWatchToast("Chưa có video đang phát"); return; }
    createWatchUi();
    const snapshot = refreshWatchCurrentSnapshot();
    if (!snapshot) { showWatchToast("Không đọc được thông tin video"); return; }
    const stats = mergedVideoStats();
    snapshot.stats = stats;
    const panel = watchUiShadow.getElementById("video-info-panel");
    panel.replaceChildren();
    panel.hidden = false;
    applyVideoOverlayVisibility();

    const header = document.createElement("header"); header.className = "video-info-head";
    if (snapshot.thumbnail) { const image = document.createElement("img"); image.src = snapshot.thumbnail; image.alt = ""; header.appendChild(image); }
    const identity = document.createElement("div"); identity.className = "video-info-identity";
    const displayTitle = String(currentVideoInfo?.authorInfo?.nickname || currentVideoInfo?.nickname || currentVideoInfo?.author || snapshot.caption?.split(/\s+#/)[0] || "Video Info").trim();
    const title = document.createElement("strong"); title.textContent = displayTitle.slice(0, 64);
    const author = document.createElement("span"); author.textContent = snapshot.author ? `@${snapshot.author}` : "TikTok video";
    const engagement = document.createElement("b"); engagement.textContent = `${stats.er.toFixed(2)}% engagement`;
    identity.append(title, author, engagement);
    const close = document.createElement("button"); close.type = "button"; close.className = "video-info-close"; close.textContent = "×"; close.title = "Đóng"; close.addEventListener("click", closeWatchModal);
    header.append(identity, close); panel.appendChild(header);

    const metrics = document.createElement("div"); metrics.className = "video-info-metrics";
    const downloads = Number(currentVideoInfo?.stats?.downloads ?? currentVideoInfo?.downloads ?? 0) || 0;
    const metricItems = [
      ["◉", "Views", formatStatsNumber(stats.views), "accent"],
      ["♡", "Likes", formatStatsNumber(stats.likes), ""],
      ["◌", "Comments", formatStatsNumber(stats.comments), ""],
      ["⇧", "Shares", formatStatsNumber(stats.shares), ""],
      ["▱", "Saves", formatStatsNumber(stats.saves), ""],
      ["↓", "Downloads", downloads ? formatStatsNumber(downloads) : "—", ""]
    ];
    for (const [icon, label, value, className] of metricItems) {
      const card = document.createElement("div"); card.className = `video-info-metric ${className}`.trim();
      const cap = document.createElement("span"); cap.textContent = `${icon} ${label}`;
      const number = document.createElement("strong"); number.textContent = value;
      card.append(cap, number); metrics.appendChild(card);
    }
    panel.appendChild(metrics);

    if (snapshot.caption) {
      const caption = document.createElement("button"); caption.type = "button"; caption.className = "video-info-caption"; caption.textContent = snapshot.caption; caption.title = "Nhấn để sao chép caption"; caption.addEventListener("click", () => void copyWatchText(snapshot.caption)); panel.appendChild(caption);
    }
    if (snapshot.hashtags.length) {
      const hashtags = document.createElement("div"); hashtags.className = "video-info-hashtags";
      for (const tag of snapshot.hashtags) { const chip = document.createElement("button"); chip.type = "button"; chip.textContent = tag; chip.title = "Nhấn để sao chép"; chip.addEventListener("click", () => void copyWatchText(tag)); hashtags.appendChild(chip); }
      panel.appendChild(hashtags);
    }

    const hydrationText = String(document.getElementById("__UNIVERSAL_DATA_FOR_REHYDRATION__")?.textContent || "");
    const region = String(currentVideoInfo?.region || hydrationText.match(/"region":"([A-Z]{2})"/)?.[1] || document.documentElement.lang.split("-")[1] || "—").toUpperCase();
    const uploadedDate = (() => {
      const raw = Number(currentVideoInfo?.createTime) || 0;
      if (!raw) return stats.date || "—";
      const date = new Date(raw < 1e12 ? raw * 1000 : raw);
      return Number.isNaN(date.getTime()) ? (stats.date || "—") : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium" }).format(date);
    })();
    const music = snapshot.music || {};
    const details = [
      ["Duration", formatDuration(snapshot.duration)],
      ["Region", region],
      ["Uploaded", uploadedDate],
      ["Music", [music.title, music.author].filter(Boolean).join(" - ") || "Chưa xác định"],
      ["Video ID", snapshot.videoId || "—"]
    ];
    const detailList = document.createElement("div"); detailList.className = "video-info-details";
    for (const [label, value] of details) { const row = document.createElement("div"); const key = document.createElement("span"); key.textContent = label; const val = document.createElement("strong"); val.textContent = value; row.append(key, val); detailList.appendChild(row); }
    panel.appendChild(detailList);

    const products = currentProductsForInfo(); updateWatchCurrentProducts(products);
    if (products.length) {
      const productTitle = document.createElement("div"); productTitle.className = "video-info-product-title"; productTitle.textContent = `Tagged product${products.length > 1 ? "s" : ""} (${products.length})`; panel.appendChild(productTitle);
      const productList = document.createElement("div"); productList.className = "video-info-products";
      for (const product of products.slice(0, 4)) {
        const item = document.createElement("a"); item.href = product.url || "#"; item.target = "_blank"; item.rel = "noopener noreferrer";
        if (product.image) { const image = document.createElement("img"); image.src = product.image; image.alt = ""; item.appendChild(image); }
        const copy = document.createElement("div"); const name = document.createElement("strong"); name.textContent = product.title || `Sản phẩm ${product.id}`; const price = document.createElement("span"); price.textContent = product.priceText || product.shopName || "TikTok Shop"; copy.append(name, price); item.appendChild(copy); productList.appendChild(item);
      }
      panel.appendChild(productList);
    }

    const copyDetails = document.createElement("button"); copyDetails.type = "button"; copyDetails.className = "video-info-copy"; copyDetails.textContent = "▣  Copy details";
    copyDetails.addEventListener("click", () => void copyWatchText([
      snapshot.caption, snapshot.author ? `@${snapshot.author}` : "", `Views: ${formatStatsNumber(stats.views)}`, `Likes: ${formatStatsNumber(stats.likes)}`, `Comments: ${formatStatsNumber(stats.comments)}`, `Shares: ${formatStatsNumber(stats.shares)}`, `Saves: ${formatStatsNumber(stats.saves)}`, `Engagement: ${stats.er.toFixed(2)}%`, `Duration: ${formatDuration(snapshot.duration)}`, `Region: ${region}`, `Uploaded: ${uploadedDate}`, `Music: ${[music.title, music.author].filter(Boolean).join(" - ") || "Chưa xác định"}`, `Video ID: ${snapshot.videoId}`, snapshot.url
    ].filter(Boolean).join("\n")));
    panel.appendChild(copyDetails);
    requestAnimationFrame(() => {
      positionVideoInfoPanel(anchorElement);
      setTimeout(() => positionVideoInfoPanel(anchorElement), 80);
    });
  }

  function renderWatchToolbar() {
    if (!watchAnalyticsReady || !watchAnalytics) return;
    const today = getWatchRange(1);
    const controlTime = controlWidgetShadow?.getElementById("tdt-control-watch-time");
    const controlVideos = controlWidgetShadow?.getElementById("tdt-control-watch-videos");
    const controlWrap = controlWidgetShadow?.getElementById("wrap");
    if (controlTime) controlTime.textContent = formatWatchClock(today.watchedSeconds);
    if (controlVideos) controlVideos.textContent = `${today.videos} videos today`;
    if (controlWrap) controlWrap.classList.toggle("watch-hidden", extensionSettings.watchWidgetEnabled === false);
  }

  function createWatchUi() {
    if (watchUiHost?.isConnected) return;
    watchUiHost = document.createElement("div");
    watchUiHost.id = "tdt-watch-ui-host";
    watchUiHost.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483646;pointer-events:none;display:none";
    document.documentElement.appendChild(watchUiHost);
    watchUiShadow = watchUiHost.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host{all:initial}*{box-sizing:border-box}button,a{font:inherit}
      .video-info-panel{position:fixed;top:76px;right:12px;width:min(390px,calc(100vw - 24px));max-height:calc(100vh - 88px);overflow:auto;border:1px solid rgba(255,255,255,.17);border-radius:18px;color:#f5f5f7;background:linear-gradient(155deg,rgba(24,24,29,.995),rgba(16,16,20,.995));box-shadow:0 24px 72px rgba(0,0,0,.68);font:12px/1.38 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;pointer-events:auto;backdrop-filter:blur(22px) saturate(130%)}
      .video-info-panel[hidden]{display:none}.video-info-head{display:grid;grid-template-columns:58px minmax(0,1fr) 28px;gap:11px;align-items:start;padding:13px 13px 12px;border-bottom:1px solid rgba(255,255,255,.09)}.video-info-head>img{width:58px;height:74px;border-radius:11px;object-fit:cover;background:#111}.video-info-identity{display:grid;gap:3px;min-width:0;padding-top:1px}.video-info-identity strong{overflow:hidden;font-size:17px;line-height:1.15;text-overflow:ellipsis;white-space:nowrap}.video-info-identity span{color:#9d9da5;font-size:12px}.video-info-identity b{margin-top:4px;color:#ff4f79;font-size:13px}.video-info-close{display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:9px;color:#aaa;background:transparent;cursor:pointer;font-size:23px;line-height:1}.video-info-close:hover{color:#fff;background:rgba(255,255,255,.08)}
      .video-info-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:12px 13px}.video-info-metric{display:grid;gap:6px;min-height:74px;padding:10px 11px;border:1px solid rgba(255,255,255,.11);border-radius:14px;background:rgba(255,255,255,.052)}.video-info-metric span{overflow:hidden;color:#a3a3aa;font-size:9px;font-weight:850;letter-spacing:.35px;text-transform:uppercase;white-space:nowrap}.video-info-metric strong{font-size:18px;line-height:1.05}.video-info-metric.accent strong{color:#ff315f}
      .video-info-caption{width:calc(100% - 26px);margin:1px 13px 0;padding:0;border:0;color:#ededf0;background:transparent;text-align:left;cursor:pointer;font-size:12px;line-height:1.45;white-space:pre-wrap}.video-info-caption:hover{color:#fff}.video-info-hashtags{display:flex;flex-wrap:wrap;gap:7px;margin:10px 13px 0}.video-info-hashtags button{padding:6px 9px;border:0;border-radius:9px;color:#69c9ff;background:#243140;cursor:pointer;font-size:11px;font-weight:850}.video-info-hashtags button:hover{filter:brightness(1.16)}
      .video-info-details{display:grid;margin:12px 13px 0;border-top:1px solid rgba(255,255,255,.1)}.video-info-details>div{display:grid;grid-template-columns:78px minmax(0,1fr);gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.085)}.video-info-details span{color:#9d9da5;font-size:12px}.video-info-details strong{overflow-wrap:anywhere;text-align:right;font-size:12px;font-weight:700}.video-info-product-title{margin:12px 13px 0;color:#aaa;font-size:10px;font-weight:850;text-transform:uppercase}.video-info-products{display:grid;gap:7px;margin:8px 13px 0}.video-info-products a{display:grid;grid-template-columns:48px minmax(0,1fr);gap:9px;align-items:center;padding:7px;border:1px solid rgba(255,255,255,.08);border-radius:11px;color:#fff;background:rgba(255,255,255,.035);text-decoration:none}.video-info-products img{width:48px;height:48px;border-radius:9px;object-fit:cover}.video-info-products strong,.video-info-products span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.video-info-products span{margin-top:3px;color:#ff6987;font-size:10px}.video-info-copy{width:calc(100% - 26px);min-height:48px;margin:13px 13px 14px;border:1px solid rgba(255,255,255,.15);border-radius:14px;color:#fff;background:#303036;cursor:pointer;font-size:14px;font-weight:900}.video-info-copy:hover{background:#3a3a42}
      .modal-backdrop{position:fixed;inset:0;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.72);pointer-events:auto;backdrop-filter:blur(10px)}.modal-backdrop[hidden]{display:none}.modal-card{display:grid;grid-template-rows:auto minmax(0,1fr);width:min(1120px,calc(100vw - 36px));max-height:calc(100vh - 36px);overflow:hidden;border:1px solid rgba(255,255,255,.17);border-radius:28px;color:#fff;background:linear-gradient(150deg,#29292b,#222225);box-shadow:0 32px 100px rgba(0,0,0,.7)}.modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:28px 32px 18px}.modal-head h2{margin:0;font-size:27px}.modal-head p{margin:2px 0 0;color:#a5a5ad;font-size:16px}.modal-close{display:grid;place-items:center;width:40px;height:40px;padding:0;border:0;border-radius:12px;color:#aaa;background:transparent;cursor:pointer;font-size:32px}.modal-close:hover{color:#fff;background:rgba(255,255,255,.08)}.modal-body{min-height:0;padding:8px 32px 24px;overflow:auto}.history-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.history-card{min-width:0;padding:0;overflow:hidden;border:1px solid rgba(255,255,255,.06);border-radius:17px;color:#fff;background:#303033;text-align:left;cursor:pointer}.history-card:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.2)}.history-media{position:relative;height:310px;overflow:hidden;background:#111}.history-media img{width:100%;height:100%;object-fit:cover}.history-duration{position:absolute;right:8px;bottom:8px;padding:3px 7px;border-radius:7px;background:rgba(0,0,0,.76);font-size:13px;font-weight:850}.history-info{padding:10px 12px 12px}.history-info strong,.history-info small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.history-info strong{font-size:16px}.history-info small{margin-top:3px;color:#a4a4aa;font-size:12px}.history-actions{display:flex;justify-content:center;padding:16px 0 0;border-top:1px solid rgba(255,255,255,.13)}.history-clear{min-width:166px;min-height:44px;padding:0 18px;border:1px solid rgba(255,255,255,.18);border-radius:14px;color:#d7dae4;background:rgba(255,255,255,.05);cursor:pointer;font-size:13px;font-weight:850}.history-clear:hover{background:rgba(255,255,255,.11)}.empty-state{padding:60px 20px;color:#aaa;text-align:center}.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.summary-box{padding:18px;border:1px solid rgba(255,255,255,.1);border-radius:18px}.watch-chart{height:300px}.watch-toast{position:fixed;left:50%;bottom:28px;padding:10px 15px;border:1px solid rgba(255,255,255,.16);border-radius:999px;color:#fff;background:rgba(17,17,20,.96);opacity:0;transform:translate(-50%,10px);transition:.18s;pointer-events:none;font:13px Inter,system-ui,sans-serif}.watch-toast[data-show="true"]{opacity:1;transform:translate(-50%,0)}
      @media(max-width:760px){.video-info-panel{width:min(360px,calc(100vw - 16px));border-radius:16px}.video-info-metrics{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:10px}.video-info-metric{min-height:68px;padding:9px 8px}.video-info-metric strong{font-size:16px}.video-info-details>div{grid-template-columns:72px minmax(0,1fr)}.history-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.history-media{height:240px}}
    `;
    const infoPanel = document.createElement("section"); infoPanel.id = "video-info-panel"; infoPanel.className = "video-info-panel"; infoPanel.hidden = true;
    watchModal = document.createElement("div"); watchModal.className = "modal-backdrop"; watchModal.hidden = true; watchModal.addEventListener("click", (event) => { if (event.target === watchModal) closeWatchModal(); });
    const modalCard = document.createElement("div"); modalCard.id = "watch-modal-card"; modalCard.className = "modal-card"; watchModal.appendChild(modalCard);
    const toast = document.createElement("div"); toast.id = "watch-toast"; toast.className = "watch-toast";
    watchUiShadow.append(style, infoPanel, watchModal, toast);
    window.addEventListener("resize", () => {
      if (isVideoInfoOpen()) positionVideoInfoPanel(playerInfoButton);
    }, { passive: true });
    syncWatchUiAccess(); renderWatchToolbar();
  }

  function syncWatchUiAccess() {
    if (!watchUiHost) return;
    watchUiHost.style.display = remoteAccessReady && !remoteAccessLocked ? "block" : "none";
    if (remoteAccessLocked) closeWatchModal();
    else renderWatchToolbar();
  }

  async function initWatchAnalyticsAndUi() {
    if (!watchAnalyticsReady) { watchAnalytics = normalizeWatchAnalytics(await watchStorageGet()); watchAnalyticsReady = true; }
    createWatchUi(); renderWatchToolbar();
    if (!watchTicker) watchTicker = setInterval(recordWatchSecond, 1000);
  }

  function videoIdFromExtensionDom(root) {
    if (!(root instanceof Element || root instanceof Document)) return { id:'', node:null };
    // TikTok's own xgwrapper is authoritative on the home feed. Read it before
    // attributes injected by any other extension, which may belong to a
    // previously selected video.
    const nativeWrapper = (root instanceof Element && root.matches?.('[id^="xgwrapper-"]') ? root : null)
      || root.querySelector?.('[id^="xgwrapper-"]');
    const nativeWrapperId = String(nativeWrapper?.id || '').match(/xgwrapper-\d+-(\d{8,})/)?.[1] || '';
    if (nativeWrapperId) return { id:nativeWrapperId, node:nativeWrapper };
    const nodes = [];
    const add = (node) => { if (node instanceof Element && !nodes.includes(node) && nodes.length < 220) nodes.push(node); };
    if (root instanceof Element) {
      add(root);
      add(root.closest?.('[id^="xgwrapper-"],[data-video-id],[data-item-id],[data-aweme-id],[data-tpt-video-id],[data-tdt-video-id],[data-tt-video-id]'));
    }
    const selector = '[id^="xgwrapper-"],[data-video-id],[data-item-id],[data-aweme-id],[data-tpt-video-id],[data-tdt-video-id],[data-tt-video-id],[data-video-url],[data-page-url],[data-url]';
    root.querySelectorAll?.(selector).forEach(add);
    const attrs = ['data-video-id','data-item-id','data-aweme-id','data-tpt-video-id','data-tdt-video-id','data-tt-video-id','data-id','data-video-url','data-page-url','data-url','href'];
    for (const node of nodes) {
      const values = [node.id, node.className];
      for (const name of attrs) values.push(node.getAttribute?.(name));
      for (const value of values) {
        const text = String(value || '');
        const id = text.match(/xgwrapper-\d+-(\d{8,})/)?.[1]
          || text.match(/(?:video|aweme|item|videoId|itemId)[^\d]{0,12}(\d{8,})/i)?.[1]
          || text.match(/\/video\/(\d{8,})/)?.[1]
          || (/^\d{8,}$/.test(text.trim()) ? text.trim() : '');
        if (id) return { id, node };
      }
    }
    return { id:'', node:null };
  }

  function videoUrlFromExtensionDom(root) {
    const identity = videoIdFromExtensionDom(root);
    if (!identity.id) return '';
    const username = usernameFromVideoRoot(root, identity.node);
    return `https://www.tiktok.com/@${username}/video/${identity.id}`;
  }

  function findVideoUrlInRoot(root) {
    if (!(root instanceof Element || root instanceof Document)) return "";
    const directCandidates = [];
    if (root instanceof Element) {
      directCandidates.push(
        root.getAttribute("href"), root.getAttribute("data-video-url"), root.getAttribute("data-url"),
        root.getAttribute("data-page-url"), root.getAttribute("data-tpt-url"), root.getAttribute("data-tdt-url")
      );
    }
    const selectors = [
      'a[href*="/video/"]',
      '[data-e2e="browse-video-link"]',
      'input[value*="/video/"]',
      '[data-video-url*="/video/"]',
      '[data-url*="/video/"]',
      '[data-page-url*="/video/"]',
      '[data-tpt-url*="/video/"]',
      '[data-tdt-url*="/video/"]'
    ];
    for (const candidate of root.querySelectorAll(selectors.join(","))) {
      directCandidates.push(
        candidate.href,
        candidate.value,
        candidate.getAttribute?.("href"),
        candidate.getAttribute?.("value"),
        candidate.getAttribute?.("data-video-url"),
        candidate.getAttribute?.("data-url"),
        candidate.getAttribute?.("data-page-url"),
        candidate.getAttribute?.("data-tpt-url"),
        candidate.getAttribute?.("data-tdt-url"),
        candidate.textContent
      );
    }
    for (const value of directCandidates) {
      const text = String(value || "").trim();
      const match = text.match(/https?:\/\/(?:www\.)?tiktok\.com\/[^\s"'<>]+\/video\/\d+/i)
        || text.match(/\/[@A-Za-z0-9._-]+\/video\/\d+/i);
      const url = normalizeTikTokVideoUrl(match?.[0] || text);
      if (url) return url;
    }

    const extensionUrl = videoUrlFromExtensionDom(root);
    if (extensionUrl) return extensionUrl;

    const idNodes = [];
    if (root instanceof Element) idNodes.push(root);
    root.querySelectorAll?.('[data-video-id],[data-item-id],[data-aweme-id],[data-tpt-video-id],[data-tdt-video-id],[data-tt-video-id],[data-id]').forEach((node) => {
      if (idNodes.length < 180) idNodes.push(node);
    });
    for (const node of idNodes) {
      const id = ["data-video-id", "data-item-id", "data-aweme-id", "data-tpt-video-id", "data-tdt-video-id", "data-tt-video-id", "data-id"]
        .map((name) => String(node.getAttribute?.(name) || "").match(/\d{8,}/)?.[0] || "")
        .find(Boolean);
      if (!id) continue;
      const profileLink = root.querySelector?.('a[href^="/@"]') || node.closest?.('a[href^="/@"]');
      const username = String(profileLink?.getAttribute?.("href") || "").match(/\/\@([^/?#]+)/)?.[1] || "tdtfeed";
      return `https://www.tiktok.com/@${username}/video/${id}`;
    }
    return "";
  }

  function visibleDialogForElement(element) {
    const ownDialog = element?.closest?.('[role="dialog"]');
    if (ownDialog && isVisibleElement(ownDialog, 180, 180)) return ownDialog;
    const directDialogs = directQueryElements(['[role="dialog"]']);
    const dialogs = (directDialogs.length ? directDialogs : deepQuerySubtitleElements(['[role="dialog"]']))
      .filter((dialog) => isVisibleElement(dialog, 180, 180));
    return dialogs.at(-1) || null;
  }

  function resolveVideoUrlForElement(element) {
    const identityRoot = element instanceof Element
      ? element.closest?.('[id^="xgwrapper-"],[data-video-id],[data-item-id],[data-aweme-id]')
      : null;
    const signature = element instanceof HTMLVideoElement
      ? [
          element.currentSrc,
          element.src,
          element.poster,
          element.getAttribute('data-video-id'),
          identityRoot?.id,
          identityRoot?.getAttribute?.('data-video-id'),
          identityRoot?.getAttribute?.('data-item-id'),
          identityRoot?.getAttribute?.('data-aweme-id'),
          pendingSearchVideoId
        ].join('|')
      : '';
    const cached = element instanceof Element ? resolvedVideoUrlCache.get(element) : null;
    if (cached?.signature === signature && cached.url) return cached.url;
    const directId = element instanceof Element ? directVideoIdForElement(element) : "";
    const accept = (rawUrl) => {
      const url = normalizeTikTokVideoUrl(rawUrl);
      const id = videoIdFromUrl(url);
      if (!url || !id) return "";
      if (directId && id !== directId) return "";
      if (isSearchRoute() && pendingSearchVideoId && id !== pendingSearchVideoId) return "";
      if (element instanceof Element) resolvedVideoUrlCache.set(element, { signature, url });
      return url;
    };

    // Resolve from the exact player/card first. A tab URL can remain on /search
    // or lag behind an in-place TikTok detail transition, so it must never win
    // over local DOM identity.
    if (element instanceof Element) {
      const ownLink = element.closest?.('a[href*="/video/"]');
      const ownUrl = accept(ownLink?.href || ownLink?.getAttribute?.("href"));
      if (ownUrl) return ownUrl;

      const scopes = [];
      const seen = new Set();
      const addScope = (scope) => {
        if (scope instanceof Element && !seen.has(scope)) {
          seen.add(scope);
          scopes.push(scope);
        }
      };
      addScope(identityRoot);
      addScope(element);
      addScope(element.parentElement);
      addScope(element.closest(
        'article,[data-e2e="recommend-list-item-container"],[data-e2e="feed-video"],section[id^="media-card-"],.xgplayer-container,.tiktok-web-player,[data-e2e="browse-video"],[data-e2e="video-player"]'
      ));
      const ownDialog = element.closest?.('[role="dialog"]');
      // A detail dialog also contains creator/related video links. Never search the
      // whole dialog for identity when the browser route already names the main video.
      if (ownDialog && !effectiveTabVideoUrl()) addScope(ownDialog);
      for (const scope of scopes) {
        const localUrl = accept(findVideoUrlInRoot(scope));
        if (localUrl) return localUrl;
      }
    }

    if (isSearchRoute()) {
      // Search result thumbnails are never replacement targets. After an explicit
      // card click, the detail player can be rendered without a /video/ link; in
      // that narrow case use only the exact pending card URL for a short window.
      if (element instanceof Element && pendingSearchFallbackIsFresh() && isLikelySearchDetailSurface(element)) {
        const pendingUrl = accept(pendingSearchVideoUrl);
        if (pendingUrl) return pendingUrl;
      }
      return "";
    }

    const currentTabVideoUrl = effectiveTabVideoUrl();
    if (currentTabVideoUrl) {
      const routeId = videoIdFromUrl(currentTabVideoUrl);
      // A tab URL identifies the opened detail video, not every <video> on the page.
      // Only the large primary stage may inherit that URL when local DOM has no ID.
      if (!(element instanceof Element) || !routeId || isPrimaryDetailRouteSurface(element, routeId)) {
        return accept(currentTabVideoUrl);
      }
      return "";
    }
    if (!(element instanceof Element)) return accept(findVideoUrlInRoot(document));
    return "";
  }

  function runtimeMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }

  function applyRemoteAccessState(value) {
    const source = value && typeof value === "object" ? value : {};
    const wasLocked = remoteAccessLocked;
    remoteAccessState = {
      allowed: source.allowed === true && Number(source.leaseExpiresAt) > Date.now(),
      status: String(source.status || "active"),
      reason: String(source.reason || ""),
      serverReachable: source.serverReachable === true,
      error: String(source.error || ""),
      clientId: String(source.clientId || ""),
      authUid: String(source.authUid || ""),
      leaseExpiresAt: Math.max(0, Number(source.leaseExpiresAt) || 0),
      source: String(source.source || "")
    };
    remoteAccessReady = true;
    remoteAccessLocked = remoteAccessState.allowed === false;
    if (watchUiHost) syncWatchUiAccess();
    clearTimeout(remoteAccessLeaseTimer);
    remoteAccessLeaseTimer = null;
    if (!remoteAccessLocked) {
      remoteAccessLeaseTimer = setTimeout(() => {
        if (Number(remoteAccessState.leaseExpiresAt) > Date.now()) return;
        applyRemoteAccessState({
          ...remoteAccessState,
          allowed: false,
          status: "lease_expired",
          reason: "Phiên quyền Vercel đã hết hạn. Extension đã tự khóa để chống bypass.",
          serverReachable: false,
          leaseExpiresAt: 0
        });
      }, Math.max(250, Number(remoteAccessState.leaseExpiresAt) - Date.now() + 100));
    }

    if (controlWidgetScanButton) controlWidgetScanButton.disabled = remoteAccessLocked;
    if (controlWidgetSubtitleButton) controlWidgetSubtitleButton.disabled = remoteAccessLocked;

    if (remoteAccessLocked) {
      mountEpoch += 1;
      currentRequestToken += 1;
      mounting = false;
      startupScanTimers.forEach((timer) => clearTimeout(timer));
      startupScanTimers = [];
      suppressedUrl = currentPageUrl || effectiveTabVideoUrl() || String(location.href);
      if (host) closePlayer({ restoreNative: true });
      restoreGuardedNativeVideos();
      updateControlWidgetStatus(remoteAccessState.reason || "Extension đã bị khóa bởi quản trị viên.", "error");
      syncWatchUiAccess();
      return remoteAccessState;
    }

    if (wasLocked) suppressedUrl = "";
    if (!remoteAccessState.serverReachable && remoteAccessState.error) {
      updateControlWidgetStatus("Máy chủ tạm thời ngoại tuyến · đang dùng quyền đã lưu.", "loading");
    } else {
      updateControlWidgetStatus("Đã xác minh quyền sử dụng.", "ok");
    }
    syncWatchUiAccess();
    if (settingsReady && extensionSettings.autoReplace) {
      scheduleStartupScans();
      if (wasLocked) void mountPlayerForCurrentVideo();
    }
    return remoteAccessState;
  }

  async function refreshRemoteAccessState(force = false) {
    try {
      const response = await runtimeMessage({ type: force ? "REMOTE_ACCESS_REFRESH" : "REMOTE_ACCESS_GET" });
      if (response?.ok && response.state) return applyRemoteAccessState(response.state);
      throw new Error(response?.error || "Không thể đọc quyền sử dụng.");
    } catch (error) {
      remoteAccessReady = true;
      remoteAccessState = { ...remoteAccessState, serverReachable: false, error: String(error?.message || "") };
      if (remoteAccessLocked) {
        updateControlWidgetStatus(remoteAccessState.reason || "Extension đang bị khóa.", "error");
      }
      return remoteAccessState;
    }
  }

  function effectiveTabVideoUrl() {
    // TikTok can update history/location before the background tab-url message.
    // A concrete /video/ URL in the page is therefore newer than a stale search URL.
    return normalizeTikTokVideoUrl(location.href) || normalizeTikTokVideoUrl(authoritativeTabUrl);
  }

  function effectiveNavigationUrl() {
    const localUrl = String(location.href || "");
    if (normalizeTikTokVideoUrl(localUrl)) return localUrl;
    const remoteUrl = String(authoritativeTabUrl || "");
    if (normalizeTikTokVideoUrl(remoteUrl)) return remoteUrl;
    return isTikTokUrl(localUrl) ? localUrl : remoteUrl;
  }

  async function refreshCurrentTabUrl(force = false) {
    const now = Date.now();
    if (!force && authoritativeTabUrl && now - lastCurrentTabUrlRefreshAt < CURRENT_TAB_URL_REFRESH_MIN_INTERVAL_MS) {
      return effectiveTabVideoUrl();
    }
    if (currentTabUrlRefreshPromise) return currentTabUrlRefreshPromise;
    lastCurrentTabUrlRefreshAt = now;
    currentTabUrlRefreshPromise = runtimeMessage({ type: "GET_CURRENT_TAB_URL" })
      .then((response) => {
        const rawUrl = String(response?.url || "");
        if (isTikTokUrl(rawUrl)) authoritativeTabUrl = rawUrl;
        return normalizeTikTokVideoUrl(response?.canonicalUrl || rawUrl) || effectiveTabVideoUrl();
      })
      .catch(() => effectiveTabVideoUrl())
      .finally(() => { currentTabUrlRefreshPromise = null; });
    return currentTabUrlRefreshPromise;
  }

  function rememberPageVideoInfo(pageUrl, info) {
    if (!pageUrl || !info?.videoUrl) return;
    const key = videoIdFromUrl(pageUrl) || canonicalUrl(pageUrl);
    pageVideoInfoCache.set(key, info);
    if (pageVideoInfoCache.size > 20) pageVideoInfoCache.delete(pageVideoInfoCache.keys().next().value);
  }

  async function prefetchCurrentTabVideoInfo(force = false) {
    const exactUrl = await refreshCurrentTabUrl(true);
    if (!exactUrl) return null;
    const cacheKey = videoIdFromUrl(exactUrl) || canonicalUrl(exactUrl);
    if (!force && pageVideoInfoCache.get(cacheKey)?.videoUrl) return pageVideoInfoCache.get(cacheKey);
    if (!force && prefetchVideoInfoPromise && lastPrefetchedVideoUrl === exactUrl) return prefetchVideoInfoPromise;
    lastPrefetchedVideoUrl = exactUrl;
    prefetchVideoInfoPromise = runtimeMessage({ type: "GET_VIDEO_INFO", url: exactUrl, force: Boolean(force) })
      .then((response) => {
        if (response?.ok && response.data?.videoUrl) {
          rememberPageVideoInfo(exactUrl, response.data);
          updateControlWidgetStatus("Đã lấy link video từ tab hiện tại, đang chờ khung TikTok…", "loading");
          return response.data;
        }
        return null;
      })
      .catch(() => null)
      .finally(() => { prefetchVideoInfoPromise = null; });
    return prefetchVideoInfoPromise;
  }


  function noticeState(message, success = false) {
    if (success) return "success";
    const value = String(message || "").toLowerCase();
    if (/đang|chờ|tải|quét|xử lý|kết nối/.test(value)) return "loading";
    if (/không thể|thất bại|lỗi|chặn|hết hạn|từ chối/.test(value)) return "error";
    return "info";
  }

  function showNotice(message, success = false) {
    if (!shadow) return;
    clearTimeout(noticeHideTimer);
    const previous = shadow.getElementById("notice");
    if (previous) previous.remove();
    const state = noticeState(message, success);
    const notice = document.createElement("div");
    notice.id = "notice";
    notice.dataset.state = state;
    notice.dataset.open = "false";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    const icon = document.createElement("span");
    icon.className = "notice-icon";
    icon.textContent = state === "success" ? "✓" : state === "error" ? "!" : state === "loading" ? "" : "i";
    const label = document.createElement("span");
    label.className = "notice-text";
    label.textContent = String(message || "Sẵn sàng");
    notice.append(icon, label);
    shadow.appendChild(notice);
    requestAnimationFrame(() => { notice.dataset.open = "true"; });
    noticeHideTimer = setTimeout(() => {
      notice.dataset.open = "false";
      setTimeout(() => notice.remove(), 260);
    }, 3600);
  }

  function setSubtitleStatus(message, state = "") {
    if (subtitleStatusEl) {
      subtitleStatusEl.textContent = `CC ${message}`;
      subtitleStatusEl.dataset.state = state;
    }
    updateControlWidgetStatus(`CC ${message}`, state);
  }

  function setVideoGate(locked, message = "Đang lấy sub từ từ đã 😺...") {
    videoGateLocked = Boolean(locked);
    if (videoGateLocked && video) {
      video.pause();
      video.controls = false;
    }
    if (subtitleGateText) {
      subtitleGateText.textContent = message;
      subtitleGateText.classList.toggle("loading-dots", videoGateLocked && message.includes("Đang"));
    }
    if (subtitleGate) {
      subtitleGate.classList.toggle("is-hidden", !videoGateLocked);
      subtitleGate.style.cursor = playbackUnlockRequired ? "pointer" : "default";
    }
    if (!videoGateLocked && video) video.controls = false;
    if (videoGateLocked) hideCenterPlaybackFeedback();
  }

  function hideCenterPlaybackFeedback() {
    clearTimeout(centerPlaybackHideTimer);
    centerPlaybackHideTimer = null;
    if (centerPlaybackButton) centerPlaybackButton.dataset.visible = "false";
  }

  function showCenterPlaybackFeedback(state) {
    if (!centerPlaybackButton || videoGateLocked || !["play", "pause"].includes(state)) return;
    hideCenterPlaybackFeedback();
    centerPlaybackButton.dataset.state = state;
    centerPlaybackButton.innerHTML = playerIcon(state);
    centerPlaybackButton.title = state === "play" ? "Phát video" : "Tạm dừng video";
    centerPlaybackButton.setAttribute("aria-label", centerPlaybackButton.title);
    void centerPlaybackButton.offsetWidth;
    centerPlaybackButton.dataset.visible = "true";
    centerPlaybackHideTimer = setTimeout(hideCenterPlaybackFeedback, 640);
  }

  function playReplacementFromGesture() {
    if (!video || videoGateLocked) return;
    const targetVideo = video;
    setManualPauseIntent(false);
    pausedBySmartAutoPause = false;
    cancelAutoplaySoundRecovery();
    autoplayMutedFallback = false;
    if (nativeAudioBridgeActive && nativeVideo?.isConnected && Number.isFinite(nativeVideo.currentTime)) {
      try { targetVideo.currentTime = Number(nativeVideo.currentTime) || 0; } catch {}
    }
    ensureVideoSound();
    // Keep the media play() call synchronous with the user gesture. Audio Studio
    // can attach asynchronously afterwards; delaying play until a CORS probe
    // finishes can lose Chrome's transient user activation.
    const playPromise = targetVideo.play();
    if (extensionSettings.audioEnabled) void ensureAudioEngine(audioStudioTarget(targetVideo));
    playPromise?.then?.(() => {
      if (targetVideo !== video) return;
      playbackUnlockRequired = false;
      syncNativeForSubtitleTranslator(true);
      notifyPlaybackStarted();
    }).catch?.(() => {
      if (targetVideo !== video) return;
      playbackUnlockRequired = true;
      setVideoGate(true, "Chrome đang chặn phát có tiếng · thử tương tác lại trên trang 🔊");
    });
  }

  function toggleReplacementPlayback() {
    if (!video || videoGateLocked) return;
    if (video.paused) {
      showCenterPlaybackFeedback("play");
      playReplacementFromGesture();
    } else {
      showCenterPlaybackFeedback("pause");
      setManualPauseIntent(true);
      video.pause();
    }
  }

  function startReplacementVideo(resetToStart = true) {
    if (!video) return;
    cancelAutoplaySoundRecovery();
    const targetVideo = video;
    const hasNativeClock = Boolean(extensionSettings.placeBelowSubtitleTranslator && nativeVideo?.isConnected);
    const shouldPlay = extensionSettings.autoplay && !isCurrentVideoManuallyPaused();
    if (hasNativeClock && Number.isFinite(nativeVideo.currentTime)) {
      try { targetVideo.currentTime = nativeVideo.currentTime; } catch {}
    } else if (resetToStart) {
      try { targetVideo.currentTime = 0; } catch {}
    }
    if (!shouldPlay) {
      setVideoGate(false);
      updatePlayerProgress();
      return;
    }
    pausedBySmartAutoPause = false;
    playbackUnlockRequired = false;
    autoplayMutedFallback = false;
    if (nativeAudioBridgeActive && nativeVideo?.isConnected && Number.isFinite(nativeVideo.currentTime)) {
      try { targetVideo.currentTime = Number(nativeVideo.currentTime) || 0; } catch {}
    }
    applyPlaybackRate(extensionSettings.playbackRate, false);
    ensureVideoSound();
    targetVideo.play().then(() => {
      if (targetVideo !== video) return;
      autoplayMutedFallback = false;
      ensureVideoSound();
      syncNativeForSubtitleTranslator(true);
      notifyPlaybackStarted();
      if (nativeAudioBridgeActive) void ensureNativeAudioBridgePlayback({ force:true });
      if (extensionSettings.audioEnabled) scheduleAudioStudioScan(0);
      if (document.hidden) startHiddenPlaybackKeepAlive();
    }).catch(async (error) => {
      if (!video || targetVideo !== video) return;
      // Do not convert network/codec/abort failures into a fake mute problem.
      // Only Chrome's autoplay policy is allowed to enter muted fallback.
      if (!isAutoplayPolicyError(error)) {
        if (String(error?.name || "") === "AbortError" && targetVideo.readyState < (Number(targetVideo.HAVE_FUTURE_DATA) || 3)) {
          targetVideo.addEventListener("canplay", () => { if (targetVideo === video && extensionSettings.autoplay && !isCurrentVideoManuallyPaused()) startReplacementVideo(false); }, { once:true });
          return;
        }
        playbackUnlockRequired = true;
        setVideoGate(true, "Video chưa thể tự phát · đang chờ nguồn sẵn sàng");
        return;
      }

      autoplayMutedFallback = true;
      ensureVideoSound();
      try {
        await targetVideo.play();
        if (targetVideo !== video) return;
        syncNativeForSubtitleTranslator(true);
        notifyPlaybackStarted();
        updateVolumeUi();
        // Retry audible playback automatically. If Chrome already grants autoplay
        // to tiktok.com (interaction/MEI), this flips back to sound without a click
        // on the video. Any later page-level activation also triggers recovery.
        scheduleAutoplaySoundRecovery(document.hidden ? 900 : 120, document.hidden ? 4 : 14);
      } catch {
        autoplayMutedFallback = false;
        playbackUnlockRequired = true;
        setVideoGate(true, "Chrome đang chặn autoplay · tương tác bất kỳ đâu trên trang để tiếp tục 🔊");
      }
    });
  }

  function cleanupSubtitleMedia() {
    subtitleBlobUrls.forEach((url) => URL.revokeObjectURL(url));
    subtitleBlobUrls = [];
    subtitleCues = [];
    if (video) video.querySelectorAll("track[data-tdt-subtitle]").forEach((track) => track.remove());
    if (captionOverlay) {
      setCaptionLines("", "");
    }
  }

  function cleanupSubtitles() {
    subtitleTaskToken += 1;
    cleanupSubtitleMedia();
    subtitleStatusEl = null;
    subtitleRetryBtn = null;
    subtitleToggleBtn = null;
    captionOverlay = null;
    captionTranslatedEl = null;
    captionOriginalEl = null;
    videoStatsPanel = null;
    videoStatsDate = null;
    videoStatsViews = null;
    videoStatsEr = null;
    videoStatsLikes = null;
    videoStatsComments = null;
    videoStatsShares = null;
    videoStatsSaves = null;
    latestExternalStats = null;
    statsDragState = null;
    sizeRange = null;
    sizeValue = null;
    subtitleOpacityRange = null;
    subtitleOpacityValue = null;
    playerSpeedButton = null;
    playerSpeedMenu = null;
    playerVolumeButton = null;
    playerVolumePopover = null;
    playerVolumeRange = null;
    playerVolumeValue = null;
    playerProgressRange = null;
    playerCurrentTime = null;
    playerDuration = null;
    playerPlayButton = null;
    playerProgressPlayed = null;
    playerProgressBuffered = null;
    playerProgressThumb = null;
    playerProgressTip = null;
    playerProgressTipTime = null;
    playerPipButton = null;
    playerWebFullscreenButton = null;
    playerProgressDragging = false;
    productWidget = null;
    productWidgetPanel = null;
    productWidgetButton = null;
    productScanSignature = "";
    latestDomProductScan = { videoId:"", products:[] };
    autoplayMutedFallback = false;
    suppressNextVideoClick = false;
    clearTimeout(centerPlaybackHideTimer);
    centerPlaybackHideTimer = null;
    centerPlaybackButton = null;
    videoMetadataOverlay = null;
    playbackUnlockRequired = false;
    pausedBySmartAutoPause = false;
    stopHiddenPlaybackKeepAlive();
    latestTranscript365Vtt = "";
    latestTranscript365Signature = "";
    subtitleGate = null;
    subtitleGateText = null;
    videoGateLocked = true;
  }

  async function closeTranscript365Worker(clearRequest = false) {
    if (currentTranscriptWindowId === null && currentTranscriptTabId === null) {
      if (clearRequest) chrome.storage.local.remove(TRANSCRIPT365_REQUEST_KEY);
      return;
    }
    const windowId = currentTranscriptWindowId;
    const tabId = currentTranscriptTabId;
    currentTranscriptWindowId = null;
    currentTranscriptTabId = null;
    currentTranscriptRequestId = "";
    try {
      await runtimeMessage({ type: "CLOSE_TRANSCRIPT365_BACKGROUND", windowId, tabId });
    } catch {
      // Cửa sổ có thể đã tự đóng khi bridge gửi kết quả.
    } finally {
      if (clearRequest) chrome.storage.local.remove(TRANSCRIPT365_REQUEST_KEY);
    }
  }

  function restoreNativePlayer() {
    if (!nativeSnapshot) return;
    if (nativeVideo) {
      try {
        if (video && Number.isFinite(video.currentTime)) nativeVideo.currentTime = video.currentTime;
        nativeVideo.style.visibility = nativeSnapshot.visibility;
        nativeVideo.style.display = nativeSnapshot.display;
        nativeVideo.style.opacity = nativeSnapshot.opacity;
        nativeVideo.style.pointerEvents = nativeSnapshot.pointerEvents;
        nativeVideo.style.zIndex = nativeSnapshot.zIndex;
        nativeVideo.removeAttribute("data-tdt-native-subtitle-clock");
        nativeVideo.muted = nativeSnapshot.muted;
        nativeVideo.defaultMuted = nativeSnapshot.defaultMuted;
        nativeVideo.volume = nativeSnapshot.volume;
        nativeVideo.controls = nativeSnapshot.controls;
        nativeVideo.playsInline = nativeSnapshot.playsInline;
        nativeVideo.loop = nativeSnapshot.loop;
        nativeVideo.defaultPlaybackRate = nativeSnapshot.defaultPlaybackRate;
        nativeVideo.playbackRate = nativeSnapshot.playbackRate;
        const allowNativePlayback = !extensionSettings.autoReplace || Boolean(suppressedUrl);
        nativeVideo.autoplay = allowNativePlayback && nativeSnapshot.autoplay;
        if (allowNativePlayback && nativeSnapshot.autoplayAttribute) nativeVideo.setAttribute("autoplay", "");
        else nativeVideo.removeAttribute("autoplay");
        if (nativeSnapshot.paused || !allowNativePlayback || isCurrentVideoManuallyPaused()) nativeVideo.pause();
        else nativeVideo.play().catch(() => {});
      } catch {
        // TikTok có thể đã thay DOM khi chuyển video.
      }
      guardedNativeStates.delete(nativeVideo);
    }
    if (mountElement && nativeSnapshot.mountPosition !== null) mountElement.style.position = nativeSnapshot.mountPosition;
    if (mountElement && nativeSnapshot.mountOverflow !== null) mountElement.style.overflow = nativeSnapshot.mountOverflow;
  }

  function closePlayer({ restoreNative = true } = {}) {
    currentRequestToken += 1;
    void closeTranscript365Worker();
    cleanupSubtitles();
    if (document.fullscreenElement === mediaLayer) {
      try { void document.exitFullscreen(); } catch {}
    }
    clearMediaSession();
    stopNativePlaybackSync();
    stopExternalSubtitleBridge();
    restorePromotedTranslatorPanels();
    restoreForeignCleanUi();
    cancelAutoplaySoundRecovery();
    disconnectAudioEngine(video);
    if (document.pictureInPictureElement === video) {
      try { void document.exitPictureInPicture(); } catch {}
    }
    if (webFullscreenActive) setWebFullscreen(false);
    else {
      document.documentElement.style.overflow = webFullscreenPreviousHtmlOverflow;
      if (document.body) document.body.style.overflow = webFullscreenPreviousBodyOverflow;
      webFullscreenPreviousHtmlOverflow = "";
      webFullscreenPreviousBodyOverflow = "";
    }
    if (video) {
      try {
        video.pause();
        video.muted = true;
        video.volume = 0;
        video.removeAttribute("src");
        video.load();
      } catch {}
    }
    if (portalGeometryFrame) cancelAnimationFrame(portalGeometryFrame);
    portalGeometryFrame = 0;
    portalResizeObserver?.disconnect();
    portalResizeObserver = null;
    playerRootObserver?.disconnect();
    playerRootObserver = null;
    mediaLayer?.removeAttribute("data-tdt-fullscreen-root");
    mediaLayer?.removeAttribute("data-tdt-webfullscreen-root");
    host?.remove();
    mediaLayer?.remove();
    mediaStyle?.remove();
    if (restoreNative) restoreNativePlayer();
    host = null;
    mediaLayer = null;
    mediaStyle = null;
    shadow = null;
    panel = null;
    video = null;
    currentVideoInfo = null;
    watchCurrentSnapshot = null;
    scheduleWatchSave(true);
    currentPageUrl = "";
    currentVideoId = "";
    mountElement = null;
    nativeVideo = null;
    nativeSnapshot = null;
    nativeInitialPlayback = { paused: true, currentTime: 0 };
    nativeAudioBridgeActive = false;
    nativeAudioBridgeFailureCount = 0;
    replacementPlaybackStarted = false;
    restoreNativeActionRail();
    playerLoadStartedAt = 0;
    lockedDetailVideoId = "";
    lockedDetailMount = null;
    mounting = false;
  }

  function formatDuration(secondsValue) {
    const total = Math.max(0, Number(secondsValue) || 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = Math.floor(total % 60);
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function updatePlayerProgress() {
    if (!video) return;
    const duration = Number.isFinite(video.duration) ? Math.max(0, video.duration) : 0;
    const current = Math.max(0, Math.min(duration || Infinity, Number(video.currentTime) || 0));
    if (playerProgressRange && !playerProgressDragging) {
      playerProgressRange.max = String(duration || 0);
      playerProgressRange.value = String(duration ? current : 0);
      playerProgressRange.disabled = !duration;
    }
    const playedPercent = duration > 0 ? Math.max(0, Math.min(100, current / duration * 100)) : 0;
    if (playerProgressPlayed && !playerProgressDragging) playerProgressPlayed.style.width = `${playedPercent}%`;
    if (playerProgressThumb && !playerProgressDragging) playerProgressThumb.style.left = `${playedPercent}%`;
    if (playerProgressBuffered) {
      let bufferedEnd = 0;
      try {
        for (let index = 0; index < video.buffered.length; index += 1) bufferedEnd = Math.max(bufferedEnd, video.buffered.end(index));
      } catch {}
      const bufferedPercent = duration > 0 ? Math.max(0, Math.min(100, bufferedEnd / duration * 100)) : 0;
      playerProgressBuffered.style.width = `${bufferedPercent}%`;
    }
    if (playerCurrentTime && !playerProgressDragging) playerCurrentTime.textContent = formatDuration(current);
    if (playerDuration) playerDuration.textContent = formatDuration(duration);
    if (playerPlayButton) {
      const paused = Boolean(video.paused || video.ended);
      playerPlayButton.innerHTML = playerIcon(paused ? "play" : "pause");
      playerPlayButton.title = paused ? "Phát" : "Tạm dừng";
      playerPlayButton.setAttribute("aria-label", playerPlayButton.title);
    }
  }

  function parseTimestamp(value) {
    const normalized = String(value || "").trim().replace(",", ".");
    const parts = normalized.split(":");
    if (parts.length < 2 || parts.length > 3) return NaN;
    const seconds = Number(parts.pop());
    const minutes = Number(parts.pop());
    const hours = parts.length ? Number(parts.pop()) : 0;
    if (![seconds, minutes, hours].every(Number.isFinite)) return NaN;
    return hours * 3600 + minutes * 60 + seconds;
  }

  function formatVttTimestamp(secondsValue) {
    const totalMs = Math.max(0, Math.round((Number(secondsValue) || 0) * 1000));
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const milliseconds = totalMs % 1000;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
  }

  function srtToVtt(srtText) {
    const normalized = String(srtText || "").replace(/^\uFEFF/, "").replace(/(\d{2}:\d{2}:\d{2}),([0-9]{3})/g, "$1.$2");
    return normalized.trimStart().startsWith("WEBVTT") ? normalized : `WEBVTT\n\n${normalized}`;
  }

  function decodeSubtitleText(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = String(value || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    return textarea.value.replace(/\u200b/g, "").trim();
  }

  function parseVttCues(rawText) {
    const text = srtToVtt(rawText).replace(/\r/g, "");
    const blocks = text.split(/\n{2,}/);
    const cues = [];
    for (const block of blocks) {
      const lines = block.split("\n").map((line) => line.trimEnd());
      const timingIndex = lines.findIndex((line) => line.includes("-->"));
      if (timingIndex < 0) continue;
      const match = lines[timingIndex].match(/((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})/);
      if (!match) continue;
      const start = parseTimestamp(match[1]);
      const end = parseTimestamp(match[2]);
      const cueText = decodeSubtitleText(lines.slice(timingIndex + 1).join("\n"));
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !cueText) continue;
      cues.push({ start, end, text: cueText });
    }
    return cues.sort((a, b) => a.start - b.start);
  }

  function cuesToVtt(cues) {
    const blocks = cues.map((cue, index) => `${index + 1}\n${formatVttTimestamp(cue.start)} --> ${formatVttTimestamp(cue.end)}\n${cue.text}`);
    return `WEBVTT\n\n${blocks.join("\n\n")}`;
  }

  function updateCaptionOverlay() {
    if (!captionOverlay || !video || !subtitlesVisible) {
      if (captionOverlay) captionOverlay.style.display = "none";
      return;
    }
    const activeCueList = subtitleCues.length ? subtitleCues : externalSubtitleCues;
    if (!activeCueList.length) {
      if (!extensionSettings.placeBelowSubtitleTranslator || (!externalSubtitleTranslatedText && !externalSubtitleOriginalText)) {
        setCaptionLines("", "");
        return;
      }
      setCaptionLines(externalSubtitleTranslatedText, externalSubtitleOriginalText);
      return;
    }
    const time = video.currentTime;
    let active = null;
    for (const cue of activeCueList) {
      if (time >= cue.start && time < cue.end) {
        active = cue;
        break;
      }
      if (cue.start > time) break;
    }
    if (!active) {
      setCaptionLines("", "");
      return;
    }
    const lines = String(active.text || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
    setCaptionLines(lines[0] || "", lines.slice(1).join(" "));
  }

  function applySubtitleCues(cues, warningCount = 0) {
    if (!video) throw new Error("Video chưa sẵn sàng.");
    if (!Array.isArray(cues) || !cues.length) throw new Error("Không có dữ liệu phụ đề hợp lệ.");

    cleanupSubtitleMedia();
    subtitleCues = cues;
    subtitlesVisible = true;
    const blob = new Blob([cuesToVtt(cues)], { type: "text/vtt;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    subtitleBlobUrls.push(blobUrl);

    const track = document.createElement("track");
    track.kind = "subtitles";
    track.label = "Tiếng Việt";
    track.srclang = "vi";
    track.src = blobUrl;
    track.default = true;
    track.dataset.tdtSubtitle = "1";
    video.appendChild(track);
    setTimeout(() => {
      try { if (track.track) track.track.mode = "hidden"; } catch {}
    }, 80);

    applyFontSize(subtitleFontSize, false);
    updateCaptionOverlay();
    const warningText = warningCount ? ` · ${warningCount} đoạn giữ nguyên` : "";
    setSubtitleStatus(`${cues.length} đoạn · ${extensionSettings.translateVietnamese ? "VI" : "gốc"}${warningText}`, warningCount ? "loading" : "ok");
    if (subtitleRetryBtn) {
      subtitleRetryBtn.textContent = extensionSettings.translateVietnamese ? "CC Lấy lại & dịch" : "CC Lấy lại sub";
      subtitleRetryBtn.classList.add("subtitle-ready");
    }
    if (controlWidgetSubtitleButton) controlWidgetSubtitleButton.textContent = "Lấy sub";
    if (subtitleToggleBtn) {
      subtitleToggleBtn.dataset.active = "true";
      subtitleToggleBtn.title = "Ẩn phụ đề";
    }
  }

  function currentTikTokVideoId() {
    const nativeScope = nativeVideo?.closest?.('article,[data-e2e="recommend-list-item-container"],[data-e2e="feed-video"],[role="dialog"],section[id^="media-card-"]')
      || mountElement?.closest?.('article,[data-e2e="recommend-list-item-container"],[data-e2e="feed-video"],[role="dialog"],section[id^="media-card-"]')
      || mountElement
      || nativeVideo;
    const nativeId = videoIdFromExtensionDom(nativeScope || document).id;
    if (/^\d{8,}$/.test(nativeId)) return nativeId;
    return currentVideoId || videoIdFromUrl(currentPageUrl) || videoIdFromUrl(effectiveTabVideoUrl());
  }

  function subtitleCacheEntryKey(videoId) {
    return `video:${String(videoId || "")}`;
  }

  function isExpiredSubtitleEntry(entry, now = Date.now()) {
    const updatedAt = Number(entry?.updatedAt) || 0;
    return !updatedAt || now - updatedAt >= SUBTITLE_CACHE_TTL_MS;
  }

  function pruneSubtitleCacheObject(value, now = Date.now()) {
    const source = value && typeof value === "object" ? value : {};
    const fresh = {};
    let changed = false;
    for (const [key, entry] of Object.entries(source)) {
      if (!entry || typeof entry !== "object" || isExpiredSubtitleEntry(entry, now)) {
        changed = true;
        continue;
      }
      fresh[key] = entry;
    }
    return { cache: fresh, changed };
  }

  async function getCachedSubtitle(videoId) {
    if (!extensionSettings.useSubtitleCache || !videoId) return null;
    const stored = await storageGet({ [SUBTITLE_CACHE_KEY]: {} });
    const pruned = pruneSubtitleCacheObject(stored[SUBTITLE_CACHE_KEY]);
    if (pruned.changed) await storageSet({ [SUBTITLE_CACHE_KEY]: pruned.cache });
    const entry = pruned.cache[subtitleCacheEntryKey(videoId)];
    if (!entry || typeof entry !== "object") return null;
    const originalVtt = String(entry.originalVtt || "");
    const translatedVtt = String(entry.translatedVtt || "");
    if (entry.noSub === true) return { ...entry, noSub: true, originalVtt: "", translatedVtt: "" };
    if (parseVttCues(originalVtt).length < 2 && parseVttCues(translatedVtt).length < 2) return null;
    return { ...entry, originalVtt, translatedVtt };
  }

  async function saveCachedSubtitle(videoId, entry) {
    if (!extensionSettings.useSubtitleCache || !videoId || !entry) return;
    const stored = await storageGet({ [SUBTITLE_CACHE_KEY]: {} });
    const { cache: freshCache } = pruneSubtitleCacheObject(stored[SUBTITLE_CACHE_KEY]);
    const cache = { ...freshCache };
    const key = subtitleCacheEntryKey(videoId);
    cache[key] = {
      videoId,
      sourceUrl: currentPageUrl,
      originalVtt: String(entry.originalVtt || ""),
      translatedVtt: String(entry.translatedVtt || ""),
      failedCount: Number(entry.failedCount) || 0,
      noSub: entry.noSub === true,
      noSubReason: String(entry.noSubReason || ""),
      updatedAt: Date.now(),
      expiresAt: Date.now() + SUBTITLE_CACHE_TTL_MS
    };

    const now = Date.now();
    const entries = Object.entries(cache)
      .filter(([, value]) => !isExpiredSubtitleEntry(value, now))
      .sort((a, b) => (Number(b[1]?.updatedAt) || 0) - (Number(a[1]?.updatedAt) || 0));
    const compact = {};
    let totalChars = 0;
    for (const [cacheKey, value] of entries) {
      const size = JSON.stringify(value).length;
      if (Object.keys(compact).length >= SUBTITLE_CACHE_MAX_ENTRIES || totalChars + size > SUBTITLE_CACHE_MAX_CHARS) continue;
      compact[cacheKey] = value;
      totalChars += size;
    }
    await storageSet({ [SUBTITLE_CACHE_KEY]: compact });
  }

  function storageGet(defaults) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(defaults, (result) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message)); else resolve(result);
      });
    });
  }

  function storageSet(values) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(values, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message)); else resolve();
      });
    });
  }

  async function requestTranscript365Data(requestedAt) {
    const request = {
      source: "tdt-tiktok-viewer",
      requestId: `${requestedAt}-${Math.random().toString(36).slice(2, 10)}`,
      pageUrl: currentPageUrl || effectiveTabVideoUrl(),
      videoId: currentTikTokVideoId(),
      requestedAt,
      expiresAt: requestedAt + SUBTITLE_SCAN_TIMEOUT_MS + 30000,
      active: true
    };
    await new Promise((resolve) => chrome.storage.local.remove(TRANSCRIPT365_NO_SUB_KEY, resolve));
    await storageSet({ [TRANSCRIPT365_REQUEST_KEY]: request });
    currentTranscriptRequestId = request.requestId;
    return request;
  }

  function resultMatchesCurrentVideo(result, requestedAt) {
    if (!result || typeof result !== "object" || !result.vtt) return false;
    if (currentTranscriptRequestId && result.requestId && result.requestId !== currentTranscriptRequestId) return false;
    const currentId = currentTikTokVideoId();
    const resultId = String(result.videoId || result.sourceUrl || "").match(/(?:\/video\/|^)(\d{8,})/)?.[1] || "";
    if (currentId && resultId && currentId !== resultId) return false;
    const generatedAt = Number(result.generatedAt) || 0;
    return generatedAt >= requestedAt - 15000;
  }

  async function getTranscriptVttFromTranscript365(requestedAt) {
    if (latestTranscript365Vtt) return latestTranscript365Vtt;
    const stored = await storageGet({ [TRANSCRIPT365_RESULT_KEY]: null });
    const result = stored[TRANSCRIPT365_RESULT_KEY];
    if (!resultMatchesCurrentVideo(result, requestedAt)) return "";
    const cues = parseVttCues(result.vtt);
    if (cues.length < 2) return "";
    const normalized = cuesToVtt(cues);
    const signature = `${cues.length}|${cues[0].start}|${cues[0].text}|${cues.at(-1).text}`;
    if (signature !== latestTranscript365Signature) {
      latestTranscript365Signature = signature;
      latestTranscript365Vtt = normalized;
    }
    return latestTranscript365Vtt;
  }

  function noSubMatchesCurrentVideo(result, requestedAt) {
    if (!result || typeof result !== "object" || result.noSub !== true) return false;
    if (currentTranscriptRequestId && result.requestId && result.requestId !== currentTranscriptRequestId) return false;
    const currentId = currentTikTokVideoId();
    const resultId = String(result.videoId || result.sourceUrl || "").match(/(?:\/video\/|^)(\d{8,})/)?.[1] || "";
    if (currentId && resultId && currentId !== resultId) return false;
    const generatedAt = Number(result.generatedAt) || 0;
    return generatedAt >= requestedAt - 15000;
  }

  async function getTranscriptNoSubFromTranscript365(requestedAt) {
    const stored = await storageGet({ [TRANSCRIPT365_NO_SUB_KEY]: null });
    const result = stored[TRANSCRIPT365_NO_SUB_KEY];
    return noSubMatchesCurrentVideo(result, requestedAt) ? result : null;
  }

  function createNoSubtitleError(reason = "") {
    const error = new Error(reason || "Transcript365 xác nhận video này không có phụ đề.");
    error.code = "TRANSCRIPT365_NO_SUB";
    return error;
  }

  function waitForTranscript365Result(requestedAt, taskToken) {
    return new Promise((resolve, reject) => {
      let finished = false;
      let fallbackTimer = null;
      const finish = (error, value) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutTimer);
        clearInterval(fallbackTimer);
        chrome.storage.onChanged.removeListener(onChanged);
        if (error) reject(error); else resolve(value);
      };
      const check = async () => {
        if (taskToken !== subtitleTaskToken || !video) {
          finish(new Error("Đã hủy lấy phụ đề."));
          return;
        }
        try {
          const noSub = await getTranscriptNoSubFromTranscript365(requestedAt);
          if (noSub) {
            finish(createNoSubtitleError(noSub.reason));
            return;
          }
          const vtt = await getTranscriptVttFromTranscript365(requestedAt);
          if (vtt) finish(null, vtt);
        } catch (error) {
          finish(error);
        }
      };
      const onChanged = (changes, areaName) => {
        if (areaName === "local" && (changes[TRANSCRIPT365_RESULT_KEY] || changes[TRANSCRIPT365_NO_SUB_KEY])) void check();
      };
      const timeoutTimer = setTimeout(() => finish(new Error("Transcript365 chưa trả phụ đề trong thời gian chờ.")), SUBTITLE_SCAN_TIMEOUT_MS);
      chrome.storage.onChanged.addListener(onChanged);
      fallbackTimer = setInterval(check, 1000);
      void check();
    });
  }

  async function translateTranscriptToVietnamese(vttText, taskToken) {
    const originalCues = parseVttCues(vttText);
    if (!originalCues.length) throw new Error("Transcript365 chưa trả về phụ đề có mốc thời gian hợp lệ.");
    setSubtitleStatus(`đang dịch ${originalCues.length} đoạn sang VI…`, "loading");

    const response = await runtimeMessage({
      type: "TRANSLATE_SUBTITLES",
      targetLanguage: "vi",
      texts: originalCues.map((cue) => cue.text)
    });
    if (taskToken !== subtitleTaskToken || !video) return null;
    if (!response?.ok || !Array.isArray(response.translations)) throw new Error(response?.error || "Không thể dịch phụ đề sang tiếng Việt.");

    const translatedCues = originalCues.map((cue, index) => ({
      ...cue,
      text: String(response.translations[index] || cue.text).trim() || cue.text
    }));
    return { cues: translatedCues, failedCount: Number(response.failedCount) || 0 };
  }

  async function autoLoadSubtitles(force = false) {
    if (!video || !panel) return;
    const taskToken = ++subtitleTaskToken;

    if (!extensionSettings.scanSubtitles && !force) {
      await closeTranscript365Worker(true);
      cleanupSubtitleMedia();
      setSubtitleStatus("quét sub đã tắt", "");
      setVideoGate(false);
      startReplacementVideo(false);
      return;
    }

    if (force) {
      cleanupSubtitleMedia();
      latestTranscript365Vtt = "";
      latestTranscript365Signature = "";
    }

    setVideoGate(true, "Đang lấy sub từ từ đã 😺...");
    if (subtitleRetryBtn) {
      subtitleRetryBtn.disabled = true;
      subtitleRetryBtn.textContent = "CC Đang lấy…";
    }
    if (controlWidgetSubtitleButton) {
      controlWidgetSubtitleButton.disabled = true;
      controlWidgetSubtitleButton.textContent = "Đang lấy sub…";
    }

    const videoId = currentTikTokVideoId();
    try {
      if (!force && extensionSettings.useSubtitleCache) {
        setSubtitleStatus("đang kiểm tra sub đã lưu…", "loading");
        const cached = await getCachedSubtitle(videoId);
        if (cached && taskToken === subtitleTaskToken && video) {
          if (cached.noSub === true) {
            cleanupSubtitleMedia();
            setSubtitleStatus("video không có sub · đã nhớ", "");
            setVideoGate(false);
            startReplacementVideo(true);
            showNotice("Video này không có phụ đề trên Transcript365; đã tự bỏ qua.", true);
            return;
          }
          let selectedVtt = extensionSettings.translateVietnamese ? cached.translatedVtt : cached.originalVtt;
          let failedCount = Number(cached.failedCount) || 0;

          if (extensionSettings.translateVietnamese && !selectedVtt && cached.originalVtt) {
            const translated = await translateTranscriptToVietnamese(cached.originalVtt, taskToken);
            if (!translated || taskToken !== subtitleTaskToken || !video) return;
            selectedVtt = cuesToVtt(translated.cues);
            failedCount = translated.failedCount;
            await saveCachedSubtitle(videoId, {
              originalVtt: cached.originalVtt,
              translatedVtt: selectedVtt,
              failedCount
            });
          }

          const cachedCues = parseVttCues(selectedVtt);
          if (cachedCues.length >= 2) {
            applySubtitleCues(cachedCues, extensionSettings.translateVietnamese ? failedCount : 0);
            setSubtitleStatus(`${cachedCues.length} đoạn · ${extensionSettings.translateVietnamese ? "VI" : "gốc"} · đã nhớ`, "ok");
            setVideoGate(false);
            startReplacementVideo(true);
            showNotice("Đã dùng phụ đề đã lưu của video này.", true);
            return;
          }
        }
      }

      setSubtitleStatus("đang mở cửa sổ Transcript365 nền…", "loading");
      await closeTranscript365Worker(false);
      const requestedAt = Date.now();
      const request = await requestTranscript365Data(requestedAt);
      const opened = await runtimeMessage({
        type: "OPEN_TRANSCRIPT365_BACKGROUND",
        pageUrl: request.pageUrl,
        requestId: request.requestId
      });
      if (!opened?.ok || !Number.isInteger(opened.tabId)) throw new Error(opened?.error || "Không thể mở Transcript365 ở cửa sổ nền.");
      currentTranscriptTabId = opened.tabId;
      currentTranscriptWindowId = Number.isInteger(opened.windowId) ? opened.windowId : null;
      setSubtitleStatus("Transcript365 đang xử lý trong cửa sổ nền…", "loading");

      const transcriptVtt = await waitForTranscript365Result(requestedAt, taskToken);
      if (taskToken !== subtitleTaskToken || !video) return;
      if (extensionSettings.autoCloseTranscriptWindow) await closeTranscript365Worker(true);

      let finalCues;
      let translatedVtt = "";
      let failedCount = 0;
      if (extensionSettings.translateVietnamese) {
        const translated = await translateTranscriptToVietnamese(transcriptVtt, taskToken);
        if (!translated || taskToken !== subtitleTaskToken || !video) return;
        finalCues = translated.cues;
        failedCount = translated.failedCount;
        translatedVtt = cuesToVtt(finalCues);
      } else {
        finalCues = parseVttCues(transcriptVtt);
        if (!finalCues.length) throw new Error("Phụ đề Transcript365 không hợp lệ.");
      }

      await saveCachedSubtitle(videoId, {
        originalVtt: transcriptVtt,
        translatedVtt,
        failedCount
      });
      applySubtitleCues(finalCues, extensionSettings.translateVietnamese ? failedCount : 0);
      setVideoGate(false);
      startReplacementVideo(true);
      showNotice(
        extensionSettings.translateVietnamese
          ? (failedCount ? `Đã lấy sub và dịch; ${failedCount} đoạn giữ nguyên.` : `Đã chèn và ghi nhớ ${finalCues.length} đoạn phụ đề tiếng Việt.`)
          : `Đã chèn và ghi nhớ ${finalCues.length} đoạn phụ đề gốc.`,
        failedCount === 0
      );
    } catch (error) {
      await closeTranscript365Worker(true);
      if (taskToken === subtitleTaskToken) {
        if (error?.code === "TRANSCRIPT365_NO_SUB") {
          cleanupSubtitleMedia();
          try { await saveCachedSubtitle(videoId, { noSub: true, noSubReason: error.message }); } catch {}
          setSubtitleStatus("video không có sub · đã bỏ qua", "");
          setVideoGate(false);
          startReplacementVideo(true);
          showNotice("Transcript365 không có sub cho video này; extension đã tự bỏ qua và phát video.", true);
        } else {
          setSubtitleStatus("lỗi lấy/dịch", "error");
          setVideoGate(true, "Chưa lấy được sub 😿 Bấm “CC Lấy lại” để thử lại.");
          showNotice(error.message || "Không thể lấy phụ đề Transcript365.");
        }
      }
    } finally {
      if (taskToken === subtitleTaskToken && subtitleRetryBtn) {
        subtitleRetryBtn.disabled = false;
        if (!subtitleCues.length) subtitleRetryBtn.textContent = "CC Lấy lại";
      }
      if (taskToken === subtitleTaskToken && controlWidgetSubtitleButton) {
        controlWidgetSubtitleButton.disabled = false;
        controlWidgetSubtitleButton.textContent = "Lấy sub";
      }
    }
  }

  function createGate(message) {
    subtitleGate = document.createElement("div");
    subtitleGate.className = "subtitle-gate";
    const gateBox = document.createElement("div");
    gateBox.className = "gate-box";
    const catLoader = document.createElement("div");
    catLoader.className = "cat-loader";
    subtitleGateText = document.createElement("div");
    subtitleGateText.className = "gate-text loading-dots";
    subtitleGateText.textContent = message;
    gateBox.append(catLoader, subtitleGateText);
    subtitleGate.appendChild(gateBox);
    subtitleGate.addEventListener("click", () => {
      if (!playbackUnlockRequired || !video) return;
      const targetVideo = video;
      playbackUnlockRequired = false;
      autoplayMutedFallback = false;
      cancelAutoplaySoundRecovery();
      setVideoGate(false);
      showCenterPlaybackFeedback("play");
      ensureVideoSound();
      applyPlaybackRate(extensionSettings.playbackRate, false);
      const playPromise = targetVideo.play();
      if (extensionSettings.audioEnabled) void ensureAudioEngine(audioStudioTarget(targetVideo));
      playPromise?.then?.(() => {
        if (targetVideo !== video) return;
        notifyPlaybackStarted();
        updateCaptionOverlay();
      }).catch?.(() => {
        if (targetVideo !== video) return;
        playbackUnlockRequired = true;
        setVideoGate(true, "Trình duyệt vẫn đang chặn phát có âm thanh 😿");
      });
    });
    return subtitleGate;
  }

  function isVisibleElement(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 24 && rect.height > 24 && rect.bottom > 0 && rect.top < innerHeight;
  }

  function isReadingComments() {
    const active = document.activeElement;
    if (active instanceof Element && active.closest('[data-e2e*="comment" i],[class*="Comment"],[class*="comment"]')) return true;
    const selectors = [
      '[data-e2e="comment-list"]', '[data-e2e="comment-panel"]', '[data-e2e="browse-comment-list"]',
      '[data-e2e*="comment-container" i]', '[class*="DivCommentList"]', '[class*="CommentPanel"]',
      '[class*="CommentDrawer"]', '[role="dialog"][aria-label*="bình luận" i]', '[role="dialog"][aria-label*="comment" i]'
    ];
    for (const element of document.querySelectorAll(selectors.join(','))) {
      if (!isVisibleElement(element)) continue;
      const rect = element.getBoundingClientRect();
      const hasEditor = Boolean(element.querySelector('textarea,input,[contenteditable="true"]'));
      const hasComments = element.querySelectorAll('[data-e2e*="comment" i],[class*="CommentItem"],[class*="comment-item"]').length > 1;
      if ((rect.width >= 220 && rect.height >= 180) && (hasEditor || hasComments)) return true;
    }
    return false;
  }

  function findCurrentFeedItem() {
    const selector = '[data-e2e="recommend-list-item-container"],[data-e2e="browse-video-container"],[data-e2e="search-card-video-container"],[data-e2e="user-post-item"],article,[class*="DivItemContainer"],[class*="VideoCard"],[class*="DivVideoContainer"]';
    for (const node of [mountElement, nativeVideo, host?.parentElement, video]) {
      const item = node instanceof Element ? node.closest(selector) : null;
      if (item) return item;
    }
    const viewportCenter = innerHeight / 2;
    return [...document.querySelectorAll(selector)]
      .filter((item) => item.querySelector?.('video,[data-e2e*="video" i]'))
      .map((item) => {
        const rect = item.getBoundingClientRect();
        return { item, score: Math.abs((rect.top + rect.bottom) / 2 - viewportCenter), rect };
      })
      .filter((entry) => entry.rect.bottom > 0 && entry.rect.top < innerHeight)
      .sort((a, b) => a.score - b.score)[0]?.item || null;
  }

  function findNextFeedItem(currentItem) {
    const containsVideo = (element) => Boolean(element?.querySelector?.('video,[data-e2e*="video" i],[data-e2e="browse-video"]'));
    if (currentItem) {
      let sibling = currentItem.nextElementSibling;
      for (let count = 0; sibling && count < 14; count += 1, sibling = sibling.nextElementSibling) {
        if (containsVideo(sibling)) return sibling;
      }
    }
    const currentRect = currentItem?.getBoundingClientRect();
    const currentTop = currentRect?.top ?? nativeVideo?.getBoundingClientRect().top ?? 0;
    const currentHeight = Math.max(80, currentRect?.height || nativeVideo?.getBoundingClientRect().height || innerHeight * .55);
    const selector = '[data-e2e="recommend-list-item-container"],[data-e2e="browse-video-container"],[data-e2e="search-card-video-container"],[data-e2e="user-post-item"],article,[class*="DivItemContainer"],[class*="VideoCard"],[class*="DivVideoContainer"]';
    return [...document.querySelectorAll(selector)]
      .filter((item) => item !== currentItem && containsVideo(item))
      .map((item) => ({ item, top: item.getBoundingClientRect().top }))
      .filter((entry) => entry.top > currentTop + Math.min(120, currentHeight * .22))
      .sort((a, b) => a.top - b.top)[0]?.item || null;
  }

  function isScrollableVertical(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const style = getComputedStyle(element);
    return /(auto|scroll|overlay)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 80;
  }

  function collectVideoScrollTargets(currentItem) {
    const targets = [];
    const add = (target) => {
      if (!target || targets.includes(target)) return;
      targets.push(target);
    };
    for (const origin of [currentItem, mountElement, nativeVideo, host?.parentElement]) {
      let node = origin instanceof Element ? origin : null;
      for (let depth = 0; node && depth < 14; depth += 1, node = node.parentElement) {
        if (isScrollableVertical(node)) add(node);
      }
    }
    const centerX = Math.round(innerWidth / 2);
    const centerY = Math.round(innerHeight / 2);
    for (const element of document.elementsFromPoint?.(centerX, centerY) || []) {
      let node = element;
      for (let depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
        if (isScrollableVertical(node)) add(node);
      }
    }
    [...document.querySelectorAll('main,[role="main"],[class*="Scroll"],[class*="scroll"],[class*="Feed"],[class*="feed"]')]
      .filter(isScrollableVertical)
      .sort((a, b) => (b.clientHeight * b.clientWidth) - (a.clientHeight * a.clientWidth))
      .slice(0, 8)
      .forEach(add);
    add(document.scrollingElement || document.documentElement);
    return targets;
  }

  function scrollTargetDown(target, distance, behavior = "smooth") {
    if (!target) return false;
    try {
      if (target === document.scrollingElement || target === document.documentElement || target === document.body) {
        window.scrollBy({ top: distance, left: 0, behavior });
      } else if (typeof target.scrollBy === "function") {
        target.scrollBy({ top: distance, left: 0, behavior });
      } else {
        target.scrollTop += distance;
      }
      return true;
    } catch (_error) {
      try { target.scrollTop += distance; return true; } catch { return false; }
    }
  }

  function clickTikTokNextButton() {
    const selectors = [
      'button[data-e2e*="arrow-down" i]', 'button[data-e2e*="next-video" i]', 'button[data-e2e*="next" i]',
      'button[aria-label*="next video" i]', 'button[aria-label*="video tiếp" i]', 'button[aria-label*="tiếp theo" i]',
      'button[aria-label*="xuống" i]', '[role="button"][aria-label*="next video" i]', '[role="button"][aria-label*="tiếp theo" i]'
    ];
    for (const button of document.querySelectorAll(selectors.join(','))) {
      if (!isVisibleElement(button) || button.disabled) continue;
      const rect = button.getBoundingClientRect();
      if (rect.width > 110 || rect.height > 110) continue;
      try { button.click(); return true; } catch {}
    }
    return false;
  }

  function dispatchNextVideoInput(distance) {
    const target = document.activeElement instanceof Element ? document.activeElement : document.body;
    const wheelOptions = { bubbles: true, cancelable: true, deltaY: distance, deltaMode: WheelEvent.DOM_DELTA_PIXEL };
    try { target?.dispatchEvent(new WheelEvent("wheel", wheelOptions)); } catch {}
    try { document.dispatchEvent(new WheelEvent("wheel", wheelOptions)); } catch {}
    try { window.dispatchEvent(new WheelEvent("wheel", wheelOptions)); } catch {}
    const keyboardOptions = { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, bubbles: true, cancelable: true };
    try { target?.dispatchEvent(new KeyboardEvent("keydown", keyboardOptions)); } catch {}
    try { document.dispatchEvent(new KeyboardEvent("keydown", keyboardOptions)); } catch {}
    try { window.dispatchEvent(new KeyboardEvent("keydown", keyboardOptions)); } catch {}
  }

  function feedPositionSignature(currentItem) {
    const rect = currentItem?.getBoundingClientRect();
    return [
      currentTikTokVideoId(),
      normalizeTikTokVideoUrl(location.href),
      Math.round(rect?.top || 0),
      Math.round((document.scrollingElement || document.documentElement)?.scrollTop || 0)
    ].join('|');
  }

  async function autoScrollToNextVideo() {
    if (!extensionSettings.autoScrollEnabled || autoScrollInFlight || Date.now() - lastAutoScrollAt < 1000) return;
    if (isReadingComments()) {
      showNotice("Đã bỏ qua tự cuộn vì bảng bình luận đang mở.", true);
      return;
    }
    autoScrollInFlight = true;
    lastAutoScrollAt = Date.now();
    try {
      const currentItem = findCurrentFeedItem();
      const before = feedPositionSignature(currentItem);
      const nextItem = findNextFeedItem(currentItem);
      const distance = Math.max(
        Math.round(innerHeight * .82),
        Math.round(currentItem?.getBoundingClientRect().height || 0),
        560
      );
      closeWatchModal();

      if (nextItem) {
        try { nextItem.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" }); } catch {}
      }

      const targets = collectVideoScrollTargets(currentItem);
      if (!nextItem) {
        for (const target of targets.slice(0, 3)) scrollTargetDown(target, distance, "smooth");
      }
      dispatchNextVideoInput(distance);
      showNotice("Đang chuyển sang video tiếp theo…", true);

      await new Promise((resolve) => setTimeout(resolve, 420));
      let moved = feedPositionSignature(findCurrentFeedItem()) !== before;
      if (!moved) {
        moved = clickTikTokNextButton();
        if (!moved) {
          for (const target of targets) {
            const previousTop = Number(target.scrollTop) || 0;
            scrollTargetDown(target, distance, "auto");
            if (Math.abs((Number(target.scrollTop) || 0) - previousTop) > 20) { moved = true; break; }
          }
        }
      }
      if (!moved) {
        dispatchNextVideoInput(Math.max(distance, innerHeight));
        try { window.scrollBy(0, Math.max(distance, innerHeight)); } catch {}
      }

      setTimeout(() => {
        evaluatePlayerLifecycle();
        scheduleLifecycleScan(60);
        scheduleLifecycleScan(320);
        scheduleLifecycleScan(900);
      }, 360);
    } finally {
      setTimeout(() => { autoScrollInFlight = false; }, 1100);
    }
  }

  function maybeAutoScrollAtVideoEnd() {
    if (!extensionSettings.autoScrollEnabled || !video || video.seeking) return;
    const duration = Number(video.duration);
    const currentTime = Number(video.currentTime);
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(currentTime)) return;
    if (duration - currentTime > .35) return;
    const signature = `${currentTikTokVideoId()}|${String(video.currentSrc || video.src || "")}|${Math.round(duration * 10)}`;
    if (autoScrollEndSignature === signature) return;
    autoScrollEndSignature = signature;
    void autoScrollToNextVideo();
  }

  function createPanel() {
    if (!shadow) return;
    const style = document.createElement("style");
    style.textContent = PLAYER_CSS;
    shadow.appendChild(style);

    panel = document.createElement("section");
    panel.id = "panel";
    panel.dataset.videoShape = "portrait";
    panel.dataset.controlDensity = "regular";
    const loadingWrap = document.createElement("div");
    loadingWrap.className = "video-wrap";
    loadingWrap.appendChild(createGate("Đang lấy video không watermark…"));
    panel.appendChild(loadingWrap);
    shadow.appendChild(panel);
  }

  async function downloadVideoInfo(info, button) {
    const initialHtml = button?.innerHTML || "";
    const initialText = button?.textContent || "";
    if (button) {
      button.disabled = true;
      button.textContent = button.classList?.contains("hd-download-widget") ? "…" : "Đang lấy HD…";
    }
    try {
      let downloadableInfo = info;
      if (!downloadableInfo?.downloadable || !/^https:\/\//i.test(String(downloadableInfo?.videoUrl || ""))) {
        const exactUrl = await refreshCurrentTabUrl(true) || currentPageUrl;
        const response = await runtimeMessage({ type: "GET_VIDEO_INFO", url: exactUrl, force: false });
        if (!response?.ok || !response.data?.videoUrl) throw new Error(response?.error || "Chưa lấy được link HD.");
        downloadableInfo = response.data;
        currentVideoInfo = response.data;
        rememberPageVideoInfo(exactUrl, response.data);
      }
      const response = await runtimeMessage({
        type: "DOWNLOAD_VIDEO",
        videoUrl: downloadableInfo.videoUrl,
        filename: downloadableInfo.title || `tiktok-${currentTikTokVideoId() || Date.now()}`
      });
      if (!response?.ok) throw new Error(response?.error || "Không thể tải video.");
      showNotice("Đã mở hộp thoại lưu video HD.", true);
    } catch (error) {
      showNotice(error.message || "Không thể tải video HD.");
      updateControlWidgetStatus(error.message || "Lỗi tải video HD.", "error");
    } finally {
      if (button) {
        button.disabled = false;
        if (initialHtml) button.innerHTML = initialHtml;
        else button.textContent = initialText;
      }
    }
  }

  async function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Không thể tạo ảnh PNG.")), "image/png", 1);
    });
  }

  async function copyCurrentFrameToClipboard() {
    if (!video || !host?.isConnected) throw new Error("Chưa có video thay thế để chụp.");

    const captureFrame = async (sourceVideo) => {
      if (!sourceVideo || sourceVideo.videoWidth <= 0 || sourceVideo.videoHeight <= 0) throw new Error("Video chưa sẵn sàng để chụp frame.");
      const canvas = document.createElement("canvas");
      canvas.width = sourceVideo.videoWidth;
      canvas.height = sourceVideo.videoHeight;
      const context = canvas.getContext("2d", { alpha: false, willReadFrequently: false });
      if (!context) throw new Error("Không tạo được canvas chụp frame.");
      context.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
      return canvasBlob(canvas);
    };

    const deliverFrame = async (blob) => {
      if ("clipboard" in navigator && typeof ClipboardItem !== "undefined") {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          showNotice("Đã copy khung hình vào clipboard 📸", true);
          return;
        } catch {}
      }
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `tiktok-frame-${currentTikTokVideoId() || Date.now()}-${Math.max(0, Math.round((video?.currentTime || 0) * 1000))}ms.png`;
      link.style.display = "none";
      document.documentElement.appendChild(link);
      try {
        link.click();
        showNotice("Đã lưu khung hình PNG 📸", true);
      } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      }
    };

    try {
      const blob = await captureFrame(video);
      await deliverFrame(blob);
      return;
    } catch {}

    const cleanVideo = document.createElement("video");
    cleanVideo.crossOrigin = "anonymous";
    cleanVideo.muted = true;
    cleanVideo.playsInline = true;
    cleanVideo.preload = "auto";
    cleanVideo.src = String(currentVideoInfo?.videoUrl || video.currentSrc || video.src || "");
    cleanVideo.style.display = "none";
    panel?.appendChild(cleanVideo);

    try {
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error("Video lấy frame quá thời gian.")), 10000);
        cleanVideo.addEventListener("loadedmetadata", () => {
          clearTimeout(timeoutId);
          resolve();
        }, { once: true });
        cleanVideo.addEventListener("error", () => {
          clearTimeout(timeoutId);
          reject(new Error("Không thể mở nguồn video để chụp frame."));
        }, { once: true });
        try { cleanVideo.load(); } catch {}
      });

      const duration = Number.isFinite(cleanVideo.duration) ? cleanVideo.duration : Number.MAX_SAFE_INTEGER;
      const targetTime = Math.max(0, Math.min(Number(video.currentTime) || 0, duration));
      if (Math.abs((cleanVideo.currentTime || 0) - targetTime) > 0.03) {
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => reject(new Error("Không thể tua tới keyframe cần chụp.")), 10000);
          cleanVideo.addEventListener("seeked", () => {
            clearTimeout(timeoutId);
            resolve();
          }, { once: true });
          cleanVideo.addEventListener("error", () => {
            clearTimeout(timeoutId);
            reject(new Error("Không thể tua video để chụp frame."));
          }, { once: true });
          try { cleanVideo.currentTime = targetTime; } catch (error) { clearTimeout(timeoutId); reject(error); }
        });
      }

      const blob = await captureFrame(cleanVideo);
      await deliverFrame(blob);
    } catch {
      throw new Error("Không thể chụp keyframe sạch từ nguồn video này.");
    } finally {
      cleanVideo.remove();
    }
  }



  function parseNestedProductJson(value) {
    if (typeof value !== "string") return null;
    const text = value.trim();
    if ((!text.startsWith("{") && !text.startsWith("[")) || !/(?:product_id|productId|anchor_shop|TikTok Shop)/i.test(text)) return null;
    try {
      const precisionSafe = text.replace(/("(?:product_id|productId|seller_id|sellerId|sku_id|skuId|material_id|addition_id)"\s*:\s*)(\d{16,})(?=\s*[,}])/g, '$1"$2"');
      return JSON.parse(precisionSafe);
    } catch { return null; }
  }

  function findCurrentVideoData(root, videoId) {
    if (!root || typeof root !== "object" || !videoId) return null;
    const seen = new WeakSet();
    const stack = [root];
    let walked = 0;
    while (stack.length && walked < PRODUCT_SCAN_MAX_NODES) {
      const value = stack.pop();
      if (!value || typeof value !== "object" || seen.has(value)) continue;
      seen.add(value);
      walked += 1;
      const id = String(value.id ?? value.itemId ?? value.item_id ?? value.awemeId ?? value.aweme_id ?? "");
      if (id === videoId && (Array.isArray(value.anchors) || value.isECVideo || value.AnchorTypes)) return value;
      for (const child of Object.values(value)) if (child && typeof child === "object") stack.push(child);
    }
    return null;
  }

  function normalizeProductRecord(value, fallback = {}) {
    if (!value || typeof value !== "object") return null;
    const id = String(value.product_id ?? value.productId ?? (value.type === 33 ? value.id : "") ?? fallback.id ?? "");
    const title = String(value.title ?? value.product_title ?? value.name ?? value.elastic_title ?? fallback.title ?? "").trim();
    if (!id || !title) return null;
    const region = String(document.documentElement.lang || "").split("-")[1]?.toLowerCase()
      || String(document.querySelector('#__UNIVERSAL_DATA_FOR_REHYDRATION__')?.textContent || "").match(/"region":"([A-Z]{2})"/)?.[1]?.toLowerCase() || "th";
    const images = [value.cover_url, value.coverUrl, value.image, value.thumbnail, ...(Array.isArray(value.img_url) ? value.img_url : []), ...(Array.isArray(value.images) ? value.images : [])].filter(Boolean);
    const rawPrice = Number(value.price ?? value.sale_price ?? value.market_price ?? 0);
    const currency = String(value.currency ?? fallback.currency ?? "").trim();
    const priceText = String(value.priceText ?? fallback.priceText ?? "").trim() || (rawPrice > 0 ? `${currency} ${rawPrice}`.trim() : "");
    const directUrl = String(value.seo_url ?? value.seoUrl ?? value.product_url ?? value.productUrl ?? value.final_url ?? fallback.url ?? "");
    return { id, title, image:String(images[0] || fallback.image || ""), priceText,
      sellerId:String(value.seller_id ?? value.sellerId ?? fallback.sellerId ?? ""), soldText:String(value.soldText ?? fallback.soldText ?? ""),
      shopName:String(value.shopName ?? value.seller_name ?? fallback.shopName ?? ""),
      category:Array.isArray(value.categories) ? value.categories.map((item) => item?.category_name).filter(Boolean).join(" › ") : "",
      skuCount:Array.isArray(value.skus) ? value.skus.length : 0,
      url:/^https:\/\//i.test(directUrl) ? directUrl : `https://www.tiktok.com/shop/${region}/pdp/${id}?source=anchor` };
  }

  function collectProductsFromData(root) {
    const products = [];
    const seenObjects = new WeakSet();
    const stack = [root];
    let walked = 0;
    while (stack.length && walked < PRODUCT_SCAN_MAX_NODES && products.length < PRODUCT_SCAN_MAX_ITEMS) {
      const value = stack.pop();
      const parsed = parseNestedProductJson(value);
      if (parsed) { stack.push(parsed); continue; }
      if (!value || typeof value !== "object" || seenObjects.has(value)) continue;
      seenObjects.add(value);
      walked += 1;
      const record = normalizeProductRecord(value);
      if (record && ("product_id" in value || "productId" in value || value.type === 33)) products.push(record);
      for (const child of Object.values(value)) if (child && (typeof child === "object" || typeof child === "string")) stack.push(child);
    }
    return products;
  }

  function productsFromDom() {
    const products = [];
    const anchors = new Set();
    const activeScope = mountElement?.closest?.('[role="dialog"],article,[data-e2e="feed-video"],[data-e2e="browse-video"]') || mountElement || document;
    ['a[href*="/shop/"][href*="/pdp/"]','a[href*="product_id"]'].forEach((selector) => activeScope.querySelectorAll?.(selector).forEach((node) => anchors.add(node)));
    for (const anchor of anchors) {
      const href = String(anchor.href || "");
      const id = href.match(/\/pdp\/(\d+)/)?.[1] || "";
      if (!id) continue;
      const scope = anchor.closest('[class*="Product" i],[data-e2e*="product" i],[data-e2e*="anchor" i]') || anchor.parentElement;
      const image = scope?.querySelector?.("img")?.currentSrc || scope?.querySelector?.("img")?.src || "";
      const lines = String(scope?.innerText || "").split("\n").map((line) => line.trim()).filter(Boolean);
      const priceText = lines.find((line) => /(?:THB|VND|USD|₫|฿|\$)\s*[\d.,]+|[\d.,]+\s*(?:THB|VND|USD|₫|฿)/i.test(line)) || "";
      const soldText = lines.find((line) => /(?:sold|đã bán|ขายแล้ว)/i.test(line)) || "";
      const title = lines.find((line) => line.length > 5 && line !== priceText && !/(?:open on|mua ngay|shop now|product info)/i.test(line)) || anchor.title || `Sản phẩm ${id}`;
      const record = normalizeProductRecord({ product_id:id, title, cover_url:image, priceText, soldText, product_url:href });
      if (record) products.push(record);
    }
    return products;
  }

  function scanCurrentVideoProducts() {
    if (!extensionSettings.productWidgetEnabled || !productWidget) return [];
    const products = [];
    const videoId = currentTikTokVideoId();
    const now = Date.now();
    const cached = productInfoCache.get(videoId);
    const cacheTtl = cached?.products?.length ? 300000 : 15000;
    if (cached && now - cached.updatedAt < cacheTtl) products.push(...cached.products);
    else {
      const hydration = document.getElementById("__UNIVERSAL_DATA_FOR_REHYDRATION__");
      const hydrationProducts = [];
      if (hydration?.textContent) try {
        const data = JSON.parse(hydration.textContent);
        hydrationProducts.push(...collectProductsFromData(findCurrentVideoData(data, videoId) || {}));
      } catch {}
      cacheProductInfo(videoId, { products:hydrationProducts, updatedAt:now });
      products.push(...hydrationProducts);
    }
    if (!products.length && videoId) window.postMessage({ source:PRODUCT_REQUEST_SOURCE, type:"request-products", videoId }, "*");
    if (now - lastProductDomScanAt > 1200) {
      lastProductDomScanAt = now;
      latestDomProductScan = { videoId, products:productsFromDom() };
    }
    if (latestDomProductScan.videoId === videoId) {
      const anchoredIds = new Set(products.map((product) => product.id));
      products.push(...latestDomProductScan.products.filter((product) => !anchoredIds.size || anchoredIds.has(product.id)));
    }
    const merged = new Map();
    for (const product of products) {
      const old = merged.get(product.id) || {};
      merged.set(product.id, { ...old, ...product, image:product.image || old.image || "", priceText:product.priceText || old.priceText || "", soldText:product.soldText || old.soldText || "", shopName:product.shopName || old.shopName || "" });
    }
    const result = Array.from(merged.values());
    renderProductWidget(result);
    updateWatchCurrentProducts(result);
    return result;
  }

  function renderProductWidget(products) {
    if (!productWidget || !productWidgetPanel || !productWidgetButton) return;
    const signature = JSON.stringify(products.map((item) => [item.id,item.title,item.priceText,item.image]));
    if (signature === productScanSignature) return;
    productScanSignature = signature;
    if (products.length > 0) chrome.runtime.sendMessage({ type: "REMOTE_USAGE_EVENT", counter: "productDetections", amount: products.length }).catch(() => {});
    productWidget.dataset.hasProducts = String(products.length > 0 && extensionSettings.productWidgetEnabled);
    productWidgetButton.querySelector(".product-widget-title-track").textContent = products.length === 1 ? products[0].title : `${products.length} sản phẩm trong video`;
    const head = productWidgetPanel.querySelector(".product-widget-head");
    productWidgetPanel.replaceChildren(head);
    for (const product of products) {
      const item = document.createElement("article"); item.className = "product-item";
      const imageWrap = document.createElement("div"); imageWrap.className = "product-image-wrap";
      const image = document.createElement("img"); image.className = "product-image"; image.alt = product.title || "Ảnh sản phẩm"; if (product.image) image.src = product.image;
      const search1688 = document.createElement("button"); search1688.type = "button"; search1688.className = "product-search-1688"; search1688.textContent = "1688"; search1688.title = "Tìm ảnh sản phẩm này trên 1688"; search1688.setAttribute("aria-label", "Tìm ảnh sản phẩm này trên 1688");
      search1688.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); document.dispatchEvent(new CustomEvent("tdt-1688-search-request", { detail: { kind:"image", imageUrl:product.image || image.currentSrc || image.src || "", sourceKind:"scanned-tiktokshop-product" } })); });
      imageWrap.append(image, search1688);
      const info = document.createElement("div");
      const name = document.createElement("div"); name.className = "product-name"; name.textContent = product.title; info.appendChild(name);
      if (product.priceText) { const price = document.createElement("div"); price.className = "product-price"; price.textContent = product.priceText; info.appendChild(price); }
      const details = [product.shopName,product.soldText,product.sellerId ? `Seller ID: ${product.sellerId}` : "",product.skuCount ? `${product.skuCount} SKU` : "",product.category].filter(Boolean);
      if (details.length) { const meta = document.createElement("div"); meta.className = "product-meta"; meta.textContent = details.join(" · "); info.appendChild(meta); }
      const link = document.createElement("a"); link.className = "product-open"; link.href = product.url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "Mở trên TikTok Shop"; link.addEventListener("click", (event) => event.stopPropagation()); info.appendChild(link);
      item.append(imageWrap, info); productWidgetPanel.appendChild(item);
    }
  }

  function createProductWidget() {
    const root = document.createElement("div"); root.className = "product-widget"; root.dataset.hasProducts = "false";
    const button = document.createElement("button"); button.type = "button"; button.className = "product-widget-button"; button.title = "Xem sản phẩm trong video"; button.setAttribute("aria-label", "Xem sản phẩm trong video"); button.innerHTML = `<i class="product-cart-icon">${playerIcon("cart")}</i><span class="product-widget-title-window"><span class="product-widget-title-track">Sản phẩm trong video</span></span>`;
    const productPanel = document.createElement("section"); productPanel.className = "product-widget-panel"; productPanel.hidden = true;
    const head = document.createElement("header"); head.className = "product-widget-head";
    const title = document.createElement("span"); title.textContent = "Thông tin sản phẩm";
    const close = document.createElement("button"); close.type = "button"; close.className = "product-widget-close"; close.textContent = "×";
    head.append(title, close); productPanel.appendChild(head);
    button.addEventListener("click", (event) => { event.stopPropagation(); productPanel.hidden = !productPanel.hidden; });
    button.addEventListener("mouseenter", () => {
      setTimeout(() => {
        const viewport = button.querySelector(".product-widget-title-window");
        const track = button.querySelector(".product-widget-title-track");
        if (!viewport || !track) return;
        const distance = Math.max(0, track.scrollWidth - viewport.clientWidth);
        button.dataset.marquee = String(distance > 3);
        button.style.setProperty("--product-marquee-distance", `${-distance}px`);
        button.style.setProperty("--product-marquee-duration", `${Math.max(4.5,Math.min(10,3.5 + distance / 35))}s`);
      }, 300);
    });
    button.addEventListener("mouseleave", () => { button.dataset.marquee = "false"; });
    close.addEventListener("click", (event) => { event.stopPropagation(); productPanel.hidden = true; });
    root.append(productPanel, button); productWidget = root; productWidgetPanel = productPanel; productWidgetButton = button;
    return root;
  }

  function buildToolbar(info) {
    // Keep every power feature from v3.0, but move the standard playback
    // controls into the TikTok-style bottom bar. This compact dock is only for
    // extension-specific tools that are not present in the reference UI.
    const dock = document.createElement("div");
    dock.className = "control-dock";

    function makeButton(icon, title, onClick) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "player-icon-btn";
      button.title = title;
      button.setAttribute("aria-label", title);
      button.innerHTML = playerIcon(icon);
      button.addEventListener("click", onClick);
      return button;
    }

    subtitleToggleBtn = makeButton("captions", "Bật/tắt phụ đề", () => {
      if (!subtitleCues.length && extensionSettings.placeBelowSubtitleTranslator) {
        subtitlesVisible = !subtitlesVisible;
        subtitleToggleBtn.dataset.active = String(subtitlesVisible);
        subtitleToggleBtn.title = subtitlesVisible ? "Ẩn phụ đề" : "Hiện phụ đề";
        refreshExternalSubtitleText();
        updateCaptionOverlay();
        return;
      }
      if (!subtitleCues.length) {
        if (!extensionSettings.scanSubtitles) {
          extensionSettings = { ...extensionSettings, scanSubtitles: true };
          chrome.storage.local.set({ [SETTINGS_KEY]: extensionSettings });
          syncControlWidgetSettings();
        }
        autoLoadSubtitles(true);
        return;
      }
      subtitlesVisible = !subtitlesVisible;
      subtitleToggleBtn.dataset.active = String(subtitlesVisible);
      subtitleToggleBtn.title = subtitlesVisible ? "Ẩn phụ đề" : "Hiện phụ đề";
      updateCaptionOverlay();
    });
    subtitleToggleBtn.dataset.active = "true";

    const refreshBtn = makeButton("refresh", "Quét và tải lại video", async () => {
      refreshBtn.disabled = true;
      try {
        await refreshCurrentTabUrl(true);
        await loadVideo(true, effectiveTabVideoUrl() || currentPageUrl, true);
      } finally {
        refreshBtn.disabled = false;
      }
    });

    const search1688Btn = makeButton("imageSearch", "Tìm khung hình trên 1688 · phím F", (event) => {
      event.stopPropagation();
      document.dispatchEvent(new CustomEvent("tdt-1688-search-request", { detail: { kind:"video", sourceKind:"player-control" } }));
    });
    search1688Btn.classList.add("tdt-1688-control-button");

    const infoBtn = makeButton("info", "Video Info · phím I", () => showVideoInfo(infoBtn));
    playerInfoButton = infoBtn;

    dock.append(subtitleToggleBtn, refreshBtn, search1688Btn, infoBtn);
    return dock;
  }

  async function togglePictureInPicture() {
    if (!video?.isConnected) return;
    if (!document.pictureInPictureEnabled || typeof video.requestPictureInPicture !== "function") {
      showNotice("Trình duyệt này chưa hỗ trợ cửa sổ nổi PiP.");
      return;
    }
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch (error) {
      showNotice(error?.message || "Không thể mở cửa sổ nổi PiP.");
    }
  }

  function setWebFullscreen(enabled) {
    if (!mediaLayer?.isConnected || !host?.isConnected || !mountElement?.isConnected) return false;
    const next = Boolean(enabled);
    if (next === webFullscreenActive) {
      if (playerWebFullscreenButton) playerWebFullscreenButton.dataset.active = String(next);
      return true;
    }
    webFullscreenActive = next;
    if (next) {
      webFullscreenPreviousHtmlOverflow = document.documentElement.style.overflow || "";
      webFullscreenPreviousBodyOverflow = document.body?.style?.overflow || "";
      document.documentElement.style.setProperty("overflow", "hidden", "important");
      document.body?.style?.setProperty("overflow", "hidden", "important");
      mediaLayer.setAttribute("data-tdt-webfullscreen-root", "true");
      if (host.parentNode !== mediaLayer) mediaLayer.appendChild(host);
    } else {
      mediaLayer.removeAttribute("data-tdt-webfullscreen-root");
      document.documentElement.style.overflow = webFullscreenPreviousHtmlOverflow;
      if (document.body) document.body.style.overflow = webFullscreenPreviousBodyOverflow;
      webFullscreenPreviousHtmlOverflow = "";
      webFullscreenPreviousBodyOverflow = "";
      if (!document.fullscreenElement && host.parentNode !== mountElement) mountElement.appendChild(host);
    }
    if (playerWebFullscreenButton) playerWebFullscreenButton.dataset.active = String(next);
    requestAnimationFrame(() => updatePortalGeometry());
    return true;
  }

  async function toggleWebFullscreen() {
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    }
    setWebFullscreen(!webFullscreenActive);
  }

  function buildTargetControlBar(info) {
    const root = document.createElement("div");
    root.className = "tpt-ctrlbar";

    const seek = document.createElement("div");
    seek.className = "tpt-cb-seek";
    playerProgressBuffered = document.createElement("div");
    playerProgressBuffered.className = "tpt-cb-buf";
    playerProgressPlayed = document.createElement("div");
    playerProgressPlayed.className = "tpt-cb-played";
    playerProgressThumb = document.createElement("div");
    playerProgressThumb.className = "tpt-cb-thumb";
    playerProgressTip = document.createElement("div");
    playerProgressTip.className = "tpt-cb-tip";
    playerProgressTipTime = document.createElement("span");
    playerProgressTipTime.className = "tpt-cb-tiptime";
    playerProgressTip.appendChild(playerProgressTipTime);

    playerProgressRange = document.createElement("input");
    playerProgressRange.type = "range";
    playerProgressRange.className = "tpt-cb-seekinput";
    playerProgressRange.min = "0";
    playerProgressRange.max = "0";
    playerProgressRange.step = "0.05";
    playerProgressRange.value = "0";
    playerProgressRange.disabled = true;
    playerProgressRange.setAttribute("aria-label", "Tiến trình video");
    playerProgressRange.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      playerProgressDragging = true;
    });
    playerProgressRange.addEventListener("input", (event) => {
      event.stopPropagation();
      playerProgressDragging = true;
      const value = Number(playerProgressRange.value) || 0;
      const duration = Number(playerProgressRange.max) || 0;
      const percent = duration > 0 ? Math.max(0, Math.min(100, value / duration * 100)) : 0;
      if (playerCurrentTime) playerCurrentTime.textContent = formatDuration(value);
      if (playerProgressPlayed) playerProgressPlayed.style.width = `${percent}%`;
      if (playerProgressThumb) playerProgressThumb.style.left = `${percent}%`;
    });
    const commitSeek = (event) => {
      event?.stopPropagation?.();
      if (video && Number.isFinite(video.duration)) {
        const nextTime = Math.max(0, Math.min(video.duration, Number(playerProgressRange.value) || 0));
        try { video.currentTime = nextTime; } catch {}
      }
      playerProgressDragging = false;
      updatePlayerProgress();
      updateCaptionOverlay();
    };
    playerProgressRange.addEventListener("change", commitSeek);
    playerProgressRange.addEventListener("pointerup", commitSeek);
    playerProgressRange.addEventListener("pointercancel", () => { playerProgressDragging = false; updatePlayerProgress(); });
    playerProgressRange.addEventListener("keydown", (event) => event.stopPropagation());
    seek.addEventListener("pointermove", (event) => {
      const rect = seek.getBoundingClientRect();
      if (!rect.width) return;
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const duration = Number.isFinite(video?.duration) ? Math.max(0, video.duration) : Number(info?.duration) || 0;
      if (playerProgressTip) playerProgressTip.style.left = `${ratio * 100}%`;
      if (playerProgressTipTime) playerProgressTipTime.textContent = formatDuration(duration * ratio);
    });
    seek.append(playerProgressBuffered, playerProgressPlayed, playerProgressThumb, playerProgressTip, playerProgressRange);

    const row = document.createElement("div");
    row.className = "tpt-cb-row";
    const makeButton = (className, title, iconName, handler) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tpt-cb-btn ${className}`;
      button.title = title;
      button.setAttribute("aria-label", title);
      button.innerHTML = playerIcon(iconName);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        handler?.(event);
      });
      return button;
    };

    playerPlayButton = makeButton("tpt-cb-play", "Phát", "play", () => toggleReplacementPlayback());
    const time = document.createElement("span");
    time.className = "tpt-cb-time";
    playerCurrentTime = document.createElement("span");
    playerCurrentTime.textContent = "0:00";
    const separator = document.createElement("span");
    separator.className = "tpt-cb-sep";
    separator.textContent = "/";
    playerDuration = document.createElement("span");
    playerDuration.textContent = formatDuration(info?.duration || 0);
    time.append(playerCurrentTime, separator, playerDuration);
    const spacer = document.createElement("span");
    spacer.className = "tpt-cb-spacer";

    const volumeWrap = document.createElement("div");
    volumeWrap.className = "tpt-cb-vol";
    playerVolumeButton = makeButton("tpt-cb-mute", "Âm lượng", "volume", () => {
      if (autoplayMutedFallback) {
        unlockAutoplaySound();
        return;
      }
      const currentVolume = clampPlaybackVolume(extensionSettings.playbackVolume);
      const rememberedVolume = Number(playerVolumeButton.dataset.lastVolume || 1);
      if (currentVolume > 0) {
        playerVolumeButton.dataset.lastVolume = String(currentVolume);
        applyPlaybackVolume(0, true);
      } else {
        applyPlaybackVolume(rememberedVolume > 0 ? rememberedVolume : 1, true);
      }
    });
    playerVolumeRange = document.createElement("input");
    playerVolumeRange.type = "range";
    playerVolumeRange.className = "tpt-cb-volslider";
    playerVolumeRange.min = "0";
    playerVolumeRange.max = "100";
    playerVolumeRange.step = "1";
    playerVolumeRange.value = String(Math.round(extensionSettings.playbackVolume * 100));
    playerVolumeRange.title = "Âm lượng";
    playerVolumeRange.setAttribute("aria-label", "Âm lượng video");
    playerVolumeRange.addEventListener("input", (event) => {
      event.stopPropagation();
      applyPlaybackVolume(Number(playerVolumeRange.value) / 100, false);
    });
    playerVolumeRange.addEventListener("change", (event) => {
      event.stopPropagation();
      applyPlaybackVolume(Number(playerVolumeRange.value) / 100, true);
    });
    playerVolumeValue = document.createElement("span");
    playerVolumeValue.hidden = true;
    playerVolumePopover = volumeWrap;
    volumeWrap.append(playerVolumeButton, playerVolumeRange);

    const speedWrap = document.createElement("div");
    speedWrap.className = "tpt-cb-speed";
    playerSpeedButton = document.createElement("button");
    playerSpeedButton.type = "button";
    playerSpeedButton.className = "tpt-cb-btn tpt-cb-speedbtn";
    playerSpeedButton.title = `Chọn tốc độ phát: ${formatPlaybackRate(extensionSettings.playbackRate)}x`;
    playerSpeedButton.setAttribute("aria-haspopup", "menu");
    playerSpeedButton.setAttribute("aria-expanded", "false");
    const speedLabel = document.createElement("span");
    speedLabel.className = "speed-label";
    speedLabel.textContent = `${formatPlaybackRate(extensionSettings.playbackRate)}×`;
    playerSpeedButton.appendChild(speedLabel);
    playerSpeedMenu = document.createElement("div");
    playerSpeedMenu.className = "tpt-cb-menu";
    playerSpeedMenu.hidden = true;
    playerSpeedMenu.setAttribute("role", "menu");
    for (const rate of PLAYBACK_RATE_STEPS) {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "tpt-cb-menu-item";
      option.textContent = `${formatPlaybackRate(rate)}×`;
      option.dataset.rate = String(rate);
      option.dataset.active = String(Math.abs(rate - extensionSettings.playbackRate) < 0.001);
      option.setAttribute("role", "menuitem");
      option.addEventListener("click", (event) => {
        event.stopPropagation();
        applyPlaybackRate(rate, true);
        playerSpeedMenu.querySelectorAll("[data-rate]").forEach((item) => {
          item.dataset.active = String(Math.abs(Number(item.dataset.rate) - rate) < 0.001);
        });
        playerSpeedMenu.hidden = true;
        playerSpeedButton.setAttribute("aria-expanded", "false");
      });
      playerSpeedMenu.appendChild(option);
    }
    playerSpeedButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const open = playerSpeedMenu.hidden;
      playerSpeedMenu.hidden = !open;
      playerSpeedButton.setAttribute("aria-expanded", String(open));
    });
    speedWrap.append(playerSpeedButton, playerSpeedMenu);

    const shotButton = makeButton("tpt-cb-shot", "Chụp khung hình", "snapshot", () => {
      void copyCurrentFrameToClipboard().catch((error) => showNotice(error.message || "Không thể chụp khung hình."));
    });
    const cleanButton = makeButton("tpt-cb-clean", "Clean Mode · phím C", "cleanEye", () => toggleCleanMode());
    playerPipButton = makeButton("tpt-cb-pip", "Cửa sổ nổi (PiP)", "pip", () => void togglePictureInPicture());
    playerPipButton.dataset.active = String(document.pictureInPictureElement === video);
    playerWebFullscreenButton = makeButton("tpt-cb-webfs", "Toàn màn hình trong trang", "webFullscreen", () => void toggleWebFullscreen());
    playerWebFullscreenButton.dataset.active = String(webFullscreenActive);
    const fullscreenButton = makeButton("tpt-cb-fs", "Toàn màn hình", "fullscreen", () => void togglePlayerFullscreen());

    row.append(playerPlayButton, time, spacer, volumeWrap, speedWrap, shotButton, cleanButton, playerPipButton, playerWebFullscreenButton, fullscreenButton);
    root.append(seek, row);
    return root;
  }

  function renderVideo(info) {
    if (!panel || !info?.videoUrl || !videoInfoMatchesUrl(info, currentPageUrl)) return;
    const previousVideo = video;
    if (previousVideo) {
      try {
        previousVideo.pause();
        previousVideo.muted = true;
        previousVideo.volume = 0;
        previousVideo.removeAttribute("src");
        previousVideo.load();
      } catch {}
    }
    disconnectAudioEngine(previousVideo);
    cancelAutoplaySoundRecovery();
    audioBypassNoticeShown = false;
    beginExternalSubtitleSession(currentTikTokVideoId());
    cleanupSubtitleMedia();
    currentVideoInfo = info;
    latestExternalStats = null;
    watchCurrentSnapshot = null;
    setTimeout(() => refreshWatchCurrentSnapshot(), 0);
    configureMediaSession(info);
    playbackUnlockRequired = false;
    autoplayMutedFallback = false;
    suppressNextVideoClick = false;
    pausedBySmartAutoPause = false;
    replacementPlaybackStarted = false;
    updateControlWidgetStatus("Đã hiển thị đúng video thay thế HD.", "ok");
    panel.textContent = "";

    const videoWrap = document.createElement("div");
    videoWrap.className = "video-wrap";
    video = document.createElement("video");
    videoZoomIndex = 0;
    video.id = "tdt-replacement-video";
    video.className = "tdt-replacement-video tpt-sm-video";
    video.setAttribute("data-tpt-shop-injected", "true");
    video.setAttribute("data-tdt-replacement", "true");
    video.setAttribute("data-version", "3.6.0");
    video.setAttribute("data-tt-subtitle-target", "true");
    video.setAttribute("data-shortkit-video", "true");
    video.setAttribute("data-tdt-video-id", currentTikTokVideoId());
    video.setAttribute("data-video-id", currentTikTokVideoId());
    video.setAttribute("data-source-video-id", normalizedInfoVideoId(info) || currentTikTokVideoId());
    video.setAttribute("data-video-url", currentPageUrl);
    video.setAttribute("data-e2e", "browse-video");
    video.setAttribute("webkit-playsinline", "");
    video.style.cssText = "width:100%!important;height:100%!important;display:block!important;object-fit:contain!important;background:#000!important;outline:0!important;position:relative!important;inset:auto!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;z-index:1!important;";
    // Giữ controls=true để các extension phụ đề nhận diện giống video ShortKit;
    // giao diện native được ẩn bằng CSS và vẫn dùng thanh điều khiển riêng.
    video.controls = true;
    video.autoplay = false;
    video.playsInline = true;
    video.preload = "auto";
    // v3.2.5 fail-safe: HD replacement owns audible output by default.
    video.defaultMuted = extensionSettings.playbackVolume <= 0;
    video.muted = extensionSettings.playbackVolume <= 0;
    video.volume = clampPlaybackVolume(extensionSettings.playbackVolume);
    video.defaultPlaybackRate = extensionSettings.playbackRate;
    video.playbackRate = extensionSettings.playbackRate;
    video.preservesPitch = true;
    video.loop = !extensionSettings.autoScrollEnabled;
    autoScrollEndSignature = "";
    const replacementSourceUrl = String(info.videoUrl || "");
    // v3.2.3: never force crossorigin on the signed HD replacement. Some TikTok
    // CDN URLs render perfectly as normal media but return a different CORS policy
    // when loaded as anonymous, which produced the "some clips have sound, some
    // clips are silent" bug. Audio Studio is routed through the native TikTok
    // audio bridge whenever that element is available.
    if (audioCorsBypassSources.has(replacementSourceUrl)) video.dataset.tdtAudioBypass = "true";
    video.src = info.videoUrl;
    video.addEventListener("ended", () => {
      if (extensionSettings.autoScrollEnabled) {
        autoScrollEndSignature = "";
        void autoScrollToNextVideo();
      }
    });

    captionOverlay = document.createElement("div");
    captionOverlay.className = "caption-overlay";
    captionOverlay.setAttribute("aria-live", "off");
    captionOverlay.style.backgroundColor = `rgba(67,67,62,${extensionSettings.subtitleBackgroundOpacity})`;
    captionTranslatedEl = document.createElement("div");
    captionTranslatedEl.className = "caption-translated";
    captionOriginalEl = document.createElement("div");
    captionOriginalEl.className = "caption-original";
    captionOverlay.append(captionTranslatedEl, captionOriginalEl);

    videoMetadataOverlay = createVideoMetadataOverlay(info);
    panel.dataset.hasVideoMeta = String(!videoMetadataOverlay.hidden);

    centerPlaybackButton = document.createElement("div");
    centerPlaybackButton.className = "center-playback-button";
    centerPlaybackButton.dataset.state = "play";
    centerPlaybackButton.dataset.visible = "false";
    centerPlaybackButton.innerHTML = playerIcon("play");
    centerPlaybackButton.title = "Phát video";
    centerPlaybackButton.setAttribute("aria-hidden", "true");

    const statsPanel = createCustomStatsPanel();
    const gate = createGate("Đang lấy sub từ từ đã 😺...");

    const hdDownloadButton = document.createElement("button");
    hdDownloadButton.type = "button";
    hdDownloadButton.className = "hd-download-widget";
    hdDownloadButton.title = "Tải video chất lượng HD";
    hdDownloadButton.setAttribute("aria-label", "Tải video HD");
    hdDownloadButton.innerHTML = playerIcon("download");
    hdDownloadButton.addEventListener("click", () => downloadVideoInfo(currentVideoInfo || info, hdDownloadButton));

    const targetControlBar = buildTargetControlBar(info);

    applyFontSize(subtitleFontSize, false);
    applySubtitleOpacity(extensionSettings.subtitleBackgroundOpacity, false);
    applyPlaybackRate(extensionSettings.playbackRate, false);
    applyPlaybackVolume(extensionSettings.playbackVolume, false);
    if (!mediaLayer?.isConnected) throw new Error("Khung video light DOM chưa sẵn sàng.");
    const expandedHost = (document.fullscreenElement === mediaLayer || webFullscreenActive) && host?.isConnected ? host : null;
    mediaLayer.replaceChildren(video);
    if (expandedHost) mediaLayer.appendChild(expandedHost);
    playerLoadStartedAt = 0;
    mediaLayer.setAttribute("data-tdt-video-id", currentTikTokVideoId());
    mediaLayer.setAttribute("data-video-url", currentPageUrl);
    video.dispatchEvent(new CustomEvent("tdt:replacement-mounted", { bubbles: true, detail: { videoId: currentTikTokVideoId(), url: currentPageUrl } }));
    video.dispatchEvent(new CustomEvent("shortkit:video-mounted", { bubbles: true, detail: { videoId: currentTikTokVideoId(), url: currentPageUrl } }));
    document.dispatchEvent(new CustomEvent("tdt:active-video-changed", { detail: { videoId: currentTikTokVideoId(), url: currentPageUrl } }));
    const cleanRestoreButton = document.createElement("button");
    cleanRestoreButton.type = "button";
    cleanRestoreButton.className = "clean-restore-button";
    cleanRestoreButton.title = "Hiện lại các nút (Clean Mode)";
    cleanRestoreButton.setAttribute("aria-label", "Tắt Clean Mode và hiện lại các nút");
    cleanRestoreButton.innerHTML = playerIcon("clean");
    cleanRestoreButton.addEventListener("click", (event) => { event.stopPropagation(); toggleCleanMode(); });
    const productInfoWidget = createProductWidget();
    videoWrap.append(statsPanel, videoMetadataOverlay, captionOverlay, centerPlaybackButton, gate, hdDownloadButton, targetControlBar, productInfoWidget, cleanRestoreButton);
    applyVideoOverlayVisibility();
    updateCustomStatsPanel();
    setTimeout(() => promoteSubtitleTranslatorPanels(document), 120);
    setTimeout(() => promoteSubtitleTranslatorPanels(document), 700);
    setTimeout(() => scanCurrentVideoProducts(), 120);
    setTimeout(() => scanCurrentVideoProducts(), 900);
    setTimeout(() => scanCurrentVideoProducts(), 2400);

    ["timeupdate", "seeked", "loadedmetadata", "durationchange", "pause"].forEach((eventName) => {
      video.addEventListener(eventName, () => {
        updateCaptionOverlay();
        updatePlayerProgress();
        syncNativeForSubtitleTranslator();
        if (eventName === "timeupdate") maybeAutoScrollAtVideoEnd();
      });
    });
    video.addEventListener("canplay", () => {
      markAudioCorsConfirmed(video);
      hdSourceRetryAttempts.delete(currentTikTokVideoId());
      if (nativeAudioBridgeActive) void ensureNativeAudioBridgePlayback();
      else suppressNativePlayback();
    });
    video.addEventListener("loadedmetadata", () => {
      markAudioCorsConfirmed(video);
      updatePortalGeometry();
      requestAnimationFrame(() => updatePortalGeometry());
      ensureVideoSound();
      if (extensionSettings.audioEnabled && audioContext?.state === "running") void ensureAudioEngine(audioStudioTarget(video));
      applyPlaybackRate(extensionSettings.playbackRate, false);
      if (nativeVideo && Number.isFinite(nativeVideo.currentTime)) {
        try { video.currentTime = nativeVideo.currentTime; } catch {}
      }
      updatePlayerProgress();
      updateCustomStatsPanel();
      startNativePlaybackSync();
      syncNativeForSubtitleTranslator(true);
      video.dispatchEvent(new Event("tdt:replacement-ready", { bubbles: true }));
      video.dispatchEvent(new Event("canplay", { bubbles: true }));
      document.dispatchEvent(new CustomEvent("tdt:replacement-video-ready", { detail: { videoId: currentTikTokVideoId(), url: currentPageUrl } }));
      document.dispatchEvent(new CustomEvent("shortkit:video-ready", { detail: { videoId: currentTikTokVideoId(), url: currentPageUrl } }));
      setTimeout(() => refreshExternalSubtitleText(true), 80);
      setTimeout(() => refreshExternalSubtitleText(true), 420);
    });
    video.addEventListener("play", () => {
      replacementPlaybackStarted = true;
      // Every user-controlled play path clears the manual-pause intent first.
      // Therefore a play event that arrives while this intent is still set was
      // triggered by TikTok, a remount, a media hook or an old async callback.
      if (isCurrentVideoManuallyPaused()) {
        video.pause();
        updatePlayerProgress();
        return;
      }
      if (videoGateLocked || (extensionSettings.scanSubtitles && !subtitleCues.length)) {
        video.pause();
        return;
      }
      pausedBySmartAutoPause = false;
      ensureVideoSound();
      if (nativeAudioBridgeActive) void ensureNativeAudioBridgePlayback({ force:true });
      if (autoplayMutedFallback) scheduleAutoplaySoundRecovery(document.hidden ? 900 : 140, document.hidden ? 4 : 12);
      if (extensionSettings.audioEnabled) {
        void ensureAudioContext({ resume:true }).then((context) => {
          if (context?.state === "running") return ensureAudioEngine(audioStudioTarget(video));
          return false;
        });
      } else {
        applyAudioSettings();
        if (audioEngines.has(video)) scheduleAudioContextRecovery(0);
      }
      applyPlaybackRate(extensionSettings.playbackRate, false);
      notifyPlaybackStarted();
      updateCaptionOverlay();
      updatePlayerProgress();
      if (document.hidden) startHiddenPlaybackKeepAlive();
      syncNativeForSubtitleTranslator(true);
    });
    video.addEventListener("pause", () => {
      stopHiddenPlaybackKeepAlive();
      syncNativeForSubtitleTranslator(true);
    });
    video.addEventListener("seeking", () => syncNativeForSubtitleTranslator(true));
    video.addEventListener("seeked", () => syncNativeForSubtitleTranslator(true));
    video.addEventListener("volumechange", updateVolumeUi);
    video.addEventListener("ratechange", () => {
      if (video && Math.abs(video.playbackRate - extensionSettings.playbackRate) > 0.01) video.playbackRate = extensionSettings.playbackRate;
    });
    video.addEventListener("enterpictureinpicture", () => {
      if (playerPipButton) playerPipButton.dataset.active = "true";
    });
    video.addEventListener("leavepictureinpicture", () => {
      if (playerPipButton) playerPipButton.dataset.active = "false";
    });
    video.addEventListener("click", () => {
      if (suppressNextVideoClick) {
        suppressNextVideoClick = false;
        return;
      }
      toggleReplacementPlayback();
    });
    video.addEventListener("error", (event) => {
      const failedVideo = event.currentTarget instanceof HTMLVideoElement ? event.currentTarget : null;
      // Ignore a late error from a video element that TikTok/our renderer already replaced.
      if (!failedVideo || failedVideo !== video) return;
      if (failedVideo.crossOrigin && failedVideo.dataset.tdtCorsFallback !== "true") {
        const sourceUrl = String(info.videoUrl || "");
        const wasCapturedByWebAudio = audioEngines.has(failedVideo);
        const resumeTime = Number.isFinite(failedVideo.currentTime) ? failedVideo.currentTime : 0;
        const shouldResume = !failedVideo.paused && !isCurrentVideoManuallyPaused();
        rememberAudioBypassSource(sourceUrl);
        failedVideo.dataset.tdtCorsFallback = "true";
        failedVideo.dataset.tdtAudioBypass = "true";
        if (wasCapturedByWebAudio) {
          // createMediaElementSource cannot be undone on the same element. Build a
          // fresh replacement video without Web Audio and preserve playback state.
          showNotice("Nguồn này chặn Web Audio; đang khôi phục âm thanh gốc…", true);
          rebuildReplacementForDirectAudio("cors-media-error");
        } else {
          failedVideo.removeAttribute("crossorigin");
          failedVideo.crossOrigin = null;
          failedVideo.src = sourceUrl;
          failedVideo.load();
          const restoreDirectPlayback = () => {
            if (failedVideo !== video) return;
            try { if (resumeTime > 0 && Number.isFinite(failedVideo.duration)) failedVideo.currentTime = Math.min(resumeTime, Math.max(0, failedVideo.duration - 0.05)); } catch {}
            autoplayMutedFallback = false;
            ensureVideoSound();
            if (shouldResume && !videoGateLocked) {
              failedVideo.play().catch((error) => {
                if (!isAutoplayPolicyError(error) || failedVideo !== video) return;
                autoplayMutedFallback = true;
                ensureVideoSound();
                failedVideo.play().catch(() => {});
                scheduleAutoplaySoundRecovery(180, 12);
              });
            }
          };
          failedVideo.addEventListener("loadedmetadata", restoreDirectPlayback, { once:true });
          showNotice("Nguồn này chặn Web Audio; đã tự chuyển sang âm thanh gốc.", true);
        }
        return;
      }
      if (!host) return;
      const id = currentTikTokVideoId();
      const attempts = Number(hdSourceRetryAttempts.get(id) || 0);
      if (attempts < 1 && currentPageUrl) {
        hdSourceRetryAttempts.set(id, attempts + 1);
        setVideoGate(true, "Nguồn HD vừa hết hạn · đang lấy lại đúng video…");
        showNotice("Nguồn HD vừa hết hạn; extension đang tự lấy lại nguồn mới.", true);
        void loadVideo(true, currentPageUrl, true);
        return;
      }
      renderError("Nguồn HD của video này chưa phát được. Bấm Quét lại video để thử nguồn mới.");
    });

    const toolbar = buildToolbar(info);
    const sourceNote = document.createElement("div");
    sourceNote.className = "source-note";
    const sourcePrefix = info.source === "tiktok-feed-hd" ? "TikTok HD trực tiếp · " : "Nguồn HD · ";
    sourceNote.textContent = extensionSettings.placeBelowSubtitleTranslator && !extensionSettings.scanSubtitles
      ? `${sourcePrefix}TikTok Subtitle Translator · đồng bộ trực tiếp`
      : extensionSettings.translateVietnamese
        ? `${sourcePrefix}Transcript365 → VI · @tranductai`
        : `${sourcePrefix}Transcript365 · sub gốc · @tranductai`;
    sourceNote.hidden = extensionSettings.placeBelowSubtitleTranslator && !extensionSettings.scanSubtitles;

    panel.onpointerdown = (event) => {
      if (playerSpeedMenu && !event.composedPath().includes(playerSpeedButton) && !event.composedPath().includes(playerSpeedMenu)) {
        playerSpeedMenu.hidden = true;
        playerSpeedButton?.setAttribute("aria-expanded", "false");
      }
    };

    panel.append(videoWrap, toolbar, sourceNote);
    applyCleanMode();
    startExternalSubtitleBridge();
    startNativePlaybackSync();
    setTimeout(() => refreshExternalSubtitleText(true), 120);
    setTimeout(() => refreshExternalSubtitleText(true), 700);
    ensureVideoSound();
    applyPlaybackRate(extensionSettings.playbackRate, false);
    updatePlayerProgress();

    if (extensionSettings.scanSubtitles) {
      setVideoGate(true, "Đang lấy sub từ từ đã 😺...");
      setTimeout(() => autoLoadSubtitles(false), 60);
    } else {
      setSubtitleStatus(extensionSettings.placeBelowSubtitleTranslator ? "đang dùng TikTok Subtitle Translator" : "quét sub đã tắt", "");
      setVideoGate(false);
      setTimeout(() => startReplacementVideo(false), 60);
    }
  }

  function renderError(message) {
    if (!panel) return;
    if (video) {
      try {
        video.pause();
        video.muted = true;
        video.volume = 0;
        video.removeAttribute("src");
        video.load();
      } catch {}
    }
    video = null;
    currentVideoInfo = null;
    playerLoadStartedAt = 0;
    updateControlWidgetStatus(message || "Không thể hiển thị video.", "error");
    setControlWidgetOpen(true);
    panel.textContent = "";
    const wrap = document.createElement("div");
    wrap.className = "video-wrap";
    const gate = document.createElement("div");
    gate.className = "subtitle-gate";
    const box = document.createElement("div");
    box.className = "error-box";
    const text = document.createElement("div");
    text.className = "gate-text";
    text.textContent = `❌ ${message}`;
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "retry-video";
    retry.textContent = "Quét lại video";
    retry.addEventListener("click", async () => { await refreshCurrentTabUrl(true); await loadVideo(true, effectiveTabVideoUrl() || currentPageUrl, true); });
    box.append(text, retry);
    gate.appendChild(box);
    wrap.appendChild(gate);
    panel.appendChild(wrap);
  }

  function visibleIntersectionArea(rect) {
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(window.innerWidth, rect.right);
    const bottom = Math.min(window.innerHeight, rect.bottom);
    return Math.max(0, right - left) * Math.max(0, bottom - top);
  }

  function hasVisibleVideoGeometry(element, minWidth = 90, minHeight = 120) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width < minWidth || rect.height < minHeight || visibleIntersectionArea(rect) <= 0) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function directVideoIdForElement(element) {
    if (!(element instanceof Element)) return "";
    const values = [];
    const nearestLink = element.closest?.('a[href*="/video/"]');
    if (nearestLink?.href) values.push(nearestLink.href);
    let node = element;
    for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
      values.push(
        node.getAttribute?.("data-video-id"), node.getAttribute?.("data-item-id"), node.getAttribute?.("data-aweme-id"),
        node.getAttribute?.("data-id"), node.id
      );
      if (node.matches?.('a[href*="/video/"]') && node.href) values.push(node.href);
    }
    for (const value of values) {
      const text = String(value || "");
      const id = text.match(/\/video\/(\d{8,})/)?.[1]
        || text.match(/xgwrapper-\d+-(\d{8,})/)?.[1]
        || (/^\d{8,}$/.test(text.trim()) ? text.trim() : "");
      if (id) return id;
    }
    return "";
  }

  function isSideRecommendationElement(element) {
    if (!(element instanceof Element)) return false;
    // Do not use a broad [data-e2e*="recommend"] selector here. TikTok names the
    // normal For You feed card "recommend-list-item-container", so that selector
    // classifies every main video as a side recommendation and disables replacement.
    const semanticSidePanel = element.closest?.([
      '[class*="RightPanelContainer"]', '[class*="RightPanelHeader"]',
      '[class*="DivVideoListTabBarWrapper"]', '[class*="VideoListTabBar"]',
      '[class*="CreatorVideo"]', '[class*="RelatedVideo"]',
      '[data-testid*="recommendation" i]', '[data-testid*="related-video" i]',
      '[data-e2e="related-video-list"]', '[data-e2e="creator-video-list"]',
      '[data-e2e="recommendation-panel"]', 'aside'
    ].join(','));
    if (semanticSidePanel) return true;

    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    let node = element;
    for (let depth = 0; node && node !== document.body && depth < 11; depth += 1, node = node.parentElement) {
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0) continue;
      const rightRail = rect.left >= window.innerWidth * .55 && rect.width <= window.innerWidth * .45;
      if (!rightRail) continue;
      const hasTabBar = Boolean(node.querySelector?.('[data-testid="tux-web-tab-bar-container"], [data-testid="tux-web-tab-bar"], [role="tablist"]'));
      const videoLinkCount = node.querySelectorAll?.('a[href*="/video/"]').length || 0;
      const videoCount = node.querySelectorAll?.('video').length || 0;
      const text = normalizeUiText(node.textContent).slice(0, 420);
      if (hasTabBar || videoLinkCount >= 2 || videoCount >= 2
        || /Bạn có thể thích|Video của nhà sáng tạo|You may like|Creator videos|Related/i.test(text)) return true;
    }

    // Right-side thumbnails often have no stable semantic class and the video can
    // be inserted outside the clickable <a>. Geometry is therefore authoritative:
    // a small player whose centre is in the right rail is never the primary detail player.
    const rect = element.getBoundingClientRect?.();
    if (rect) {
      const visibleArea = visibleIntersectionArea(rect);
      const centerX = rect.left + rect.width / 2;
      const smallRightPreview = centerX >= window.innerWidth * 0.66
        && rect.width <= window.innerWidth * 0.42
        && rect.height <= window.innerHeight * 0.78
        && visibleArea <= viewportArea * 0.26;
      if (smallRightPreview) return true;
    }
    return false;
  }

  function isPrimaryDetailRouteSurface(element, routeId = "") {
    if (!(element instanceof Element) || !element.isConnected) return false;
    if (isSearchResultPreviewElement(element) || isSideRecommendationElement(element)) return false;
    const expectedId = String(routeId || videoIdFromUrl(effectiveTabVideoUrl()) || "");
    const candidateId = directVideoIdForElement(element);
    if (expectedId && candidateId) return candidateId === expectedId;

    const rect = element.getBoundingClientRect?.();
    if (!rect) return false;
    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    const visibleArea = visibleIntersectionArea(rect);
    const centerX = rect.left + rect.width / 2;
    const largeMainStage = rect.height >= window.innerHeight * DETAIL_PRIMARY_MIN_HEIGHT_RATIO
      && rect.width >= Math.min(260, window.innerWidth * 0.17)
      && visibleArea >= viewportArea * DETAIL_PRIMARY_MIN_AREA_RATIO
      && centerX <= window.innerWidth * DETAIL_PRIMARY_MAX_CENTER_X_RATIO;
    if (!largeMainStage) return false;

    // If a route is already locked, only its connected mount/native descendants
    // may keep the session. This prevents a late hover preview from stealing it.
    if (expectedId && lockedDetailVideoId === expectedId && lockedDetailMount?.isConnected) {
      return element === lockedDetailMount || lockedDetailMount.contains?.(element) || element.contains?.(lockedDetailMount);
    }
    return true;
  }

  function candidateConflictsWithCurrentRoute(element) {
    const routeId = videoIdFromUrl(effectiveTabVideoUrl());
    if (!routeId) return false;
    const candidateId = directVideoIdForElement(element);
    if (candidateId) return candidateId !== routeId;
    return !isPrimaryDetailRouteSurface(element, routeId);
  }

  function isSearchResultPreviewElement(element) {
    // Historical name kept to minimize regression risk in the existing player
    // discovery pipeline. v3.2.4 expands it to every preview/grid surface, not
    // just /search. Hover previews on music/profile/tag/discover pages therefore
    // stay 100% native and never receive the HD replacement player.
    return isSearchResultGridElement(element) || isGenericPreviewGridElement(element);
  }

  function findPrimaryTikTokVideo() {
    const recent = lastNativePlayVideo;
    if (recent instanceof HTMLVideoElement && recent.isConnected && performance.now() - lastNativePlayAt <= RECENT_NATIVE_PLAY_WINDOW_MS
      && !isSearchResultPreviewElement(recent) && !isSideRecommendationElement(recent) && !candidateConflictsWithCurrentRoute(recent)
      && searchCandidateMatchesPending(recent, lastNativePlayUrl)
      && (!isSearchRoute() || isLikelySearchDetailSurface(recent))
      && hasVisibleVideoGeometry(recent)) return recent;
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    let allVideos = directQueryElements(["video"]);
    // TikTok's standard React player is light DOM. Only probe open shadow
    // roots when there is genuinely no visible native player.
    if (!allVideos.some((element) => element instanceof HTMLVideoElement && hasVisibleVideoGeometry(element))) {
      const now = Date.now();
      if (now - lastPlayerDeepRootRefreshAt >= 5000) {
        lastPlayerDeepRootRefreshAt = now;
        scanOpenSubtitleRoots(true);
      }
      allVideos = deepQuerySubtitleElements(["video"]);
    }
    const candidates = allVideos.filter((element) => {
      if (!(element instanceof HTMLVideoElement)) return false;
      if (element === video || element.matches?.('[data-tdt-replacement="true"]') || host?.contains(element) || mediaLayer?.contains(element)) return false;
      if (isSearchResultPreviewElement(element) || isSideRecommendationElement(element) || candidateConflictsWithCurrentRoute(element)) return false;
      if (!searchCandidateMatchesPending(element) || (isSearchRoute() && !isLikelySearchDetailSurface(element))) return false;
      const isMountedNativeVideo = element === nativeVideo;
      if (isMountedNativeVideo) return hasVisibleVideoGeometry(element);
      const rect = element.getBoundingClientRect();
      return rect.width >= 90 && rect.height >= 120 && rect.width * rect.height >= 22000 && isVisibleElement(element, 90, 120);
    });

    let best = null;
    let bestScore = -Infinity;
    for (const element of candidates) {
      const rect = element.getBoundingClientRect();
      const intersectionArea = visibleIntersectionArea(rect);
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(centerX - viewportCenterX, centerY - viewportCenterY);
      const source = String(element.currentSrc || element.src || "");
      const dialog = element.closest('[role="dialog"]');
      const dialogBoost = dialog && isVisibleElement(dialog, 180, 180) ? 1_000_000_000 : 0;
      const playingBoost = !element.paused && !element.ended ? 250_000_000 : 0;
      const recentPlayBoost = element === lastNativePlayVideo && performance.now() - lastNativePlayAt <= RECENT_NATIVE_PLAY_WINDOW_MS ? 900_000_000 : 0;
      const nativeBoost = source.startsWith("blob:") ? 30_000_000 : 0;
      const nativePlayer = Boolean(element.closest('.xgplayer-container,.tiktok-web-player'));
      const foreignReplacement = Boolean(element.matches?.('.tpt-sm-video,[data-tpt-shop-injected="true"],[data-shortkit-video]'));
      const foreignPenalty = foreignReplacement ? 500_000_000 : 0;
      const nativePlayerBoost = nativePlayer ? 100_000_000 : 0;
      const score = intersectionArea * 1000 - distance * 1000 + dialogBoost + playingBoost + recentPlayBoost + nativeBoost + nativePlayerBoost - foreignPenalty;
      if (score > bestScore) {
        bestScore = score;
        best = element;
      }
    }
    return best;
  }

  function findExactPlayerContainer(element) {
    if (!element) return null;
    const videoRect = element.getBoundingClientRect();
    const videoArea = Math.max(1, videoRect.width * videoRect.height);
    const semanticPlayer = element.parentElement?.closest?.([
      'xg-video-container', 'xg-player', '.xgplayer-container', '.tiktok-web-player',
      '[data-e2e="browse-video"]', '[data-e2e="video-player"]', '[data-e2e*="video-container"]',
      '[data-e2e*="player" i]', '[data-testid*="video-player" i]', '[data-testid*="player" i]',
      'tiktok-player', 'tiktok-video-player', '[class*="DivVideoContainer"]', '[class*="VideoContainer"]',
      '[class*="PlayerContainer"]', '[class*="PlayerWrapper"]', '[class*="video-player"]', '[class*="VideoPlayer"]'
    ].join(','));
    if (semanticPlayer && hasVisibleVideoGeometry(semanticPlayer, 90, 120)) return semanticPlayer;
    let best = null;
    let node = element.parentElement;
    for (let depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
      if (node === document.body || node === document.documentElement) break;
      const rect = node.getBoundingClientRect();
      if (rect.width < 90 || rect.height < 120) continue;
      if (!best) best = node;
      const widthRatio = rect.width / Math.max(1, videoRect.width);
      const heightRatio = rect.height / Math.max(1, videoRect.height);
      const areaRatio = (rect.width * rect.height) / videoArea;
      if (widthRatio <= 1.16 && heightRatio <= 1.16 && areaRatio <= 1.32) {
        best = node;
        continue;
      }
      break;
    }
    return best || element.parentElement;
  }

  function findFallbackTikTokPlayerTarget() {
    const directDialogs = directQueryElements(['[role="dialog"]']);
    const dialogs = (directDialogs.length ? directDialogs : deepQuerySubtitleElements(['[role="dialog"]'])).filter((dialog) => isVisibleElement(dialog, 180, 180));
    const dialog = dialogs.at(-1);
    if (!dialog) return null;
    const pageUrl = effectiveTabVideoUrl() || findVideoUrlInRoot(dialog);
    if (!pageUrl) return null;
    const playIcon = dialog.querySelector('[data-e2e="browse-video-play"]');
    if (!playIcon) return null;
    const mediaPane = playIcon.parentElement;
    const precedingSurface = playIcon.previousElementSibling;
    let targetMount = null;
    if (precedingSurface && isVisibleElement(precedingSurface, 140, 180)) targetMount = precedingSurface;
    if (!targetMount && mediaPane && isVisibleElement(mediaPane, 180, 180)) {
      const candidates = Array.from(mediaPane.children).filter((child) => child !== playIcon && isVisibleElement(child, 140, 180));
      targetMount = candidates.sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return br.width * br.height - ar.width * ar.height;
      })[0] || null;
    }
    if (!targetMount) return null;
    return { targetVideo: null, targetMount, pageUrl };
  }

  function findGenericVideoSurface() {
    const pageUrl = effectiveTabVideoUrl();
    if (!pageUrl) return null;
    const selectors = [
      '[data-e2e="browse-video"]', '[data-e2e="video-player"]', '[data-e2e*="video-container"]',
      '[data-e2e*="player" i]', '[data-testid*="video-player" i]', '[data-testid*="player" i]',
      'tiktok-player', 'tiktok-video-player', 'xg-video-container', 'xg-player', '.xgplayer-container', '.tiktok-web-player',
      '[class*="DivVideoContainer"]', '[class*="VideoContainer"]', '[class*="PlayerContainer"]',
      '[class*="PlayerWrapper"]', '[class*="video-player"]', '[class*="VideoPlayer"]', '[class*="xgplayer"]'
    ];
    const candidates = [];
    const seenMounts = new Set();
    const directElements = directQueryElements(selectors);
    const surfaceElements = directElements.length ? directElements : deepQuerySubtitleElements(selectors);
    for (const element of surfaceElements) {
      if (isSearchResultPreviewElement(element) || isSideRecommendationElement(element) || candidateConflictsWithCurrentRoute(element)) continue;
      const routeId = videoIdFromUrl(pageUrl);
      if (routeId && !isPrimaryDetailRouteSurface(element, routeId)) continue;
      if (!isVisibleElement(element, 180, 220)) continue;
      const rect = element.getBoundingClientRect();
      const area = visibleIntersectionArea(rect);
      if (area < 50000) continue;
      const targetMount = /^(?:VIDEO|CANVAS|IMG)$/.test(element.tagName) ? findExactPlayerContainer(element) : element;
      if (!targetMount?.isConnected || seenMounts.has(targetMount)) continue;
      seenMounts.add(targetMount);
      candidates.push({ element: targetMount, area, distance: Math.hypot(rect.left + rect.width / 2 - innerWidth / 2, rect.top + rect.height / 2 - innerHeight / 2) });
    }
    candidates.sort((a,b)=>(b.area-a.area)||(a.distance-b.distance));
    const targetMount = candidates[0]?.element || null;
    return targetMount ? { targetVideo: null, targetMount, pageUrl } : null;
  }

  function feedCardVideoUrl(card) {
    if (!(card instanceof Element)) return "";
    const root = card.closest?.('article[data-e2e="recommend-list-item-container"],article') || card;
    const direct = findVideoUrlInRoot(root);
    if (direct) return direct;
    const extensionUrl = videoUrlFromExtensionDom(root);
    if (extensionUrl) return extensionUrl;
    const wrapper = card.querySelector?.('[id^="xgwrapper-"]') || root.querySelector?.('[id^="xgwrapper-"]');
    const id = String(wrapper?.id || "").match(/xgwrapper-\d+-(\d{8,})/)?.[1] || directVideoIdForElement(card);
    if (!id) return "";
    const username = usernameFromVideoRoot(root, wrapper);
    return `https://www.tiktok.com/@${username || "tdtfeed"}/video/${id}`;
  }

  function findFeedCardPlayerTarget() {
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const directCards = directQueryElements(['[data-e2e="feed-video"]']);
    const cards = (directCards.length ? directCards : deepQuerySubtitleElements(['[data-e2e="feed-video"]'])).filter((card) => {
      if (!(card instanceof Element) || isSideRecommendationElement(card) || isSearchResultPreviewElement(card)) return false;
      return isVisibleElement(card, 180, 220);
    });
    let best = null;
    let bestScore = -Infinity;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const area = visibleIntersectionArea(rect);
      if (area < 45000) continue;
      const centerDistance = Math.hypot(rect.left + rect.width / 2 - viewportCenterX, rect.top + rect.height / 2 - viewportCenterY);
      const native = card.querySelector('video');
      const playingBoost = native instanceof HTMLVideoElement && !native.paused && !native.ended ? 250_000_000 : 0;
      const article = card.closest('article[data-scroll-index]');
      const focusBoost = article?.matches?.(':focus-within') ? 20_000_000 : 0;
      const score = area * 1000 - centerDistance * 1250 + playingBoost + focusBoost;
      if (score > bestScore) { bestScore = score; best = card; }
    }
    if (!best) return null;
    const pageUrl = feedCardVideoUrl(best);
    if (!pageUrl) return null;
    const targetVideo = best.querySelector('video');
    const targetMount = (targetVideo instanceof HTMLVideoElement ? findExactPlayerContainer(targetVideo) : null)
      || best.querySelector('.xgplayer-container,.tiktok-web-player,[class*="BasePlayerContainer"],[class*="DivVideoPlayerContainer"]')
      || best;
    if (!targetMount?.isConnected || isSideRecommendationElement(targetMount)) return null;
    return { targetVideo: targetVideo instanceof HTMLVideoElement ? targetVideo : null, targetMount, pageUrl };
  }

  function findBestPlayerTarget() {
    if (isBareCollectionGridPage()) return null;
    const searchMode = isSearchRoute();
    if (searchMode && !pendingSearchSelectionIsUsable()) return null;
    const now = Date.now();
    if (playerTargetCache && now - playerTargetCacheAt < 450) {
      const cached = playerTargetCache;
      if (cached.targetMount?.isConnected && !isSideRecommendationElement(cached.targetMount)
        && !isSearchResultPreviewElement(cached.targetMount)
        && !candidateConflictsWithCurrentRoute(cached.targetVideo || cached.targetMount)
        && searchCandidateMatchesPending(cached.targetVideo || cached.targetMount, cached.pageUrl)) return cached;
    }
    let result = null;
    const targetVideo = findPrimaryTikTokVideo();
    if (targetVideo) {
      const pageUrl = resolveVideoUrlForElement(targetVideo) || (!searchMode ? effectiveTabVideoUrl() : "");
      const targetMount = findExactPlayerContainer(targetVideo);
      const routeId = videoIdFromUrl(pageUrl);
      if (pageUrl && targetMount && !isSideRecommendationElement(targetMount)
        && !isSearchResultPreviewElement(targetMount)
        && !candidateConflictsWithCurrentRoute(targetVideo)
        && (!routeId || isPrimaryDetailRouteSurface(targetVideo, routeId))
        && searchCandidateMatchesPending(targetVideo, pageUrl)) {
        result = { targetVideo, targetMount, pageUrl };
      }
    }
    // On /search, only the explicitly clicked detail player is eligible. Feed,
    // dialog and generic fallbacks can otherwise select a thumbnail or right-rail
    // preview that happens to be larger/playing.
    if (!searchMode && !result) result = findFeedCardPlayerTarget();
    if (!searchMode && !result) result = findFallbackTikTokPlayerTarget() || findGenericVideoSurface();
    const resultRouteId = videoIdFromUrl(result?.pageUrl || "");
    if (!result || isSearchResultPreviewElement(result.targetMount) || isSideRecommendationElement(result.targetMount)
      || candidateConflictsWithCurrentRoute(result.targetVideo || result.targetMount)
      || (resultRouteId && !isPrimaryDetailRouteSurface(result.targetVideo || result.targetMount, resultRouteId))
      || !searchCandidateMatchesPending(result.targetVideo || result.targetMount, result.pageUrl)) return null;
    playerTargetCache = result;
    playerTargetCacheAt = now;
    return result;
  }

  function restoreNativeActionRail() {
    if (nativeActionRail && nativeActionRailSnapshot != null) {
      try { nativeActionRail.style.cssText = nativeActionRailSnapshot; } catch {}
    }
    if (nativeActionRailHost && nativeActionRailHostPosition != null) {
      try { nativeActionRailHost.style.position = nativeActionRailHostPosition; } catch {}
    }
    nativeActionRail = null;
    nativeActionRailSnapshot = null;
    nativeActionRailHost = null;
    nativeActionRailHostPosition = "";
  }

  function findNativeActionRail() {
    if (!mountElement?.isConnected) return null;
    const scope = mountElement.closest?.('article[data-e2e="recommend-list-item-container"],article,[data-e2e="feed-video"]') || mountElement.parentElement;
    if (!(scope instanceof Element)) return null;
    const selectors = [
      'section[class*="SectionActionBarContainer"]',
      '[class*="DivActionBarContainer"]',
      '[class*="ActionBarContainer"]'
    ];
    for (const selector of selectors) {
      for (const candidate of scope.querySelectorAll(selector)) {
        if (!(candidate instanceof HTMLElement)) continue;
        const hasFeedActions = candidate.querySelector?.('[data-e2e="like-icon"],[data-e2e="comment-icon"],[data-e2e="share-icon"],[data-e2e="favorite-icon"],[data-e2e="video-author-avatar"]');
        if (hasFeedActions) return candidate;
      }
    }
    const actionIcon = scope.querySelector?.('[data-e2e="like-icon"],[data-e2e="comment-icon"],[data-e2e="share-icon"]');
    return actionIcon?.closest?.('section,[class*="ActionBar"]') || null;
  }

  function preserveNativeActionRail(shape = "", box = null) {
    if (shape !== "landscape" || extensionSettings.cleanMode || webFullscreenActive || document.fullscreenElement === mediaLayer) {
      if (nativeActionRail) restoreNativeActionRail();
      return;
    }
    const rail = findNativeActionRail();
    if (!(rail instanceof HTMLElement)) return;
    if (nativeActionRail && nativeActionRail !== rail) restoreNativeActionRail();
    if (!nativeActionRail) {
      nativeActionRail = rail;
      nativeActionRailSnapshot = rail.style.cssText;
    }

    // Keep TikTok's original action buttons interactive above our replacement
    // video. 16:9 feed cards can place this rail over/just outside the media
    // surface, where previous full-card overlays or overflow:hidden clipped it.
    rail.style.setProperty("display", "flex", "important");
    rail.style.setProperty("visibility", "visible", "important");
    rail.style.setProperty("opacity", "1", "important");
    rail.style.setProperty("pointer-events", "auto", "important");
    rail.style.setProperty("z-index", "2147482505", "important");

    const rect = rail.getBoundingClientRect?.();
    const invisible = !rect || rect.width < 20 || rect.height < 56 || rect.right < 0 || rect.left > innerWidth;
    if (!invisible) return;

    const card = mountElement.closest?.('article[data-e2e="recommend-list-item-container"],article') || rail.parentElement;
    if (!(card instanceof HTMLElement)) return;
    if (!nativeActionRailHost) {
      nativeActionRailHost = card;
      nativeActionRailHostPosition = card.style.position || "";
    }
    if (getComputedStyle(card).position === "static") card.style.setProperty("position", "relative", "important");
    rail.style.setProperty("position", "absolute", "important");
    rail.style.setProperty("right", "10px", "important");
    rail.style.setProperty("top", "50%", "important");
    rail.style.setProperty("bottom", "auto", "important");
    rail.style.setProperty("left", "auto", "important");
    rail.style.setProperty("transform", "translateY(-42%)", "important");
    rail.style.setProperty("max-height", box?.height ? `${Math.max(180, box.height - 100)}px` : "calc(100% - 100px)", "important");
  }

  function updateControlBarProfile(box = null) {
    if (!panel) return;
    const sourceWidth = Math.max(1, Number(video?.videoWidth) || Number(box?.width) || 1);
    const sourceHeight = Math.max(1, Number(video?.videoHeight) || Number(box?.height) || 1);
    const ratio = sourceWidth / sourceHeight;
    const shape = ratio < 0.82 ? "portrait" : ratio > 1.22 ? "landscape" : "square";
    const renderedWidth = Math.max(1, Number(box?.width) || host?.clientWidth || mountElement?.clientWidth || 1);
    const density = renderedWidth < 350 ? "micro" : renderedWidth < 520 ? "compact" : "regular";
    panel.dataset.videoShape = shape;
    panel.dataset.controlDensity = density;
    preserveNativeActionRail(shape, box);
  }

  function nativeVideoBoxWithinMount() {
    if (!mountElement?.isConnected || !nativeVideo?.isConnected) return null;
    try {
      const mountRect = mountElement.getBoundingClientRect();
      const nativeRect = nativeVideo.getBoundingClientRect();
      if (!mountRect.width || !mountRect.height || nativeRect.width < 40 || nativeRect.height < 40) return null;
      const left = nativeRect.left - mountRect.left;
      const top = nativeRect.top - mountRect.top;
      const right = left + nativeRect.width;
      const bottom = top + nativeRect.height;
      const visibleW = Math.max(0, Math.min(right, mountRect.width) - Math.max(left, 0));
      const visibleH = Math.max(0, Math.min(bottom, mountRect.height) - Math.max(top, 0));
      if (visibleW < 40 || visibleH < 40) return null;
      return {
        left: Math.max(0, left),
        top: Math.max(0, top),
        width: Math.max(1, Math.min(nativeRect.width, mountRect.width - Math.max(0, left))),
        height: Math.max(1, Math.min(nativeRect.height, mountRect.height - Math.max(0, top)))
      };
    } catch {
      return null;
    }
  }

  function containedVideoBox() {
    if (!mountElement) return null;
    const fullscreenActive = document.fullscreenElement === mediaLayer || webFullscreenActive || mediaLayer?.getAttribute("data-tdt-webfullscreen-root") === "true";
    if (!fullscreenActive) {
      const nativeBox = nativeVideoBoxWithinMount();
      if (nativeBox) return nativeBox;
    }
    const containerWidth = Math.max(1, (fullscreenActive ? mediaLayer?.clientWidth : mountElement.clientWidth) || mediaLayer?.clientWidth || 1);
    const containerHeight = Math.max(1, (fullscreenActive ? mediaLayer?.clientHeight : mountElement.clientHeight) || mediaLayer?.clientHeight || 1);
    const sourceWidth = Math.max(1, Number(video?.videoWidth) || 9);
    const sourceHeight = Math.max(1, Number(video?.videoHeight) || 16);
    const scale = Math.min(containerWidth / sourceWidth, containerHeight / sourceHeight);
    const width = Math.max(1, Math.min(containerWidth, sourceWidth * scale));
    const height = Math.max(1, Math.min(containerHeight, sourceHeight * scale));
    return {
      left: Math.max(0, (containerWidth - width) / 2),
      top: Math.max(0, (containerHeight - height) / 2),
      width,
      height
    };
  }

  function setAbsoluteBox(element, box) {
    if (!(element instanceof HTMLElement)) return;
    if (!box) {
      element.style.inset = "0";
      element.style.left = "0";
      element.style.top = "0";
      element.style.width = "100%";
      element.style.height = "100%";
      return;
    }
    element.style.inset = "auto";
    element.style.left = `${box.left}px`;
    element.style.top = `${box.top}px`;
    element.style.width = `${box.width}px`;
    element.style.height = `${box.height}px`;
  }

  function updatePortalGeometry() {
    if (!host || !mediaLayer || !mountElement?.isConnected) return false;
    const fullscreenActive = document.fullscreenElement === mediaLayer || webFullscreenActive || mediaLayer?.getAttribute("data-tdt-webfullscreen-root") === "true";
    const box = containedVideoBox();

    if (fullscreenActive) {
      // mediaLayer is the fullscreen root; CSS expands it to the viewport and the
      // control host is its child.
      mediaLayer.style.inset = "0";
      mediaLayer.style.left = "0";
      mediaLayer.style.top = "0";
      mediaLayer.style.width = "100%";
      mediaLayer.style.height = "100%";
      setAbsoluteBox(host, null);
    } else {
      // Cover only the real native video rectangle, never the whole feed card.
      // This leaves TikTok's avatar/like/comment/share rail untouched.
      setAbsoluteBox(mediaLayer, box);
      setAbsoluteBox(host, box);
    }

    updateControlBarProfile(fullscreenActive ? null : box);
    host.style.display = "block";
    ensureControlWidgetOnTop();
    return true;
  }

  function schedulePortalGeometryUpdate() {
    if (portalGeometryFrame) return;
    portalGeometryFrame = requestAnimationFrame(() => {
      portalGeometryFrame = 0;
      updatePortalGeometry();
    });
  }

  function startPortalGeometryTracking() {
    if (portalGeometryFrame) cancelAnimationFrame(portalGeometryFrame);
    portalGeometryFrame = 0;
    portalResizeObserver?.disconnect();
    portalResizeObserver = null;
    updatePortalGeometry();
    if (typeof ResizeObserver === "function" && mountElement) {
      portalResizeObserver = new ResizeObserver(schedulePortalGeometryUpdate);
      portalResizeObserver.observe(mountElement);
      if (mediaLayer) portalResizeObserver.observe(mediaLayer);
    }
  }

  function startPlayerRootTracking() {
    playerRootObserver?.disconnect();
    playerRootObserver = null;
    const root = mountElement?.getRootNode?.();
    if (!(root instanceof ShadowRoot)) return;
    playerRootObserver = new MutationObserver((records) => {
      const externalChange = records.some((record) => {
        const target = record.target;
        if (host?.contains?.(target) || mediaLayer?.contains?.(target)) return false;
        const changed = [...record.addedNodes, ...record.removedNodes].filter((node) => node instanceof Element);
        if (changed.length && changed.every((node) => node === host || node === mediaLayer || host?.contains?.(node) || mediaLayer?.contains?.(node))) return false;
        return changed.length > 0;
      });
      if (externalChange) scheduleLifecycleScan(0);
    });
    playerRootObserver.observe(root, { childList: true, subtree: true });
  }

  function installInlineHost(targetVideo, targetMount) {
    nativeVideo = targetVideo || null;
    mountElement = targetMount;
    const guardedState = targetVideo ? guardedNativeStates.get(targetVideo) : null;
    nativeSnapshot = {
      visibility: targetVideo?.style.visibility ?? "",
      display: targetVideo?.style.display ?? "",
      opacity: targetVideo?.style.opacity ?? "",
      pointerEvents: targetVideo?.style.pointerEvents ?? "",
      zIndex: targetVideo?.style.zIndex ?? "",
      muted: guardedState?.muted ?? targetVideo?.muted ?? true,
      defaultMuted: guardedState?.defaultMuted ?? targetVideo?.defaultMuted ?? true,
      volume: guardedState?.volume ?? targetVideo?.volume ?? 1,
      controls: guardedState?.controls ?? targetVideo?.controls ?? false,
      playsInline: guardedState?.playsInline ?? targetVideo?.playsInline ?? true,
      autoplay: guardedState?.autoplay ?? targetVideo?.autoplay ?? false,
      autoplayAttribute: guardedState?.autoplayAttribute ?? targetVideo?.hasAttribute?.("autoplay") ?? false,
      paused: guardedState?.paused ?? targetVideo?.paused ?? true,
      loop: guardedState?.loop ?? targetVideo?.loop ?? false,
      playbackRate: targetVideo?.playbackRate ?? 1,
      defaultPlaybackRate: targetVideo?.defaultPlaybackRate ?? 1,
      currentTime: guardedState?.currentTime ?? targetVideo?.currentTime ?? 0,
      mountPosition: targetMount.style.position,
      mountOverflow: targetMount.style.overflow
    };
    nativeInitialPlayback = {
      paused: guardedState?.paused ?? targetVideo?.paused ?? true,
      currentTime: Number(targetVideo?.currentTime) || 0
    };

    // Replacement audio is primary until Audio Studio proves the native graph.
    nativeAudioBridgeActive = false;
    nativeAudioBridgeFailureCount = 0;
    if (targetVideo) {
      try {
        // Keep TikTok's native playback pipeline alive as a hidden audio/subtitle
        // clock. Do not mute/pause it here; doing so before the replacement is
        // audible was the main source of silent homepage clips.
        targetVideo.controls = false;
        targetVideo.playsInline = true;
        targetVideo.setAttribute('data-tdt-native-subtitle-clock','true');
        // Preserve TikTok's current audible state until the HD replacement starts.
      } catch {}
      targetVideo.style.pointerEvents = "none";
      targetVideo.style.visibility = "visible";
      targetVideo.style.opacity = "0";
      targetVideo.style.zIndex = "0";
    }

    const computedPosition = getComputedStyle(targetMount).position;
    if (!computedPosition || computedPosition === "static") targetMount.style.position = "relative";
    // Preserve TikTok's own overflow. On landscape feed cards the action rail can
    // sit outside the media box; forcing overflow:hidden clipped avatar/like/
    // comment/share controls.

    mediaLayer = document.createElement("div");
    mediaLayer.id = "tdt-lightdom-player";
    mediaLayer.className = "tdt-lightdom-player tpt-sm-videowrap";
    mediaLayer.setAttribute("data-tdt-player-root", "true");
    mediaLayer.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#000;overflow:hidden;z-index:2147482000;";

    mediaStyle = document.createElement("style");
    mediaStyle.id = "tdt-lightdom-player-style";
    mediaStyle.textContent = `
      [data-tdt-fullscreen-root="true"]:fullscreen,
      [data-tdt-fullscreen-root="true"]:-webkit-full-screen { width:100vw !important;height:100vh !important;max-width:none !important;max-height:none !important;margin:0 !important;padding:0 !important;background:#000 !important;overflow:hidden !important; }
      [data-tdt-fullscreen-root="true"]:fullscreen > #tdt-lightdom-player,
      [data-tdt-fullscreen-root="true"]:fullscreen > #tdt-tiktok-extension-host,
      [data-tdt-fullscreen-root="true"]:-webkit-full-screen > #tdt-lightdom-player,
      [data-tdt-fullscreen-root="true"]:-webkit-full-screen > #tdt-tiktok-extension-host { position:absolute !important;inset:0 !important;width:100% !important;height:100% !important; }
      [data-tdt-webfullscreen-root="true"] { position:fixed !important;inset:0 !important;width:100vw !important;height:100vh !important;max-width:none !important;max-height:none !important;margin:0 !important;padding:0 !important;background:#000 !important;overflow:hidden !important;z-index:2147483600 !important; }
      [data-tdt-webfullscreen-root="true"] > #tdt-tiktok-extension-host { position:absolute !important;inset:0 !important;width:100% !important;height:100% !important; }
      video[data-tdt-native-subtitle-clock="true"] { opacity:0 !important;visibility:visible !important;pointer-events:none !important;z-index:0 !important; }
      [data-tdt-clean-foreign-hidden="true"] { opacity:0 !important;visibility:hidden !important;pointer-events:none !important; }
      #tdt-lightdom-player > video.tdt-replacement-video {
        width:100% !important;height:100% !important;display:block !important;object-fit:contain !important;
        background:#000 !important;outline:0 !important;position:relative !important;inset:auto !important;
        opacity:1 !important;visibility:visible !important;pointer-events:auto !important;z-index:1 !important;
      }
      #tdt-lightdom-player > video.tdt-replacement-video::-webkit-media-controls { display:none !important; }
      #tdt-lightdom-player > #tt-sub-inline,
      #tdt-lightdom-player > [class*="tt-sub-inline"],
      [data-tdt-subtitle-source-hidden="true"] {
        opacity:0 !important; pointer-events:none !important;
      }
    `;
    const targetRoot = targetMount.getRootNode?.();
    const mediaStyleParent = targetRoot instanceof ShadowRoot ? targetRoot : document.documentElement;
    mediaStyleParent.appendChild(mediaStyle);

    host = document.createElement("div");
    host.id = "tdt-tiktok-extension-host";
    host.style.cssText = "all:initial;position:absolute;left:0;top:0;width:100%;height:100%;display:block;z-index:2147482001;background:transparent;overflow:hidden;isolation:isolate;contain:layout paint style;pointer-events:none;";
    applyPlayerLayerMode();
    targetMount.append(mediaLayer, host);
    shadow = host.attachShadow({ mode: "open" });
    createPanel();
    startPortalGeometryTracking();
    startPlayerRootTracking();
    setTimeout(() => promoteSubtitleTranslatorPanels(document), 120);
    ensureControlWidgetOnTop();
  }

  async function loadVideo(force = false, pageUrlOverride = "", forceApi = false) {
    let pageUrl = normalizeTikTokVideoUrl(pageUrlOverride || currentPageUrl) || effectiveTabVideoUrl();
    if (!pageUrl || !isTikTokUrl(pageUrl)) pageUrl = await refreshCurrentTabUrl(true);
    pageUrl = normalizeTikTokVideoUrl(pageUrl);
    if (!pageUrl || !isTikTokUrl(pageUrl) || !panel) return;
    if (!force && currentPageUrl === pageUrl && currentVideoInfo?.videoUrl) return;

    const requestedId = videoIdFromUrl(pageUrl);
    currentPageUrl = pageUrl;
    currentVideoId = requestedId;
    preparePlaybackIntentForVideo(currentVideoId);
    playerLoadStartedAt = Date.now();
    const token = ++currentRequestToken;
    setVideoGate(true, "Đang lấy đúng nguồn video HD…");
    suppressNativePlayback();

    const localCached = !forceApi ? pageVideoInfoCache.get(requestedId || canonicalUrl(pageUrl)) : null;
    if (localCached?.videoUrl && videoInfoMatchesUrl(localCached, pageUrl)) {
      renderVideo(localCached);
      return;
    }

    const exactHookCached = hookMediaCache.get(requestedId);
    if (!forceApi && exactHookCached?.videoUrl && videoInfoMatchesUrl(exactHookCached, pageUrl)) {
      rememberPageVideoInfo(pageUrl, exactHookCached);
      renderVideo(exactHookCached);
      return;
    }

    const apiPromise = runtimeMessage({ type: "GET_VIDEO_INFO", url: pageUrl, force: Boolean(forceApi) });
    const hookInfo = !forceApi && requestedId ? await waitForHookMedia(requestedId, MEDIA_HOOK_WAIT_MS) : null;
    if (token !== currentRequestToken || !panel) return;
    if (hookInfo?.videoUrl && videoInfoMatchesUrl(hookInfo, pageUrl)) {
      rememberPageVideoInfo(pageUrl, hookInfo);
      renderVideo(hookInfo);
    }

    try {
      const response = await apiPromise;
      if (token !== currentRequestToken || !panel) return;
      if (!response?.ok || !response.data?.videoUrl) throw new Error(response?.error || "Không lấy được video HD.");
      if (!videoInfoMatchesUrl(response.data, pageUrl)) throw new Error("Máy chủ trả về sai Video ID nên extension đã từ chối nguồn này.");
      rememberPageVideoInfo(pageUrl, response.data);
      if (video?.isConnected && currentVideoInfo?.videoUrl && normalizedInfoVideoId(currentVideoInfo) === requestedId) {
        currentVideoInfo = {
          ...response.data,
          ...currentVideoInfo,
          stats: { ...(response.data.stats || {}), ...(currentVideoInfo.stats || {}) },
          authorInfo: { ...(response.data.authorInfo || {}), ...(currentVideoInfo.authorInfo || {}) }
        };
        playerLoadStartedAt = 0;
        return;
      }
      renderVideo(response.data);
    } catch (error) {
      if (token !== currentRequestToken || !panel) return;
      if (video?.isConnected && currentVideoInfo?.videoUrl && normalizedInfoVideoId(currentVideoInfo) === requestedId) {
        playerLoadStartedAt = 0;
        return;
      }
      const lateHookInfo = requestedId ? hookMediaCache.get(requestedId) : null;
      if (lateHookInfo?.videoUrl && videoInfoMatchesUrl(lateHookInfo, pageUrl)) {
        rememberPageVideoInfo(pageUrl, lateHookInfo);
        renderVideo(lateHookInfo);
        return;
      }
      renderError(error.message || "Không thể tải đúng nguồn video HD.");
    }
  }

  async function mountPlayerForCurrentVideo(targetOverride = null) {
    if (!remoteAccessReady || remoteAccessLocked || !settingsReady || !extensionSettings.autoReplace || mounting || !isTikTokUrl(location.href)) return false;
    if (isBareCollectionGridPage()) {
      if (host) closePlayer({ restoreNative: true });
      return false;
    }
    const epoch = mountEpoch;
    mounting = true;
    try {
      const target = targetOverride || findBestPlayerTarget();
      if (epoch !== mountEpoch) return false;
      if (!target) {
        updateControlWidgetStatus("Chưa tìm thấy khung video TikTok. Extension sẽ tiếp tục tự quét.", "loading");
        return false;
      }
      const { targetVideo, targetMount } = target;
      const pageUrl = target.pageUrl || await refreshCurrentTabUrl(true);
      const targetId = videoIdFromUrl(pageUrl);
      if (targetId) requestHookMedia(targetId);
      if (!pageUrl || pageUrl === suppressedUrl || !targetMount?.isConnected || epoch !== mountEpoch) return false;
      if (isSearchResultPreviewElement(targetMount) || !searchCandidateMatchesPending(targetVideo || targetMount, pageUrl)) {
        updateControlWidgetStatus("Trang tìm kiếm chỉ thay thế video sau khi bạn bấm mở đúng thẻ video.", "loading");
        return false;
      }
      if (isSideRecommendationElement(targetMount) || candidateConflictsWithCurrentRoute(targetVideo || targetMount)
        || (targetId && !isPrimaryDetailRouteSurface(targetVideo || targetMount, targetId))) {
        updateControlWidgetStatus("Đã bỏ qua khung video đề xuất; chỉ giữ player video chính.", "loading");
        return false;
      }
      if (host?.isConnected && currentPageUrl === pageUrl && nativeVideo === targetVideo && mountElement === targetMount) return true;
      if (host) closePlayer({ restoreNative: true });
      if (epoch !== mountEpoch) return false;
      updateControlWidgetStatus("Đang lấy link tab hiện tại và tải video…", "loading");
      installInlineHost(targetVideo, targetMount);
      currentPageUrl = pageUrl;
      currentVideoId = videoIdFromUrl(pageUrl);
      if (currentVideoId) {
        lockedDetailVideoId = currentVideoId;
        lockedDetailMount = targetMount;
      }
      preparePlaybackIntentForVideo(currentVideoId);
      await loadVideo(true, pageUrl, false);
      return Boolean(host?.isConnected);
    } catch (error) {
      updateControlWidgetStatus(error?.message || "Không thể thay thế video; extension đang tự thử lại.", "error");
      if (host) closePlayer({ restoreNative: true });
      const now = Date.now();
      if (now - lastPlayerRecoveryAt > 900) {
        lastPlayerRecoveryAt = now;
        setTimeout(() => scheduleLifecycleScan(0), 900);
      }
      return false;
    } finally {
      if (epoch === mountEpoch) mounting = false;
    }
  }

  async function waitForPlayerTarget(timeoutMs = 8000, epoch = mountEpoch) {
    const startedAt = Date.now();
    while (epoch === mountEpoch && Date.now() - startedAt < timeoutMs) {
      const target = findBestPlayerTarget();
      if (target?.targetMount?.isConnected && !isSearchResultPreviewElement(target.targetMount) && !isSideRecommendationElement(target.targetMount)) return target;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return null;
  }

  async function forceScanCurrentVideo() {
    if (!remoteAccessReady) await refreshRemoteAccessState(false);
    if (remoteAccessLocked) throw new Error(remoteAccessState.reason || "Extension đã bị khóa bởi quản trị viên.");
    const epoch = ++mountEpoch;
    currentRequestToken += 1;
    mounting = false;
    suppressedUrl = "";
    extensionSettings = { ...extensionSettings, autoReplace: true };
    chrome.storage.local.set({ [SETTINGS_KEY]: extensionSettings });
    updateControlWidgetStatus("Đang chờ player video hiện tại…", "loading");
    if (host) closePlayer({ restoreNative: true });
    await refreshCurrentTabUrl(true);
    if (epoch !== mountEpoch) throw new Error("Lệnh quét đã được thay bằng lần quét mới hơn.");
    const target = await waitForPlayerTarget(8000, epoch);
    if (!target) throw new Error("Chưa tìm thấy player video đang mở. Hãy đóng video rồi mở lại từ kết quả tìm kiếm.");
    const mounted = await mountPlayerForCurrentVideo(target);
    if (!mounted || !host?.isConnected) throw new Error("Không thể gắn video thay thế vào player hiện tại.");
    updateControlWidgetStatus("Đã nhận đúng video và bắt đầu thay thế.", "ok");
    scheduleStartupScans();
    return { ok: true, videoId: videoIdFromUrl(target.pageUrl), url: target.pageUrl };
  }

  let observedUrl = String(location.href);

  function evaluatePlayerLifecycle() {
    if (!controlWidgetHost?.isConnected && settingsReady) createControlWidget();
    if (!watchUiHost?.isConnected && settingsReady) void initWatchAnalyticsAndUi();
    if (!remoteAccessReady) return;
    if (remoteAccessLocked) {
      if (host) closePlayer({ restoreNative: true });
      return;
    }
    if (isBareCollectionGridPage()) {
      // Keep every collection/grid card completely native and clickable. Also
      // clean up a player that may have been mounted before navigation returned
      // from a normal video detail surface to music/profile/tag/search grids.
      if (host) closePlayer({ restoreNative: true });
      return;
    }
    if (host?.isConnected) {
      const mountedRouteId = videoIdFromUrl(currentPageUrl || effectiveTabVideoUrl());
      if (isSideRecommendationElement(mountElement)
        || (mountedRouteId && !isPrimaryDetailRouteSurface(nativeVideo || mountElement, mountedRouteId))) {
        closePlayer({ restoreNative: true });
        scheduleLifecycleScan(120);
        return;
      }
      updatePortalGeometry();
      const maintenanceNow = Date.now();
      if (maintenanceNow - lastTranslatorPromotionAt >= EXTERNAL_TRANSCRIPT_SCAN_INTERVAL_MS) {
        lastTranslatorPromotionAt = maintenanceNow;
        promoteSubtitleTranslatorPanels(document);
      }
      if (extensionSettings.cleanMode) concealForeignCleanUi();
      if (extensionSettings.productWidgetEnabled) scanCurrentVideoProducts();
      const loadTimedOut = !video?.isConnected && playerLoadStartedAt > 0 && Date.now() - playerLoadStartedAt > PLAYER_MOUNT_TIMEOUT_MS;
      const replacementDetached = Boolean(video && (!video.isConnected || !mediaLayer?.contains(video)));
      if (loadTimedOut || replacementDetached || !mediaLayer?.isConnected || !mountElement?.isConnected) {
        const now = Date.now();
        if (now - lastPlayerRecoveryAt > 900) {
          lastPlayerRecoveryAt = now;
          closePlayer({ restoreNative: true });
          scheduleLifecycleScan(0);
          return;
        }
      }
    }
    if (document.hidden && host?.isConnected) return;
    void refreshCurrentTabUrl(false);
    const nextLocation = effectiveNavigationUrl();
    if (nextLocation !== observedUrl) {
      observedUrl = nextLocation;
      suppressedUrl = "";
      playerTargetCache = null;
      playerTargetCacheAt = 0;
      lockedDetailVideoId = "";
      lockedDetailMount = null;
      if (!isSearchRoute()) clearPendingSearchSelection();
    }

    if (!settingsReady || !extensionSettings.autoReplace || !isTikTokUrl(nextLocation)) {
      if (host) closePlayer({ restoreNative: true });
      return;
    }

    if (isSearchRoute() && !pendingSearchSelectionIsUsable()) {
      if (host) closePlayer({ restoreNative: true });
      return;
    }

    const routeVideoId = videoIdFromUrl(normalizeTikTokVideoUrl(nextLocation));
    if (host?.isConnected && mountElement?.isConnected && mediaLayer?.isConnected && video?.isConnected
      && !isSideRecommendationElement(mountElement)
      && (!routeVideoId || isPrimaryDetailRouteSurface(nativeVideo || mountElement, routeVideoId))) {
      const currentStillVisible = hasVisibleVideoGeometry(mountElement, 90, 120);
      const recentDifferentNative = lastNativePlayVideo instanceof HTMLVideoElement && lastNativePlayVideo !== nativeVideo
        && lastNativePlayVideo.isConnected && performance.now() - lastNativePlayAt <= RECENT_NATIVE_PLAY_WINDOW_MS;
      if ((routeVideoId && routeVideoId === currentVideoId) || (!routeVideoId && currentStillVisible && !recentDifferentNative)) return;
    }

    const target = findBestPlayerTarget();
    if (!target) {
      if (host && (!host.isConnected || !mountElement?.isConnected || (nativeVideo && !nativeVideo.isConnected))) {
        closePlayer({ restoreNative: true });
      }
      return;
    }

    const targetChanged = !host?.isConnected
      || !mountElement?.isConnected
      || (nativeVideo && !nativeVideo.isConnected)
      || canonicalUrl(currentPageUrl) !== canonicalUrl(target.pageUrl)
      || currentVideoId !== videoIdFromUrl(target.pageUrl)
      || nativeVideo !== target.targetVideo
      || mountElement !== target.targetMount;

    if (host && targetChanged) closePlayer({ restoreNative: true });
    if (!host && target.pageUrl !== suppressedUrl) void mountPlayerForCurrentVideo(target);
  }

  function scheduleLifecycleScan(delay = LIFECYCLE_SCAN_DEBOUNCE_MS) {
    const wait = Math.max(0, delay);
    if (lifecycleScanTimer) {
      if (wait > 0) return;
      clearTimeout(lifecycleScanTimer);
    }
    lifecycleScanTimer = setTimeout(() => {
      lifecycleScanTimer = null;
      evaluatePlayerLifecycle();
    }, wait);
  }

  function scheduleStartupScans() {
    if (!remoteAccessReady || remoteAccessLocked) {
      startupScanTimers.forEach((timer) => clearTimeout(timer));
      startupScanTimers = [];
      return;
    }
    void prefetchCurrentTabVideoInfo(false);
    startupScanTimers.forEach((timer) => clearTimeout(timer));
    startupScanTimers = STARTUP_SCAN_DELAYS_MS.map((delay) => setTimeout(() => scheduleLifecycleScan(0), delay));
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "TDT_REMOTE_ACCESS_CHANGED") {
      applyRemoteAccessState(message.state);
      sendResponse?.({ ok: true });
      return false;
    }
    if (remoteAccessLocked && ["TDT_FORCE_SCAN", "TDT_FORCE_SUB", "TDT_OPEN_WIDGET"].includes(message?.type)) {
      sendResponse?.({ ok: false, locked: true, error: remoteAccessState.reason || "Extension đã bị khóa bởi quản trị viên." });
      return false;
    }
    if (message?.type === "TDT_PAUSE_FOR_OTHER_MEDIA") {
      if (extensionSettings.smartAutoPause && video && !video.paused) {
        pausedBySmartAutoPause = true;
        shouldResumeFromBackground = false;
        stopHiddenPlaybackKeepAlive();
        video.pause();
        updateControlWidgetStatus("Smart Auto-Pause: đã dừng vì tab khác đang phát media.", "loading");
        showNotice("Đã tự dừng video vì tab khác bắt đầu phát media.", true);
      }
      return false;
    }
    if (message?.type === "TDT_FORCE_SCAN") {
      void forceScanCurrentVideo()
        .then((result) => sendResponse?.(result))
        .catch((error) => sendResponse?.({ ok: false, error: error.message || "Không thể quét video." }));
      return true;
    }
    if (message?.type === "TDT_FORCE_SUB") {
      void (async () => {
        if (!video || !host?.isConnected) {
          suppressedUrl = "";
          extensionSettings = extensionSettings.placeBelowSubtitleTranslator
            ? { ...extensionSettings, autoReplace: true }
            : { ...extensionSettings, autoReplace: true, scanSubtitles: true };
          chrome.storage.local.set({ [SETTINGS_KEY]: extensionSettings });
          await refreshCurrentTabUrl(true);
          await mountPlayerForCurrentVideo();
        }
        if (!video) {
          updateControlWidgetStatus("Chưa tìm thấy video để lấy sub.", "error");
          return;
        }
        if (extensionSettings.placeBelowSubtitleTranslator && await forceReadExternalSubtitles()) return;
        await autoLoadSubtitles(true);
      })().catch((error) => {
        updateControlWidgetStatus(error.message || "Không thể lấy phụ đề.", "error");
        showNotice(error.message || "Không thể lấy phụ đề.");
      });
      return false;
    }
    if (message?.type === "TDT_OPEN_WIDGET") {
      createControlWidget();
      setControlWidgetOpen(true);
      ensureControlWidgetOnTop();
      return false;
    }
    if (message?.type !== "TDT_TAB_URL_UPDATED") return false;
    const rawUrl = String(message.url || "");
    if (isTikTokUrl(rawUrl)) authoritativeTabUrl = rawUrl;
    suppressedUrl = "";
    updateControlWidgetStatus("Đã nhận link tab hiện tại, đang nhận diện video…", "loading");
    if (!remoteAccessLocked) scheduleStartupScans();
    return false;
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.source === MEDIA_HOOK_SOURCE && event.data?.type === "media") {
      const items = Array.isArray(event.data.items) ? event.data.items : [];
      for (const item of items) {
        const info = cacheHookMediaInfo(item);
        if (!info) continue;
        if (panel && !video?.isConnected && currentVideoId === info.videoId && currentPageUrl && videoInfoMatchesUrl(info, currentPageUrl)) {
          rememberPageVideoInfo(currentPageUrl, info);
          renderVideo(info);
        }
      }
      return;
    }
    if (event.data?.source !== PRODUCT_HOOK_SOURCE || event.data?.type !== "products") return;
    const items = Array.isArray(event.data.items) ? event.data.items : [];
    for (const item of items) {
      const videoId = String(item?.videoId || "").match(/\d{8,}/)?.[0] || "";
      if (!videoId) continue;
      const products = collectProductsFromData(item.anchors || []);
      if (!products.length) continue;
      const previous = productInfoCache.get(videoId)?.products || [];
      const merged = new Map(previous.map((product) => [product.id, product]));
      for (const product of products) merged.set(product.id, { ...(merged.get(product.id) || {}), ...product });
      cacheProductInfo(videoId, { products:Array.from(merged.values()), updatedAt:Date.now() });
      if (videoId === currentTikTokVideoId()) { productScanSignature = ""; scanCurrentVideoProducts(); }
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable) return;
    const videoInfoPanel = watchUiShadow?.getElementById("video-info-panel");
    if ((event.code === "Escape" || event.key === "Escape") && ((watchModal && !watchModal.hidden) || (videoInfoPanel && !videoInfoPanel.hidden))) {
      closeWatchModal();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!video || !host?.isConnected) return;
    const code = String(event.code || "");
    const key = String(event.key || "").toLowerCase();
    if (code === "Space" || key === " " || key === "spacebar") {
      const wasPaused = video.paused;
      toggleReplacementPlayback();
      showNotice(wasPaused ? "Đang phát" : "Đã tạm dừng", true);
    } else if (code === "ArrowLeft" || code === "ArrowRight" || key === "arrowleft" || key === "arrowright") {
      const direction = code === "ArrowLeft" || key === "arrowleft" ? -1 : 1;
      const duration = Number.isFinite(video.duration) ? Math.max(0, video.duration) : Infinity;
      try { video.currentTime = Math.max(0, Math.min(duration, (Number(video.currentTime) || 0) + direction * 3)); } catch {}
      updatePlayerProgress();
      updateCaptionOverlay();
      showNotice(direction < 0 ? "Tua lại 3 giây" : "Tua tới 3 giây", true);
    } else if (code === "Comma" || key === "," || key === "<") {
      stepPlaybackRate(-1);
    } else if (code === "Period" || key === "." || key === ">") {
      stepPlaybackRate(1);
    } else if (code === "KeyZ" || key === "z") {
      cycleVideoZoom();
    } else if (code === "KeyS" || key === "s") {
      void copyCurrentFrameToClipboard().catch((error) => showNotice(error.message || "Không thể copy frame video."));
    } else if (code === "KeyC" || key === "c") {
      toggleCleanMode();
    } else if (code === "KeyI" || key === "i") {
      showVideoInfo(playerInfoButton);
    } else if (code === "KeyD" || key === "d") {
      void downloadVideoInfo(currentVideoInfo || {}, null);
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }, true);

  const lifecycleTimer = setInterval(() => {
    // DOM discovery is unnecessary in background tabs; background playback has
    // its own lightweight keep-alive path.
    if (!document.hidden) evaluatePlayerLifecycle();
  }, PLAYER_RETRY_MS);
  function mutationNodeMayAffectPlayer(node) {
    if (!(node instanceof Element)) return false;
    if (isSearchRoute() && (isSearchResultGridElement(node) || node.closest?.('[data-e2e="search_top-item-list"]'))) return false;
    const selector = [
      'video', '[role="dialog"]', '[data-e2e="feed-video"]', '[data-e2e="browse-video"]',
      '[data-e2e="video-player"]', 'xg-player', 'xg-video-container', '.xgplayer-container',
      '.tiktok-web-player', '[class*="PlayerContainer"]', '[class*="VideoContainer"]'
    ].join(',');
    if (node.matches?.(selector)) return true;
    if (node.childElementCount > 1800) return Boolean(node.querySelector?.('video,[data-e2e="feed-video"],[id^="xgwrapper-"]'));
    return Boolean(node.querySelector?.(selector));
  }

  lifecycleObserver = new MutationObserver((records) => {
    let playerSurfaceChanged = false;
    let audioSurfaceChanged = false;
    for (const record of records) {
      const target = record.target;
      const ownChange = target === host || host?.contains?.(target) || target === mediaLayer || mediaLayer?.contains?.(target) || target === controlWidgetHost || controlWidgetHost?.contains?.(target) || target === watchUiHost || watchUiHost?.contains?.(target);
      if (ownChange) continue;
      for (const node of record.addedNodes) {
        suppressTikTokShopAppNotice(node);
        if (!audioSurfaceChanged && node instanceof Element
          && (node.matches?.("video") || node.querySelector?.("video"))) audioSurfaceChanged = true;
        if (node instanceof Element && (node.matches?.('#tt-sub-inline,[class*="tt-sub-inline"],[data-tt-sub-inline]') || node.querySelector?.('#tt-sub-inline,[class*="tt-sub-inline"],[data-tt-sub-inline]'))) {
          promoteSubtitleTranslatorPanels(node);
        }
        if (!playerSurfaceChanged && mutationNodeMayAffectPlayer(node)) playerSurfaceChanged = true;
      }
      if (!playerSurfaceChanged) {
        for (const node of record.removedNodes) {
          if (!audioSurfaceChanged && node instanceof Element
            && (node.matches?.("video") || node.querySelector?.("video"))) audioSurfaceChanged = true;
          if (node === mountElement || node === nativeVideo || node === mediaLayer || (node instanceof Element && (node.contains?.(mountElement) || node.contains?.(nativeVideo)))) {
            playerSurfaceChanged = true;
            break;
          }
        }
      }
    }
    if (playerSurfaceChanged) scheduleLifecycleScan();
    if (extensionSettings.audioEnabled && (audioSurfaceChanged || playerSurfaceChanged)) scheduleAudioStudioScan(35);
  });
  lifecycleObserver.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });
  suppressTikTokShopAppNotice(document);
  setTimeout(() => suppressTikTokShopAppNotice(document), 400);
  setTimeout(() => suppressTikTokShopAppNotice(document), 1400);
  document.addEventListener("playing", (event) => {
    const targetVideo = event.target;
    if (!(targetVideo instanceof HTMLVideoElement) || !extensionSettings.audioEnabled) return;
    markAudioCorsConfirmed(targetVideo);
    if (!shouldAttachAudioToVideo(targetVideo)) return;
    void ensureAudioContext({ resume:true }).then((context) => {
      if (context?.state !== "running") return;
      void ensureAudioEngine(audioStudioTarget(targetVideo));
      scheduleAudioStudioScan(10);
    });
  }, true);

  document.addEventListener("play", (event) => {
    const targetVideo = event.target;
    if (targetVideo instanceof HTMLVideoElement && shouldAttachAudioToVideo(targetVideo) && (extensionSettings.audioEnabled || audioEngines.has(targetVideo))) {
      markAudioCorsConfirmed(targetVideo);
      void ensureAudioContext({ resume:true }).then((context) => {
        if (context?.state !== "running") return;
        if (extensionSettings.audioEnabled) { void ensureAudioEngine(audioStudioTarget(targetVideo)); scheduleAudioStudioScan(60); }
        else applyAudioSettingsToEngine(audioEngines.get(targetVideo));
      });
    }
    // Playback events from the current hidden native audio bridge are expected;
    // never interpret them as a new TikTok card that should be remounted.
    if (targetVideo === nativeVideo && nativeAudioBridgeActive) return;
    if (!(targetVideo instanceof HTMLVideoElement) || targetVideo === video || targetVideo.matches?.('[data-tdt-replacement="true"]')) return;
    // Hover previews in search results and right-side recommendation cards must
    // remain native/clickable and must never steal the replacement session.
    if (isSearchResultPreviewElement(targetVideo) || isSideRecommendationElement(targetVideo)
      || candidateConflictsWithCurrentRoute(targetVideo)) return;
    const routeId = videoIdFromUrl(effectiveTabVideoUrl());
    if (routeId && !isPrimaryDetailRouteSurface(targetVideo, routeId)) return;
    const resolvedUrl = resolveVideoUrlForElement(targetVideo) || "";
    if (!searchCandidateMatchesPending(targetVideo, resolvedUrl) || (isSearchRoute() && !isLikelySearchDetailSurface(targetVideo))) return;
    lastNativePlayVideo = targetVideo;
    lastNativePlayAt = performance.now();
    lastNativePlayUrl = resolvedUrl;
    playerTargetCache = null;
    playerTargetCacheAt = 0;
    guardNativeVideoAudio(targetVideo);
    const targetMount = findExactPlayerContainer(targetVideo);
    if (lastNativePlayUrl) {
      const id = videoIdFromUrl(lastNativePlayUrl);
      if (id) requestHookMedia(id);
      if (id && currentVideoId && id !== currentVideoId && host?.isConnected) {
        // TikTok has advanced to another feed item. Stop every byte of the old
        // replacement immediately, invalidate its async work, then mount only
        // the newly played native card.
        mountEpoch += 1;
        mounting = false;
        closePlayer({ restoreNative: true });
      } else if (video && id && id !== normalizedInfoVideoId(currentVideoInfo)) {
        try {
          video.pause();
          video.muted = true;
          video.volume = 0;
        } catch {}
      }
      if (remoteAccessReady && !remoteAccessLocked && settingsReady && extensionSettings.autoReplace && targetMount?.isConnected) {
        void mountPlayerForCurrentVideo({ targetVideo, targetMount, pageUrl:lastNativePlayUrl });
      }
    }
    scheduleLifecycleScan(0);
  }, true);
  for (const eventName of ["loadedmetadata", "canplay", "emptied"]) {
    document.addEventListener(eventName, (event) => {
      if (event.target instanceof HTMLVideoElement && event.target !== video) {
        const targetVideo = event.target;

        // Audio Studio must be evaluated BEFORE replacement-preview filtering.
        // A music/profile/search hover preview is not an Auto Replace target, but
        // it is still a valid actively-playing TikTok audio source.
        if (eventName === "emptied") {
          delete targetVideo.dataset.tdtAudioBypass;
          delete targetVideo.dataset.tdtAudioBypassSource;
          delete targetVideo.dataset.tdtAudioBypassReason;
          delete targetVideo.dataset.tdtCorsConfirmed;
        } else markAudioCorsConfirmed(targetVideo);
        if (eventName !== "emptied" && shouldAttachAudioToVideo(targetVideo) && (extensionSettings.audioEnabled || audioEngines.has(targetVideo))) {
          void ensureAudioContext({ resume:true }).then((context) => {
            if (context?.state !== "running") return;
            if (extensionSettings.audioEnabled) {
              void ensureAudioEngine(audioStudioTarget(targetVideo));
              scheduleAudioStudioScan(20);
            } else applyAudioSettingsToEngine(audioEngines.get(targetVideo));
          });
        }

        const routeId = videoIdFromUrl(effectiveTabVideoUrl());
        if (isSearchResultPreviewElement(targetVideo) || isSideRecommendationElement(targetVideo)
          || candidateConflictsWithCurrentRoute(targetVideo)
          || (routeId && !isPrimaryDetailRouteSurface(targetVideo, routeId))) return;
        playerTargetCache = null;
        playerTargetCacheAt = 0;
        if (eventName !== "emptied" && hasVisibleVideoGeometry(targetVideo)) {
          const exactUrl = resolveVideoUrlForElement(targetVideo);
          const id = videoIdFromUrl(exactUrl);
          if (id) requestHookMedia(id);
        }
        if (!targetVideo.paused) guardNativeVideoAudio(targetVideo);
        scheduleLifecycleScan(eventName === "emptied" ? 120 : 0);
      }
    }, true);
  }
  // Chrome may suspend Web Audio after tab/background transitions. Any real user
  // interaction should immediately restore the shared context before playback.
  document.addEventListener("keydown", () => {
    if (autoplayMutedFallback) unlockAutoplaySound();
    if (extensionSettings.audioEnabled) void unlockAudioStudioForPage();
    else if (audioEngines.size) scheduleAudioContextRecovery(0);
  }, true);
  window.addEventListener("focus", () => {
    if (autoplayMutedFallback) scheduleAutoplaySoundRecovery(80, 6);
    if (extensionSettings.audioEnabled || audioEngines.size) scheduleAudioContextRecovery(0);
  }, true);

  document.addEventListener("pointerdown", (event) => {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
    if (isSearchRoute()) {
      const searchNode = path.find((node) => node instanceof Element && (node.closest?.('a[href*="/video/"]') || searchResultCardForElement(node)));
      const selectedUrl = clickedSearchVideoUrl(searchNode);
      if (selectedUrl) registerPendingSearchSelection(selectedUrl);
    }
    const volumeInteraction = path.includes(playerVolumeButton) || path.includes(playerVolumeRange) || path.includes(playerVolumePopover);
    const unlockedSound = volumeInteraction ? false : unlockAutoplaySound();
    if (unlockedSound && event.target === video && !video.paused) {
      suppressNextVideoClick = true;
      setTimeout(() => { suppressNextVideoClick = false; }, 700);
    }
    if (extensionSettings.audioEnabled) void unlockAudioStudioForPage();
    if (!isBareCollectionGridPage() || !host?.isConnected) return;
    const previewCardHit = path.some((node) => node instanceof Element && (
      isGenericPreviewGridElement(node) || Boolean(node.closest?.('[data-e2e="user-post-item"],#user-post-item-list,a[href*="/video/"]'))
    ));
    if (previewCardHit) closePlayer({ restoreNative: true });
  }, true);
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (isSearchRoute() && target) {
      const selectedUrl = clickedSearchVideoUrl(target);
      if (selectedUrl) {
        registerPendingSearchSelection(selectedUrl);
        scheduleLifecycleScan(40);
        return;
      }
      const closeControl = target.closest?.('button[aria-label*="Đóng" i],button[aria-label*="Close" i],[data-e2e*="close" i]');
      if (closeControl && host?.isConnected) {
        mountEpoch += 1;
        currentRequestToken += 1;
        closePlayer({ restoreNative: true });
        clearPendingSearchSelection();
        scheduleLifecycleScan(160);
        return;
      }
    }
    if (target?.closest?.('a[href*="/video/"],button,[data-e2e*="video"]')) scheduleLifecycleScan(80);
  }, true);
  window.addEventListener("pagehide", () => void saveWatchAnalyticsNow());
  window.addEventListener("beforeunload", () => void saveWatchAnalyticsNow());
  window.addEventListener("resize", schedulePortalGeometryUpdate, { passive: true });
  window.addEventListener("scroll", () => {
    playerTargetCache = null;
    playerTargetCacheAt = 0;
    schedulePortalGeometryUpdate();
    clearTimeout(scrollLifecycleTimer);
    scrollLifecycleTimer = setTimeout(() => {
      scrollLifecycleTimer = null;
      if (!document.hidden) scheduleLifecycleScan(0);
    }, 180);
  }, { passive: true, capture: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      schedulePortalGeometryUpdate();
      scheduleLifecycleScan(0);
      if (extensionSettings.audioEnabled || audioEngines.size) scheduleAudioContextRecovery(0);
      if (autoplayMutedFallback) scheduleAutoplaySoundRecovery(100, 8);
    }
  });
  window.addEventListener("popstate", () => scheduleLifecycleScan(0));
  window.addEventListener("hashchange", () => scheduleLifecycleScan(0));
  window.addEventListener("pageshow", () => {
    void refreshCurrentTabUrl(true);
    scheduleStartupScans();
    if (extensionSettings.audioEnabled || audioEngines.size) scheduleAudioContextRecovery(0);
    if (autoplayMutedFallback) scheduleAutoplaySoundRecovery(100, 8);
  });
  window.addEventListener("load", () => scheduleStartupScans(), { once: true });
  document.addEventListener("DOMContentLoaded", () => scheduleStartupScans(), { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      shouldResumeFromBackground = Boolean(video && !video.paused && !videoGateLocked);
      if (!extensionSettings.backgroundPlay && shouldResumeFromBackground) {
        video.pause();
        return;
      }
      if (extensionSettings.backgroundPlay && shouldResumeFromBackground && !pausedBySmartAutoPause && !isCurrentVideoManuallyPaused()) {
        if (extensionSettings.audioEnabled || audioEngines.size) scheduleAudioContextRecovery(0);
        ensureVideoSound();
        video.play().catch(() => {});
        startHiddenPlaybackKeepAlive();
      }
      return;
    }
    stopHiddenPlaybackKeepAlive();
    void refreshCurrentTabUrl(true);
    scheduleStartupScans();
    if (shouldResumeFromBackground && !pausedBySmartAutoPause && !isCurrentVideoManuallyPaused() && video && !videoGateLocked) {
      ensureVideoSound();
      video.play().catch(() => {});
    }
    shouldResumeFromBackground = false;
  });

  void refreshCurrentTabUrl(true).finally(() => {
    scheduleStartupScans();
    if (settingsReady && extensionSettings.autoReplace) void mountPlayerForCurrentVideo();
  });

  window.addEventListener("pagehide", () => {
    clearInterval(lifecycleTimer);
    clearTimeout(lifecycleScanTimer);
    startupScanTimers.forEach((timer) => clearTimeout(timer));
    startupScanTimers = [];
    clearTimeout(remoteAccessLeaseTimer);
    stopAudioStudioSupervisor();
    lifecycleObserver?.disconnect();
    closePlayer({ restoreNative: true });
    restoreGuardedNativeVideos();
    controlWidgetHost?.remove();
  }, { once: true });
})();
