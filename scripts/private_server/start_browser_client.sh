#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/load_server_profile.sh"

CLIENT_ROOT="${SCREEPS_BROWSER_CLIENT_DIR}"
BROWSER_NODE_BIN="${SCREEPS_BROWSER_NODE_BIN:-${SCREEPS_NODE_BIN}}"
PACKAGE_NW="${SCREEPS_PACKAGE_NW:-/Users/jaysheldon/Library/Application Support/Steam/steamapps/common/Screeps/package.nw}"
CLIENT_HOST="${SCREEPS_BROWSER_HOST}"
CLIENT_PORT="${SCREEPS_BROWSER_PORT}"

export PATH="${BROWSER_NODE_BIN}:$PATH"

cd "${CLIENT_ROOT}"
exec npx screepers-steamless-client \
  --package "${PACKAGE_NW}" \
  --host "${CLIENT_HOST}" \
  --port "${CLIENT_PORT}"
