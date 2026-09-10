# FIX v4.0.3 — Admin PostgreSQL + Google Sign-In

## 1) `operator does not exist: text == unknown`

Nguyên nhân: lớp tương thích Firestore truyền toán tử `==` trực tiếp vào PostgreSQL. PostgreSQL dùng `=` chứ không dùng `==`.

Đã sửa bằng whitelist/mapping toán tử (`==` → `=`, `!=` → `<>`, giữ `>=`, `<=`, `>`, `<`) và ép kiểu tham số JSONB rõ ràng. Dashboard `/api/admin/state` không còn lỗi ở các truy vấn `locked == true`, `listState == whitelist/blacklist`.

## 2) Google popup `404 DEPLOYMENT_NOT_FOUND`

Nguyên nhân: extension còn hard-code domain cũ `https://tdt-vercel-control.vercel.app`. Production hiện tại là `https://tdt-tiktok.vercel.app`.

Đã sửa:
- default `PUBLIC_BASE_URL` → `https://tdt-tiktok.vercel.app`;
- Google auth popup lấy origin từ `REMOTE_CONFIG.serverUrl`;
- build tự đồng bộ `host_permissions`, CSP `frame-src`, `externally_connectable`, `update_url`;
- bỏ script Google/config bị nhúng lặp hai lần trên trang auth;
- extension bump `4.0.1` để phân biệt gói đã fix.

## 3) Admin mặc định

Giữ bootstrap `admin/admin` và bắt buộc đổi sau lần đăng nhập đầu. Marker bootstrap vẫn là `admin-default-v4.0.2`, vì vậy deploy v4.0.3 không reset tài khoản/mật khẩu mà admin đã đổi trước đó.

## Vercel Environment Variables tối thiểu

- `PUBLIC_BASE_URL=https://tdt-tiktok.vercel.app`
- `TDT_APP_SECRET=<chuỗi bí mật tối thiểu 32 ký tự>`
- `GOOGLE_CLIENT_ID=<Google OAuth Web Client ID>`
- Postgres/Neon variables do Vercel Storage integration cung cấp.
- `TDT_EXTENSION_ID=cpndheccadlhkiogcfdhagomiadbaogn` (nếu dùng đúng extension ID này).

Sau deploy kiểm tra `/api/health` phải trả `version: 4.0.3`.
