#!/bin/bash
set -e
AUDIT_LOG="/data/.openclaw/workspace/scripts/audit-log.sh"
# Backup directory - restricted access (owner only)
BKDIR="/data/.openclaw/workspace/backup"
TS="$(date +'%Y%m%d_%H%M%S')"

# Ensure backup directory exists with secure permissions (700)
mkdir -p "$BKDIR"
chmod 700 "$BKDIR"

# Copy sensitive files to backup directory
for f in USER.md MEMORY.md AGENTS.md SOUL.md TOOLS.md IDENTITY.md; do
  [ -f "/data/.openclaw/workspace/$f" ] && cp "/data/.openclaw/workspace/$f" "$BKDIR/${f%.md}_$TS.md"
done

# Secure backup files (600 - owner read/write only)
chmod 600 "$BKDIR"/*.md 2>/dev/null || true

"$AUDIT_LOG" "backup_run" "script=backup-workspace.sh backup_dir=$BKDIR timestamp=$TS"
