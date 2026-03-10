#!/usr/bin/env bash
set -euo pipefail

ROOT="/data/.openclaw/workspace"
STATE_FILE="$ROOT/logs/security-sensitive-state.tsv"
AUDIT_LOG="$ROOT/scripts/audit-log.sh"

mkdir -p "$ROOT/logs"
chmod 700 "$ROOT/logs"

# Minimal high-value targets (low noise)
TARGETS=(
  "/data/.openclaw/openclaw.json"
  "/data/.openclaw/workspace/openclaw.json"
  "$ROOT/memory/cron-context.json"
  "$ROOT/projects/autonomous-trading-bot/.env"
)

# Build current snapshot in-memory
snapshot_tmp="$(mktemp)"
for p in "${TARGETS[@]}"; do
  if [ -e "$p" ]; then
    mode="$(stat -c '%a' "$p" 2>/dev/null || echo unknown)"
    sha="$(sha256sum "$p" 2>/dev/null | awk '{print $1}' || echo unknown)"
    printf '%s\t%s\t%s\n' "$p" "$mode" "$sha" >> "$snapshot_tmp"
  else
    printf '%s\t%s\t%s\n' "$p" "missing" "missing" >> "$snapshot_tmp"
  fi
done

# First run: initialize baseline
if [ ! -f "$STATE_FILE" ]; then
  cp "$snapshot_tmp" "$STATE_FILE"
  chmod 600 "$STATE_FILE"
  AUDIT_ACTOR="system" "$AUDIT_LOG" "sensitive_snapshot_init" "Initialized sensitive file baseline"
  rm -f "$snapshot_tmp"
  exit 0
fi

# Compare with previous state and log only changes
while IFS=$'\t' read -r path mode sha; do
  old_line="$(grep -F "${path}" "$STATE_FILE" || true)"
  old_mode="$(printf '%s' "$old_line" | awk -F '\t' '{print $2}')"
  old_sha="$(printf '%s' "$old_line" | awk -F '\t' '{print $3}')"

  if [ "$mode" != "$old_mode" ] || [ "$sha" != "$old_sha" ]; then
    AUDIT_ACTOR="system" \
    AUDIT_TARGET="$path" \
    AUDIT_BEFORE="mode=${old_mode:-none},sha=${old_sha:-none}" \
    AUDIT_AFTER="mode=${mode},sha=${sha}" \
    "$AUDIT_LOG" "sensitive_file_changed" "Detected change in sensitive file"
  fi
done < "$snapshot_tmp"

# Update state
cp "$snapshot_tmp" "$STATE_FILE"
chmod 600 "$STATE_FILE"
rm -f "$snapshot_tmp"
