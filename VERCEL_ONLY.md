# TDT Control v4.0.0 — Vercel Only

## Architecture
- Vercel Node.js Functions: all application APIs.
- Vercel Postgres: users, installations, access, settings, sync, admin credentials, release metadata.
- Vercel Blob: extension release packages.
- Google Identity Services + Google OAuth: Google sign-in; Firebase Authentication is not used.
- Chrome extension talks only to the Vercel API. No Firebase SDK, Realtime Database or Cloud Functions remain.

## Required Vercel environment variables
- `POSTGRES_URL`
- `BLOB_READ_WRITE_TOKEN`
- `GOOGLE_CLIENT_ID`
- `TDT_APP_SECRET` (32+ random characters)
- `TDT_ADMIN_TOKEN` (32+ random characters; may be the same as TDT_APP_SECRET)
- `TDT_PROJECT_KEY`
- `TDT_EXTENSION_ID`
- `PUBLIC_BASE_URL`

## Google setup
Create a Google OAuth Web Client ID in Google Cloud Console and add the deployed Vercel origin to Authorized JavaScript origins. Put the client ID in `GOOGLE_CLIENT_ID`.

## Database
The API automatically creates `app_documents` on first protected/public API request. It stores document-style records in JSONB so the existing access, sync, analytics and admin data model remains compatible.

## Existing data
Firebase data is not automatically copied by Vercel. Export the old data once and import it into the Vercel database before switching production traffic if historical users/analytics must be preserved.
