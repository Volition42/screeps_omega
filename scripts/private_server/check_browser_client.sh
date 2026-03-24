#!/bin/zsh
set -euo pipefail

CLIENT_URL="${SCREEPS_BROWSER_URL:-http://127.0.0.1:8080}"
SERVER_URL="${SCREEPS_SERVER_URL:-http://127.0.0.1:21025}"

echo "Browser Client Root:"
curl -sSfI "${CLIENT_URL}/"
echo
echo
echo "Browser Client Local Server Route:"
curl -sSfI "${CLIENT_URL}/(${SERVER_URL})/"
echo
