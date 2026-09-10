import { existsSync } from "node:fs";
const required = ["public/index.html", "public/admin/index.html", "api/[...path].js"];
for (const file of required) if (!existsSync(file)) throw new Error(`Missing required deployment file: ${file}`);
console.log(`Vercel build OK: ${required.length} required files present.`);
