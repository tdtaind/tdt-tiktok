"use strict";
const $ = (id) => document.getElementById(id);
let state = {};
function message(payload) {
  return new Promise((resolve, reject) => chrome.runtime.sendMessage(payload, (response) => {
    if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
    if (!response?.ok) return reject(new Error(response?.error || "Không thể kết nối bộ cập nhật."));
    resolve(response);
  }));
}
function render(next = {}) {
  state = { ...state, ...next };
  const current = String(state.currentVersion || chrome.runtime.getManifest().version);
  const latest = String(state.latestVersion || "—");
  $("currentVersion").textContent = `v${current}`;
  $("latestVersion").textContent = latest === "—" ? latest : `v${latest}`;
  $("message").textContent = state.available
    ? `Phiên bản v${latest} đã được quản trị viên phát hành và yêu cầu cập nhật ngay.`
    : (state.message || "Đang kiểm tra phiên bản mới nhất từ máy chủ…");
  $("notes").textContent = String(state.releaseNotes || "");
  $("notes").hidden = !$("notes").textContent;
  const busy = ["checking", "downloading", "applying"].includes(String(state.status || ""));
  $("updateButton").disabled = busy || !state.available || !state.downloadUrl;
  $("updateButton").textContent = state.status === "downloading" ? "Đang tải gói cập nhật…" : state.status === "downloaded" ? "Tải lại gói cập nhật" : busy ? "Đang xử lý…" : "Tải và cập nhật ngay";
  $("checkButton").disabled = busy;
  $("status").textContent = String(state.message || "");
  $("status").classList.toggle("error", state.status === "error");
}
async function load(force = false) {
  try {
    render({ status: "checking", message: "Đang kiểm tra máy chủ cập nhật…" });
    const response = await message({ type: force ? "PRIVATE_UPDATE_CHECK" : "PRIVATE_UPDATE_GET" });
    render(response.state);
  } catch (error) {
    render({ status: "error", message: error.message });
  }
}
$("updateButton").addEventListener("click", async () => {
  try {
    render({ status: "applying", message: "Đang chuẩn bị gói cập nhật…" });
    const response = await message({ type: "PRIVATE_UPDATE_APPLY" });
    render(response.state);
  } catch (error) {
    render({ status: "error", message: error.message });
  }
});
$("checkButton").addEventListener("click", () => void load(true));
chrome.runtime.onMessage.addListener((event) => {
  if (event?.type === "PRIVATE_UPDATE_STATE_CHANGED" && event.state) render(event.state);
});
void load(false);
