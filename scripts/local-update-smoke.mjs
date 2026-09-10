import assert from "node:assert/strict";
const base = process.env.TDT_LOCAL_SERVER_URL || "http://127.0.0.1:5000";
async function readJson(path) {
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(20000), cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.ok, true, `${path} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  return body;
}
const health = await readJson("/api/health");
assert.equal(health.version, "3.0.0");
const dynamicManifest = await readJson("/api/v1/extension/update-manifest");
assert.equal(dynamicManifest.version, "3.0.0");
assert.equal(dynamicManifest.mandatory, true);
const staticManifest = await readJson("/extension/releases/latest.json");
assert.equal(staticManifest.version, "3.0.0");
const download = await fetch(`${base}/extension/releases/TikTok_Tai_Dep_Trai_v3.0.0.zip`, { signal: AbortSignal.timeout(20000) });
assert.equal(download.ok, true);
assert.ok(Number(download.headers.get("content-length")) > 0);
console.log(JSON.stringify({ ok: true, health: health.version, dynamic: dynamicManifest.version, static: staticManifest.version, packageBytes: Number(download.headers.get("content-length")) }, null, 2));
