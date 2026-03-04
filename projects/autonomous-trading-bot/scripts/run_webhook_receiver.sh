#!/usr/bin/env bash
set -euo pipefail

ROOT="/data/.openclaw/workspace/projects/autonomous-trading-bot"
LOG_DIR="$ROOT/logs"
PID_FILE="$LOG_DIR/webhook_receiver.pid"
OUT_LOG="$LOG_DIR/webhook_receiver.out.log"
ERR_LOG="$LOG_DIR/webhook_receiver.err.log"

mkdir -p "$LOG_DIR"
cd "$ROOT"

# Load env vars
set -a
. ./.env
set +a

# Default safe bind (local only)
export WEBHOOK_HOST="${WEBHOOK_HOST:-127.0.0.1}"
export WEBHOOK_PORT="${WEBHOOK_PORT:-8000}"

# Prevent duplicates
if [[ -f "$PID_FILE" ]]; then
  old_pid="$(cat "$PID_FILE" || true)"
  if [[ -n "${old_pid:-}" ]] && kill -0 "$old_pid" 2>/dev/null; then
    echo "webhook receiver already running (pid=$old_pid)"
    exit 0
  fi
fi

nohup python3 -m src.webhook_receiver >>"$OUT_LOG" 2>>"$ERR_LOG" &
echo $! > "$PID_FILE"
echo "started webhook receiver pid=$(cat "$PID_FILE") host=${WEBHOOK_HOST} port=${WEBHOOK_PORT}"