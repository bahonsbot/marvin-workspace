#!/usr/bin/env bash
set -euo pipefail

ROOT="/data/.openclaw/workspace/projects/autonomous-trading-bot"
PID_FILE="$ROOT/logs/webhook_receiver.pid"

if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE" || true)"
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    exit 0
  fi
fi

exec "$ROOT/scripts/run_webhook_receiver.sh"