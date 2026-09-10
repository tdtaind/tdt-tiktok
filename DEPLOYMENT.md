# Hướng dẫn triển khai Firebase Control v3.0.0

Thiết lập production:

- Dashboard: `https://tran-duc-tai.web.app/admin/`
- Cloud Function: `api`, Node.js 20, thế hệ 2, vùng `asia-southeast1`
- Realtime Database: `https://tran-duc-tai-default-rtdb.asia-southeast1.firebasedatabase.app`
- Chrome Extension ID: `cpndheccadlhkiogcfdhagomiadbaogn`
- Firebase Authentication: Google bắt buộc ở API extension
- Tài khoản mới: Whitelist mặc định
- Dashboard mặc định lần đầu: `admin / admin`, bắt buộc đổi ngay sau khi đăng nhập

Kiểm tra bắt buộc sau triển khai:

- Health trả phiên bản `3.0.0`.
- Dashboard không còn ô Admin token; đăng nhập sai bị từ chối.
- Trang `/auth-extension/` chạy top-level trên `tran-duc-tai.firebaseapp.com` và trả kết quả qua external messaging.
- Firebase Anonymous Auth bị API extension từ chối.
- Endpoint Google Auth đã tạo được `authUri` cho provider `google.com`.
- Authorized Domain chứa đúng `chrome-extension://cpndheccadlhkiogcfdhagomiadbaogn`.
- Mỗi phiên đăng nhập được xác thực bằng nonce ngẫu nhiên 256-bit và Extension ID cố định.
- Logic backend và unit test xác nhận tài khoản Google mới nhận trạng thái `whitelist`.
- Khóa/mở khóa nhận qua Realtime Database và fail-closed khi mất xác minh.

Secret `TDT_ADMIN_TOKEN` chỉ dùng ký phiên HMAC phía server, không nằm trong Dashboard, extension hoặc gói ZIP.


Google Auth v2.3.0: dùng cửa sổ redirect hiển thị trên `tran-duc-tai.firebaseapp.com`, `browserSessionPersistence` và `externally_connectable`; không còn dùng popup Firebase trong iframe/offscreen ẩn.


## Cập nhật v2.3.0

- Ghi nhớ phiên Dashboard tối đa 30 ngày.
- Thông báo chặn riêng theo từng Firebase UID.
- Thêm trung tâm upload/phát hành Extension từ Dashboard.
- Gói update lưu trên Firebase Storage, manifest lưu Firestore và lệnh update phát qua Realtime Database.
- Endpoint mới: `/api/v1/extension/update-manifest` và `/api/v1/extension/download`.
- Deploy: `npx --yes firebase-tools@latest deploy --project tran-duc-tai`.
