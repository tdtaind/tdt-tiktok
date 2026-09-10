(() => {
  "use strict";

  if (globalThis.__TDT_TRANSCRIPT365_BRIDGE_V24__) return;
  globalThis.__TDT_TRANSCRIPT365_BRIDGE_V24__ = true;

  const RESULT_KEY = "tdt_transcript365_latest";
  const NO_SUB_KEY = "tdt_transcript365_no_sub_latest";
  const REQUEST_KEY = "tdt_transcript365_request";
  const SUBMIT_GUARD_KEY = "tdt_transcript365_submit_guard";
  const MAIN_HOOK_SOURCE = "tdt-transcript365-main-hook";
  const MAX_TEXT_LENGTH = 2500000;
  let latestRequest = null;
  let lastSignature = "";
  let autoGenerateClicked = false;
  let requestObservedAt = 0;
  let submittedRequestId = "";
  let scanTimer = null;
  let lastDeepScanAt = 0;
  let noSubSaved = false;
  const fetchedUrls = new Set();

  function parseTimestamp(value) {
    const normalized = String(value || "").trim().replace(",", ".");
    const parts = normalized.split(":");
    if (parts.length < 2 || parts.length > 3) return NaN;
    const seconds = Number(parts.pop());
    const minutes = Number(parts.pop());
    const hours = parts.length ? Number(parts.pop()) : 0;
    return [seconds, minutes, hours].every(Number.isFinite) ? hours * 3600 + minutes * 60 + seconds : NaN;
  }

  function normalizeTime(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value > 100000 ? value / 1000 : value;
    const text = String(value || "").trim();
    if (!text) return NaN;
    if (text.includes(":")) return parseTimestamp(text);
    const number = Number(text);
    return Number.isFinite(number) ? (number > 100000 ? number / 1000 : number) : NaN;
  }

  function formatTime(secondsValue) {
    const totalMs = Math.max(0, Math.round((Number(secondsValue) || 0) * 1000));
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const milliseconds = totalMs % 1000;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
  }

  function decodeText(value) {
    const element = document.createElement("textarea");
    element.innerHTML = String(value || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    return element.value.replace(/\u200b/g, "").trim();
  }

  function cuesToVtt(cues) {
    return `WEBVTT\n\n${cues.map((cue, index) => `${index + 1}\n${formatTime(cue.start)} --> ${formatTime(cue.end)}\n${cue.text}`).join("\n\n")}`;
  }

  function parseTimedText(rawText) {
    const text = String(rawText || "").replace(/^\uFEFF/, "").replace(/\r/g, "").replace(/(\d{2}:\d{2}:\d{2}),([0-9]{3})/g, "$1.$2");
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
      const cueText = decodeText(lines.slice(timingIndex + 1).join("\n"));
      if (Number.isFinite(start) && Number.isFinite(end) && end > start && cueText) cues.push({ start, end, text: cueText });
    }
    return cues.sort((a, b) => a.start - b.start);
  }

  function timestampTextToVtt(rawText) {
    const text = String(rawText || "").replace(/\r/g, "").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n");
    const pattern = /(?:^|\n)\s*((?:(?:\d{1,2}:)?\d{1,2}:\d{2})(?:[.,]\d{1,3})?)\s+(.*?)(?=(?:\n\s*(?:(?:\d{1,2}:)?\d{1,2}:\d{2})(?:[.,]\d{1,3})?\s+)|$)/gs;
    const segments = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const start = parseTimestamp(match[1]);
      const cueText = decodeText(match[2])
        .replace(/\n\s*(?:Copy|TXT|SRT|VTT|Download|Export|Tải xuống)\s*$/gi, "")
        .trim();
      if (Number.isFinite(start) && cueText && cueText.length <= 2000) segments.push({ start, text: cueText });
    }
    if (segments.length < 2) return "";
    const unique = [];
    const seen = new Set();
    for (const segment of segments.sort((a, b) => a.start - b.start)) {
      const key = `${segment.start.toFixed(3)}|${segment.text}`;
      if (!seen.has(key)) { seen.add(key); unique.push(segment); }
    }
    const duration = Math.max(0, Number(document.querySelector("video")?.duration) || 0);
    return cuesToVtt(unique.map((segment, index) => {
      const next = unique[index + 1]?.start;
      let end = Number.isFinite(next) && next > segment.start ? next - 0.04 : segment.start + 4;
      if (duration > segment.start) end = Math.min(end, duration);
      if (end <= segment.start + 0.25) end = segment.start + 1.5;
      return { start: segment.start, end, text: segment.text };
    }));
  }

  function captionArrayToVtt(items) {
    if (!Array.isArray(items)) return "";
    const cues = [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const start = normalizeTime(item.start_time ?? item.startTime ?? item.start ?? item.from ?? item.begin ?? item.offset);
      let end = normalizeTime(item.end_time ?? item.endTime ?? item.end ?? item.to ?? item.finish);
      const text = decodeText(item.text ?? item.content ?? item.caption ?? item.subtitle ?? item.value ?? item.words ?? "");
      if (!Number.isFinite(start) || !text) continue;
      if (!Number.isFinite(end) || end <= start) end = start + Math.max(1.5, Number(item.duration) || 3);
      cues.push({ start, end, text });
    }
    return cues.length >= 2 ? cuesToVtt(cues.sort((a, b) => a.start - b.start)) : "";
  }

  function extractVtt(value, depth = 0, seen = new Set()) {
    if (value == null || depth > 9) return "";
    if (typeof value === "string") {
      const text = value.trim();
      if (!text || text.length > MAX_TEXT_LENGTH) return "";
      if (/WEBVTT|-->/.test(text)) {
        const cues = parseTimedText(text);
        if (cues.length >= 2) return cuesToVtt(cues);
      }
      if ((text.match(/(?:^|\n)\s*(?:(?:\d{1,2}:)?\d{1,2}:\d{2})(?:[.,]\d{1,3})?\b/g) || []).length >= 2) {
        const vtt = timestampTextToVtt(text);
        if (vtt) return vtt;
      }
      try {
        if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) return extractVtt(JSON.parse(text), depth + 1, seen);
      } catch {
        return "";
      }
      return "";
    }
    if (typeof value !== "object" || seen.has(value)) return "";
    seen.add(value);
    if (Array.isArray(value)) {
      const direct = captionArrayToVtt(value);
      if (direct) return direct;
      for (const item of value) {
        const nested = extractVtt(item, depth + 1, seen);
        if (nested) return nested;
      }
      return "";
    }
    const preferred = ["vtt", "srt", "subtitles", "subtitle", "captions", "caption", "transcript", "transcripts", "segments", "utterances", "words", "result", "data", "payload", "content"];
    for (const key of preferred) {
      if (!(key in value)) continue;
      const nested = extractVtt(value[key], depth + 1, seen);
      if (nested) return nested;
    }
    for (const nestedValue of Object.values(value)) {
      const nested = extractVtt(nestedValue, depth + 1, seen);
      if (nested) return nested;
    }
    return "";
  }

  function getVideoId(value) {
    return String(value || "").match(/\/video\/(\d+)/)?.[1] || "";
  }

  function findTikTokSourceUrl() {
    const candidates = [];
    const decodedLocation = (() => { try { return decodeURIComponent(location.href); } catch { return location.href; } })();
    candidates.push(decodedLocation, latestRequest?.pageUrl || "");
    document.querySelectorAll('input,textarea,[contenteditable="true"]').forEach((element) => candidates.push(element.value || element.textContent || ""));
    for (const text of candidates) {
      const match = String(text).match(/https?:\/\/(?:www\.)?tiktok\.com\/[^\s"'<>]+/i);
      if (match) return match[0].replace(/[),.;]+$/, "");
    }
    return latestRequest?.pageUrl || "";
  }

  function saveResult(vtt, sourceUrl = "") {
    const cues = parseTimedText(vtt);
    if (cues.length < 2) return false;
    const normalized = cuesToVtt(cues);
    const signature = `${cues.length}|${cues[0].start}|${cues[0].text}|${cues.at(-1).text}`;
    if (signature === lastSignature) return false;
    lastSignature = signature;
    const resolvedSource = sourceUrl || findTikTokSourceUrl();
    const result = {
      source: "Transcript365",
      vtt: normalized,
      cueCount: cues.length,
      sourceUrl: resolvedSource,
      videoId: getVideoId(resolvedSource) || latestRequest?.videoId || "",
      pageUrl: location.href,
      requestId: latestRequest?.requestId || "",
      generatedAt: Date.now()
    };
    chrome.storage.local.set({ [RESULT_KEY]: result }, () => {
      if (chrome.runtime.lastError) return;
      chrome.runtime.sendMessage({
        type: "TRANSCRIPT365_RESULT_READY",
        requestId: result.requestId,
        videoId: result.videoId
      }, () => void chrome.runtime.lastError);
    });
    return true;
  }

  function saveNoSubtitle(reason = "") {
    if (noSubSaved || lastSignature || !requestIsActive(latestRequest)) return false;
    noSubSaved = true;
    const resolvedSource = findTikTokSourceUrl();
    const result = {
      source: "Transcript365",
      noSub: true,
      reason: String(reason || "Transcript365 không tìm thấy phụ đề cho video này.").slice(0, 500),
      sourceUrl: resolvedSource,
      videoId: getVideoId(resolvedSource) || latestRequest?.videoId || "",
      pageUrl: location.href,
      requestId: latestRequest?.requestId || "",
      generatedAt: Date.now()
    };
    chrome.storage.local.set({ [NO_SUB_KEY]: result }, () => {
      if (chrome.runtime.lastError) return;
      chrome.runtime.sendMessage({
        type: "TRANSCRIPT365_NO_SUB_READY",
        requestId: result.requestId,
        videoId: result.videoId
      }, () => void chrome.runtime.lastError);
    });
    return true;
  }

  function detectNoSubtitleState() {
    if (lastSignature || noSubSaved || !requestIsActive(latestRequest) || !autoGenerateClicked) return false;
    if (Date.now() - requestObservedAt < 1800) return false;
    const selectors = [
      '[role="alert"]', '[role="status"]', '[aria-live="assertive"]', '[aria-live="polite"]',
      '[class*="error" i]', '[class*="empty" i]', '[class*="message" i]', '[class*="toast" i]',
      '[class*="result" i]', '[data-testid*="result" i]', '[class*="transcript" i]'
    ];
    const messages = [];
    for (const selector of selectors) {
      try {
        document.querySelectorAll(selector).forEach((node) => {
          if (!visible(node)) return;
          const text = String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
          if (text && text.length <= 1200) messages.push(text);
        });
      } catch {}
    }
    const combined = messages.join(" | ");
    if (!combined.trim()) return false;
    const noSubPattern = /(?:no\s+(?:transcript|subtitles?|captions?)\s+(?:found|available|generated)|(?:transcript|subtitles?|captions?)\s+(?:not\s+found|unavailable)|could(?:\s+not|n't)\s+(?:generate|find|transcribe)|unable\s+to\s+(?:generate|transcribe)|no\s+speech\s+detected|video\s+(?:has|contains)\s+no\s+(?:speech|audio)|không\s+(?:có|tìm\s+thấy|tạo\s+được).{0,80}(?:phụ\s+đề|bản\s+ghi)|ไม่พบ.{0,80}(?:คำบรรยาย|ถอดเสียง)|ไม่มี.{0,80}(?:คำบรรยาย|เสียงพูด))/i;
    const match = combined.match(noSubPattern);
    return match ? saveNoSubtitle(match[0]) : false;
  }

  function processCandidate(value, sourceUrl = "") {
    const vtt = extractVtt(value);
    return vtt ? saveResult(vtt, sourceUrl) : false;
  }

  function visible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 2 && rect.height > 2 && style.display !== "none" && style.visibility !== "hidden";
  }

  function setNativeValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, value); else element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function requestIsActive(request) {
    if (!request || request.active === false || !request.pageUrl || !request.requestId) return false;
    const now = Date.now();
    const requestedAt = Number(request.requestedAt) || 0;
    const expiresAt = Number(request.expiresAt) || (requestedAt + 120000);
    return requestedAt > 0 && now >= requestedAt - 5000 && now <= expiresAt;
  }

  function clickGuardKey() {
    return `tdt365-submitted:${latestRequest?.requestId || "none"}`;
  }

  function maybeAutoGenerate() {
    if (window.top !== window.self || autoGenerateClicked || !requestIsActive(latestRequest) || !document.body) return;
    if (Date.now() - requestObservedAt < 650 || document.readyState === "loading") return;

    if (submittedRequestId === latestRequest.requestId) {
      autoGenerateClicked = true;
      return;
    }
    try {
      if (sessionStorage.getItem(clickGuardKey()) === "1") {
        autoGenerateClicked = true;
        return;
      }
    } catch {}

    const input = Array.from(document.querySelectorAll('input[type="url"],input[placeholder*="URL" i],input[placeholder*="link" i],textarea')).find(visible);
    if (!input) return;
    const currentValue = String(input.value || "").trim();
    if (currentValue !== latestRequest.pageUrl) {
      setNativeValue(input, latestRequest.pageUrl);
      return;
    }

    const buttons = Array.from(document.querySelectorAll('button,[role="button"],input[type="submit"]')).filter(visible);
    const generateButton = buttons.find((button) => {
      const text = `${button.textContent || button.value || ""} ${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""}`.trim();
      return /generate|transcribe|create transcript|start transcription|tạo.*(?:phụ đề|bản ghi|transcript)|trích xuất/i.test(text)
        && !/download|export|copy|login|sign in/i.test(text)
        && !button.disabled;
    });
    if (!generateButton) return;

    autoGenerateClicked = true;
    submittedRequestId = latestRequest.requestId;
    try { sessionStorage.setItem(clickGuardKey(), "1"); } catch {}
    chrome.storage.local.set({
      [SUBMIT_GUARD_KEY]: { requestId: latestRequest.requestId, submittedAt: Date.now() }
    }, () => void chrome.runtime.lastError);
    setTimeout(() => {
      try {
        generateButton.click();
        [60, 140, 280, 520, 900].forEach((delay) => setTimeout(scanDom, delay));
      } catch { autoGenerateClicked = false; }
    }, 25);
  }

  function scanDom() {
    maybeAutoGenerate();
    if (detectNoSubtitleState()) return;
    const selectors = [
      'textarea', 'pre', 'code', '[contenteditable="true"]',
      '[class*="transcript" i]', '[id*="transcript" i]',
      '[class*="subtitle" i]', '[id*="subtitle" i]',
      '[class*="caption" i]', '[id*="caption" i]',
      '[data-testid*="transcript" i]', '[data-testid*="subtitle" i]'
    ];
    const candidates = new Set();
    for (const selector of selectors) {
      try { document.querySelectorAll(selector).forEach((node) => candidates.add(node)); } catch {}
    }
    let inspected = 0;
    for (const node of candidates) {
      if (inspected++ > 600) break;
      const text = String(node.value || node.innerText || node.textContent || "").trim();
      if (text.length < 30 || text.length > MAX_TEXT_LENGTH) continue;
      if (processCandidate(text)) return;
    }

    const now = Date.now();
    if (now - lastDeepScanAt < 1500) return;
    lastDeepScanAt = now;

    document.querySelectorAll('script[type="application/json"],script#__NEXT_DATA__,script').forEach((script) => {
      if (lastSignature) return;
      const text = String(script.textContent || "").trim();
      if (text.length >= 30 && text.length <= MAX_TEXT_LENGTH && /transcript|subtitle|caption|segments|utterances|WEBVTT|-->/i.test(text)) processCandidate(text);
    });

    for (const storage of [localStorage, sessionStorage]) {
      try {
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index) || "";
          const value = storage.getItem(key) || "";
          if (/transcript|subtitle|caption|srt|vtt|job|task/i.test(`${key} ${value.slice(0, 500)}`)) processCandidate(value);
        }
      } catch {}
    }

    document.querySelectorAll('a[href],button[data-url],button[data-href]').forEach((element) => {
      const raw = element.href || element.dataset.url || element.dataset.href || "";
      if (!raw || fetchedUrls.has(raw) || !/(?:\.srt|\.vtt)(?:$|[?#])|blob:/i.test(raw)) return;
      fetchedUrls.add(raw);
      fetch(raw, { credentials: "include" }).then((response) => response.text()).then((text) => processCandidate(text)).catch(() => {});
    });
  }

  function scheduleScan(delay = 160) {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scanDom();
    }, delay);
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (event.source !== window || !data || data.source !== MAIN_HOOK_SOURCE || data.type !== "TRANSCRIPT365_CAPTURE") return;
    processCandidate(data.payload, findTikTokSourceUrl());
  });

  chrome.storage.local.get({ [REQUEST_KEY]: null, [SUBMIT_GUARD_KEY]: null }, (result) => {
    latestRequest = requestIsActive(result[REQUEST_KEY]) ? result[REQUEST_KEY] : null;
    submittedRequestId = String(result[SUBMIT_GUARD_KEY]?.requestId || "");
    autoGenerateClicked = Boolean(latestRequest && submittedRequestId === latestRequest.requestId);
    requestObservedAt = Date.now();
    scheduleScan(160);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[SUBMIT_GUARD_KEY]) {
      submittedRequestId = String(changes[SUBMIT_GUARD_KEY].newValue?.requestId || "");
      if (latestRequest && submittedRequestId === latestRequest.requestId) autoGenerateClicked = true;
    }
    if (!changes[REQUEST_KEY]) return;
    latestRequest = requestIsActive(changes[REQUEST_KEY].newValue) ? changes[REQUEST_KEY].newValue : null;
    requestObservedAt = Date.now();
    autoGenerateClicked = Boolean(latestRequest && submittedRequestId === latestRequest.requestId);
    lastSignature = "";
    noSubSaved = false;
    scheduleScan(160);
  });

  const observer = new MutationObserver(() => {
    if (requestIsActive(latestRequest) && !lastSignature && !noSubSaved) scheduleScan(70);
  });
  const startObserver = () => {
    if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  startObserver();
  document.addEventListener("DOMContentLoaded", () => scheduleScan(20), { once: true });
  setInterval(() => {
    if (requestIsActive(latestRequest) && !lastSignature && !noSubSaved) scanDom();
  }, 900);
})();
