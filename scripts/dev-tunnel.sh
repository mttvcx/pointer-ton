#!/usr/bin/env bash
# Expose local Pulse webhook receiver via ngrok (port 3001).
# Usage: ./scripts/dev-tunnel.sh
# Windows: powershell -ExecutionPolicy Bypass -File ./scripts/dev-tunnel.ps1
# Then: npm run update:webhook-url -- https://YOUR-NGROK-URL

set -euo pipefail

PORT="${PORT:-3001}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NGROK_BIN="${NGROK_BIN:-}"

if [[ -z "${NGROK_BIN}" ]]; then
  if command -v ngrok >/dev/null 2>&1; then
    NGROK_BIN="$(command -v ngrok)"
  elif [[ -x "${ROOT}/.tools/ngrok.exe" ]]; then
    NGROK_BIN="${ROOT}/.tools/ngrok.exe"
  fi
fi

if [[ -z "${NGROK_BIN}" ]]; then
  echo "ngrok is not installed. Install from https://ngrok.com/download" >&2
  echo "Or download to ${ROOT}/.tools/ngrok.exe" >&2
  exit 1
fi

echo "Starting ngrok tunnel to http://127.0.0.1:${PORT} ..."
echo "When ngrok prints the Forwarding URL, run:"
echo "  npm run update:webhook-url -- https://YOUR-SUBDOMAIN.ngrok-free.app"
echo ""

exec "${NGROK_BIN}" http "${PORT}"
