# Deploy TDT Control Center 4.0.0 to Vercel — no Firebase

## 1. Create the Vercel project
Import this repository/ZIP into Vercel.

- Framework: Other
- Build command: `npm run vercel-build`
- Output directory: `public`
- Node.js: 20.x

Do not add a `functions.runtime` field to `vercel.json`.

## 2. Add Vercel Postgres
In the Vercel project, create/connect a Postgres database from the Vercel Storage/Marketplace UI. Make sure `POSTGRES_URL` is available to the project.

The application creates its `app_documents` table automatically on first request.

## 3. Add Vercel Blob
Create/connect a Blob store and expose `BLOB_READ_WRITE_TOKEN` to the project.

Release uploads use direct browser-to-Blob upload, so large ZIP/CRX files do not have to pass through the serverless request body.

## 4. Create Google OAuth Web Client
Create an OAuth 2.0 Web application client in Google Cloud Console.

Add the exact deployed origin, for example:
`https://tdt-vercel-control.vercel.app`

Set that client ID as `GOOGLE_CLIENT_ID`.

## 5. Environment variables
Required:

- `POSTGRES_URL`
- `BLOB_READ_WRITE_TOKEN`
- `GOOGLE_CLIENT_ID`
- `TDT_APP_SECRET` — 32+ random characters
- `TDT_ADMIN_TOKEN` — 32+ random characters
- `TDT_PROJECT_KEY=tiktok-tai-dep-trai`
- `TDT_EXTENSION_ID=cpndheccadlhkiogcfdhagomiadbaogn`
- `PUBLIC_BASE_URL=https://YOUR-VERCEL-DOMAIN`

Redeploy after adding/changing variables.

## 6. First checks
Open:

- `/`
- `/admin/`
- `/api/health`
- `/extension/`

The first API request creates the Vercel Postgres schema.

## 7. Existing Firebase data
This build does not contact Firebase and therefore cannot silently copy the old Firebase data. If historical users/settings/sync records must be preserved, export them from the old system and import them into Vercel Postgres before switching production traffic.
