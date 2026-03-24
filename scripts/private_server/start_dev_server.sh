#!/bin/zsh
set -euo pipefail

SERVER_ROOT="${SCREEPS_PRIVATE_SERVER_DIR:-/Users/jaysheldon/screeps_private_server}"
NODE24_BIN="${SCREEPS_NODE24_BIN:-/opt/homebrew/opt/node@24/bin}"
LOCAL_TOKEN="${SCREEPS_LOCAL_TOKEN:-screeps-omega-dev-token}"

export PATH="${NODE24_BIN}:$PATH"
export LOCAL_NOAUTH=1
export LOCAL_NOAUTH_TOKEN="${LOCAL_TOKEN}"

cd "${SERVER_ROOT}"
exec npx screeps start
