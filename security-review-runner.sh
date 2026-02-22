#!/bin/bash
# Security Review Runner - AI-Powered
# Analyzes codebase from 4 perspectives using sub-agents

set -e

WORKSPACE="/data/.openclaw/workspace"
REPORT_DIR="$WORKSPACE/memory/security"
TIMESTAMP=$(date +'%Y-%m-%d %H:%M:%S')
REPORT_FILE="$REPORT_DIR/${TIMESTAMP//:/_}.md"

mkdir -p "$REPORT_DIR"

echo "=== Security Review Started at $TIMESTAMP ==="

# Find code files
CODE_FILES=$(find "$WORKSPACE" -maxdepth 3 -type f \( -name "*.py" -o -name "*.sh" -o -name "*.json" \) \
  ! -path "*/.git/*" \
  ! -path "*/backup/*" \
  ! -path "*/memory/*" \
  ! -path "*/.openclaw/*" \
  ! -name "*.bak*" \
  ! -name "*_meta.json" \
  ! -name "workspace-state.json" \
  2>/dev/null | head -50)

FILE_COUNT=$(echo "$CODE_FILES" | wc -l)
echo "Found $FILE_COUNT files to analyze"

# Create initial report
cat > "$REPORT_FILE" << REPORT
# 🔒 Nightly Security Review
Generated: $TIMESTAMP
Scope: $FILE_COUNT code files

══════════════════════════════
INITIALIZING ANALYSIS
══════════════════════════════
Analyzing from 4 perspectives:
1. Offensive (attacker's view)
2. Defensive (protections)
3. Data Privacy
4. Operational Realism

Files under review:
$(echo "$CODE_FILES" | head -20)
$( [ $FILE_COUNT -gt 20 ] && echo "... and $((FILE_COUNT - 20)) more" || true )

Analysis in progress...
REPORT

echo "Report initialized at $REPORT_FILE"
echo "Now triggering AI analysis via cron..."

# The actual AI analysis will be done by the sub-agents spawned by the cron job
# This script just sets up the environment

echo "Security review environment ready. AI agents will now analyze the codebase."
