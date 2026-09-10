import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export const DEFAULT_ADMIN_USERNAME = "admin";
export const DEFAULT_ADMIN_PASSWORD = "admin";

export function normalizeUsername(value) {
  const username = String(value || "").trim().toLowerCase();
  return /^[a-z0-9._-]{3,40}$/.test(username) ? username : "";
}

export function validNewPassword(value) {
  const password = String(value || "");
  return password.length >= 8 && password.length <= 128;
}

export async function hashPassword(password, saltValue = "") {
  const salt = saltValue || crypto.randomBytes(16).toString("base64url");
  const derived = await scrypt(String(password || ""), salt, 32, { N: 16384, r: 8, p: 1 });
  return { salt, hash: Buffer.from(derived).toString("base64url"), algorithm: "scrypt-v1" };
}

export async function verifyPassword(password, credentials) {
  if (!credentials?.passwordSalt || !credentials?.passwordHash) return false;
  const candidate = await hashPassword(password, credentials.passwordSalt);
  const received = Buffer.from(candidate.hash);
  const expected = Buffer.from(String(credentials.passwordHash));
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function sessionSignature(encodedPayload, secret) {
  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function issueAdminSession({ username, version }, secret, now = Date.now()) {
  if (String(secret || "").length < 32) throw new Error("Session secret chưa đủ mạnh.");
  const payload = {
    sub: normalizeUsername(username),
    ver: Math.max(1, Number(version) || 1),
    iat: now,
    exp: now + SESSION_MS,
    sid: crypto.randomBytes(12).toString("base64url")
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { token: `${encoded}.${sessionSignature(encoded, secret)}`, expiresAt: payload.exp };
}

export function verifyAdminSession(token, secret, now = Date.now()) {
  const [encoded, receivedSignature, extra] = String(token || "").split(".");
  if (!encoded || !receivedSignature || extra || String(secret || "").length < 32) return null;
  const expectedSignature = sessionSignature(encoded, secret);
  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!normalizeUsername(payload.sub) || !Number.isFinite(payload.exp) || payload.exp <= now || payload.iat > now + 60_000) return null;
    return payload;
  } catch {
    return null;
  }
}
