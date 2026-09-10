#!/bin/bash
set -u
cd "$(dirname "$0")"
PROJECT="tran-duc-tai"
export NPM_CONFIG_CACHE="${TMPDIR:-/tmp}/tdt-firebase-npm-cache-v234"
mkdir -p "$NPM_CONFIG_CACHE"
LOG="firebase-deploy-diagnostic-$(date +%Y%m%d-%H%M%S).log"
{
  echo "=== Node/npm ==="
  node --version
  npm --version
  echo
  echo "=== Firebase CLI ==="
  npx --yes firebase-tools@latest --version
  echo
  echo "=== Login/project ==="
  npx --yes firebase-tools@latest projects:list | grep -E "$PROJECT|Project Display Name|Project ID" || true
  echo
  echo "=== Functions source preflight ==="
  npm ci --prefix functions --include=optional --no-audit --no-fund
  npm run verify --prefix functions
  echo
  echo "=== Existing Functions ==="
  npx --yes firebase-tools@latest functions:list --project "$PROJECT" || true
} 2>&1 | tee "$LOG"
echo "Đã lưu chẩn đoán vào: $LOG"
