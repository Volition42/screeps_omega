#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "${ROOT_DIR}/scripts/private_server/load_server_profile.sh"

python3 "${ROOT_DIR}/scripts/private_server/world_tool.py" reset-world
python3 "${ROOT_DIR}/scripts/private_server/world_tool.py" ensure-local-user
python3 "${ROOT_DIR}/scripts/private_server/world_tool.py" generate-dev-world
bash "${ROOT_DIR}/scripts/private_server/upload_src.sh"
bash "${ROOT_DIR}/scripts/private_server/set_browser_password.sh"
