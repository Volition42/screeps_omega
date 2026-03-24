#!/bin/zsh
set -euo pipefail

SERVER_ROOT="${SCREEPS_PRIVATE_SERVER_DIR:-/Users/jaysheldon/screeps_private_server}"

pkill -f "${SERVER_ROOT}" || true
pkill -f 'npx screeps start' || true
