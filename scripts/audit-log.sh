#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="/data/.openclaw/workspace/logs"
LOG_FILE="$LOG_DIR/security-actions.log"

ACTION="${1:-}"
DETAILS="${2:-}"
ACTOR="${AUDIT_ACTOR:-marvin}"

if [ -z "$ACTION" ]; then
  echo "Usage: audit-log.sh <action> [details]" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"

TS="$(date +'%Y-%m-%dT%H:%M:%S%z')"
printf '%s | actor=%s | action=%s | details=%s\n' "$TS" "$ACTOR" "$ACTION" "$DETAILS" >> "$LOG_FILE"
chmod 600 "$LOG_FILE"
