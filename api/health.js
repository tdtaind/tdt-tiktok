function safeSetHeader(response, name, value) {
  if (typeof response?.setHeader === "function") response.setHeader(name, String(value));
  else if (typeof response?.writeHead !== "function" && response?.headers && typeof response.headers.set === "function") response.headers.set(name, String(value));
}

export default async function handler(request, response) {
  const payload = { ok: true, service: "tdt-control-vercel", version: "4.0.3", time: Date.now() };
  try {
    if (response?.writableEnded) return;
    response.statusCode = 200;
    safeSetHeader(response, "Content-Type", "application/json; charset=utf-8");
    safeSetHeader(response, "Cache-Control", "no-store, max-age=0");
    safeSetHeader(response, "X-Content-Type-Options", "nosniff");
    const body = JSON.stringify(payload);
    if (typeof response?.end === "function") return response.end(body);
    if (typeof response?.send === "function") return response.send(body);
    throw new Error("Vercel response object does not expose end()/send().");
  } catch (error) {
    console.error("TDT Vercel health API error", error);
    if (response?.writableEnded) return;
    response.statusCode = 500;
    safeSetHeader(response, "Content-Type", "application/json; charset=utf-8");
    const body = JSON.stringify({ ok: false, error: error?.message || "Lỗi máy chủ." });
    if (typeof response?.end === "function") return response.end(body);
    if (typeof response?.send === "function") return response.send(body);
  }
}
