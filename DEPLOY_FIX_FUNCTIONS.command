#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
PROJECT="tran-duc-tai"
export NPM_CONFIG_CACHE="${TMPDIR:-/tmp}/tdt-firebase-npm-cache-v234"
mkdir -p "$NPM_CONFIG_CACHE"

echo "[1/5] Cài dependencies sạch, bao gồm Firestore/Storage bắt buộc..."
npm ci --prefix functions --include=optional

echo "[2/5] Kiểm tra cú pháp + nạp thử toàn bộ Functions..."
npm run verify --prefix functions

echo "[3/5] Bảo đảm các API Google Cloud cần thiết đã bật..."
npx --yes firebase-tools@latest use "$PROJECT" >/dev/null 2>&1 || true

echo "[4/5] Deploy duy nhất Function api để tránh lỗi tạo Function phụ..."
npx --yes firebase-tools@latest deploy --project "$PROJECT" --only functions:api

echo "[5/5] Deploy Hosting và Rules sau khi api thành công..."
npx --yes firebase-tools@latest deploy --project "$PROJECT" --only hosting,database,firestore

echo "Hoàn tất. Kiểm tra: https://tran-duc-tai.web.app/api/health"
