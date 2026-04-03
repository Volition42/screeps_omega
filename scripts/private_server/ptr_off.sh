#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_SESSION="screeps-ptr-server"
CLIENT_SESSION="screeps-ptr-client"

tmux kill-session -t "${SERVER_SESSION}" 2>/dev/null || true
tmux kill-session -t "${CLIENT_SESSION}" 2>/dev/null || true

bash "${SCRIPT_DIR}/stop_browser_client.sh" >/dev/null 2>&1 || true
bash "${SCRIPT_DIR}/stop_dev_server.sh" >/dev/null 2>&1 || true

echo "Stopped Screeps PTR server and browser client."
