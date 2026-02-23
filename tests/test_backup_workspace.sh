#!/usr/bin/env bash
set -euo pipefail

SCRIPT="/data/.openclaw/workspace/backup-workspace.sh"
BKDIR="/data/.openclaw/workspace/backup"

before_count=$(find "$BKDIR" -maxdepth 1 -type f | wc -l)

bash "$SCRIPT"

after_count=$(find "$BKDIR" -maxdepth 1 -type f | wc -l)

if [ "$after_count" -le "$before_count" ]; then
  echo "FAIL: backup-workspace.sh did not create new backup files"
  exit 1
fi

echo "PASS: backup-workspace.sh created backup artifacts"
