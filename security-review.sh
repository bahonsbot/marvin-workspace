#!/bin/bash
# Security Review Automation
# Runs nightly at 3:30am Vietnam time

set -e

AUDIT_LOG="/data/.openclaw/workspace/scripts/audit-log.sh"
WORKSPACE="/data/.openclaw/workspace"
REPORT_DIR="$WORKSPACE/memory/security"
TIMESTAMP=$(date +'%Y-%m-%d %H:%M:%S')

mkdir -p "$REPORT_DIR"

# Find code files to analyze
CODE_FILES=$(find "$WORKSPACE" -maxdepth 3 -type f \( -name "*.py" -o -name "*.sh" -o -name "*.json" \) \
  ! -path "*/.git/*" \
  ! -path "*/backup/*" \
  ! -path "*/memory/*" \
  ! -path "*/.openclaw/*" \
  ! -name "*.bak*" \
  ! -name "*_meta.json" \
  ! -name "workspace-state.json" \
  2>/dev/null | tr '\n' ',')

echo "=== Security Review Started at $TIMESTAMP ==="
echo "Analyzing files: $CODE_FILES"
"$AUDIT_LOG" "security_review_start" "script=security-review.sh timestamp=$TIMESTAMP"

# This script will be executed by the cron job which runs an AI agent
# The actual analysis is done by the AI reading through the code
# Here we just prepare the environment

cat > "$REPORT_DIR/latest_review.md" << EOF
# Security Review - $TIMESTAMP

## Status: IN PROGRESS

Files to analyze:
$CODE_FILES

Analysis will be performed by AI agent.
EOF

echo "Security review triggered. AI analysis incoming."
"$AUDIT_LOG" "security_review_prepared" "script=security-review.sh report=$REPORT_DIR/latest_review.md"
