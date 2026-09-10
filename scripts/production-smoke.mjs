import assert from "node:assert/strict";

const serverUrl = String(process.env.TDT_SERVER_URL || "").replace(/\/+$/, "");
const apiKey = String(process.env.TDT_FIREBASE_API_KEY || "");
const adminUsername = String(process.env.TDT_ADMIN_USERNAME || "admin");
const adminPassword = String(process.env.TDT_ADMIN_PASSWORD || "admin");
const extensionId = String(process.env.TDT_EXTENSION_ID || "cpndheccadlhkiogcfdhagomiadbaogn");

assert.match(serverUrl, /^https:\/\//, "Thiếu TDT_SERVER_URL.");
assert.ok(apiKey.length >= 20, "Thiếu TDT_FIREBASE_API_KEY.");
assert.match(extensionId, /^[a-p]{32}$/, "TDT_EXTENSION_ID không hợp lệ.");

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function fetchWithRetry(url, options = {}, attempts = 6) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(60_000) });
      if (response.status < 500 || attempt === attempts) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) { lastError = error; }
    await sleep(attempt * 1500);
  }
  throw lastError;
}
async function payload(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) throw new Error(`${response.status}: ${body?.error || JSON.stringify(body)}`);
  return body;
}

let response = await fetchWithRetry(`${serverUrl}/api/health`);
const health = await payload(response);
assert.equal(health.service, "tdt-vercel-control");
assert.equal(health.version, "3.0.0");

response = await fetchWithRetry(`${serverUrl}/api/v1/extension/update-manifest`);
const updateManifest = await payload(response);
assert.match(updateManifest.version || "", /^\d+(?:\.\d+){1,3}$/);
assert.match(updateManifest.downloadUrl || "", /^https:\/\//);

response = await fetchWithRetry(`${serverUrl}/extension/releases/latest.json`);
const staticManifest = await payload(response);
assert.match(staticManifest.version || "", /^\d+(?:\.\d+){1,3}$/);

response = await fetchWithRetry(`${serverUrl}/`);
assert.equal(response.status, 200);
const dashboardHtml = await response.text();
assert.match(dashboardHtml, /Đăng nhập Dashboard/);
assert.doesNotMatch(dashboardHtml, /Admin token/i);

response = await fetch(`${serverUrl}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: adminUsername, password: `${adminPassword}-wrong` })
});
assert.equal(response.status, 401, "Dashboard phải từ chối mật khẩu sai.");

response = await fetchWithRetry(`${serverUrl}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: adminUsername, password: adminPassword })
});
const login = await payload(response);
assert.ok(login.sessionToken && login.expiresAt > Date.now());

response = await fetchWithRetry(`${serverUrl}/api/admin/state`, {
  headers: { Authorization: `Bearer ${login.sessionToken}` }
});
const state = await payload(response);
assert.equal(state.admin.username, adminUsername);
assert.ok(state.summary && state.insights && Array.isArray(state.users));
assert.ok(Object.hasOwn(state.summary, "active5m"));
assert.ok(Object.hasOwn(state.summary.counters, "googleLogins"));

response = await fetchWithRetry(`${serverUrl}/auth/`);
assert.equal(response.status, 200);
const authCsp = response.headers.get("content-security-policy") || "";
assert.match(authCsp, new RegExp(`frame-ancestors chrome-extension:\\/\\/${extensionId}`));
assert.equal(response.headers.get("x-frame-options"), null, "Trang auth không được đặt X-Frame-Options.");

response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ returnSecureToken: true })
});
let anonymousRejected = false;
if (response.ok) {
  const anonymous = await response.json();
  const clientId = crypto.randomUUID().replaceAll("-", "");
  response = await fetchWithRetry(`${serverUrl}/api/v1/extension/check`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anonymous.idToken}`,
      "Content-Type": "application/json",
      Origin: `chrome-extension://${extensionId}`
    },
    body: JSON.stringify({ projectKey: "tiktok-tai-dep-trai", clientId, client: { version: "production-smoke", extensionId }, counters: { heartbeats: 1 } })
  });
  assert.equal(response.status, 403, "Backend phải từ chối Vercel Anonymous Auth.");
  const rejected = await response.json();
  assert.match(rejected.error || "", /Google/);
  anonymousRejected = true;
} else {
  const disabled = await response.json().catch(() => ({}));
  assert.match(disabled?.error?.message || "", /OPERATION_NOT_ALLOWED|ADMIN_ONLY_OPERATION/);
  anonymousRejected = true;
}

console.log(JSON.stringify({
  ok: true,
  serverUrl,
  dashboardLogin: true,
  googleAuthFrame: true,
  anonymousRejected,
  totalUsers: state.summary.totalUsers,
  adminMustChangePassword: state.admin.mustChangePassword
}, null, 2));
