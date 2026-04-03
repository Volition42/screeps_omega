#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "${ROOT_DIR}/scripts/private_server/load_server_profile.sh"

ROOM="${SCREEPS_TEST_ROOM:-W5N5}"
X="${SCREEPS_TEST_INVADER_X:-10}"
Y="${SCREEPS_TEST_INVADER_Y:-10}"
SIZE="${SCREEPS_TEST_INVADER_SIZE:-small}"
TYPE="${SCREEPS_TEST_INVADER_TYPE:-Melee}"

python3 "${ROOT_DIR}/scripts/private_server/world_tool.py" create-invader \
  --room "${ROOM}" \
  --x "${X}" \
  --y "${Y}" \
  --size "${SIZE}" \
  --type "${TYPE}"
