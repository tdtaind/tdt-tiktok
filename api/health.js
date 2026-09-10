import { route } from "../server/index.js";
export default async function handler(req,res){ try { await route(req,res); } catch(error){ console.error(error); res.status(500).json({ok:false,error:error?.message||"Lỗi máy chủ."}); } }
