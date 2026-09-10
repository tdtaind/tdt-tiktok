import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

const [,, sourceArg, versionArg, notesArg = "", mandatoryArg = "true"] = process.argv;
if (!sourceArg || !versionArg) {
  console.error("Dùng: node scripts/publish-update.mjs <file.zip|file.crx> <version> [release notes] [mandatory=true|false]");
  process.exit(1);
}
if (!/^\d+(?:\.\d+){1,3}$/.test(versionArg)) throw new Error("Phiên bản không hợp lệ.");

const source = resolve(sourceArg);
const bytes = await readFile(source);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const ext = extname(source).toLowerCase() === ".crx" ? ".crx" : ".zip";
const releaseDir = resolve("public/extension/releases");
await mkdir(releaseDir, { recursive: true });
const filename = `TikTok_Tai_Dep_Trai_v${versionArg}${ext}`;
await copyFile(source, resolve(releaseDir, filename));

const baseUrl = "https://tdt-vercel-control.vercel.app/extension";
const manifest = {
  version: versionArg,
  downloadUrl: `${baseUrl}/releases/${filename}`,
  releasePageUrl: `${baseUrl}/`,
  releaseNotes: notesArg || `Phát hành TikTok by TDT v${versionArg}.`,
  publishedAt: new Date().toISOString(),
  sha256,
  mandatory: String(mandatoryArg).toLowerCase() !== "false",
  filename,
  sizeBytes: bytes.length
};
await writeFile(resolve(releaseDir, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

if (ext === ".crx") {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">\n  <app appid="cpndheccadlhkiogcfdhagomiadbaogn">\n    <updatecheck codebase="${baseUrl}/releases/${filename}" version="${versionArg}" />\n  </app>\n</gupdate>\n`;
  await writeFile(resolve("public/extension/updates.xml"), xml);
}
console.log(JSON.stringify({ source: basename(source), version: versionArg, filename, sha256 }, null, 2));
