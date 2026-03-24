#!/bin/zsh
set -euo pipefail

CLIENT_ROOT="${SCREEPS_BROWSER_CLIENT_DIR:-/Users/jaysheldon/screeps_browser_client}"
NODE24_BIN="${SCREEPS_NODE24_BIN:-/opt/homebrew/opt/node@24/bin}"
PACKAGE_NW="${SCREEPS_PACKAGE_NW:-/Users/jaysheldon/Library/Application Support/Steam/steamapps/common/Screeps/package.nw}"
CLIENT_HOST="${SCREEPS_BROWSER_HOST:-127.0.0.1}"
CLIENT_PORT="${SCREEPS_BROWSER_PORT:-8080}"

export PATH="${NODE24_BIN}:$PATH"

cd "${CLIENT_ROOT}"
exec npx screepers-steamless-client \
  --package "${PACKAGE_NW}" \
  --host "${CLIENT_HOST}" \
  --port "${CLIENT_PORT}"
