#!/usr/bin/env bash
set -euo pipefail

cd /data/.openclaw/workspace/projects/mission-control
RUNTIME_DIR="${MISSION_CONTROL_PREVIEW_RUNTIME_DIR:-/data/.openclaw/workspace/projects/mission-control/.preview-runtime}"
ENV_FILE="$RUNTIME_DIR/mission-control-preview.env"
mkdir -p "$RUNTIME_DIR"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

SIDECAR_HOST="${MISSION_CONTROL_WS_SIDECAR_HOST:-127.0.0.1}"
SIDECAR_PORT="${MISSION_CONTROL_WS_SIDECAR_PORT:-3006}"
SIDECAR_PATH="${MISSION_CONTROL_WS_SIDECAR_PATH:-/mission-control-runtime}"
PUBLIC_WS_PATH="${MISSION_CONTROL_WS_PUBLIC_PATH:-/api/runtime-bridge/ws}"
PREVIEW_PORT="${MISSION_CONTROL_PREVIEW_PORT:-3005}"
INTERNAL_NEXT_HOST="${MISSION_CONTROL_PREVIEW_INTERNAL_HOST:-127.0.0.1}"
INTERNAL_NEXT_PORT="${MISSION_CONTROL_PREVIEW_INTERNAL_PORT:-3007}"

export MISSION_CONTROL_WS_SIDECAR_HOST="$SIDECAR_HOST"
export MISSION_CONTROL_WS_SIDECAR_PORT="$SIDECAR_PORT"
export MISSION_CONTROL_WS_SIDECAR_PATH="$SIDECAR_PATH"
export MISSION_CONTROL_WS_PUBLIC_PATH="$PUBLIC_WS_PATH"
export MISSION_CONTROL_PREVIEW_PORT="$PREVIEW_PORT"
export MISSION_CONTROL_PREVIEW_INTERNAL_HOST="$INTERNAL_NEXT_HOST"
export MISSION_CONTROL_PREVIEW_INTERNAL_PORT="$INTERNAL_NEXT_PORT"

if [[ -z "${MISSION_CONTROL_WS_SIDECAR_TOKEN:-}" ]]; then
  MISSION_CONTROL_WS_SIDECAR_TOKEN="$(node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))")"
fi
export MISSION_CONTROL_WS_SIDECAR_TOKEN

nohup node ./scripts/runtime-bridge-ws-sidecar.js >"$RUNTIME_DIR/ws-sidecar.log" 2>&1 &
echo $! > "$RUNTIME_DIR/ws-sidecar.pid"

nohup npm run start -- --hostname "$INTERNAL_NEXT_HOST" --port "$INTERNAL_NEXT_PORT" >"$RUNTIME_DIR/next.log" 2>&1 &
echo $! > "$RUNTIME_DIR/next.pid"

nohup node ./scripts/preview-origin-proxy.js >"$RUNTIME_DIR/latest.log" 2>&1 &
echo $! > "$RUNTIME_DIR/latest.pid"
sleep 1
cat "$RUNTIME_DIR/latest.pid"
