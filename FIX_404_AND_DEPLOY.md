# Sửa lỗi Firebase Hosting Page Not Found

## Nguyên nhân
Gói máy chủ cập nhật cũ chỉ chứa thư mục `public/extension/` và không có `public/index.html`. Khi deploy riêng gói đó lên cùng site `tran-duc-tai`, Firebase Hosting thay toàn bộ nội dung site nên trang gốc và Dashboard biến mất.

## Gói này đã gộp an toàn
- Dashboard Firebase Control tại `/` và `/admin/`
- Đăng nhập extension tại `/auth-extension/`
- Auth iframe tại `/auth/`
- API Functions tại `/api/**`
- Máy chủ cập nhật tại `/extension/`
- Manifest tại `/extension/releases/latest.json`
- Update XML tại `/extension/updates.xml`
- Trang lỗi `404.html`

## Deploy sửa lỗi
Chạy trong đúng thư mục đã giải nén gói này:

```bash
npm install --prefix functions
npm test --prefix functions
npx --yes firebase-tools@latest deploy --project tran-duc-tai
```

Chỉ deploy Hosting khi Functions đã tồn tại và không thay đổi:

```bash
npx --yes firebase-tools@latest deploy --only hosting --project tran-duc-tai
```

## Kiểm tra sau deploy
- https://tran-duc-tai.web.app/
- https://tran-duc-tai.web.app/admin/
- https://tran-duc-tai.web.app/extension/
- https://tran-duc-tai.web.app/extension/releases/latest.json
- https://tran-duc-tai.web.app/auth-extension/

Không deploy lại gói `TDT_PRIVATE_EXTENSION_UPDATE_SERVER.zip` cũ lên cùng site vì gói đó sẽ thay thế Dashboard.
