#!/usr/bin/env bash
set -euo pipefail

cd /data/.openclaw/workspace/projects/mission-control
export PATH="/data/.npm-global/bin:/data/.local/bin:/data/bin:/data/.bun/bin:$PATH"
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

spawn_detached() {
  local pid_file="$1"
  local log_file="$2"
  shift 2

  rm -f "$pid_file"
  setsid "$@" </dev/null >"$log_file" 2>&1 &
  local pid=$!
  echo "$pid" > "$pid_file"
}

ensure_alive() {
  local pid_file="$1"
  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

spawn_detached "$RUNTIME_DIR/ws-sidecar.pid" "$RUNTIME_DIR/ws-sidecar.log" node ./scripts/runtime-bridge-ws-sidecar.js
spawn_detached "$RUNTIME_DIR/next.pid" "$RUNTIME_DIR/next.log" npm run start -- --hostname "$INTERNAL_NEXT_HOST" --port "$INTERNAL_NEXT_PORT"
spawn_detached "$RUNTIME_DIR/latest.pid" "$RUNTIME_DIR/latest.log" node ./scripts/preview-origin-proxy.js

warm_runtime_bridge() {
  local descriptor_json bridge_token
  descriptor_json="$(curl -fsS "http://127.0.0.1:${PREVIEW_PORT}/api/runtime-bridge" 2>/dev/null || true)"
  if [[ -z "$descriptor_json" ]]; then
    return 1
  fi

  bridge_token="$(printf '%s' "$descriptor_json" | python3 - <<'PY'
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get('runtimeBridge', {}).get('endpoints', {}).get('websocketBridgeToken', '') or '')
except Exception:
    print('')
PY
)"

  if [[ -z "$bridge_token" ]]; then
    return 1
  fi

  node - "$bridge_token" "$PREVIEW_PORT" <<'NODE' >/dev/null 2>&1
const { WebSocket } = require('./node_modules/ws');
const token = process.argv[2];
const port = process.argv[3];
const url = `ws://127.0.0.1:${port}/api/runtime-bridge/ws?bridgeToken=${token}`;

const ws = new WebSocket(url);
const timer = setTimeout(() => {
  try { ws.terminate(); } catch {}
  process.exit(1);
}, 10000);

ws.once('message', () => {
  clearTimeout(timer);
  try { ws.close(); } catch {}
  process.exit(0);
});

ws.once('error', () => {
  clearTimeout(timer);
  process.exit(1);
});
NODE
}

for _ in {1..30}; do
  if ensure_alive "$RUNTIME_DIR/ws-sidecar.pid" && ensure_alive "$RUNTIME_DIR/next.pid" && ensure_alive "$RUNTIME_DIR/latest.pid"; then
    if curl -fsS "http://127.0.0.1:${PREVIEW_PORT}/general/agents" >/dev/null 2>&1; then
      warm_runtime_bridge || true
      cat "$RUNTIME_DIR/latest.pid"
      exit 0
    fi
  fi
  sleep 1
done

echo "preview-start: Mission Control preview failed to become healthy" >&2
echo "--- latest.log ---" >&2
tail -n 40 "$RUNTIME_DIR/latest.log" >&2 || true
echo "--- next.log ---" >&2
tail -n 40 "$RUNTIME_DIR/next.log" >&2 || true
echo "--- ws-sidecar.log ---" >&2
tail -n 40 "$RUNTIME_DIR/ws-sidecar.log" >&2 || true
exit 1
