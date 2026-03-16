#!/bin/bash
# Delegation Helper for Hybrid Agent Team
# Usage: Run this script or reference when delegating to Builder/Reviewer

echo "=== Hybrid Agent Delegation Quick Reference ==="
echo ""
echo "PREFERRED PRACTICAL PATH (prompt-template delegation):"
echo "  1. Keep Marvin on codex5.4 when orchestration quality matters"
echo "  2. Use projects/_ops/agent-team/builder-prompt.md or reviewer-prompt.md"
echo "  3. Fill in placeholders (TASK, WORK_TYPE, CONTEXT, etc.)"
echo "  4. Send through the supported delegated subagent route"
echo "  5. Treat inherited/default model behavior as fallback, not ideal specialist routing"
echo ""
echo "FALLBACK (exec-based codex for coding tasks):"
echo "  bash pty:true workdir:/data/.openclaw/workspace \\"
echo "    background:true \\"
echo '    command:"codex exec --full-auto '\''<your task>'\''"'
echo ""
echo "SINGLE-AGENT (stay with Marvin):"
echo "  - Simple Q&A"
echo "  - Trivial edits"
echo "  - Tasks needing judgment beyond implementation"
echo ""
echo "For details, see: projects/_ops/agent-team/launch-path-spec.md"