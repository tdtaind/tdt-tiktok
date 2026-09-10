import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeMainSyncDocument,
  mergeWatchAnalytics,
  normalizeSyncPayload,
  normalizeWatchAnalytics,
  publicSyncPayload
} from "../sync_logic.js";

test("first sync giữ dữ liệu online đã có nhưng nhận trường còn thiếu", () => {
  const current = {
    data: { settings: { autoplay: false } },
    modifiedAtByKey: { settings: 100 },
    revision: 2,
    createdAt: 10,
    updatedAt: 100
  };
  const next = mergeMainSyncDocument(current, {
    firstSync: true,
    data: { settings: { autoplay: true }, fontSize: 24 },
    modifiedAtByKey: { settings: 500, fontSize: 0 }
  }, 1000);
  assert.equal(next.data.settings.autoplay, false);
  assert.equal(next.data.fontSize, 24);
  assert.equal(next.revision, 3);
});

test("lần sync sau dùng timestamp mới nhất cho cài đặt", () => {
  const current = {
    data: { settings: { autoplay: false } },
    modifiedAtByKey: { settings: 100 },
    revision: 1
  };
  const next = mergeMainSyncDocument(current, {
    firstSync: false,
    data: { settings: { autoplay: true } },
    modifiedAtByKey: { settings: 200 }
  }, 300);
  assert.equal(next.data.settings.autoplay, true);
  assert.equal(next.modifiedAtByKey.settings, 300);
});

test("watch analytics hợp nhất không nhân đôi dữ liệu đã đồng bộ", () => {
  const merged = mergeWatchAnalytics(
    { totalWatchedSeconds: 50, allTimeVideoIds: ["1"], days: { "2026-07-21": { watchedSeconds: 50, videoIds: ["1"] } }, history: [{ videoId: "1", watchedSeconds: 50, lastWatchedAt: 100 }] },
    { totalWatchedSeconds: 80, allTimeVideoIds: ["1", "2"], days: { "2026-07-21": { watchedSeconds: 80, videoIds: ["1", "2"] } }, history: [{ videoId: "1", watchedSeconds: 80, lastWatchedAt: 200 }, { videoId: "2", watchedSeconds: 10, lastWatchedAt: 210 }] }
  );
  assert.equal(merged.totalWatchedSeconds, 80);
  assert.deepEqual(merged.allTimeVideoIds, ["1", "2"]);
  assert.equal(merged.history.length, 2);
  assert.equal(merged.history.find((item) => item.videoId === "1").watchedSeconds, 80);
});

test("payload được giới hạn để lưu Firestore an toàn", () => {
  const days = {};
  for (let i = 0; i < 180; i += 1) {
    const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
    days[day] = { watchedSeconds: 1, videoIds: Array.from({ length: 500 }, (_, j) => `${i}-${j}`) };
  }
  const watch = normalizeWatchAnalytics({
    allTimeVideoIds: Array.from({ length: 20000 }, (_, i) => String(i)),
    days,
    history: Array.from({ length: 500 }, (_, i) => ({ videoId: String(i), caption: "x".repeat(3000), thumbnail: "https://example.com/" + "x".repeat(2000), lastWatchedAt: i }))
  });
  assert.equal(Object.keys(watch.days).length, 90);
  assert.equal(watch.allTimeVideoIds.length, 5000);
  assert.equal(watch.history.length, 100);
  assert.ok(Buffer.byteLength(JSON.stringify(watch)) < 800_000);
});

test("public payload chứa profile và watch đã chuẩn hóa", () => {
  const payload = publicSyncPayload(
    { data: { settings: { autoplay: true } }, modifiedAtByKey: { settings: 10 }, revision: 2, updatedAt: 20 },
    { data: { totalWatchedSeconds: 9 }, revision: 3, updatedAt: 30 },
    { uid: "uid1234567890", email: "a@example.com", displayName: "A" }
  );
  assert.equal(payload.account.email, "a@example.com");
  assert.equal(payload.revision, 3);
  assert.equal(payload.data.watchAnalytics.totalWatchedSeconds, 9);
});

test("normalize payload luôn có đủ khóa đồng bộ", () => {
  const payload = normalizeSyncPayload({ data: {} });
  assert.equal(typeof payload.data.settings, "object");
  assert.equal(payload.data.fontSize, 12);
  assert.equal(payload.modifiedAtByKey.watchAnalytics, 0);
});
