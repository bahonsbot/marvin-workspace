#!/bin/bash
set -e
BKDIR="/data/.openclaw/workspace/backup"
TS="$(date +'%Y%m%d_%H%M%S')"
for f in USER.md MEMORY.md AGENTS.md SOUL.md TOOLS.md IDENTITY.md; do
  [ -f "/data/.openclaw/workspace/$f" ] && cp "/data/.openclaw/workspace/$f" "$BKDIR/${f%.md}_$TS.md"
done
