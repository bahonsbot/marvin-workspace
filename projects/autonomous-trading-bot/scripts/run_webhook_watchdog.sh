#!/usr/bin/env bash
set -euo pipefail

ROOT="/data/.openclaw/workspace/projects/autonomous-trading-bot"
LOG_DIR="$ROOT/logs"
PID_FILE="$LOG_DIR/webhook_watchdog.pid"
OUT_LOG="$LOG_DIR/webhook_watchdog.out.log"
ERR_LOG="$LOG_DIR/webhook_watchdog.err.log"

mkdir -p "$LOG_DIR"
cd "$ROOT"

python3 -c "from src.log_utils import rotate_log; from pathlib import Path; rotate_log(Path('$OUT_LOG')); rotate_log(Path('$ERR_LOG'))" 2>/dev/null || true

if [[ -f "$PID_FILE" ]]; then
  old_pid="$(cat "$PID_FILE" || true)"
  if [[ -n "${old_pid:-}" ]] && kill -0 "$old_pid" 2>/dev/null; then
    if [[ -r "/proc/$old_pid/cmdline" ]] && tr '\0' ' ' < "/proc/$old_pid/cmdline" | grep -q "webhook_watchdog.sh"; then
      echo "webhook watchdog already running (pid=$old_pid)"
      exit 0
    fi
  fi
fi

nohup bash "$ROOT/scripts/webhook_watchdog.sh" >>"$OUT_LOG" 2>>"$ERR_LOG" &
echo $! > "$PID_FILE"
echo "started webhook watchdog pid=$(cat "$PID_FILE")"
