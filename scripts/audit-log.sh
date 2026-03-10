#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="/data/.openclaw/workspace/logs"
LOG_FILE_TXT="$LOG_DIR/security-actions.log"
LOG_FILE_JSONL="$LOG_DIR/security-actions.jsonl"

ACTION="${1:-}"
DETAILS="${2:-}"
ACTOR="${AUDIT_ACTOR:-marvin}"
TARGET="${AUDIT_TARGET:-}"
STATUS="${AUDIT_STATUS:-ok}"
BEFORE="${AUDIT_BEFORE:-}"
AFTER="${AUDIT_AFTER:-}"

if [ -z "$ACTION" ]; then
  echo "Usage: audit-log.sh <action> [details]" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"

TS="$(date +'%Y-%m-%dT%H:%M:%S%z')"

# Sanitize input to prevent log injection
sanitize() {
  # Strip control characters/newlines and truncate to prevent overflow
  printf '%s' "$1" | tr -cd '[:print:]' | tr -d '\n\t' | head -c 500
}

esc_json() {
  # Minimal JSON escape for strings
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

sanitized_action=$(sanitize "$ACTION")
sanitized_details=$(sanitize "$DETAILS")
sanitized_actor=$(sanitize "$ACTOR")
sanitized_target=$(sanitize "$TARGET")
sanitized_status=$(sanitize "$STATUS")
sanitized_before=$(sanitize "$BEFORE")
sanitized_after=$(sanitize "$AFTER")

# Backward-compatible human-readable log
printf '%s | actor=%s | action=%s | target=%s | status=%s | details=%s\n' \
  "$TS" "$sanitized_actor" "$sanitized_action" "$sanitized_target" "$sanitized_status" "$sanitized_details" >> "$LOG_FILE_TXT"

# Structured JSONL audit log (minimal, low-noise)
printf '{"ts":"%s","actor":"%s","action":"%s","target":"%s","status":"%s","details":"%s","before":"%s","after":"%s"}\n' \
  "$(esc_json "$TS")" \
  "$(esc_json "$sanitized_actor")" \
  "$(esc_json "$sanitized_action")" \
  "$(esc_json "$sanitized_target")" \
  "$(esc_json "$sanitized_status")" \
  "$(esc_json "$sanitized_details")" \
  "$(esc_json "$sanitized_before")" \
  "$(esc_json "$sanitized_after")" >> "$LOG_FILE_JSONL"

chmod 600 "$LOG_FILE_TXT" "$LOG_FILE_JSONL"
