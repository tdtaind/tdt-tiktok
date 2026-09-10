# TDT Control Center v4.0.5 — Vercel Only

Bản này giữ nguyên các luồng chính của TDT Control Center nhưng chuyển toàn bộ runtime khỏi Firebase:

- Frontend/Admin: Vercel
- API/backend: Vercel Functions
- Database: Vercel Postgres
- File release: Vercel Blob
- Google login: Google Identity Services + server session
- Extension remote access/sync/update: Vercel API

Không cần deploy Firebase Hosting, Firebase Functions, Firestore hoặc Realtime Database.

Xem `VERCEL_ONLY.md` và `.env.vercel.example` để cấu hình.


## v4.0.5

- Sửa lỗi Extension đăng nhập/đồng bộ thành công nhưng Admin vẫn hiển thị `0 tài khoản`. Nguyên nhân chính là PostgreSQL query adapter dùng query mutable làm filter của `whitelist/blacklist/locked/active` rò vào nhau khi `Promise.all`.
- Query builder đã đổi sang immutable như Firestore thật; mỗi `where/orderBy/limit` có state riêng.
- `/api/v1/auth/google` giờ đăng ký/touch tài khoản Google vào `users/{uid}` ngay khi đăng nhập thành công.
- `/api/v1/extension/sync` luôn cập nhật profile, Client ID, metadata thiết bị, thời điểm sync và watch analytics summary vào hồ sơ Admin.
- `/api/v1/extension/check` làm mới cache Admin ngay sau heartbeat/quyền truy cập.
- Admin tự làm mới dữ liệu khoảng 15 giây khi tab đang mở.
- Giữ nguyên Extension release v4.0.2; chỉ cần deploy backend v4.0.5.


## v4.0.4
- Fix `snapshot.exists is not a function` trong PostgreSQL realtime adapter.
- Google OAuth hiển thị rõ Authorized JavaScript origin bắt buộc.
- Extension release: v4.0.2.
