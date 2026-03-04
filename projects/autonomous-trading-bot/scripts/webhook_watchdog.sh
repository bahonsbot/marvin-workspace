#!/usr/bin/env bash
# Lightweight webhook receiver watchdog
# Restarts receiver if it dies. Runs once, sleeps between checks.

set -euo pipefail

ROOT="/data/.openclaw/workspace/projects/autonomous-trading-bot"
PID_FILE="$ROOT/logs/webhook_receiver.pid"
CHECK_INTERVAL=60  # seconds

cd "$ROOT"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [watchdog] $*"
}

ensure_running() {
  if [[ -f "$PID_FILE" ]]; then
    pid="$(cat "$PID_FILE" || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  
  log "receiver not running, starting..."
  ./scripts/run_webhook_receiver.sh
  sleep 2
  
  if [[ -f "$PID_FILE" ]]; then
    pid="$(cat "$PID_FILE")"
    if kill -0 "$pid" 2>/dev/null; then
      log "started (pid=$pid)"
      return 0
    fi
  fi
  
  log "failed to start"
  return 1
}

log "watchdog started (interval=${CHECK_INTERVAL}s)"

while true; do
  ensure_running || true
  sleep "$CHECK_INTERVAL"
done
