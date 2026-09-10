# FIX v4.0.5 — Extension có dữ liệu nhưng Admin hiển thị 0 tài khoản

## Nguyên nhân chính

Adapter Firestore tự viết cho Vercel Postgres ở v4.0.4 đang **mutate cùng một query object** khi gọi `where()`, `orderBy()` và `limit()`. Trong `adminState()` một `usersReference` được dùng đồng thời cho nhiều truy vấn. Vì các query dùng chung state, filter của truy vấn sau bị rò sang truy vấn trước. Cuối chuỗi có thể tạo điều kiện mâu thuẫn như:

- `listState == whitelist`
- đồng thời `listState == blacklist`

Kết quả là Admin có thể nhận `users: []` và các KPI bằng 0 dù tài khoản Extension đã tồn tại trong database.

## Đã sửa

1. Query builder PostgreSQL giờ **immutable giống Firestore thật**: mỗi `where/orderBy/limit` trả một query mới với state riêng.
2. Mỗi query chụp snapshot state trước `await`, tránh race khi chạy `Promise.all`.
3. `count()` và `aggregate()` giữ filter riêng, không bị lẫn điều kiện giữa các truy vấn.
4. Google login ghi ngay hồ sơ `users/{uid}` trước khi cấp session Extension, tránh trạng thái đăng nhập thành công nhưng Admin chưa có user.
5. `/api/v1/extension/sync` upsert đầy đủ profile, Client ID, version/platform/browser/timezone, thời điểm sync và summary watch analytics.
6. `/api/v1/extension/check` và `/sync` xóa Admin cache ngay sau khi ghi dữ liệu.
7. Admin tự refresh khoảng 15 giây khi tab đang mở.

## Kiểm thử đã chạy

- `npm run check`: PASS.
- Query isolation test: PASS — list/total/active/locked/whitelist/blacklist giữ params độc lập.
- Google auth persistence test: PASS — login tạo ngay user trong DB.
- Extension sync persistence test: PASS — Client ID, version và watch summary được ghi vào hồ sơ Admin.

## Sau deploy

- `/api/health` phải trả `version: 4.0.5`.
- Extension hiện tại v4.0.2 vẫn dùng được, **không bắt buộc cài lại**.
- Nếu Extension đang đăng nhập sẵn: bấm **Đồng bộ** hoặc chờ heartbeat; Admin sẽ tự xuất hiện tài khoản.
- Nút **Làm mới** trên Admin gọi `fresh=1`, không dùng cache 12 giây.
