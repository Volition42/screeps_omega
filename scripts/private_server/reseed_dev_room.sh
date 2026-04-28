#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "${ROOT_DIR}/scripts/private_server/load_server_profile.sh"

ROOM="${SCREEPS_TEST_ROOM:-W3N3}"
SPAWN_NAME="${SCREEPS_TEST_SPAWN:-Spawn1}"
SPAWN_X="${SCREEPS_TEST_SPAWN_X:-25}"
SPAWN_Y="${SCREEPS_TEST_SPAWN_Y:-25}"

python3 "${ROOT_DIR}/scripts/private_server/world_tool.py" ensure-local-user
python3 "${ROOT_DIR}/scripts/private_server/world_tool.py" reseed-room \
  --room "${ROOM}" \
  --spawn-name "${SPAWN_NAME}" \
  --spawn-x "${SPAWN_X}" \
  --spawn-y "${SPAWN_Y}"
bash "${ROOT_DIR}/scripts/private_server/upload_src.sh"
bash "${ROOT_DIR}/scripts/private_server/set_browser_password.sh"
