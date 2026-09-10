import test from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  issueAdminSession,
  normalizeUsername,
  validNewPassword,
  verifyAdminSession,
  verifyPassword
} from "../admin_auth.js";

test("hash mật khẩu không lưu plaintext và xác minh đúng", async () => {
  const credentials = await hashPassword("mat-khau-rat-manh");
  assert.notEqual(credentials.hash, "mat-khau-rat-manh");
  assert.equal(await verifyPassword("mat-khau-rat-manh", { passwordSalt: credentials.salt, passwordHash: credentials.hash }), true);
  assert.equal(await verifyPassword("sai", { passwordSalt: credentials.salt, passwordHash: credentials.hash }), false);
});

test("session HMAC hết hạn và chống sửa payload", () => {
  const secret = "s".repeat(64);
  const now = 1_700_000_000_000;
  const session = issueAdminSession({ username: "admin", version: 2 }, secret, now);
  assert.equal(verifyAdminSession(session.token, secret, now + 1000)?.ver, 2);
  assert.equal(verifyAdminSession(`${session.token}x`, secret, now + 1000), null);
  assert.equal(verifyAdminSession(session.token, secret, session.expiresAt + 1), null);
});

test("validate username và mật khẩu mới", () => {
  assert.equal(normalizeUsername(" Admin.Name "), "admin.name");
  assert.equal(normalizeUsername("x"), "");
  assert.equal(validNewPassword("12345678"), true);
  assert.equal(validNewPassword("admin"), false);
});
