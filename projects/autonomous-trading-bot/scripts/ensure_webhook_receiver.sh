#!/usr/bin/env bash
set -euo pipefail

ROOT="/data/.openclaw/workspace/projects/autonomous-trading-bot"
PID_FILE="$ROOT/logs/webhook_receiver.pid"
HEALTH_URL="http://127.0.0.1:8000/health"
AUTH_URL="http://127.0.0.1:8000/health/auth"
STARTUP_WAIT_SECONDS="${WEBHOOK_STARTUP_WAIT_SECONDS:-10}"

cd "$ROOT"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ensure-webhook] $*"
}

health_ok() {
  curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null && \
    curl -fsS --max-time 5 "$AUTH_URL" >/dev/null
}

receiver_pids() {
  pgrep -f "python3 -m src.webhook_receiver" || true
}

sync_pid_file() {
  local pid
  pid="$(receiver_pids | head -n 1 || true)"
  if [[ -n "${pid:-}" ]]; then
    echo "$pid" > "$PID_FILE"
  else
    rm -f "$PID_FILE"
  fi
}

stop_receiver_processes() {
  local pids pid
  pids="$(receiver_pids)"
  [[ -n "$pids" ]] || return 0

  log "stopping unhealthy receiver process(es): $(echo "$pids" | tr '\n' ' ')"
  while IFS= read -r pid; do
    [[ -n "${pid:-}" ]] || continue
    kill "$pid" 2>/dev/null || true
  done <<< "$pids"

  for _ in $(seq 1 10); do
    sleep 1
    pids="$(receiver_pids)"
    [[ -z "$pids" ]] && break
  done

  if [[ -n "$pids" ]]; then
    log "force-killing stuck receiver process(es): $(echo "$pids" | tr '\n' ' ')"
    while IFS= read -r pid; do
      [[ -n "${pid:-}" ]] || continue
      kill -9 "$pid" 2>/dev/null || true
    done <<< "$pids"
  fi

  rm -f "$PID_FILE"
}

if health_ok; then
  sync_pid_file
  exit 0
fi

if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE" || true)"
  if [[ -n "${pid:-}" ]] && ! kill -0 "$pid" 2>/dev/null; then
    rm -f "$PID_FILE"
  fi
fi

if [[ -n "$(receiver_pids)" ]]; then
  stop_receiver_processes
fi

"$ROOT/scripts/run_webhook_receiver.sh"

for _ in $(seq 1 "$STARTUP_WAIT_SECONDS"); do
  if health_ok; then
    sync_pid_file
    exit 0
  fi
  sleep 1
done

log "receiver failed health verification after restart"
exit 1
