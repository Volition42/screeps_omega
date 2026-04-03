#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/load_server_profile.sh"

SERVER_ROOT="${SCREEPS_PRIVATE_SERVER_DIR}"

pkill -f "${SERVER_ROOT}" || true
pkill -f 'npx screeps start' || true
