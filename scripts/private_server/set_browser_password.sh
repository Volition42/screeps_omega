#!/bin/zsh
set -euo pipefail

SERVER_URL="${SCREEPS_SERVER_URL:-http://127.0.0.1:21025}"
LOCAL_TOKEN="${SCREEPS_LOCAL_TOKEN:-screeps-omega-dev-token}"
BROWSER_PASSWORD="${SCREEPS_BROWSER_PASSWORD:-screeps-local-pass}"

curl -sSf \
  -H "X-Token: ${LOCAL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"oldPassword\":\"\",\"password\":\"${BROWSER_PASSWORD}\"}" \
  "${SERVER_URL}/api/user/password"
echo
echo "Browser login user: local-dev"
echo "Browser login password: ${BROWSER_PASSWORD}"
