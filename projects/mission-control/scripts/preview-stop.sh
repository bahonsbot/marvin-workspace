#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/data/.openclaw/workspace/projects/mission-control"
RUNTIME_DIR="${MISSION_CONTROL_PREVIEW_RUNTIME_DIR:-$PROJECT_DIR/.preview-runtime}"
ENV_FILE="$RUNTIME_DIR/mission-control-preview.env"
PID_FILE="$RUNTIME_DIR/latest.pid"
SIDECAR_PID_FILE="$RUNTIME_DIR/ws-sidecar.pid"
PIPER_TTS_PID_FILE="$RUNTIME_DIR/piper-tts-worker.pid"
MOONSHINE_STT_PID_FILE="$RUNTIME_DIR/moonshine-stt-worker.pid"
NEXT_PID_FILE="$RUNTIME_DIR/next.pid"
PREVIEW_PORT="${MISSION_CONTROL_PREVIEW_PORT:-3005}"
INTERNAL_NEXT_PORT="${MISSION_CONTROL_PREVIEW_INTERNAL_PORT:-3007}"
SIDECAR_PORT="${MISSION_CONTROL_WS_SIDECAR_PORT:-3006}"
PIPER_TTS_PORT="${MISSION_CONTROL_PIPER_TTS_PORT:-3024}"
MOONSHINE_STT_PORT="${MISSION_CONTROL_MOONSHINE_STT_PORT:-3025}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  PREVIEW_PORT="${MISSION_CONTROL_PREVIEW_PORT:-$PREVIEW_PORT}"
  INTERNAL_NEXT_PORT="${MISSION_CONTROL_PREVIEW_INTERNAL_PORT:-$INTERNAL_NEXT_PORT}"
  SIDECAR_PORT="${MISSION_CONTROL_WS_SIDECAR_PORT:-$SIDECAR_PORT}"
  PIPER_TTS_PORT="${MISSION_CONTROL_PIPER_TTS_PORT:-$PIPER_TTS_PORT}"
  MOONSHINE_STT_PORT="${MISSION_CONTROL_MOONSHINE_STT_PORT:-$MOONSHINE_STT_PORT}"
fi

kill_pid() {
  local pid="$1"
  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  sleep 1
  if kill -0 "$pid" 2>/dev/null; then
    kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
  fi
}

kill_from_pid_file() {
  local pid_file="$1"
  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  kill_pid "$pid"
  rm -f "$pid_file"
}

kill_matching_processes() {
  local pattern="$1"
  local pids=""
  pids="$(pgrep -f "$pattern" 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    return 0
  fi

  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue
    kill_pid "$pid"
  done <<< "$pids"
}

kill_listeners_on_port() {
  local port="$1"
  local pids=""

  if command -v ss >/dev/null 2>&1; then
    pids="$(ss -ltnp "( sport = :$port )" 2>/dev/null | grep -o 'pid=[0-9]\+' | cut -d= -f2 | sort -u || true)"
  elif command -v fuser >/dev/null 2>&1; then
    pids="$(fuser "$port"/tcp 2>/dev/null | tr ' ' '\n' | sed '/^$/d' | sort -u || true)"
  fi

  if [[ -z "$pids" ]]; then
    return 0
  fi

  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue
    kill_pid "$pid"
  done <<< "$pids"
}

kill_from_pid_file "$PID_FILE"
kill_from_pid_file "$SIDECAR_PID_FILE"
kill_from_pid_file "$PIPER_TTS_PID_FILE"
kill_from_pid_file "$MOONSHINE_STT_PID_FILE"
kill_from_pid_file "$NEXT_PID_FILE"


kill_listeners_on_port "$PREVIEW_PORT"
kill_listeners_on_port "$INTERNAL_NEXT_PORT"
kill_listeners_on_port "$SIDECAR_PORT"
kill_listeners_on_port "$PIPER_TTS_PORT"
kill_listeners_on_port "$MOONSHINE_STT_PORT"

rm -f "$PID_FILE" "$SIDECAR_PID_FILE" "$PIPER_TTS_PID_FILE" "$MOONSHINE_STT_PID_FILE" "$NEXT_PID_FILE"
