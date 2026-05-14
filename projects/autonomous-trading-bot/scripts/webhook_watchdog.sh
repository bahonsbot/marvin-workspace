#!/usr/bin/env bash
# Lightweight webhook receiver watchdog
# Restarts receiver if it dies. Runs once, sleeps between checks.

set -euo pipefail

ROOT="/data/.openclaw/workspace/projects/autonomous-trading-bot"
PID_FILE="$ROOT/logs/webhook_receiver.pid"
WATCHDOG_PID_FILE="$ROOT/logs/webhook_watchdog.pid"
HEALTH_URL="http://127.0.0.1:8000/health"
AUTH_URL="http://127.0.0.1:8000/health/auth"
CHECK_INTERVAL=60  # seconds

# Telegram config (from environment or .env)
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
ALERT_COOLDOWN_FILE="$ROOT/logs/watchdog_alert_cooldown"

cd "$ROOT"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [watchdog] $*"
}

load_env_var() {
  local var="$1"
  local val=""

  if [[ -n "${!var:-}" ]]; then
    return 0
  fi

  if [[ -f ./.env ]]; then
    val=$(grep "^${var}=" ./.env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)
    if [[ -n "$val" ]]; then
      export "$var=$val"
    fi
  fi
}

health_ok() {
  curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null && \
    curl -fsS --max-time 5 "$AUTH_URL" >/dev/null
}

sync_receiver_pid_file() {
  local pid
  pid="$(pgrep -f "python3 -m src.webhook_receiver" | head -n 1 || true)"
  if [[ -n "${pid:-}" ]]; then
    echo "$pid" > "$PID_FILE"
  else
    rm -f "$PID_FILE"
  fi
}

acquire_watchdog_lock() {
  local existing_pid existing_cmd

  if [[ -f "$WATCHDOG_PID_FILE" ]]; then
    existing_pid="$(cat "$WATCHDOG_PID_FILE" || true)"
    if [[ -n "${existing_pid:-}" ]] && [[ "$existing_pid" != "$$" ]] && kill -0 "$existing_pid" 2>/dev/null; then
      if [[ -r "/proc/$existing_pid/cmdline" ]]; then
        existing_cmd="$(tr '\0' ' ' < "/proc/$existing_pid/cmdline" || true)"
        if [[ "$existing_cmd" == *"webhook_watchdog.sh"* ]]; then
          log "another watchdog is already running (pid=$existing_pid), exiting"
          exit 0
        fi
      fi
    fi
  fi

  echo $$ > "$WATCHDOG_PID_FILE"
  trap 'if [[ -f "$WATCHDOG_PID_FILE" ]] && [[ "$(cat "$WATCHDOG_PID_FILE" 2>/dev/null || true)" == "$$" ]]; then rm -f "$WATCHDOG_PID_FILE"; fi' EXIT
}

send_telegram_alert() {
  local message="$1"
  
  # Skip if no Telegram config
  if [[ -z "$TELEGRAM_BOT_TOKEN" || -z "$TELEGRAM_CHAT_ID" ]]; then
    log "Telegram not configured, skipping alert: $message"
    return
  fi
  
  # Check cooldown (don't spam alerts)
  if [[ -f "$ALERT_COOLDOWN_FILE" ]]; then
    local last_alert
    last_alert=$(cat "$ALERT_COOLDOWN_FILE")
    local now
    now=$(date +%s)
    local diff=$((now - last_alert))
    if [[ $diff -lt 3600 ]]; then  # 1 hour cooldown
      log "Alert cooldown active (${diff}s ago), skipping"
      return
    fi
  fi
  
  # Send alert
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${message}" \
    -d "parse_mode=Markdown" \
    >/dev/null 2>&1 || true
  
  # Update cooldown
  date +%s > "$ALERT_COOLDOWN_FILE"
  log "Telegram alert sent: $message"
}

ensure_running() {
  if health_ok; then
    sync_receiver_pid_file
    return 0
  fi

  if [[ -f "$PID_FILE" ]]; then
    pid="$(cat "$PID_FILE" || true)"
    if [[ -n "${pid:-}" ]] && ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$PID_FILE"
    fi
  fi

  log "webhook health check failed, reconciling receiver state..."
  if ./scripts/ensure_webhook_receiver.sh; then
    sync_receiver_pid_file
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    log "receiver healthy${pid:+ (pid=$pid)}"
    return 0
  fi

  log "failed to restore healthy receiver"
  return 1
}

RETRY_COUNT=0
MAX_RETRIES=5

load_env_var "TELEGRAM_BOT_TOKEN"
load_env_var "TELEGRAM_CHAT_ID"
acquire_watchdog_lock

log "watchdog started (interval=${CHECK_INTERVAL}s)"

while true; do
  if ensure_running; then
    RETRY_COUNT=0
  else
    log "ERROR: Failed to start webhook receiver"
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [[ $RETRY_COUNT -ge $MAX_RETRIES ]]; then
      log "CRITICAL: Max retries ($MAX_RETRIES) exceeded - sending escalation alert"
      send_telegram_alert "🚨 **WATCHDOG ESCALATION**\n\nWebhook receiver is still down after $MAX_RETRIES consecutive auto-restart attempts.\n\nThis is different from a single dispatch-side outage alert: auto-recovery has already been tried and is not sticking.\n\nManual intervention is required.\n\nCheck: \`logs/webhook_receiver.out.log\`"
      # Reset counter after alert to allow future recovery
      RETRY_COUNT=0
    fi
    log "Retry $RETRY_COUNT/$MAX_RETRIES in ${CHECK_INTERVAL}s"
  fi
  sleep "$CHECK_INTERVAL"
done
