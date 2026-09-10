## Firebase Control v3.0.0 · Bản hoàn thiện hiệu năng và cập nhật

- API mới: `POST /api/v1/extension/sync`.
- Đồng bộ cài đặt Extension, Watch-time, lịch sử xem và tùy chọn giao diện theo Firebase UID.
- Dữ liệu được ghi qua Cloud Function bằng Firebase Admin; client không có quyền ghi trực tiếp Firestore.
- Cần deploy `functions:api` trước khi dùng Extension v2.5.1.

## Google Auth & Dashboard v3.0.0

- Luồng đăng nhập chính mở trực tiếp `https://tdt-firebase-control.vercel.app/auth-extension/` trong cửa sổ Chrome.
- Dùng `signInWithRedirect()` và `browserSessionPersistence`; không còn phụ thuộc popup chạy trong iframe/offscreen ẩn.
- Trang Firebase chỉ được phép trả kết quả về Extension ID `cpndheccadlhkiogcfdhagomiadbaogn` qua `externally_connectable`.
- Mỗi phiên dùng nonce ngẫu nhiên 256-bit, tự hết hạn sau khoảng 3 phút.
- Chỉ cần deploy Hosting: `npx --yes firebase-tools@latest deploy --only hosting --project tran-duc-tai`.

# TDT Firebase Control v2.1.3

Backend Firebase cho **TikTok Tài Đẹp Trai v2.20.0**.

## Tính năng

- Google Sign-In là điều kiện bắt buộc để extension hoạt động; Firebase Anonymous Auth bị backend từ chối.
- Tài khoản Google đăng ký lần đầu được đưa vào Whitelist mặc định.
- Khóa/mở khóa, Whitelist/Blacklist và chế độ toàn hệ thống được đẩy qua Realtime Database.
- Dashboard đăng nhập bằng tên người dùng/mật khẩu, mặc định lần đầu `admin / admin`; phiên đăng nhập được ghi nhớ tối đa 30 ngày và bị vô hiệu khi đổi tài khoản.
- Mỗi người dùng có thông báo chặn riêng, đồng bộ realtime tới popup extension.
- Thống kê tài khoản, online 5 phút/24 giờ/7 ngày/30 ngày, đăng ký mới, lượt cài đặt, phiên, ngày hoạt động, thiết bị và 13 nhóm sự kiện.
- Firestore lưu hồ sơ và thống kê; Security Rules chặn ghi trực tiếp từ client.

## Cơ chế khóa

- Extension không tin trạng thái `allowed` đã lưu khi Service Worker khởi động lại.
- Mỗi quyết định có lease tối đa 90 giây; các thao tác nền luôn kiểm tra lease.
- Hai luồng realtime theo dõi `settings` và `access/{auth.uid}`.
- Mất xác minh, token lỗi, server lỗi hoặc lease hết hạn đều chuyển sang fail-closed.
- Backend xác minh Firebase ID token, provider `google.com`, Project Key và Extension ID cố định.

Mã JavaScript nằm trên thiết bị người dùng không thể chống sửa tuyệt đối. Dữ liệu hoặc chức năng có giá trị cần nằm sau API server và API phải kiểm tra quyền ở mọi request.

## Cấu hình Firebase

Project cần bật billing để triển khai Cloud Functions v2. Trong Firebase Console:

1. Authentication → Sign-in method → bật **Google**.
2. Firebase Hosting mặc định phải phục vụ được miền `tran-duc-tai.firebaseapp.com`. URI extension cũ trong Authorized domains có thể giữ nguyên nhưng luồng v2.1.3 không phụ thuộc vào nó.
3. Tạo Cloud Firestore và Realtime Database.
4. Tạo Web App để lấy Web API Key.

Đặt secret ký phiên Dashboard. Secret này không phải mật khẩu admin và không đưa vào extension/source:

```bash
firebase functions:secrets:set TDT_ADMIN_TOKEN
```

Tạo `functions/.env.PROJECT_ID`:

```env
TDT_PROJECT_KEY=tiktok-tai-dep-trai
TDT_EXTENSION_ID=cpndheccadlhkiogcfdhagomiadbaogn
```

## Kiểm thử và triển khai

```bash
npm install --prefix functions
npm test --prefix functions
firebase deploy --only functions,hosting,database,firestore
```

Dashboard: `https://PROJECT_ID.web.app`. Đăng nhập lần đầu bằng `admin / admin` và đổi mật khẩu ngay trong Dashboard.

## Dữ liệu thu thập

- Firebase UID, email, tên và ảnh đại diện Google.
- Client ID ngẫu nhiên, lần đầu/lần cuối hoạt động, phiên bản extension.
- Nền tảng, trình duyệt, kiến trúc, mobile/desktop, CPU logic, RAM ước lượng, kiểu kết nối, ngôn ngữ và múi giờ.
- Bộ đếm heartbeat, popup, đăng nhập, video/tải/phụ đề/dịch, proxy, Clean Mode, sản phẩm và bộ lọc.

Không gửi cookie, mật khẩu Google, URL TikTok, nội dung tìm kiếm/phụ đề hoặc lịch sử duyệt web.

---

## Máy chủ cập nhật extension đã gộp

Bản này đã gộp Firebase Control và máy chủ cập nhật vào cùng một Hosting deploy để tránh lỗi mất `index.html`.

- Dashboard: `/` hoặc `/admin/`
- Update server: `/extension/`
- Update manifest: `/extension/releases/latest.json`

Không deploy riêng gói update-server cũ lên site này.


## Fix HTTP 404 v2.3.2
Deploy đầy đủ lần đầu bằng DEPLOY_FIX_404.command. Endpoint update dùng Function độc lập và manifest tĩnh dự phòng.
