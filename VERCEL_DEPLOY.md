# TDT Firebase Control v3.0.0 + Vercel frontend

Bản này giữ nguyên frontend, Firebase Auth, Firestore, Realtime Database và Cloud Function `api`.
Vercel chỉ thay thế Firebase Hosting cho web static; các API/backend hiện tại vẫn chạy trên Firebase Functions.

## Deploy
1. Import thư mục này vào Vercel.
2. Framework Preset: Other.
3. Build Command: để trống.
4. Output Directory: `public`.
5. Deploy.
6. Trong Vercel, thêm domain nếu cần.

`vercel.json` đã rewrite `/api/*` sang:
`https://asia-southeast1-tran-duc-tai.cloudfunctions.net/api/*`

## Quan trọng
- Không đưa `TDT_ADMIN_TOKEN` lên Vercel. Secret backend vẫn nằm ở Firebase Functions.
- Nếu muốn chuyển **toàn bộ backend** khỏi Firebase sang Vercel Functions, cần port `functions/index.js` sang Vercel Serverless Functions và cấu hình Firebase Admin credentials/secret tương ứng. Bản hiện tại không làm việc đó để tránh thay đổi logic backend.
- Extension v3.6.0 đã được đóng gói trong `public/extension/releases/`.
- API update động của extension vẫn dùng Firebase Function và Realtime Database như bản gốc, nên không mất cơ chế cập nhật.
