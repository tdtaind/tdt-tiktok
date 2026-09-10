import { existsSync, readFileSync, writeFileSync, mkdirSync, createWriteStream } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import archiver from "archiver";

const DEFAULT_BASE_URL = "https://tdt-tiktok.vercel.app";
const EXTENSION_VERSION = "4.0.2";
const DEFAULT_EXTENSION_ID = "cpndheccadlhkiogcfdhagomiadbaogn";
const required = ["public/index.html", "public/admin/index.html", "api/health.js", "server/index.js"];
for (const file of required) if (!existsSync(file)) throw new Error(`Missing required deployment file: ${file}`);

const clientId = String(process.env.GOOGLE_CLIENT_ID || "__GOOGLE_CLIENT_ID__").trim();
const base = String(process.env.PUBLIC_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/$/, "");
let baseOrigin;
try {
  const parsed = new URL(base);
  if (parsed.protocol !== "https:") throw new Error("PUBLIC_BASE_URL must use https://");
  baseOrigin = parsed.origin;
} catch (error) {
  throw new Error(`PUBLIC_BASE_URL không hợp lệ: ${base}. ${error.message}`);
}
const basePattern = `${baseOrigin}/*`;
const extensionId = String(process.env.TDT_EXTENSION_ID || DEFAULT_EXTENSION_ID).trim();

writeFileSync("public/config.js", `window.TDT_CONFIG=${JSON.stringify({ googleClientId: clientId, baseUrl: baseOrigin, googleAuthOrigin: baseOrigin })};\n`);

const releaseDir = join("public", "extension", "releases");
mkdirSync(releaseDir, { recursive: true });
const sourceDir = join("extension-src");
const manifestPath = join(sourceDir, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.version = EXTENSION_VERSION;
const isLegacyControlHost = (value) => /^https:\/\/tdt-(?:vercel-control|tiktok)\.vercel\.app\/\*$/.test(String(value || ""));
manifest.host_permissions = [...new Set([...(manifest.host_permissions || []).filter((value) => !isLegacyControlHost(value)), basePattern])];
manifest.content_security_policy = manifest.content_security_policy || {};
manifest.content_security_policy.extension_pages = `script-src 'self'; object-src 'self'; frame-src ${baseOrigin}`;
manifest.externally_connectable = { ...(manifest.externally_connectable || {}), matches: [basePattern] };
manifest.update_url = `${baseOrigin}/extension/updates.xml`;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

const configPath = join(sourceDir, "remote_config.js");
writeFileSync(configPath, `"use strict";globalThis.TDT_REMOTE_CONFIG=Object.freeze(${JSON.stringify({
  enabled: true,
  serverUrl: baseOrigin,
  projectKey: String(process.env.TDT_PROJECT_KEY || "tiktok-tai-dep-trai"),
  expectedExtensionId: extensionId,
  heartbeatMinutes: 1,
  requestTimeoutMs: 8000,
  leaseSeconds: 90,
  failMode: "closed",
  privateUpdates: {
    enabled: true,
    manifestUrl: `${baseOrigin}/api/v1/extension/update-manifest`,
    manifestFallbackUrls: [`${baseOrigin}/extension/releases/latest.json`],
    releasePageUrl: `${baseOrigin}/extension/`,
    checkMinutes: 60,
    autoDownload: true
  }
})});\n`);

const zipFilename = `TikTok_Tai_Dep_Trai_v${EXTENSION_VERSION}.zip`;
const zipPath = join(releaseDir, zipFilename);
await new Promise((resolve, reject) => {
  const output = createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });
  output.on("close", resolve);
  archive.on("error", reject);
  archive.pipe(output);
  archive.directory(sourceDir, false);
  archive.finalize();
});

const bytes = readFileSync(zipPath);
const latest = {
  version: EXTENSION_VERSION,
  downloadUrl: `${baseOrigin}/api/v1/extension/download?version=${encodeURIComponent(EXTENSION_VERSION)}`,
  releasePageUrl: `${baseOrigin}/extension/`,
  releaseNotes: "v4.0.2: sửa snapshot.exists và thêm chẩn đoán Google OAuth origin bắt buộc.",
  publishedAt: new Date().toISOString(),
  sha256: createHash("sha256").update(bytes).digest("hex"),
  mandatory: true,
  filename: zipFilename,
  sizeBytes: bytes.length
};
writeFileSync(join(releaseDir, "latest.json"), JSON.stringify(latest, null, 2) + "\n");
writeFileSync("public/extension/updates.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0"><app appid="${extensionId}"><updatecheck codebase="${baseOrigin}/extension/releases/${zipFilename}" version="${EXTENSION_VERSION}" /></app></gupdate>\n`);
console.log(`Vercel-only build OK: ${required.length} required files present; base=${baseOrigin}; extension=${EXTENSION_VERSION}; package=${zipPath}.`);
