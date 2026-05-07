#!/usr/bin/env bash

PROFILE="${SCREEPS_SERVER_PROFILE:-ptr}"
HOME_DIR="${HOME:-/home/vadmin}"

detect_tailscale_ip() {
  if command -v tailscale >/dev/null 2>&1; then
    tailscale ip -4 2>/dev/null | head -n 1 || true
  elif [[ -x "/Applications/Tailscale.app/Contents/MacOS/Tailscale" ]]; then
    "/Applications/Tailscale.app/Contents/MacOS/Tailscale" ip -4 2>/dev/null | head -n 1 || true
  fi
}

detect_primary_ip() {
  local ip

  if command -v ip >/dev/null 2>&1; then
    ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") {print $(i + 1); exit}}')"
    if [[ -n "${ip}" ]]; then
      echo "${ip}"
      return
    fi
  fi

  if command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | tr ' ' '\n' | awk '/^[0-9.]+$/ && $0 !~ /^127\\./ && $0 !~ /^169\\.254\\./ {print; exit}')"
    if [[ -n "${ip}" ]]; then
      echo "${ip}"
      return
    fi
  fi

  if command -v ifconfig >/dev/null 2>&1; then
    ifconfig 2>/dev/null | awk '/inet / {print $2}' | awk '/^[0-9.]+$/ && $0 !~ /^127\./ && $0 !~ /^169\.254\./ {print; exit}'
  fi
}

node_major_version() {
  local node_bin="$1"
  local version

  if [[ -z "${node_bin}" || ! -x "${node_bin}/node" ]]; then
    return 1
  fi

  version="$("${node_bin}/node" -v 2>/dev/null || true)"
  version="${version#v}"
  version="${version%%.*}"
  [[ "${version}" =~ ^[0-9]+$ ]] || return 1
  echo "${version}"
}

detect_node24_bin() {
  local candidate
  local major

  for candidate in \
    "${HOME_DIR}/.local/opt/node24/bin" \
    "/opt/homebrew/opt/node@24/bin" \
    "/usr/local/opt/node@24/bin" \
    "/opt/homebrew/bin" \
    "/usr/local/bin" \
    "/usr/bin"; do
    major="$(node_major_version "${candidate}" || true)"
    if [[ "${major}" == "24" ]]; then
      echo "${candidate}"
      return
    fi
  done

  echo "/usr/bin"
}

DEFAULT_NODE24_BIN="$(detect_node24_bin)"

case "${PROFILE}" in
  ptr)
    : "${SCREEPS_PRIVATE_SERVER_DIR:=${HOME_DIR}/screeps_private_server_ptr}"
    : "${SCREEPS_NODE_BIN:=${DEFAULT_NODE24_BIN}}"
    : "${SCREEPS_SERVER_HOST:=0.0.0.0}"
    : "${SCREEPS_SERVER_PORT:=21035}"
    : "${SCREEPS_CLI_HOST:=localhost}"
    : "${SCREEPS_CLI_PORT:=21036}"
    ;;
  feat-node24)
    # Backward-compatible alternate local install profile.
    : "${SCREEPS_PRIVATE_SERVER_DIR:=${HOME_DIR}/screeps_private_server}"
    : "${SCREEPS_NODE_BIN:=${DEFAULT_NODE24_BIN}}"
    : "${SCREEPS_SERVER_HOST:=0.0.0.0}"
    : "${SCREEPS_SERVER_PORT:=21025}"
    : "${SCREEPS_CLI_HOST:=localhost}"
    : "${SCREEPS_CLI_PORT:=21026}"
    ;;
  *)
    echo "Unknown SCREEPS_SERVER_PROFILE: ${PROFILE}" >&2
    return 1
    ;;
esac

if [[ -z "${SCREEPS_TAILSCALE_IP:-}" ]]; then
  SCREEPS_TAILSCALE_IP="$(detect_tailscale_ip)"
fi

if [[ -z "${SCREEPS_PUBLIC_HOSTNAME:-}" ]]; then
  SCREEPS_PUBLIC_HOSTNAME="${SCREEPS_TAILSCALE_IP:-}"
fi

if [[ -z "${SCREEPS_PUBLIC_HOSTNAME:-}" ]]; then
  SCREEPS_PUBLIC_HOSTNAME="$(detect_primary_ip)"
fi

: "${SCREEPS_SERVER_URL:=http://${SCREEPS_SERVER_HOST}:${SCREEPS_SERVER_PORT}}"
: "${SCREEPS_SERVER_PUBLIC_HOSTNAME:=${SCREEPS_PUBLIC_HOSTNAME:-127.0.0.1}}"
: "${SCREEPS_SERVER_PUBLIC_URL:=http://${SCREEPS_SERVER_PUBLIC_HOSTNAME}:${SCREEPS_SERVER_PORT}}"
: "${SCREEPS_BROWSER_CLIENT_DIR:=${HOME_DIR}/screeps_browser_client}"
: "${SCREEPS_BROWSER_HOST:=127.0.0.1}"
: "${SCREEPS_BROWSER_BIND_HOST:=0.0.0.0}"
: "${SCREEPS_BROWSER_PORT:=8080}"
: "${SCREEPS_BROWSER_URL:=http://${SCREEPS_BROWSER_HOST}:${SCREEPS_BROWSER_PORT}}"
: "${SCREEPS_BROWSER_PUBLIC_HOSTNAME:=${SCREEPS_PUBLIC_HOSTNAME:-127.0.0.1}}"
: "${SCREEPS_BROWSER_PUBLIC_PORT:=${SCREEPS_BROWSER_PORT}}"
: "${SCREEPS_BROWSER_PUBLIC_URL:=http://${SCREEPS_BROWSER_PUBLIC_HOSTNAME}:${SCREEPS_BROWSER_PUBLIC_PORT}}"
: "${SCREEPS_BROWSER_NODE_BIN:=${DEFAULT_NODE24_BIN}}"
: "${SCREEPS_LOCAL_TOKEN:=screeps-omega-dev-token}"
: "${SCREEPS_BROWSER_PASSWORD:=screeps-local-pass}"
: "${SCREEPS_PACKAGE_NW:=${SCREEPS_BROWSER_CLIENT_DIR}/vendor/package.nw}"
: "${SCREEPS_BROWSER_SERVER_LIST:=}"

export SCREEPS_SERVER_PROFILE="${PROFILE}"
export SCREEPS_PRIVATE_SERVER_DIR
export SCREEPS_NODE_BIN
export SCREEPS_SERVER_HOST
export SCREEPS_SERVER_PORT
export SCREEPS_SERVER_URL
export SCREEPS_SERVER_PUBLIC_HOSTNAME
export SCREEPS_SERVER_PUBLIC_URL
export SCREEPS_CLI_HOST
export SCREEPS_CLI_PORT
export SCREEPS_BROWSER_CLIENT_DIR
export SCREEPS_BROWSER_HOST
export SCREEPS_BROWSER_BIND_HOST
export SCREEPS_BROWSER_PORT
export SCREEPS_BROWSER_URL
export SCREEPS_BROWSER_PUBLIC_HOSTNAME
export SCREEPS_BROWSER_PUBLIC_PORT
export SCREEPS_BROWSER_PUBLIC_URL
export SCREEPS_BROWSER_NODE_BIN
export SCREEPS_LOCAL_TOKEN
export SCREEPS_BROWSER_PASSWORD
export SCREEPS_PACKAGE_NW
export SCREEPS_BROWSER_SERVER_LIST
export SCREEPS_TAILSCALE_IP
export SCREEPS_PUBLIC_HOSTNAME
