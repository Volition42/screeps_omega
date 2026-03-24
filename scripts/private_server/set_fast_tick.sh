#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
TICK_MS="${1:-100}"

python3 "${ROOT_DIR}/scripts/private_server/world_tool.py" set-tick-duration "${TICK_MS}"
