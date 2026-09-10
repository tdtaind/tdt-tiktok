const EXPECTED_EXTENSION_ORIGIN = "chrome-extension://cpndheccadlhkiogcfdhagomiadbaogn";
const PARENT_FRAME_ORIGIN = document.location.ancestorOrigins?.[0] || EXPECTED_EXTENSION_ORIGIN;
const CONFIG = globalThis.TDT_CONFIG || {};
function send(payload) { parent.postMessage({ namespace: "tdt-google-auth", ...payload }, PARENT_FRAME_ORIGIN); }
async function exchange(credential) {
  const r = await fetch("/api/v1/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }), cache: "no-store" });
  const p = await r.json().catch(() => ({}));
  if (!r.ok || !p.ok) throw new Error(p.error || "Không thể tạo phiên đăng nhập.");
  return p;
}
function start() {
  const box = document.createElement("div");
  document.body.appendChild(box);
  if (!globalThis.google?.accounts?.id) return;
  globalThis.google.accounts.id.initialize({
    client_id: String(CONFIG.googleClientId || ""),
    callback: async (r) => {
      try {
        const p = await exchange(r.credential);
        send({ action: "result", ...p, version: "4.0.2" });
        setTimeout(() => close(), 500);
      } catch (e) {
        send({ action: "result", ok: false, error: e.message, version: "4.0.2" });
      }
    }
  });
  globalThis.google.accounts.id.renderButton(box, { theme: "outline", size: "large", text: "signin_with", shape: "rectangular" });
}
addEventListener("message", (e) => {
  if (e.origin !== EXPECTED_EXTENSION_ORIGIN || e.source !== parent || e.data?.namespace !== "tdt-google-auth" || e.data?.action !== "sign-in") return;
  setTimeout(start, 0);
});
