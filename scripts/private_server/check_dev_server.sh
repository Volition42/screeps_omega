#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/load_server_profile.sh"

SERVER_URL="http://127.0.0.1:${SCREEPS_SERVER_PORT}"
LOCAL_TOKEN="${SCREEPS_LOCAL_TOKEN}"

curl -sSf -H "Content-Type: application/json" \
  -d '{"ticket":"local-dev-check","useNativeAuth":false}' \
  "${SERVER_URL}/api/auth/steam-ticket" >/dev/null

echo "Version:"
curl -sSf "${SERVER_URL}/api/version"
echo
echo
echo "Auth:"
curl -sSf -H "X-Token: ${LOCAL_TOKEN}" "${SERVER_URL}/api/auth/me"
echo
echo
echo "Steam Ticket Bridge:"
curl -sSf -H "Content-Type: application/json" \
  -d '{"ticket":"local-dev-check","useNativeAuth":false}' \
  "${SERVER_URL}/api/auth/steam-ticket"
echo
