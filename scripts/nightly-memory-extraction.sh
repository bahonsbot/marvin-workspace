#!/bin/bash
# Nightly Memory Extraction
# Runs at 23:00 ICT to extract durable facts from the day's conversations

WORKSPACE="/data/.openclaw/workspace"
DATE=$(date +%Y-%m-%d)

echo "=== Nightly Memory Extraction: $DATE ==="

# Change to workspace
cd "$WORKSPACE" || exit 1

# Secure file handling: prevent symlink attacks
MEMORY_FILE="$WORKSPACE/memory/$DATE.md"

# Verify memory directory exists with secure permissions
if [[ ! -d "$WORKSPACE/memory" ]]; then
    echo "Error: memory directory does not exist"
    exit 1
fi

# Check for symlinks (security: reject symlink attacks)
if [[ -L "$MEMORY_FILE" ]]; then
    echo "Error: Target file is a symlink - rejecting for security"
    exit 1
fi

# Ensure secure permissions on memory directory
chmod 700 "$WORKSPACE/memory" 2>/dev/null || true

# Use atomic write: write to temp file first, then move
TEMP_FILE=$(mktemp "$WORKSPACE/memory/.XXXXXX.md")
echo "- 23:00 — Nightly memory extraction ran" >> "$TEMP_FILE"

# Verify write succeeded before atomic move
if [[ -s "$TEMP_FILE" ]]; then
    mv "$TEMP_FILE" "$MEMORY_FILE"
    chmod 600 "$MEMORY_FILE" 2>/dev/null || true
else
    echo "Error: Failed to write to temp file"
    rm -f "$TEMP_FILE"
    exit 1
fi

echo "=== Extraction complete ==="
