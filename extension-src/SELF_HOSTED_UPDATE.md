# Cập nhật từ máy chủ riêng

Extension v2.3.9 giữ nguyên Extension ID `cpndheccadlhkiogcfdhagomiadbaogn`.

- API manifest động: `https://tdt-tiktok.vercel.app/api/v1/extension/update-manifest`
- API tải gói: `https://tdt-tiktok.vercel.app/api/v1/extension/download`
- Kênh thông báo: Vercel Realtime Database tại `/update`.
- Chu kỳ kiểm tra dự phòng: 60 phút; đồng thời kiểm tra khi Chrome khởi động, khi mở popup và khi heartbeat.
- Bản bắt buộc tự khóa phiên bản cũ, hiện popup update và tự tải gói mới.
- Chỉ chấp nhận URL HTTPS cùng máy chủ riêng đã cấu hình.

Chrome không cho bản `Load unpacked` tự ghi đè mã nguồn đang chạy. Với bản này, ZIP mới được tải tự động; người dùng giải nén và nạp lại thư mục. Cập nhật CRX im lặng cần CRX ký bằng cùng private key và cài qua chính sách doanh nghiệp.
