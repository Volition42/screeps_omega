#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/load_server_profile.sh"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

SERVER_ROOT="${SCREEPS_PRIVATE_SERVER_DIR}"
NODE_BIN="${SCREEPS_NODE_BIN}"
LOCAL_TOKEN="${SCREEPS_LOCAL_TOKEN}"
SERVER_ENV_FILE="${SERVER_ROOT}/.local-dev.env"

export PATH="${NODE_BIN}:$PATH"

if [[ -f "${SERVER_ENV_FILE}" ]]; then
  source "${SERVER_ENV_FILE}"
fi

export LOCAL_NOAUTH=1
export LOCAL_NOAUTH_TOKEN="${LOCAL_TOKEN}"
export LOCAL_NOAUTH_CPU="${LOCAL_NOAUTH_CPU:-${SCREEPS_TEST_CPU:-20}}"

python3 "${ROOT_DIR}/scripts/private_server/patch_private_server.py"

cd "${SERVER_ROOT}"
exec npx screeps start
