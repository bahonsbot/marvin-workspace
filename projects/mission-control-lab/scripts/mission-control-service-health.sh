#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/data/.openclaw/workspace/projects/mission-control-lab"
RUNTIME_DIR="${MISSION_CONTROL_PREVIEW_RUNTIME_DIR:-$PROJECT_DIR/.lab-runtime}"
ENV_FILE="$RUNTIME_DIR/mission-control-lab.env"
PID_FILE="$RUNTIME_DIR/latest.pid"
SIDECAR_PID_FILE="$RUNTIME_DIR/ws-sidecar.pid"
PIPER_TTS_PID_FILE="$RUNTIME_DIR/piper-tts-worker.pid"
MOONSHINE_STT_PID_FILE="$RUNTIME_DIR/moonshine-stt-worker.pid"
DEFEATBETA_SIDECAR_PID_FILE="$RUNTIME_DIR/defeatbeta-sidecar.pid"
NEXT_PID_FILE="$RUNTIME_DIR/next.pid"
PREVIEW_PORT="${MISSION_CONTROL_PREVIEW_PORT:-3005}"
SIDECAR_HOST="${MISSION_CONTROL_WS_SIDECAR_HOST:-127.0.0.1}"
SIDECAR_PORT="${MISSION_CONTROL_WS_SIDECAR_PORT:-3006}"
PIPER_TTS_HOST="${MISSION_CONTROL_PIPER_TTS_HOST:-127.0.0.1}"
PIPER_TTS_PORT="${MISSION_CONTROL_PIPER_TTS_PORT:-3022}"
MOONSHINE_STT_HOST="${MISSION_CONTROL_MOONSHINE_STT_HOST:-127.0.0.1}"
MOONSHINE_STT_PORT="${MISSION_CONTROL_MOONSHINE_STT_PORT:-3023}"
DEFEATBETA_SIDECAR_HOST="${DEFEATBETA_SIDECAR_HOST:-127.0.0.1}"
DEFEATBETA_SIDECAR_PORT="${DEFEATBETA_SIDECAR_PORT:-8791}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  PREVIEW_PORT="${MISSION_CONTROL_PREVIEW_PORT:-$PREVIEW_PORT}"
  SIDECAR_HOST="${MISSION_CONTROL_WS_SIDECAR_HOST:-$SIDECAR_HOST}"
  SIDECAR_PORT="${MISSION_CONTROL_WS_SIDECAR_PORT:-$SIDECAR_PORT}"
  PIPER_TTS_HOST="${MISSION_CONTROL_PIPER_TTS_HOST:-$PIPER_TTS_HOST}"
  PIPER_TTS_PORT="${MISSION_CONTROL_PIPER_TTS_PORT:-$PIPER_TTS_PORT}"
  MOONSHINE_STT_HOST="${MISSION_CONTROL_MOONSHINE_STT_HOST:-$MOONSHINE_STT_HOST}"
  MOONSHINE_STT_PORT="${MISSION_CONTROL_MOONSHINE_STT_PORT:-$MOONSHINE_STT_PORT}"
  DEFEATBETA_SIDECAR_HOST="${DEFEATBETA_SIDECAR_HOST:-$DEFEATBETA_SIDECAR_HOST}"
  DEFEATBETA_SIDECAR_PORT="${DEFEATBETA_SIDECAR_PORT:-$DEFEATBETA_SIDECAR_PORT}"
fi

check_pid() {
  local label="$1"
  local pid_file="$2"

  if [[ ! -f "$pid_file" ]]; then
    echo "[fail] $label pid file missing: $pid_file" >&2
    return 1
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    echo "[fail] $label pid file empty: $pid_file" >&2
    return 1
  fi

  if ! kill -0 "$pid" 2>/dev/null; then
    echo "[fail] $label process not running: pid=$pid" >&2
    return 1
  fi

  echo "[ok] $label pid=$pid"
}

check_http() {
  local label="$1"
  local url="$2"

  if ! curl -fsS "$url" >/dev/null; then
    echo "[fail] $label check failed: $url" >&2
    return 1
  fi

  echo "[ok] $label url=$url"
}

check_json_field() {
  local label="$1"
  local url="$2"
  local python_expr="$3"

  local payload
  if ! payload="$(curl -fsS "$url")"; then
    echo "[fail] $label fetch failed: $url" >&2
    return 1
  fi

  if ! PAYLOAD="$payload" python3 - <<PY
import json, os, sys
payload = json.loads(os.environ['PAYLOAD'])
value = $python_expr
if not value:
    raise SystemExit(1)
PY
  then
    echo "[fail] $label validation failed: $url" >&2
    return 1
  fi

  echo "[ok] $label url=$url"
}

check_pid "proxy" "$PID_FILE"
check_pid "next" "$NEXT_PID_FILE"
check_pid "ws-sidecar" "$SIDECAR_PID_FILE"
check_pid "piper-tts-worker" "$PIPER_TTS_PID_FILE"
check_pid "moonshine-stt-worker" "$MOONSHINE_STT_PID_FILE"
check_pid "defeatbeta-sidecar" "$DEFEATBETA_SIDECAR_PID_FILE"
check_http "app" "http://127.0.0.1:${PREVIEW_PORT}/general/agents"
check_json_field "runtime-bridge" "http://127.0.0.1:${PREVIEW_PORT}/api/runtime-bridge" "payload.get('runtimeBridge', {}).get('descriptorVersion')"
check_json_field "ws-sidecar-health" "http://${SIDECAR_HOST}:${SIDECAR_PORT}/healthz" "payload.get('ok')"
check_json_field "piper-tts-worker-health" "http://${PIPER_TTS_HOST}:${PIPER_TTS_PORT}/healthz" "payload.get('ok')"
check_json_field "moonshine-stt-worker-health" "http://${MOONSHINE_STT_HOST}:${MOONSHINE_STT_PORT}/healthz" "payload.get('ok')"
check_json_field "defeatbeta-sidecar-health" "http://${DEFEATBETA_SIDECAR_HOST}:${DEFEATBETA_SIDECAR_PORT}/health" "payload.get('ok')"

echo "[ok] Mission Control service health passed"
