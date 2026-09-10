import { route } from "../../server/index.js";

export default async function handler(req, res) {
  try {
    await route(req, res);
  } catch (error) {
    console.error("TDT Vercel API error", error);
    if (!res.headersSent && !res.writableEnded) {
      res.statusCode = Number(error?.status) || 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify({ ok: false, error: error?.message || "Lỗi máy chủ." }));
    }
  }
}
