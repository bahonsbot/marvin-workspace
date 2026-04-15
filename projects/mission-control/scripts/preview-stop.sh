#!/usr/bin/env bash
set -euo pipefail

RUNTIME_DIR="${MISSION_CONTROL_PREVIEW_RUNTIME_DIR:-/data/.openclaw/workspace/projects/mission-control/.preview-runtime}"
ENV_FILE="$RUNTIME_DIR/mission-control-preview.env"
PID_FILE="$RUNTIME_DIR/latest.pid"
SIDECAR_PID_FILE="$RUNTIME_DIR/ws-sidecar.pid"
NEXT_PID_FILE="$RUNTIME_DIR/next.pid"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

kill_from_pid_file() {
  local pid_file="$1"
  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
    fi
  fi
  rm -f "$pid_file"
}

kill_from_pid_file "$PID_FILE"
kill_from_pid_file "$SIDECAR_PID_FILE"
kill_from_pid_file "$NEXT_PID_FILE"
