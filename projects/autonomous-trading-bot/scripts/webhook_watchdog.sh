#!/usr/bin/env bash
# Lightweight webhook receiver watchdog
# Restarts receiver if it dies. Runs once, sleeps between checks.

set -euo pipefail

ROOT="/data/.openclaw/workspace/projects/autonomous-trading-bot"
PID_FILE="$ROOT/logs/webhook_receiver.pid"
CHECK_INTERVAL=60  # seconds

# Telegram config (from environment or .env)
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
ALERT_COOLDOWN_FILE="$ROOT/logs/watchdog_alert_cooldown"

cd "$ROOT"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [watchdog] $*"
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
  local encoded_message
  encoded_message=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$message'))")
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    -d "text=${encoded_message}" \
    -d "parse_mode=Markdown" \
    >/dev/null 2>&1 || true
  
  # Update cooldown
  date +%s > "$ALERT_COOLDOWN_FILE"
  log "Telegram alert sent: $message"
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
      log "CRITICAL: Max retries ($MAX_RETRIES) exceeded - sending alert"
      send_telegram_alert "🚨 **WATCHDOG ALERT**\n\nWebhook receiver failed to start after $MAX_RETRIES attempts.\n\nManual intervention may be required.\n\nCheck: \`logs/webhook_receiver.out.log\`"
      # Reset counter after alert to allow future recovery
      RETRY_COUNT=0
    fi
    log "Retry $RETRY_COUNT/$MAX_RETRIES in ${CHECK_INTERVAL}s"
  }
  sleep "$CHECK_INTERVAL"
done
