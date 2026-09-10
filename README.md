# TDT Control Center v4.0.0 — Vercel Only

Bản này giữ nguyên các luồng chính của TDT Control Center nhưng chuyển toàn bộ runtime khỏi Firebase:

- Frontend/Admin: Vercel
- API/backend: Vercel Functions
- Database: Vercel Postgres
- File release: Vercel Blob
- Google login: Google Identity Services + server session
- Extension remote access/sync/update: Vercel API

Không cần deploy Firebase Hosting, Firebase Functions, Firestore hoặc Realtime Database.

Xem `VERCEL_ONLY.md` và `.env.vercel.example` để cấu hình.
