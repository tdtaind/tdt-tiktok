import { route } from "../functions/index.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb"
    },
    responseLimit: false
  }
};

export default async function handler(req, res) {
  try {
    await route(req, res);
  } catch (error) {
    console.error("TDT Vercel API error", error);
    if (!res.headersSent) {
      res.status(Number(error?.status) || 500).setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, error: error?.message || "Lỗi máy chủ." }));
    } else {
      res.end();
    }
  }
}
