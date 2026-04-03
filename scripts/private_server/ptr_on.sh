#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/load_server_profile.sh"

LOG_DIR="${HOME:-/home/vadmin}/.cache/screeps_omega/private_server"
SERVER_LOG="${LOG_DIR}/server.log"
CLIENT_LOG="${LOG_DIR}/client.log"
SERVER_URL="${SCREEPS_SERVER_PUBLIC_URL:-${SCREEPS_SERVER_URL}}"
CLIENT_URL="${SCREEPS_BROWSER_PUBLIC_URL:-${SCREEPS_BROWSER_URL}}"
SERVER_CHECK_URL="http://127.0.0.1:${SCREEPS_SERVER_PORT}"
CLIENT_CHECK_URL="http://127.0.0.1:${SCREEPS_BROWSER_PORT}"
SERVER_SESSION="screeps-ptr-server"
CLIENT_SESSION="screeps-ptr-client"

mkdir -p "${LOG_DIR}"
: > "${SERVER_LOG}"
: > "${CLIENT_LOG}"

bash "${SCRIPT_DIR}/ptr_off.sh" >/dev/null 2>&1 || true
bash "${SCRIPT_DIR}/stop_browser_client.sh" >/dev/null 2>&1 || true
bash "${SCRIPT_DIR}/stop_dev_server.sh" >/dev/null 2>&1 || true

tmux new-session -d -s "${SERVER_SESSION}" \
  "bash '${SCRIPT_DIR}/start_dev_server.sh' >>'${SERVER_LOG}' 2>&1"
sleep 2
tmux new-session -d -s "${CLIENT_SESSION}" \
  "bash '${SCRIPT_DIR}/start_browser_client.sh' >>'${CLIENT_LOG}' 2>&1"

echo "Starting Screeps PTR services..."
echo "Server log: ${SERVER_LOG}"
echo "Client log: ${CLIENT_LOG}"
echo

for _ in $(seq 1 30); do
  if curl -sSf "${SERVER_CHECK_URL}/api/version" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

for _ in $(seq 1 30); do
  if curl -sSfI "${CLIENT_CHECK_URL}/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Server: ${SERVER_URL}"
echo "Portal: ${CLIENT_URL}/"
echo "Game: ${CLIENT_URL}/(${SERVER_URL})/"
echo "Admin: ${CLIENT_URL}/omega-admin/"
