#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/load_server_profile.sh"

CLIENT_URL="${SCREEPS_BROWSER_PUBLIC_URL:-${SCREEPS_BROWSER_URL}}"
SERVER_URL="${SCREEPS_SERVER_PUBLIC_URL:-${SCREEPS_SERVER_URL}}"

echo "Browser Client Root:"
curl -sSfI "${CLIENT_URL}/"
echo
echo
echo "Browser Client Local Server Route:"
curl -sSfI "${CLIENT_URL}/(${SERVER_URL})/"
echo

echo
echo "Browser Client Dashboard Entry:"
curl -sSfI "${CLIENT_URL}/web"
echo
