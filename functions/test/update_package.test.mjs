import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_UPDATE_PACKAGE_BYTES,
  compareReleaseVersions,
  decodeUpdatePackageBase64,
  validUpdatePackageMagic
} from "../update_package.js";

test("giải mã chính xác package base64", () => {
  const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
  assert.deepEqual(decodeUpdatePackageBase64(bytes.toString("base64")), bytes);
});

test("từ chối base64 hỏng", () => {
  assert.throws(() => decodeUpdatePackageBase64("not@@base64"), /base64/);
  assert.throws(() => decodeUpdatePackageBase64("A"), /base64/);
});

test("nhận diện đúng ZIP và CRX", () => {
  assert.equal(validUpdatePackageMagic(Buffer.from([0x50, 0x4b, 0x03, 0x04]), ".zip"), true);
  assert.equal(validUpdatePackageMagic(Buffer.from("Cr24payload"), ".crx"), true);
  assert.equal(validUpdatePackageMagic(Buffer.from("not-a-zip"), ".zip"), false);
  assert.equal(MAX_UPDATE_PACKAGE_BYTES, 20 * 1024 * 1024);
});

test("so sánh phiên bản không cho phát hành lùi", () => {
  assert.equal(compareReleaseVersions("2.6.2", "2.6.1"), 1);
  assert.equal(compareReleaseVersions("2.6.2", "2.6.2"), 0);
  assert.equal(compareReleaseVersions("2.5.9", "2.6.2"), -1);
});
