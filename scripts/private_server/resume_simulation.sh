#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "${ROOT_DIR}/scripts/private_server/load_server_profile.sh"

python3 "${ROOT_DIR}/scripts/private_server/world_tool.py" resume
