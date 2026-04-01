#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "${ROOT_DIR}/scripts/private_server/load_server_profile.sh"

python3 "${ROOT_DIR}/scripts/private_server/world_tool.py" reset-world
python3 "${ROOT_DIR}/scripts/private_server/world_tool.py" ensure-local-user
python3 "${ROOT_DIR}/scripts/private_server/world_tool.py" reseed-room \
  --room "${SCREEPS_TEST_ROOM:-W5N5}" \
  --spawn-name "${SCREEPS_TEST_SPAWN:-Spawn1}" \
  --spawn-x "${SCREEPS_TEST_SPAWN_X:-25}" \
  --spawn-y "${SCREEPS_TEST_SPAWN_Y:-25}"
zsh "${ROOT_DIR}/scripts/private_server/upload_src.sh"
zsh "${ROOT_DIR}/scripts/private_server/set_browser_password.sh"
