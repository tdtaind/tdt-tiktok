export const MAX_UPDATE_PACKAGE_BYTES = 20 * 1024 * 1024;

export function compareReleaseVersions(left, right) {
  const parts = (value) => String(value || "0").split(/[.-]/).map((part) => {
    const parsed = Number.parseInt(String(part).replace(/\D+/g, ""), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }).slice(0, 4);
  const a = parts(left);
  const b = parts(right);
  const length = Math.max(a.length, b.length, 4);
  for (let index = 0; index < length; index += 1) {
    const delta = (a[index] || 0) - (b[index] || 0);
    if (delta) return delta > 0 ? 1 : -1;
  }
  return 0;
}

export function decodeUpdatePackageBase64(value) {
  const base64 = String(value || "").replace(/^data:[^,]+,/, "").replace(/\s+/g, "");
  if (!base64 || base64.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw Object.assign(new Error("Dữ liệu file base64 không hợp lệ."), { status: 400 });
  }
  const bytes = Buffer.from(base64, "base64");
  if (bytes.toString("base64").replace(/=+$/, "") !== base64.replace(/=+$/, "")) {
    throw Object.assign(new Error("Dữ liệu file base64 bị hỏng."), { status: 400 });
  }
  return bytes;
}

export function validUpdatePackageMagic(bytes, extension) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 4) return false;
  if (extension === ".crx") return bytes.subarray(0, 4).toString("ascii") === "Cr24";
  return bytes[0] === 0x50 && bytes[1] === 0x4b
    && ((bytes[2] === 0x03 && bytes[3] === 0x04)
      || (bytes[2] === 0x05 && bytes[3] === 0x06)
      || (bytes[2] === 0x07 && bytes[3] === 0x08));
}
