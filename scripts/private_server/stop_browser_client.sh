#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/load_server_profile.sh"

CLIENT_ROOT="${SCREEPS_BROWSER_CLIENT_DIR}"

pkill -f "${CLIENT_ROOT}" || true
pkill -f 'screepers-steamless-client' || true
