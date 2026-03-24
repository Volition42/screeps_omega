#!/bin/zsh
set -euo pipefail

CLIENT_ROOT="${SCREEPS_BROWSER_CLIENT_DIR:-/Users/jaysheldon/screeps_browser_client}"

pkill -f "${CLIENT_ROOT}" || true
pkill -f 'screepers-steamless-client' || true
