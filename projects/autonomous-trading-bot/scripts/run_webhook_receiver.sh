#!/usr/bin/env bash
set -euo pipefail

ROOT="/data/.openclaw/workspace/projects/autonomous-trading-bot"
LOG_DIR="$ROOT/logs"
PID_FILE="$LOG_DIR/webhook_receiver.pid"
OUT_LOG="$LOG_DIR/webhook_receiver.out.log"
ERR_LOG="$LOG_DIR/webhook_receiver.err.log"

mkdir -p "$LOG_DIR"
cd "$ROOT"

# Rotate logs before starting (prevent unbounded growth)
python3 -c "from src.log_utils import rotate_log; from pathlib import Path; rotate_log(Path('$OUT_LOG')); rotate_log(Path('$ERR_LOG'))" 2>/dev/null || true

# Load only required variables explicitly (avoid exporting all .env contents)
set -u
for var in WEBHOOK_SHARED_SECRET ALPACA_API_KEY ALPACA_SECRET_KEY TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID AUTO_MIN_CONFIDENCE WEBHOOK_HOST WEBHOOK_PORT; do
    if [[ -f ./.env ]]; then
        val=$(grep "^${var}=" ./.env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)
        if [[ -n "$val" ]]; then
            export "$var=$val"
        fi
    fi
done
set +u

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