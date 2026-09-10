# TDT Control v3.7.0 — Vercel-only deployment

## Mục tiêu
Toàn bộ web/API/extension update chạy trên Vercel. Firebase chỉ còn là dịch vụ dữ liệu và Google/Firebase Authentication; Firebase Hosting và Firebase Cloud Functions không tham gia runtime.

## Vercel
- Build command: `npm run vercel-build`
- Output directory: `public`
- Node runtime: 20
- API entry: `api/[...path].js`

## Environment Variables
- `FIREBASE_SERVICE_ACCOUNT_JSON` (bắt buộc production)
- `FIREBASE_PROJECT_ID=tran-duc-tai`
- `FIREBASE_DATABASE_URL=https://tran-duc-tai-default-rtdb.asia-southeast1.firebasedatabase.app`
- `FIREBASE_STORAGE_BUCKET=tran-duc-tai.firebasestorage.app`
- `TDT_ADMIN_TOKEN` (secret mạnh)
- `TDT_PROJECT_KEY=tiktok-tai-dep-trai`
- `TDT_EXTENSION_ID=cpndheccadlhkiogcfdhagomiadbaogn`
- `PUBLIC_BASE_URL=https://<project>.vercel.app`

## Sau deploy
1. Thêm domain Vercel vào Firebase Authentication Authorized domains.
2. Kiểm tra `/api/health`.
3. Kiểm tra `/auth/`, `/auth-extension/`, `/admin/`, `/extension/`.
4. Kiểm tra `/api/v1/extension/check` và `/api/v1/extension/update-manifest`.
5. Nếu dùng Google Sign-In cho extension, kiểm tra callback trên domain Vercel.
6. Không cần deploy `firebase deploy --only functions,hosting`.
