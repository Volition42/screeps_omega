#!/bin/zsh

PROFILE="${SCREEPS_SERVER_PROFILE:-ptr}"

case "${PROFILE}" in
  ptr)
    : "${SCREEPS_PRIVATE_SERVER_DIR:=/Users/jaysheldon/screeps_private_server_ptr}"
    : "${SCREEPS_NODE_BIN:=/opt/homebrew/opt/node@22/bin}"
    : "${SCREEPS_SERVER_HOST:=127.0.0.1}"
    : "${SCREEPS_SERVER_PORT:=21035}"
    : "${SCREEPS_CLI_HOST:=localhost}"
    : "${SCREEPS_CLI_PORT:=21036}"
    ;;
  feat-node24)
    : "${SCREEPS_PRIVATE_SERVER_DIR:=/Users/jaysheldon/screeps_private_server}"
    : "${SCREEPS_NODE_BIN:=/opt/homebrew/opt/node@24/bin}"
    : "${SCREEPS_SERVER_HOST:=127.0.0.1}"
    : "${SCREEPS_SERVER_PORT:=21025}"
    : "${SCREEPS_CLI_HOST:=localhost}"
    : "${SCREEPS_CLI_PORT:=21026}"
    ;;
  *)
    echo "Unknown SCREEPS_SERVER_PROFILE: ${PROFILE}" >&2
    return 1
    ;;
esac

: "${SCREEPS_SERVER_URL:=http://${SCREEPS_SERVER_HOST}:${SCREEPS_SERVER_PORT}}"
: "${SCREEPS_BROWSER_CLIENT_DIR:=/Users/jaysheldon/screeps_browser_client}"
: "${SCREEPS_BROWSER_HOST:=127.0.0.1}"
: "${SCREEPS_BROWSER_PORT:=8080}"
: "${SCREEPS_BROWSER_URL:=http://${SCREEPS_BROWSER_HOST}:${SCREEPS_BROWSER_PORT}}"
: "${SCREEPS_LOCAL_TOKEN:=screeps-omega-dev-token}"
: "${SCREEPS_BROWSER_PASSWORD:=screeps-local-pass}"

export SCREEPS_SERVER_PROFILE="${PROFILE}"
export SCREEPS_PRIVATE_SERVER_DIR
export SCREEPS_NODE_BIN
export SCREEPS_SERVER_HOST
export SCREEPS_SERVER_PORT
export SCREEPS_SERVER_URL
export SCREEPS_CLI_HOST
export SCREEPS_CLI_PORT
export SCREEPS_BROWSER_CLIENT_DIR
export SCREEPS_BROWSER_HOST
export SCREEPS_BROWSER_PORT
export SCREEPS_BROWSER_URL
export SCREEPS_LOCAL_TOKEN
export SCREEPS_BROWSER_PASSWORD
