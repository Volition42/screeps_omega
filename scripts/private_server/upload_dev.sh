#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
TOKEN="${SCREEPS_LOCAL_TOKEN:-screeps-omega-dev-token}"
SERVER_URL="${SCREEPS_SERVER_URL:-http://127.0.0.1:21025}"

exec python3 "${ROOT_DIR}/scripts/private_server/upload_code.py" \
  "${ROOT_DIR}/dev" \
  --server-url "${SERVER_URL}" \
  --token "${TOKEN}"
