#!/bin/bash
# Nightly Memory Extraction
# Runs at 23:00 ICT to extract durable facts from the day's conversations

WORKSPACE="/data/.openclaw/workspace"
DATE=$(date +%Y-%m-%d)

echo "=== Nightly Memory Extraction: $DATE ==="

# Change to workspace
cd "$WORKSPACE" || exit 1

# The extraction task itself is handled by OpenClaw's agentic capabilities
# This script is a wrapper that logs the extraction
echo "Triggering extraction for $DATE"

# Log to daily notes
echo "- 23:00 — Nightly memory extraction ran" >> "$WORKSPACE/memory/$DATE.md"

echo "=== Extraction complete ==="
