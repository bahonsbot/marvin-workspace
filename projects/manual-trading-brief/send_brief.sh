#!/bin/bash
# Send pre-market brief via OpenClaw message tool

BRIEF=$(/data/.openclaw/workspace/.venv/bin/python /data/.openclaw/workspace/projects/manual-trading-brief/src/brief_generator.py 2>&1)

# Check if brief was generated successfully
if echo "$BRIEF" | grep -q "Pre-Market Brief"; then
    # Send via OpenClaw message tool (Telegram)
    # The bot will route to Philippe's DM channel
    openclaw message send --target "telegram" --message "$BRIEF"
    echo "✓ Brief sent via OpenClaw"
else
    echo "✗ Brief generation failed"
    echo "$BRIEF"
    exit 1
fi
