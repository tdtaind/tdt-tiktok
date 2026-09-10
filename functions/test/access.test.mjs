import test from "node:test";
import assert from "node:assert/strict";
import { accessDecision, initialListState, mergeAccessPatch, normalizeCounters, validInstallId } from "../access.js";

test("Open cho phép neutral nhưng khóa và blacklist có ưu tiên", () => {
  assert.equal(accessDecision({ locked: false, listState: "neutral" }, { mode: "open" }).allowed, true);
  assert.equal(accessDecision({ locked: true, listState: "whitelist" }, { mode: "open" }).status, "locked");
  assert.equal(accessDecision({ locked: false, listState: "blacklist" }, { mode: "open" }).status, "blacklisted");
});

test("Whitelist chỉ cho phép người thuộc whitelist", () => {
  assert.equal(accessDecision({ listState: "neutral" }, { mode: "whitelist" }).allowed, false);
  assert.equal(accessDecision({ listState: "whitelist" }, { mode: "whitelist" }).allowed, true);
});

test("Tài khoản Google mới được Whitelist mặc định", () => {
  assert.equal(initialListState(true, "neutral"), "whitelist");
  assert.equal(initialListState(false, "blacklist"), "blacklist");
  assert.equal(initialListState(false, "invalid"), "neutral");
});

test("Bộ đếm và install ID được giới hạn", () => {
  assert.equal(validInstallId("a".repeat(32)), "a".repeat(32));
  assert.equal(validInstallId("not-valid"), "");
  const counters = normalizeCounters({ downloads: 2.9, proxyChanges: -5, heartbeats: 9_000_000, imageSearch1688: 4 });
  assert.equal(counters.downloads, 2);
  assert.equal(counters.proxyChanges, 0);
  assert.equal(counters.heartbeats, 1_000_000);
  assert.equal(counters.imageSearch1688, 4);
});


test("thông báo chặn riêng ưu tiên thông báo toàn hệ thống", () => {
  const decision = accessDecision({ locked: true, listState: "whitelist", blockMessage: "Tài khoản A bị tạm khóa." }, { mode: "open", message: "Thông báo chung" });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "Tài khoản A bị tạm khóa.");
});


test("mergeAccessPatch giữ đúng thông báo riêng và không bị ghi đè bởi dữ liệu cũ", () => {
  const current = { locked: false, listState: "whitelist", blockMessage: "Thông báo cũ", updatedAt: 1 };
  const locked = mergeAccessPatch(current, { locked: true, blockMessage: "Thông báo riêng mới" }, 200);
  assert.deepEqual(locked, { locked: true, listState: "whitelist", blockMessage: "Thông báo riêng mới", updatedAt: 200 });
  const unlockOnly = mergeAccessPatch(locked, { locked: false }, 300);
  assert.equal(unlockOnly.blockMessage, "Thông báo riêng mới");
  const cleared = mergeAccessPatch(unlockOnly, { blockMessage: "" }, 400);
  assert.equal(cleared.blockMessage, "");
});

test("đọc tương thích thông báo riêng từ trường message của dữ liệu cũ", () => {
  const decision = accessDecision({ locked: true, listState: "whitelist", message: "Thông báo riêng phiên bản cũ" }, { mode: "open", message: "Thông báo chung" });
  assert.equal(decision.reason, "Thông báo riêng phiên bản cũ");
});
