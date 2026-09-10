import fs from "node:fs";
import path from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = String(process.argv[index] || "").replace(/^--/, "");
  args.set(key, String(process.argv[index + 1] || ""));
}

const extensionDirectory = path.resolve(args.get("extension") || "../v2.18.1-google-login");
const projectId = args.get("project-id") || "";
const apiKey = args.get("api-key") || "";
const databaseUrl = String(args.get("database-url") || "").replace(/\/+$/, "");
const extensionId = args.get("extension-id") || "";

if (!/^[a-z][a-z0-9-]{4,29}$/.test(projectId)) throw new Error("--project-id không hợp lệ.");
if (!apiKey || apiKey.length < 20) throw new Error("--api-key không hợp lệ.");
if (!/^https:\/\//.test(databaseUrl)) throw new Error("--database-url phải là HTTPS URL của Realtime Database.");
if (extensionId && !/^[a-p]{32}$/.test(extensionId)) throw new Error("--extension-id phải là Chrome Extension ID 32 ký tự a-p.");

const configPath = path.join(extensionDirectory, "remote_config.js");
const manifestPath = path.join(extensionDirectory, "manifest.json");
let config = fs.readFileSync(configPath, "utf8");
const replacements = {
  serverUrl: `https://${projectId}.web.app`,
  firebaseApiKey: apiKey,
  firebaseDatabaseUrl: databaseUrl,
  expectedExtensionId: extensionId
};
for (const [key, value] of Object.entries(replacements)) {
  const pattern = new RegExp(`(${key}:\\s*)"[^"]*"`);
  if (!pattern.test(config)) throw new Error(`Không tìm thấy ${key} trong remote_config.js.`);
  config = config.replace(pattern, `$1${JSON.stringify(value)}`);
}
fs.writeFileSync(configPath, config);

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const exactHostingPermission = `https://${projectId}.web.app/*`;
const exactDatabasePermission = `${new URL(databaseUrl).origin}/*`;
const broadDevelopmentPermissions = new Set([
  "https://*.web.app/*",
  "https://*.firebaseapp.com/*",
  "https://*.firebaseio.com/*",
  "https://*.firebasedatabase.app/*",
  "http://127.0.0.1/*",
  "http://localhost/*"
]);
manifest.host_permissions = [...new Set([
  ...(manifest.host_permissions || []).filter((permission) => !broadDevelopmentPermissions.has(permission)),
  exactHostingPermission,
  exactDatabasePermission
])];
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Đã cấu hình extension tại ${extensionDirectory}`);
console.log(`Firebase Hosting: https://${projectId}.web.app`);
console.log(`Realtime Database: ${databaseUrl}`);
console.log(extensionId ? `Khóa Extension ID: ${extensionId}` : "Extension ID chưa khóa; hãy cấu hình trước khi phát hành chính thức.");
