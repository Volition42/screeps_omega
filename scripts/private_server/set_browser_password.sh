#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/load_server_profile.sh"

SERVER_URL="${SCREEPS_SERVER_URL}"
LOCAL_TOKEN="${SCREEPS_LOCAL_TOKEN}"
BROWSER_PASSWORD="${SCREEPS_BROWSER_PASSWORD}"

curl -sSf -H "Content-Type: application/json" \
  -d '{"ticket":"local-dev-browser","useNativeAuth":false}' \
  "${SERVER_URL}/api/auth/steam-ticket" >/dev/null

curl -sSf \
  -H "X-Token: ${LOCAL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"oldPassword\":\"\",\"password\":\"${BROWSER_PASSWORD}\"}" \
  "${SERVER_URL}/api/user/password"
echo
echo "Browser login user: local-dev"
echo "Browser login password: ${BROWSER_PASSWORD}"
