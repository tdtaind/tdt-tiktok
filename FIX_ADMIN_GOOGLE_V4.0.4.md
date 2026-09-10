# FIX v4.0.4 — Admin snapshot + Google OAuth origin

## 1. Admin: `snapshot.exists is not a function`

PostgreSQL adapter của dự án trả snapshot theo dạng `snapshot.exists` (boolean), nhưng hai nhánh realtime vẫn gọi `snapshot.exists()` như Firebase SDK. Đã sửa toàn bộ hai vị trí còn lại sang boolean:

- `ensureSettings()`
- cập nhật access của user trong Admin API

Sau sửa, `/api/admin/state` không còn văng lỗi này.

## 2. Google: `401 invalid_client` / `no registered origin`

Đây là lỗi cấu hình OAuth của Google, không phải lỗi route Vercel. Trang đăng nhập chạy tại origin:

`https://tdt-tiktok.vercel.app`

Trong Google Cloud Console, mở đúng **OAuth 2.0 Client ID loại Web application** đang đặt trong biến Vercel `GOOGLE_CLIENT_ID`, rồi thêm chính xác vào **Authorized JavaScript origins**:

`https://tdt-tiktok.vercel.app`

Không thêm `/auth-extension`, không thêm dấu `/` ở cuối.

Bản v4.0.4 bổ sung preflight và thông báo trực tiếp origin bắt buộc trên trang đăng nhập, đồng thời `/api/health` trả `googleAuth.authorizedJavascriptOriginRequired` để kiểm tra deployment.

## 3. Vercel Environment Variables

```env
PUBLIC_BASE_URL=https://tdt-tiktok.vercel.app
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
TDT_EXTENSION_ID=cpndheccadlhkiogcfdhagomiadbaogn
TDT_APP_SECRET=<32+ random characters>
```

Sau khi lưu Google Cloud credential, redeploy Vercel nếu bạn cũng vừa đổi `GOOGLE_CLIENT_ID`. Nếu chỉ thêm Authorized JavaScript origin cho đúng client ID hiện có thì không cần đổi source; đóng popup cũ và đăng nhập lại.
