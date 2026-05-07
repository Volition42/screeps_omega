#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="${HOME:-/home/vadmin}/.cache/screeps_omega/private_server"
SERVER_PID="${LOG_DIR}/server.pid"
CLIENT_PID="${LOG_DIR}/client.pid"
SERVER_SESSION="screeps-ptr-server"
CLIENT_SESSION="screeps-ptr-client"

kill_pid_file() {
  local pid_file="$1"
  local pid

  if [[ ! -f "${pid_file}" ]]; then
    return
  fi

  pid="$(cat "${pid_file}" 2>/dev/null || true)"
  rm -f "${pid_file}"

  if [[ -z "${pid}" ]] || ! kill -0 "${pid}" 2>/dev/null; then
    return
  fi

  kill "${pid}" 2>/dev/null || true
  for _ in $(seq 1 10); do
    if ! kill -0 "${pid}" 2>/dev/null; then
      return
    fi
    sleep 0.2
  done
  kill -KILL "${pid}" 2>/dev/null || true
}

if command -v tmux >/dev/null 2>&1; then
  tmux kill-session -t "${SERVER_SESSION}" 2>/dev/null || true
  tmux kill-session -t "${CLIENT_SESSION}" 2>/dev/null || true
fi

kill_pid_file "${SERVER_PID}"
kill_pid_file "${CLIENT_PID}"

bash "${SCRIPT_DIR}/stop_browser_client.sh" >/dev/null 2>&1 || true
bash "${SCRIPT_DIR}/stop_dev_server.sh" >/dev/null 2>&1 || true

echo "Stopped Screeps PTR server and browser client."
