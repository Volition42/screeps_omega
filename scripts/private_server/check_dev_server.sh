#!/bin/zsh
set -euo pipefail

SERVER_URL="${SCREEPS_SERVER_URL:-http://127.0.0.1:21025}"
LOCAL_TOKEN="${SCREEPS_LOCAL_TOKEN:-screeps-omega-dev-token}"

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
