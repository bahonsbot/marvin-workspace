#!/bin/bash
#
# security-review.sh - Run security review (manual entrypoint)
#
# This script provides a CLI interface to the security review skill.
# It's used by tests and can be run manually.
#
# The actual review is performed by the security-review skill
# which spawns 4 parallel sub-agents (Offensive, Defensive, Privacy, Operational).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="${WORKSPACE:-/data/.openclaw/workspace}"
REPORT_DIR="$WORKSPACE/memory/security"
REPORT="$REPORT_DIR/latest_review.md"

# Ensure report directory exists
mkdir -p "$REPORT_DIR"

echo "Running security review..."
echo "Workspace: $WORKSPACE"
echo "Report will be saved to: $REPORT"
echo ""

# Run the security review skill via OpenClaw
# This spawns 4 parallel sub-agents
openclaw run "Run a comprehensive security review of the codebase. Use the security-review skill. Analyze from 4 perspectives: (1) Offensive (2) Defensive (3) Data Privacy (4) Operational. Spawn 4 sub-agents in parallel and aggregate findings.

IMPORTANT: Save full report to $REPORT_DIR/ with timestamp in filename.

SUPPRESSION BASELINE (accepted risk controls):
- Do NOT re-raise credential-rotation recommendations for historical .env exposure if all of the following are true at scan time: (a) .env files are mode 600, (b) .env patterns are ignored by git, (c) no .env files are tracked in git, and (d) no new leak evidence is detected in logs/reports.
- Re-open this finding ONLY when there is a new exposure window: permission drift (>600), tracked/committed .env, or fresh secret exposure evidence.
- For accepted-risk items, report once as INFO with a short baseline note, then suppress repeats unless state changes." --model qwen3.5-plus --session isolated

echo ""
echo "Security review complete."
echo "Report saved to: $REPORT_DIR/"

# Find the latest report
latest=$(ls -t "$REPORT_DIR"/20*.md 2>/dev/null | head -1)
if [ -n "$latest" ]; then
    ln -sf "$(basename "$latest")" "$REPORT"
    echo "Latest report linked: $REPORT"
fi
