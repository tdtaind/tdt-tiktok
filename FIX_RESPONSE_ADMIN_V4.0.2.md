# TDT Control Vercel v4.0.2 – Response/Admin fix

## Lỗi `response.set is not a function`

- `/api/health` nay là handler độc lập, không import router/database/blob.
- Không còn dùng `response.set()`, `response.status()`, `response.send()` trong health/router.
- Dùng chuẩn Node/Vercel: `statusCode`, `setHeader()`, `end()`.
- Sau deploy, `/api/health` phải trả `ok:true` và `version:"4.0.2"`. Nếu vẫn thấy lỗi cũ thì deployment đang chạy source/build cũ hoặc Root Directory sai.

## Admin mặc định

- Lần đầu chạy bản v4.0.2, thông tin quản trị được bootstrap một lần về `admin` / `admin`.
- Đăng nhập thành công sẽ bắt buộc đổi tài khoản/mật khẩu trước khi dùng API quản trị.
- Mật khẩu mới tối thiểu 8 ký tự; không được giữ nguyên `admin/admin`.
- Sau khi đổi thành công, marker `admin-default-v4.0.2` được lưu nên cold start/redeploy cùng bản không reset mật khẩu nữa.

## Kiểm tra sau deploy

1. Mở `/api/health` → phải có `version: 4.0.2`.
2. Mở `/admin/` → đăng nhập `admin` / `admin`.
3. Hệ thống tự mở hộp đổi thông tin quản trị và không cho đóng trước khi đổi thành công.
4. Đổi mật khẩu mới >= 8 ký tự, sau đó dashboard mới được tải.
