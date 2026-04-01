#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "${ROOT_DIR}/scripts/private_server/load_server_profile.sh"

TOKEN="${SCREEPS_LOCAL_TOKEN}"
SERVER_URL="${SCREEPS_SERVER_URL}"

exec python3 "${ROOT_DIR}/scripts/private_server/upload_code.py" \
  "${ROOT_DIR}/src" \
  --server-url "${SERVER_URL}" \
  --token "${TOKEN}"
