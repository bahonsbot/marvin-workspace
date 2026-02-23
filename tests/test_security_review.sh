#!/usr/bin/env bash
set -euo pipefail

SCRIPT="/data/.openclaw/workspace/security-review.sh"
REPORT="/data/.openclaw/workspace/memory/security/latest_review.md"

bash "$SCRIPT"

if [ ! -f "$REPORT" ]; then
  echo "FAIL: security review report not created"
  exit 1
fi

if ! grep -q "Status: IN PROGRESS" "$REPORT"; then
  echo "FAIL: security review report missing expected status"
  exit 1
fi

echo "PASS: security-review.sh created expected report"
