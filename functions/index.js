import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { AggregateField, FieldValue, getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";
import { getStorage } from "firebase-admin/storage";
import { createHash } from "node:crypto";
import { defineSecret, defineString } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import {
  ACCESS_MODES,
  COUNTER_KEYS,
  LIST_STATES,
  accessDecision,
  cleanText,
  normalizeAccess,
  mergeAccessPatch,
  normalizeCounters,
  normalizeSettings,
  initialListState,
  validInstallId
} from "./access.js";
import {
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  hashPassword,
  issueAdminSession,
  normalizeUsername,
  validNewPassword,
  verifyAdminSession,
  verifyPassword
} from "./admin_auth.js";
import {
  mergeMainSyncDocument,
  mergeWatchAnalytics,
  normalizeSyncPayload,
  publicSyncPayload
} from "./sync_logic.js";
import {
  MAX_UPDATE_PACKAGE_BYTES,
  compareReleaseVersions,
  decodeUpdatePackageBase64,
  validUpdatePackageMagic
} from "./update_package.js";

initializeApp();

const firestore = getFirestore();
const adminToken = defineSecret("TDT_ADMIN_TOKEN");
const configuredProjectKey = defineString("TDT_PROJECT_KEY", { default: "tiktok-tai-dep-trai" });
const configuredExtensionId = defineString("TDT_EXTENSION_ID", { default: "" });
const LEASE_MS = 90_000;
const MAX_USERS_IN_DASHBOARD = 1000;
const MAX_USERS_IN_EXPORT = 5000;
const UPDATE_RELEASE_DOC = "config/updateRelease";
const UPDATE_REALTIME_PATH = "update";
const PUBLIC_BASE_URL = "https://tran-duc-tai.web.app";
const DEFAULT_UPDATE_RELEASE = Object.freeze({
  version: "3.0.0",
  downloadUrl: `${PUBLIC_BASE_URL}/extension/releases/TikTok_Tai_Dep_Trai_v3.0.0.zip`,
  releasePageUrl: `${PUBLIC_BASE_URL}/extension/`,
  releaseNotes: "HD hotfix: thay đúng video trên trang chủ, chỉ hiển thị player thay thế, chặn âm thanh video cũ, xác thực Video ID và giảm tải DOM.",
  publishedAt: "2026-08-02T12:43:00+07:00",
  sha256: "cdb0c9023ab04c0842c55101ca49b41bea2ae979fd4b809dce95c8bf39b62391",
  mandatory: true,
  filename: "TikTok_Tai_Dep_Trai_v3.0.0.zip",
  storagePath: "",
  sizeBytes: 236298,
  updatedAt: 0
});
const checkBuckets = new Map();
const syncBuckets = new Map();
const adminLoginBuckets = new Map();
const ADMIN_STATE_CACHE_TTL_MS = 12_000;
const UPDATE_RELEASE_CACHE_TTL_MS = 15_000;
let adminStateCache = { value: null, expiresAt: 0 };
let updateReleaseCache = { value: null, expiresAt: 0 };
let updateReleaseFlight = null;

function invalidateAdminStateCache() { adminStateCache = { value: null, expiresAt: 0 }; }
function cacheUpdateRelease(value) {
  updateReleaseCache = { value: normalizeUpdateRelease(value), expiresAt: Date.now() + UPDATE_RELEASE_CACHE_TTL_MS };
  return updateReleaseCache.value;
}

function realtimeDatabase() {
  return getDatabase();
}

function sendJson(response, status, payload, extraHeaders = {}) {
  response.status(status);
  response.set({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extraHeaders
  });
  response.send(JSON.stringify(payload));
}

function requestPath(request) {
  return new URL(request.originalUrl || request.url || "/", `https://${request.headers.host || "localhost"}`).pathname;
}

function requestBody(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) return request.body;
  const raw = Buffer.isBuffer(request.body) ? request.body.toString("utf8") : String(request.body || "");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error("JSON không hợp lệ."), { status: 400 }); }
}


function validReleaseVersion(value) {
  const version = cleanText(value, 40);
  return /^\d+(?:\.\d+){1,3}(?:[-+][A-Za-z0-9.-]+)?$/.test(version) ? version : "";
}

function normalizeUpdateRelease(value) {
  const source = value && typeof value === "object" ? value : {};
  const version = validReleaseVersion(source.version) || DEFAULT_UPDATE_RELEASE.version;
  const filename = cleanText(source.filename, 180) || `TikTok_Tai_Dep_Trai_v${version}.zip`;
  return {
    version,
    downloadUrl: cleanText(source.downloadUrl, 1000) || DEFAULT_UPDATE_RELEASE.downloadUrl,
    releasePageUrl: cleanText(source.releasePageUrl, 1000) || DEFAULT_UPDATE_RELEASE.releasePageUrl,
    releaseNotes: cleanText(source.releaseNotes, 6000),
    publishedAt: cleanText(source.publishedAt, 80) || new Date().toISOString(),
    sha256: cleanText(source.sha256, 64).toLowerCase().replace(/[^a-f0-9]/g, ""),
    mandatory: source.mandatory === true,
    filename,
    storagePath: cleanText(source.storagePath, 500),
    sizeBytes: Math.max(0, Number(source.sizeBytes) || 0),
    updatedAt: Math.max(0, Number(source.updatedAt) || 0),
    broadcastId: cleanText(source.broadcastId, 120)
  };
}

async function getUpdateRelease() {
  if (updateReleaseCache.value && Date.now() < updateReleaseCache.expiresAt) return updateReleaseCache.value;
  if (updateReleaseFlight) return updateReleaseFlight;
  updateReleaseFlight = firestore.doc(UPDATE_RELEASE_DOC).get()
    .then((snapshot) => {
      const stored = snapshot.exists ? normalizeUpdateRelease(snapshot.data()) : null;
      const effective = stored && compareReleaseVersions(stored.version, DEFAULT_UPDATE_RELEASE.version) >= 0
        ? stored
        : DEFAULT_UPDATE_RELEASE;
      return cacheUpdateRelease(effective);
    })
    .finally(() => { updateReleaseFlight = null; });
  return updateReleaseFlight;
}

function publicUpdateManifest(release) {
  const value = normalizeUpdateRelease(release);
  return {
    version: value.version,
    downloadUrl: value.downloadUrl,
    releasePageUrl: value.releasePageUrl,
    releaseNotes: value.releaseNotes,
    publishedAt: value.publishedAt,
    sha256: value.sha256,
    mandatory: value.mandatory,
    sizeBytes: value.sizeBytes,
    filename: value.filename,
    broadcastId: value.broadcastId
  };
}

async function handlePublicUpdateManifest(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { ok: false, error: "Method không được hỗ trợ." });
  const release = await getUpdateRelease();
  return sendJson(response, 200, publicUpdateManifest(release), {
    "Cache-Control": "no-store, max-age=0",
    "Access-Control-Allow-Origin": "*"
  });
}

async function handlePublicUpdateDownload(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { ok: false, error: "Method không được hỗ trợ." });
  const release = await getUpdateRelease();
  const requested = validReleaseVersion(new URL(request.originalUrl || request.url || "/", `https://${request.headers.host || "localhost"}`).searchParams.get("version"));
  if (requested && requested !== release.version) return sendJson(response, 404, { ok: false, error: "Phiên bản này không còn là bản phát hành mới nhất." });
  if (!release.storagePath) {
    response.redirect(302, release.downloadUrl || DEFAULT_UPDATE_RELEASE.downloadUrl);
    return;
  }
  const file = getStorage().bucket().file(release.storagePath);
  const [exists] = await file.exists();
  if (!exists) return sendJson(response, 404, { ok: false, error: "Không tìm thấy gói cập nhật trên Storage." });
  response.status(200);
  response.set({
    "Content-Type": release.filename.toLowerCase().endsWith(".crx") ? "application/x-chrome-extension" : "application/zip",
    "Content-Disposition": `attachment; filename="${release.filename.replace(/["\\]/g, "_")}"`,
    "Content-Length": String(release.sizeBytes || ""),
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff"
  });
  await new Promise((resolve, reject) => {
    const stream = file.createReadStream();
    stream.on("error", reject);
    response.on("finish", resolve);
    response.on("close", resolve);
    stream.pipe(response);
  });
}

async function publishUpdateRelease(body) {
  const version = validReleaseVersion(body.version);
  if (!version) throw Object.assign(new Error("Phiên bản không hợp lệ. Ví dụ: 2.6.2"), { status: 400 });
  const currentRelease = await getUpdateRelease();
  if (compareReleaseVersions(version, currentRelease.version) < 0) {
    throw Object.assign(new Error(`Không thể phát hành lùi từ v${currentRelease.version} xuống v${version}.`), { status: 409 });
  }
  const rawName = cleanText(body.filename, 180);
  const extension = rawName.toLowerCase().endsWith(".crx") ? ".crx" : rawName.toLowerCase().endsWith(".zip") ? ".zip" : "";
  if (!extension) throw Object.assign(new Error("Chỉ hỗ trợ gói .zip hoặc .crx."), { status: 400 });
  if (!body.fileBase64) throw Object.assign(new Error("Chưa chọn file cập nhật."), { status: 400 });
  const bytes = decodeUpdatePackageBase64(body.fileBase64);
  if (!bytes.length || bytes.length > MAX_UPDATE_PACKAGE_BYTES) throw Object.assign(new Error("Gói cập nhật phải lớn hơn 0 và không vượt quá 20 MB."), { status: 400 });
  if (!validUpdatePackageMagic(bytes, extension)) throw Object.assign(new Error(`Nội dung file không đúng định dạng ${extension.toUpperCase()}.`), { status: 400 });
  const filename = `TikTok_Tai_Dep_Trai_v${version}${extension}`;
  const storagePath = `extension-releases/${filename}`;
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await getStorage().bucket().file(storagePath).save(bytes, {
    resumable: false,
    validation: "md5",
    contentType: extension === ".crx" ? "application/x-chrome-extension" : "application/zip",
    metadata: {
      cacheControl: "private, no-store, max-age=0",
      metadata: { version, sha256, uploadedBy: "tdt-admin-dashboard" }
    }
  });
  const now = Date.now();
  const release = normalizeUpdateRelease({
    version,
    filename,
    storagePath,
    sizeBytes: bytes.length,
    sha256,
    mandatory: body.mandatory !== false,
    releaseNotes: cleanText(body.releaseNotes, 6000) || `Phát hành TikTok by TDT v${version}.`,
    publishedAt: new Date(now).toISOString(),
    downloadUrl: `${PUBLIC_BASE_URL}/api/v1/extension/download?version=${encodeURIComponent(version)}`,
    releasePageUrl: `${PUBLIC_BASE_URL}/extension/`,
    updatedAt: now,
    broadcastId: `${version}-${now}`
  });
  await Promise.all([
    firestore.doc(UPDATE_RELEASE_DOC).set(release),
    realtimeDatabase().ref(UPDATE_REALTIME_PATH).set(publicUpdateManifest(release))
  ]);
  cacheUpdateRelease(release);
  invalidateAdminStateCache();
  return release;
}

function clientAddress(request) {
  return cleanText(String(request.headers["x-forwarded-for"] || request.ip || "unknown").split(",")[0], 80) || "unknown";
}

function adminLoginRateLimited(request, failed = false) {
  const key = clientAddress(request);
  const now = Date.now();
  let bucket = adminLoginBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) bucket = { failures: 0, resetAt: now + 15 * 60_000 };
  if (failed) bucket.failures += 1;
  adminLoginBuckets.set(key, bucket);
  if (adminLoginBuckets.size > 2000) for (const [address, value] of adminLoginBuckets) if (now >= value.resetAt) adminLoginBuckets.delete(address);
  return bucket.failures >= 10;
}

async function ensureAdminCredentials() {
  const reference = firestore.doc("config/adminAuth");
  const snapshot = await reference.get();
  if (snapshot.exists) return snapshot.data();
  const password = await hashPassword(DEFAULT_ADMIN_PASSWORD);
  await firestore.runTransaction(async (transaction) => {
    const current = await transaction.get(reference);
    if (!current.exists) transaction.set(reference, {
      username: DEFAULT_ADMIN_USERNAME,
      passwordSalt: password.salt,
      passwordHash: password.hash,
      passwordAlgorithm: password.algorithm,
      version: 1,
      mustChangePassword: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  });
  return (await reference.get()).data();
}

async function authorizedAdmin(request) {
  const secret = adminToken.value();
  const authorization = String(request.headers.authorization || "");
  if (secret.length < 32 || !authorization.startsWith("Bearer ")) return null;
  const session = verifyAdminSession(authorization.slice(7), secret);
  if (!session) return null;
  const credentials = await ensureAdminCredentials();
  if (normalizeUsername(credentials.username) !== session.sub || Number(credentials.version) !== Number(session.ver)) return null;
  return { session, credentials };
}

async function requireAdmin(request, response) {
  if (adminToken.value().length < 32) {
    sendJson(response, 503, { ok: false, error: "Khóa ký phiên quản trị chưa được cấu hình đúng." });
    return null;
  }
  const context = await authorizedAdmin(request);
  if (context) return context;
  sendJson(response, 401, { ok: false, error: "Phiên quản trị không hợp lệ hoặc đã hết hạn." }, { "WWW-Authenticate": "Bearer" });
  return null;
}

async function handleAdminLogin(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { ok: false, error: "Method không được hỗ trợ." });
  if (adminLoginRateLimited(request)) return sendJson(response, 429, { ok: false, error: "Đăng nhập sai quá nhiều lần. Hãy thử lại sau 15 phút." }, { "Retry-After": "900" });
  const body = requestBody(request);
  const credentials = await ensureAdminCredentials();
  const username = normalizeUsername(body.username);
  const passwordOk = username === normalizeUsername(credentials.username) && await verifyPassword(body.password, credentials);
  if (!passwordOk) {
    adminLoginRateLimited(request, true);
    return sendJson(response, 401, { ok: false, error: "Tên đăng nhập hoặc mật khẩu không đúng." });
  }
  adminLoginBuckets.delete(clientAddress(request));
  const session = issueAdminSession(credentials, adminToken.value());
  await firestore.doc("config/adminAuth").set({ lastLoginAt: Date.now() }, { merge: true });
  return sendJson(response, 200, {
    ok: true,
    sessionToken: session.token,
    expiresAt: session.expiresAt,
    admin: { username: normalizeUsername(credentials.username), mustChangePassword: credentials.mustChangePassword === true }
  });
}

function extensionCors(request, response) {
  const expectedId = cleanText(configuredExtensionId.value(), 64);
  const expectedOrigin = expectedId ? `chrome-extension://${expectedId}` : "*";
  response.set({
    "Access-Control-Allow-Origin": expectedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin"
  });
  if (request.method === "OPTIONS") {
    response.status(204).send("");
    return true;
  }
  return false;
}

function validateExtensionIdentity(request, client) {
  const expectedId = cleanText(configuredExtensionId.value(), 64);
  if (!expectedId) return;
  const declaredId = cleanText(client?.extensionId, 64);
  const origin = cleanText(request.headers.origin, 160);
  if (declaredId !== expectedId || (origin && origin !== `chrome-extension://${expectedId}`)) {
    throw Object.assign(new Error("Extension ID không được cấp phép."), { status: 403 });
  }
}

async function verifyExtensionAuth(request) {
  const authorization = String(request.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) throw Object.assign(new Error("Thiếu Firebase ID token."), { status: 401 });
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(authorization.slice(7), true);
    if (!decoded?.uid) throw new Error("Token không có UID.");
  } catch (_error) {
    throw Object.assign(new Error("Firebase ID token không hợp lệ hoặc đã bị thu hồi."), { status: 401 });
  }
  if (decoded.firebase?.sign_in_provider !== "google.com") {
    throw Object.assign(new Error("Bạn phải đăng nhập bằng tài khoản Google."), { status: 403 });
  }
  return decoded;
}

function rateLimitCheck(uid, response) {
  const now = Date.now();
  let bucket = checkBuckets.get(uid);
  if (!bucket || now >= bucket.resetAt) bucket = { count: 0, resetAt: now + 60_000 };
  bucket.count += 1;
  checkBuckets.set(uid, bucket);
  if (checkBuckets.size > 5000) {
    for (const [key, value] of checkBuckets) if (now >= value.resetAt) checkBuckets.delete(key);
  }
  if (bucket.count <= 30) return false;
  sendJson(response, 429, { ok: false, error: "Quá nhiều yêu cầu kiểm tra quyền." }, {
    "Retry-After": String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)))
  });
  return true;
}

function syncRateLimited(uid, response) {
  const now = Date.now();
  let bucket = syncBuckets.get(uid);
  if (!bucket || now >= bucket.resetAt) bucket = { count: 0, resetAt: now + 60_000 };
  bucket.count += 1;
  syncBuckets.set(uid, bucket);
  if (syncBuckets.size > 5000) {
    for (const [key, value] of syncBuckets) if (now >= value.resetAt) syncBuckets.delete(key);
  }
  if (bucket.count <= 20) return false;
  sendJson(response, 429, { ok: false, error: "Đồng bộ quá thường xuyên. Hãy thử lại sau." }, {
    "Retry-After": String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)))
  });
  return true;
}

function syncProfile(decoded) {
  return {
    uid: decoded.uid,
    email: cleanText(decoded.email, 254),
    displayName: cleanText(decoded.name, 120),
    photoURL: cleanText(decoded.picture, 700)
  };
}

async function readAccountSync(uid, decoded) {
  const [mainSnapshot, watchSnapshot] = await Promise.all([
    firestore.doc(`extensionSync/${uid}`).get(),
    firestore.doc(`extensionWatch/${uid}`).get()
  ]);
  return publicSyncPayload(
    mainSnapshot.exists ? mainSnapshot.data() : {},
    watchSnapshot.exists ? watchSnapshot.data() : {},
    syncProfile(decoded)
  );
}

async function mergeAccountSync(uid, decoded, body) {
  const normalized = normalizeSyncPayload(body);
  const mainReference = firestore.doc(`extensionSync/${uid}`);
  const watchReference = firestore.doc(`extensionWatch/${uid}`);
  const userReference = firestore.doc(`users/${uid}`);
  const now = Date.now();

  await firestore.runTransaction(async (transaction) => {
    const [mainSnapshot, watchSnapshot] = await Promise.all([
      transaction.get(mainReference),
      transaction.get(watchReference)
    ]);
    const currentMain = mainSnapshot.exists ? mainSnapshot.data() : {};
    const currentWatch = watchSnapshot.exists ? watchSnapshot.data() : {};
    const nextMain = {
      ...mergeMainSyncDocument(currentMain, normalized, now),
      lastClientId: validInstallId(body.clientId) || "",
      profile: syncProfile(decoded)
    };
    const mergedWatch = mergeWatchAnalytics(currentWatch.data, normalized.data.watchAnalytics);
    const nextWatch = {
      schemaVersion: 1,
      data: mergedWatch,
      revision: Math.max(0, Number(currentWatch.revision) || 0) + 1,
      createdAt: Number(currentWatch.createdAt) || now,
      updatedAt: now,
      lastClientId: validInstallId(body.clientId) || ""
    };
    transaction.set(mainReference, nextMain);
    transaction.set(watchReference, nextWatch);
    transaction.set(userReference, {
      onlineSyncAt: now,
      onlineSyncRevision: Math.max(nextMain.revision, nextWatch.revision),
      onlineSyncClientId: validInstallId(body.clientId) || ""
    }, { merge: true });
  });
  return readAccountSync(uid, decoded);
}

async function handleExtensionSync(request, response) {
  if (extensionCors(request, response)) return;
  if (!["GET", "POST"].includes(request.method)) {
    return sendJson(response, 405, { ok: false, error: "Method không được hỗ trợ." });
  }
  const decoded = await verifyExtensionAuth(request);
  if (syncRateLimited(decoded.uid, response)) return;
  if (request.method === "GET") {
    return sendJson(response, 200, { ok: true, sync: await readAccountSync(decoded.uid, decoded) });
  }
  const body = requestBody(request);
  if (cleanText(body.projectKey, 100) !== configuredProjectKey.value()) {
    return sendJson(response, 403, { ok: false, error: "Project key không hợp lệ." });
  }
  const installId = validInstallId(body.clientId);
  if (!installId) return sendJson(response, 400, { ok: false, error: "Client ID không hợp lệ." });
  const client = body.client && typeof body.client === "object" ? body.client : {};
  validateExtensionIdentity(request, client);
  const sync = await mergeAccountSync(decoded.uid, decoded, { ...body, clientId: installId });
  return sendJson(response, 200, { ok: true, sync });
}

function dayKey(timestamp = Date.now()) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

async function ensureSettings() {
  const reference = realtimeDatabase().ref("settings");
  const snapshot = await reference.get();
  if (snapshot.exists()) return normalizeSettings(snapshot.val());
  const settings = { mode: "whitelist", message: "", updatedAt: Date.now() };
  await reference.set(settings);
  await firestore.doc("config/access").set(settings, { merge: true });
  return settings;
}

async function ensureAccess(uid, defaultListState = "neutral") {
  const reference = realtimeDatabase().ref(`access/${uid}`);
  const access = { locked: false, listState: LIST_STATES.has(defaultListState) ? defaultListState : "neutral", blockMessage: "", message: "", updatedAt: Date.now() };
  const result = await reference.transaction((current) => current === null ? access : current, undefined, false);
  return normalizeAccess(result.snapshot.val());
}

async function bindInstallation(uid, installId, client, decoded, now) {
  const userReference = firestore.doc(`users/${uid}`);
  const bindingReference = firestore.doc(`installations/${installId}`);
  const result = await firestore.runTransaction(async (transaction) => {
    const [bindingSnapshot, userSnapshot] = await Promise.all([
      transaction.get(bindingReference),
      transaction.get(userReference)
    ]);
    if (bindingSnapshot.exists && bindingSnapshot.data()?.uid !== uid) {
      throw Object.assign(new Error("Mã cài đặt đã được liên kết với UID khác."), { status: 409 });
    }
    const isNew = !userSnapshot.exists;
    const previous = userSnapshot.data() || {};
    const today = dayKey(now);
    const newSession = !Number(previous.lastSeen) || Number(previous.lastSeen) < now - 30 * 60_000;
    const newActiveDay = previous.lastActiveDay !== today;
    const defaultListState = initialListState(isNew, previous.listState);
    transaction.set(bindingReference, { uid, installId, updatedAt: now, createdAt: bindingSnapshot.data()?.createdAt || now }, { merge: true });
    transaction.set(userReference, {
      authUid: uid,
      clientId: installId,
      firstSeen: previous.firstSeen || now,
      lastSeen: now,
      lastAuthAt: Math.max(0, Number(decoded.auth_time) || 0) * 1000,
      provider: cleanText(decoded.firebase?.sign_in_provider, 40),
      email: cleanText(decoded.email, 254),
      displayName: cleanText(decoded.name, 120),
      photoURL: cleanText(decoded.picture, 500),
      emailVerified: decoded.email_verified === true,
      version: cleanText(client.version, 40),
      locale: cleanText(client.locale, 40),
      platform: cleanText(client.platform, 80),
      browser: cleanText(client.browser, 240),
      architecture: cleanText(client.architecture, 40),
      mobile: client.mobile === true,
      hardwareConcurrency: Math.max(0, Math.min(128, Number(client.hardwareConcurrency) || 0)),
      deviceMemory: Math.max(0, Math.min(128, Number(client.deviceMemory) || 0)),
      connectionType: cleanText(client.connectionType, 30),
      timezone: cleanText(client.timezone, 80),
      installReason: cleanText(client.installReason, 40),
      extensionId: cleanText(client.extensionId, 64),
      locked: previous.locked === true,
      listState: defaultListState,
      note: cleanText(previous.note, 500),
      blockMessage: cleanText(previous.blockMessage, 500),
      sessionCount: Math.max(0, Number(previous.sessionCount) || 0) + (newSession ? 1 : 0),
      activeDays: Math.max(0, Number(previous.activeDays) || 0) + (newActiveDay ? 1 : 0),
      lastActiveDay: today,
      installationCount: Math.max(0, Number(previous.installationCount) || 0) + (!bindingSnapshot.exists ? 1 : 0)
    }, { merge: true });
    return { isNew, userReference, defaultListState };
  });
  return result;
}

async function recordUsage(userReference, countersValue, isNew, now) {
  const counters = normalizeCounters(countersValue);
  counters.heartbeats = Math.max(1, counters.heartbeats || 0);
  const counterFields = {};
  for (const key of COUNTER_KEYS) counterFields[key] = FieldValue.increment(counters[key] || 0);
  await Promise.all([
    userReference.set({
      lastSeen: now,
      counters: counterFields,
      daily: { [dayKey(now)]: counterFields }
    }, { merge: true }),
    firestore.doc("meta/summary").set({
      totalUsers: FieldValue.increment(isNew ? 1 : 0),
      counters: counterFields,
      updatedAt: now
    }, { merge: true })
  ]);
}

function numericCounters(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(COUNTER_KEYS.map((key) => [key, Math.max(0, Number(source[key]) || 0)]));
}

async function handleExtensionCheck(request, response) {
  if (extensionCors(request, response)) return;
  if (request.method !== "POST") return sendJson(response, 405, { ok: false, error: "Method không được hỗ trợ." });
  const body = requestBody(request);
  if (cleanText(body.projectKey, 100) !== configuredProjectKey.value()) {
    return sendJson(response, 403, { ok: false, error: "Project key không hợp lệ." });
  }
  const installId = validInstallId(body.clientId);
  if (!installId) return sendJson(response, 400, { ok: false, error: "Client ID không hợp lệ." });
  const client = body.client && typeof body.client === "object" ? body.client : {};
  validateExtensionIdentity(request, client);
  const decoded = await verifyExtensionAuth(request);
  if (rateLimitCheck(decoded.uid, response)) return;

  const now = Date.now();
  const { isNew, userReference, defaultListState } = await bindInstallation(decoded.uid, installId, client, decoded, now);
  const [settings, access, update] = await Promise.all([ensureSettings(), ensureAccess(decoded.uid, defaultListState), getUpdateRelease()]);
  await Promise.all([
    recordUsage(userReference, body.counters, isNew, now),
    userReference.set({ locked: access.locked, listState: access.listState, blockMessage: access.blockMessage }, { merge: true })
  ]);
  const decision = accessDecision(access, settings);
  sendJson(response, 200, {
    ok: true,
    allowed: decision.allowed,
    status: decision.status,
    reason: decision.reason,
    mode: settings.mode,
    checkedAt: now,
    leaseExpiresAt: now + LEASE_MS,
    nextCheckSeconds: 60,
    authUid: decoded.uid,
    clientId: installId,
    blockMessage: access.blockMessage,
    messageUpdatedAt: access.updatedAt,
    update: publicUpdateManifest(update)
  });
}

function validUid(value) {
  const uid = String(value || "");
  return /^[A-Za-z0-9_-]{10,128}$/.test(uid) ? uid : "";
}

async function aggregateCount(query) {
  const snapshot = await query.count().get();
  return Number(snapshot.data().count) || 0;
}

function serializeUser(snapshot) {
  const data = snapshot.data() || {};
  return {
    authUid: snapshot.id,
    clientId: cleanText(data.clientId, 80),
    firstSeen: Number(data.firstSeen) || 0,
    lastSeen: Number(data.lastSeen) || 0,
    lastAuthAt: Number(data.lastAuthAt) || 0,
    provider: cleanText(data.provider, 40),
    email: cleanText(data.email, 254),
    displayName: cleanText(data.displayName, 120),
    photoURL: cleanText(data.photoURL, 500),
    emailVerified: data.emailVerified === true,
    version: cleanText(data.version, 40),
    locale: cleanText(data.locale, 40),
    platform: cleanText(data.platform, 80),
    browser: cleanText(data.browser, 240),
    architecture: cleanText(data.architecture, 40),
    mobile: data.mobile === true,
    hardwareConcurrency: Math.max(0, Number(data.hardwareConcurrency) || 0),
    deviceMemory: Math.max(0, Number(data.deviceMemory) || 0),
    connectionType: cleanText(data.connectionType, 30),
    timezone: cleanText(data.timezone, 80),
    installReason: cleanText(data.installReason, 40),
    extensionId: cleanText(data.extensionId, 64),
    locked: data.locked === true,
    listState: LIST_STATES.has(data.listState) ? data.listState : "neutral",
    note: cleanText(data.note, 500),
    blockMessage: cleanText(data.blockMessage, 500),
    sessionCount: Math.max(0, Number(data.sessionCount) || 0),
    activeDays: Math.max(0, Number(data.activeDays) || 0),
    installationCount: Math.max(0, Number(data.installationCount) || 0),
    lastActiveDay: cleanText(data.lastActiveDay, 20),
    counters: numericCounters(data.counters),
    daily: data.daily && typeof data.daily === "object" ? data.daily : {},
    updatedAt: Number(data.updatedAt) || 0
  };
}

function topDistribution(users, getter, limit = 8) {
  const counts = new Map();
  for (const user of users) {
    const key = cleanText(getter(user), 80) || "Không rõ";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([label, count]) => ({ label, count }));
}

function browserName(userAgent) {
  const value = String(userAgent || "");
  if (/Edg\//.test(value)) return "Edge";
  if (/OPR\//.test(value)) return "Opera";
  if (/Firefox\//.test(value)) return "Firefox";
  if (/Chrome\//.test(value)) return "Chrome";
  if (/Safari\//.test(value)) return "Safari";
  return "Không rõ";
}

function dailyUsage(users, days = 14) {
  const dates = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) dates.push(dayKey(Date.now() - offset * 86_400_000));
  return dates.map((date) => {
    const counters = Object.fromEntries(COUNTER_KEYS.map((key) => [key, 0]));
    let activeUsers = 0;
    for (const user of users) {
      const daily = user.daily?.[date];
      if (!daily || typeof daily !== "object") continue;
      activeUsers += 1;
      for (const key of COUNTER_KEYS) counters[key] += Math.max(0, Number(daily[key]) || 0);
    }
    return { date, activeUsers, counters };
  });
}

async function adminState(adminContext = null, force = false) {
  if (!force && adminStateCache.value && Date.now() < adminStateCache.expiresAt) {
    return { ...adminStateCache.value, admin: adminContext ? { username: normalizeUsername(adminContext.credentials.username), mustChangePassword: adminContext.credentials.mustChangePassword === true } : undefined, cached: true };
  }
  const usersReference = firestore.collection("users");
  const now = Date.now();
  const [settings, summarySnapshot, usersSnapshot, sessionsSnapshot, activeDaysSnapshot, totalUsers, active5m, active24h, active7d, active30d, new7d, locked, whitelist, blacklist, installations] = await Promise.all([
    ensureSettings(),
    firestore.doc("meta/summary").get(),
    usersReference.orderBy("lastSeen", "desc").limit(MAX_USERS_IN_DASHBOARD).get(),
    usersReference.aggregate({ totalSessions: AggregateField.sum("sessionCount") }).get(),
    usersReference.aggregate({ totalActiveDays: AggregateField.sum("activeDays") }).get(),
    aggregateCount(usersReference),
    aggregateCount(usersReference.where("lastSeen", ">=", now - 5 * 60_000)),
    aggregateCount(usersReference.where("lastSeen", ">=", now - 24 * 60 * 60_000)),
    aggregateCount(usersReference.where("lastSeen", ">=", now - 7 * 24 * 60 * 60_000)),
    aggregateCount(usersReference.where("lastSeen", ">=", now - 30 * 24 * 60 * 60_000)),
    aggregateCount(usersReference.where("firstSeen", ">=", now - 7 * 24 * 60 * 60_000)),
    aggregateCount(usersReference.where("locked", "==", true)),
    aggregateCount(usersReference.where("listState", "==", "whitelist")),
    aggregateCount(usersReference.where("listState", "==", "blacklist")),
    aggregateCount(firestore.collection("installations"))
  ]);
  const summaryData = summarySnapshot.data() || {};
  const sessionsData = sessionsSnapshot.data() || {};
  const activeDaysData = activeDaysSnapshot.data() || {};
  const update = await getUpdateRelease();
  const users = usersSnapshot.docs.map(serializeUser);
  const usersWithDecision = users.map((user) => {
    const decision = accessDecision(user, settings);
    return { ...user, allowed: decision.allowed, accessStatus: decision.status, accessReason: decision.reason };
  });
  const result = {
    ok: true,
    admin: adminContext ? {
      username: normalizeUsername(adminContext.credentials.username),
      mustChangePassword: adminContext.credentials.mustChangePassword === true
    } : undefined,
    settings,
    update: publicUpdateManifest(update),
    summary: {
      totalUsers,
      active5m,
      active24h,
      active7d,
      active30d,
      new7d,
      locked,
      whitelist,
      blacklist,
      installations,
      totalSessions: Math.max(0, Number(sessionsData.totalSessions) || 0),
      totalActiveDays: Math.max(0, Number(activeDaysData.totalActiveDays) || 0),
      counters: numericCounters(summaryData.counters)
    },
    insights: {
      versions: topDistribution(usersWithDecision, (user) => user.version),
      platforms: topDistribution(usersWithDecision, (user) => user.platform),
      browsers: topDistribution(usersWithDecision, (user) => browserName(user.browser)),
      locales: topDistribution(usersWithDecision, (user) => user.locale),
      timezones: topDistribution(usersWithDecision, (user) => user.timezone),
      daily: dailyUsage(usersWithDecision)
    },
    users: usersWithDecision,
    truncated: totalUsers > usersSnapshot.size,
    generatedAt: Date.now(),
    cached: false
  };
  adminStateCache = { value: { ...result, admin: undefined }, expiresAt: Date.now() + ADMIN_STATE_CACHE_TTL_MS };
  return result;
}

async function handleAdminApi(request, response, pathname) {
  if (pathname === "/api/admin/login") return handleAdminLogin(request, response);
  const adminContext = await requireAdmin(request, response);
  if (!adminContext) return;

  if (request.method === "GET" && pathname === "/api/admin/state") {
    const force = /[?&]fresh=1(?:&|$)/.test(String(request.originalUrl || request.url || ""));
    return sendJson(response, 200, await adminState(adminContext, force));
  }
  if (request.method === "GET" && pathname === "/api/admin/update") {
    return sendJson(response, 200, { ok: true, update: publicUpdateManifest(await getUpdateRelease()) });
  }
  if (request.method === "POST" && pathname === "/api/admin/update") {
    const release = await publishUpdateRelease(requestBody(request));
    return sendJson(response, 200, { ok: true, update: publicUpdateManifest(release), message: "Đã tải lên và gửi yêu cầu cập nhật realtime đến người dùng." });
  }
  if (request.method === "POST" && pathname === "/api/admin/change-credentials") {
    const body = requestBody(request);
    if (!await verifyPassword(body.currentPassword, adminContext.credentials)) {
      return sendJson(response, 400, { ok: false, error: "Mật khẩu hiện tại không đúng." });
    }
    const username = body.newUsername === undefined
      ? normalizeUsername(adminContext.credentials.username)
      : normalizeUsername(body.newUsername);
    if (!username) return sendJson(response, 400, { ok: false, error: "Tên đăng nhập phải có 3–40 ký tự a-z, số, dấu chấm, gạch dưới hoặc gạch ngang." });
    if (!validNewPassword(body.newPassword)) return sendJson(response, 400, { ok: false, error: "Mật khẩu mới phải có 8–128 ký tự." });
    if (username === DEFAULT_ADMIN_USERNAME && String(body.newPassword) === DEFAULT_ADMIN_PASSWORD) {
      return sendJson(response, 400, { ok: false, error: "Không thể tiếp tục sử dụng tài khoản admin/admin mặc định." });
    }
    const password = await hashPassword(body.newPassword);
    const nextCredentials = {
      username,
      passwordSalt: password.salt,
      passwordHash: password.hash,
      passwordAlgorithm: password.algorithm,
      version: Math.max(1, Number(adminContext.credentials.version) || 1) + 1,
      mustChangePassword: false,
      updatedAt: Date.now()
    };
    await firestore.doc("config/adminAuth").set(nextCredentials, { merge: true });
    invalidateAdminStateCache();
    const session = issueAdminSession(nextCredentials, adminToken.value());
    return sendJson(response, 200, {
      ok: true,
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      admin: { username, mustChangePassword: false }
    });
  }
  if (request.method === "GET" && pathname === "/api/admin/export") {
    const [settings, usersSnapshot] = await Promise.all([
      ensureSettings(),
      firestore.collection("users").orderBy("lastSeen", "desc").limit(MAX_USERS_IN_EXPORT).get()
    ]);
    return sendJson(response, 200, {
      schemaVersion: 3,
      exportedAt: Date.now(),
      settings,
      users: usersSnapshot.docs.map(serializeUser)
    }, { "Content-Disposition": `attachment; filename="tdt-firebase-users-${dayKey()}.json"` });
  }
  if (request.method === "PATCH" && pathname === "/api/admin/settings") {
    const body = requestBody(request);
    if (body.mode !== undefined && !ACCESS_MODES.has(body.mode)) return sendJson(response, 400, { ok: false, error: "Chế độ không hợp lệ." });
    const current = await ensureSettings();
    const settings = normalizeSettings({
      mode: body.mode === undefined ? current.mode : body.mode,
      message: body.message === undefined ? current.message : body.message,
      updatedAt: Date.now()
    });
    await Promise.all([
      realtimeDatabase().ref("settings").set(settings),
      firestore.doc("config/access").set(settings, { merge: true })
    ]);
    invalidateAdminStateCache();
    return sendJson(response, 200, { ok: true, settings });
  }

  const userMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (request.method === "PATCH" && userMatch) {
    const uid = validUid(decodeURIComponent(userMatch[1]));
    if (!uid) return sendJson(response, 400, { ok: false, error: "UID không hợp lệ." });
    const userReference = firestore.doc(`users/${uid}`);
    const accessReference = realtimeDatabase().ref(`access/${uid}`);
    const [snapshot, accessSnapshot] = await Promise.all([userReference.get(), accessReference.get()]);
    if (!snapshot.exists) return sendJson(response, 404, { ok: false, error: "Không tìm thấy người dùng." });
    const body = requestBody(request);
    if (body.listState !== undefined && !LIST_STATES.has(body.listState)) return sendJson(response, 400, { ok: false, error: "Danh sách không hợp lệ." });
    const current = serializeUser(snapshot);
    const currentAccess = accessSnapshot.exists() ? accessSnapshot.val() : { locked: current.locked, listState: current.listState, blockMessage: current.blockMessage, updatedAt: current.updatedAt };
    const access = mergeAccessPatch(currentAccess, body, Date.now());
    const note = body.note === undefined ? current.note : cleanText(body.note, 500);
    // Realtime Database là nguồn quyết định quyền trực tiếp của extension. Ghi vào đây trước
    // để thông báo riêng và trạng thái khóa đến đúng tài khoản ngay cả khi Firestore chậm.
    const realtimeAccess = { ...access, message: access.blockMessage, messageUpdatedAt: access.updatedAt };
    await accessReference.set(realtimeAccess);
    const verifiedAccessSnapshot = await accessReference.get();
    const verifiedAccess = normalizeAccess(verifiedAccessSnapshot.val());
    if (verifiedAccess.blockMessage !== access.blockMessage || verifiedAccess.locked !== access.locked) {
      throw Object.assign(new Error("Realtime Database chưa lưu đúng trạng thái hoặc thông báo riêng."), { status: 503 });
    }
    await userReference.set({ ...access, note, updatedAt: access.updatedAt }, { merge: true });
    invalidateAdminStateCache();
    const settings = await ensureSettings();
    return sendJson(response, 200, {
      ok: true,
      user: { ...current, ...access, note, authUid: uid },
      decision: accessDecision(access, settings)
    });
  }

  sendJson(response, 404, { ok: false, error: "Không tìm thấy API quản trị." });
}

export async function route(request, response) {
  const pathname = requestPath(request);
  if (pathname === "/api/health" || pathname === "/health") {
    return sendJson(response, 200, { ok: true, service: "tdt-firebase-control", version: "3.0.0", time: Date.now() });
  }
  if (pathname === "/api/v1/extension/update-manifest") return handlePublicUpdateManifest(request, response);
  if (pathname === "/api/v1/extension/download") return handlePublicUpdateDownload(request, response);
  if (pathname === "/api/v1/extension/check") return handleExtensionCheck(request, response);
  if (pathname === "/api/v1/extension/sync") return handleExtensionSync(request, response);
  if (pathname.startsWith("/api/admin/")) return handleAdminApi(request, response, pathname);
  return sendJson(response, 404, { ok: false, error: "Not found" });
}

const PUBLIC_FUNCTION_OPTIONS = Object.freeze({
  region: "asia-southeast1",
  cors: false,
  timeoutSeconds: 120,
  memory: "512MiB",
  maxInstances: 20
});

async function runPublicHandler(handler, label, request, response) {
  try {
    await handler(request, response);
  } catch (error) {
    console.error(`TDT ${label} error`, error);
    if (!response.headersSent) sendJson(response, Number(error?.status) || 500, { ok: false, error: error?.message || "Lỗi máy chủ." });
    else response.end();
  }
}

export const api = onRequest({
  ...PUBLIC_FUNCTION_OPTIONS,
  secrets: [adminToken]
}, async (request, response) => {
  await runPublicHandler(route, "Firebase API", request, response);
});
