export const ACCESS_MODES = new Set(["open", "whitelist", "blacklist"]);
export const LIST_STATES = new Set(["neutral", "whitelist", "blacklist"]);
export const COUNTER_KEYS = Object.freeze([
  "heartbeats",
  "videoInfoRequests",
  "downloads",
  "subtitleRequests",
  "subtitleTranslations",
  "keywordTranslations",
  "proxyChanges",
  "popupOpens",
  "googleLogins",
  "proxyLatencyTests",
  "cleanModeToggles",
  "productDetections",
  "searchFilterRuns",
  "imageSearch1688"
]);

export function cleanText(value, maxLength = 160) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function validInstallId(value) {
  const id = String(value || "").trim().toLowerCase();
  return /^[a-f0-9]{32}$/.test(id) ? id : "";
}

export function normalizeSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    mode: ACCESS_MODES.has(source.mode) ? source.mode : "whitelist",
    message: cleanText(source.message, 500),
    updatedAt: Math.max(0, Number(source.updatedAt) || Date.now())
  };
}

export function normalizeAccess(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    locked: source.locked === true,
    listState: LIST_STATES.has(source.listState) ? source.listState : "neutral",
    blockMessage: cleanText(source.blockMessage || source.message || source.blockReason, 500),
    updatedAt: Math.max(0, Number(source.updatedAt) || Date.now())
  };
}


export function mergeAccessPatch(currentValue, patchValue, now = Date.now()) {
  const current = normalizeAccess(currentValue);
  const patch = patchValue && typeof patchValue === "object" ? patchValue : {};
  return {
    locked: Object.hasOwn(patch, "locked") ? patch.locked === true : current.locked,
    listState: Object.hasOwn(patch, "listState") && LIST_STATES.has(patch.listState) ? patch.listState : current.listState,
    blockMessage: Object.hasOwn(patch, "blockMessage") ? cleanText(patch.blockMessage, 500) : current.blockMessage,
    updatedAt: Math.max(0, Number(now) || Date.now())
  };
}

export function initialListState(isNewUser, existingValue = "neutral") {
  if (isNewUser) return "whitelist";
  return LIST_STATES.has(existingValue) ? existingValue : "neutral";
}

export function normalizeCounters(value) {
  const source = value && typeof value === "object" ? value : {};
  const output = {};
  for (const key of COUNTER_KEYS) {
    const amount = Number(source[key]);
    output[key] = Number.isFinite(amount) && amount > 0 ? Math.min(1_000_000, Math.floor(amount)) : 0;
  }
  return output;
}

export function accessDecision(accessValue, settingsValue) {
  const access = normalizeAccess(accessValue);
  const settings = normalizeSettings(settingsValue);
  if (access.locked) {
    return { allowed: false, status: "locked", reason: access.blockMessage || settings.message || "Tài khoản extension đã bị quản trị viên khóa." };
  }
  if (access.listState === "blacklist") {
    return { allowed: false, status: "blacklisted", reason: access.blockMessage || settings.message || "Mã cài đặt đang nằm trong Blacklist." };
  }
  if (settings.mode === "whitelist" && access.listState !== "whitelist") {
    return { allowed: false, status: "not_whitelisted", reason: access.blockMessage || settings.message || "Extension đang ở chế độ Whitelist. Người dùng này chưa được cấp quyền." };
  }
  return { allowed: true, status: access.listState === "whitelist" ? "whitelisted" : "active", reason: "" };
}
