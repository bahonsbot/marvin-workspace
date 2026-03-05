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

RETRY_COUNT=0
MAX_RETRIES=5

log "watchdog started (interval=${CHECK_INTERVAL}s)"

while true; do
  ensure_running || {
    log "ERROR: Failed to start webhook receiver"
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [[ $RETRY_COUNT -ge $MAX_RETRIES ]]; then
      log "CRITICAL: Max retries ($MAX_RETRIES) exceeded - receiver may need manual intervention"
      # Reset counter after alert to allow future recovery
      RETRY_COUNT=0
    fi
    log "Retry $RETRY_COUNT/$MAX_RETRIES in ${CHECK_INTERVAL}s"
  }
  sleep "$CHECK_INTERVAL"
done
