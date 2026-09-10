# Fix Vercel API response — v4.0.1

Đã sửa lỗi `/api/health` trả về:

`{"ok":false,"error":"response.set is not a function"}`

Các thay đổi chính:
- Thay Express-only `response.set()`, `response.send()`, `response.status()` bằng API chuẩn Node/Vercel: `statusCode`, `setHeader()`, `end()`.
- Thay `response.redirect()` bằng redirect dùng `Location` + `statusCode`.
- Sửa CORS/OPTIONS để không dùng Express helpers.
- Sửa import sai đường dẫn ở `/api/v1/auth/[...path].js` và `/api/v1/extension/[...path].js`.
- Khôi phục `adminToken` dùng `TDT_APP_SECRET`.
- Sửa biến `PUBLIC_BASE_URL` chưa tồn tại thành `VERCEL_BASE_URL`.
- Import `list` từ `@vercel/blob` cho helper Blob.
- Sửa script `npm run check` để kiểm tra đúng các API route hiện có.

Sau deploy, `/api/health` phải trả HTTP 200 với JSON dạng:

`{"ok":true,"service":"tdt-control-vercel","version":"4.0.0","time":...}`
