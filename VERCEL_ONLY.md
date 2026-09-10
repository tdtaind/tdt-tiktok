# Vercel-only runtime

Runtime production gồm `public/*` và Vercel Function `api/[...path].js`. Không cần Firebase Hosting hoặc Firebase Cloud Functions để chạy web/API.

Firebase vẫn được giữ làm lớp dữ liệu và Authentication để bảo toàn dữ liệu/chức năng gốc.
