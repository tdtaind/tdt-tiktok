# Vercel Runtime Fix

The previous deployment error came from the legacy `functions.runtime` declaration in `vercel.json`.
This build removes that declaration and lets Vercel infer the Node.js runtime from the project configuration (`engines.node >=20`).

No application features or API routes were intentionally removed.

Deploy with:
- Framework Preset: Other
- Build Command: `npm run vercel-build`
- Output Directory: `public`
- Node.js: 20.x (or the current supported Node 20 runtime)

Do not add a `functions.runtime` entry such as `nodejs20.x` to `vercel.json`.
