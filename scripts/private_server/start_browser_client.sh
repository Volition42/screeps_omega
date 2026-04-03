#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/load_server_profile.sh"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

CLIENT_ROOT="${SCREEPS_BROWSER_CLIENT_DIR}"
BROWSER_NODE_BIN="${SCREEPS_BROWSER_NODE_BIN:-${SCREEPS_NODE_BIN}}"
PACKAGE_NW="${SCREEPS_PACKAGE_NW}"
CLIENT_HOST="${SCREEPS_BROWSER_BIND_HOST:-${SCREEPS_BROWSER_HOST}}"
CLIENT_PORT="${SCREEPS_BROWSER_PORT}"
PUBLIC_HOSTNAME="${SCREEPS_BROWSER_PUBLIC_HOSTNAME:-}"
PUBLIC_PORT="${SCREEPS_BROWSER_PUBLIC_PORT:-${CLIENT_PORT}}"
SERVER_LIST="${SCREEPS_BROWSER_SERVER_LIST:-}"
SERVER_PUBLIC_URL="${SCREEPS_SERVER_PUBLIC_URL:-${SCREEPS_SERVER_URL}}"

export PATH="${BROWSER_NODE_BIN}:$PATH"
export SCREEPS_BROWSER_EXTENSION_MODULE="${ROOT_DIR}/scripts/private_server/browser_admin_extension.mjs"
export SCREEPS_OMEGA_REPO_ROOT="${ROOT_DIR}"
export SCREEPS_OMEGA_WORLD_TOOL="${ROOT_DIR}/scripts/private_server/world_tool.py"
export SCREEPS_OMEGA_UPLOAD_SCRIPT="${ROOT_DIR}/scripts/private_server/upload_src.sh"
export SCREEPS_OMEGA_RESET_SCRIPT="${ROOT_DIR}/scripts/private_server/reset_dev_world.sh"
export SCREEPS_OMEGA_RESEED_SCRIPT="${ROOT_DIR}/scripts/private_server/reseed_dev_room.sh"

if [[ ! -f "${PACKAGE_NW}" ]]; then
  echo "Missing Screeps package.nw at ${PACKAGE_NW}" >&2
  echo "Set SCREEPS_PACKAGE_NW to a valid client bundle before starting the browser client." >&2
  exit 1
fi

python3 "${ROOT_DIR}/scripts/private_server/patch_browser_client.py"

cd "${CLIENT_ROOT}"
ARGS=(
  --package "${PACKAGE_NW}"
  --host "${CLIENT_HOST}"
  --port "${CLIENT_PORT}"
)

if [[ -n "${PUBLIC_HOSTNAME}" ]]; then
  ARGS+=(--public_hostname "${PUBLIC_HOSTNAME}")
  ARGS+=(--public_port "${PUBLIC_PORT}")
fi

if [[ -z "${SERVER_LIST}" ]]; then
  SERVER_LIST="${CLIENT_ROOT}/server_list.local.generated.json"
  cat > "${SERVER_LIST}" <<EOF
[
  {
    "type": "private",
    "name": "Local Dev Server",
    "url": "${SERVER_PUBLIC_URL}",
    "subdomain": "localdev"
  }
]
EOF
fi

if [[ -n "${SERVER_LIST}" ]]; then
  ARGS+=(--server_list "${SERVER_LIST}")
fi

exec npx screepers-steamless-client "${ARGS[@]}"
