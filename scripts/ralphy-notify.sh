#!/bin/bash
# Ralph Loop Telegram Notifier
# Sends notifications to Telegram when Ralph loop completes or errors

# Load config or use defaults
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
WORKSPACE="${WORKSPACE:-/data/.openclaw/workspace}"

send_notification() {
    local message="$1"
    local priority="${2:-normal}"
    
    # If no bot token, try to get from OpenClaw config
    if [[ -z "$TELEGRAM_BOT_TOKEN" ]]; then
        local config_token=$(grep -o '"token": "[^"]*"' "$WORKSPACE/../openclaw.json" 2>/dev/null | head -1 | cut -d'"' -f4)
        if [[ -n "$config_token" ]]; then
            TELEGRAM_BOT_TOKEN="$config_token"
        fi
    fi
    
    # If still no token, try openclaw CLI
    if [[ -z "$TELEGRAM_BOT_TOKEN" ]]; then
        TELEGRAM_BOT_TOKEN=$(openclaw config get channels.telegram.botToken 2>/dev/null | tr -d '"')
    fi
    
    # Get chat ID from config or env
    if [[ -z "$TELEGRAM_CHAT_ID" ]]; then
        TELEGRAM_CHAT_ID="${OPENCLAW_TELEGRAM_CHAT_ID:-}"
    fi
    
    if [[ -z "$TELEGRAM_BOT_TOKEN" ]]; then
        echo "[ERROR] No Telegram bot token configured"
        return 1
    fi
    
    if [[ -z "$TELEGRAM_CHAT_ID" ]]; then
        echo "[ERROR] No Telegram chat ID configured"
        return 1
    fi
    
    # Escape message for JSON
    local escaped_message=$(echo "$message" | sed 's/"/\\"/g' | sed 's/\n/\\n/g')
    
    # Send via Telegram API
    local response=$(curl -s -X POST \
        "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
        -H "Content-Type: application/json" \
        -d "{\"chat_id\": \"$TELEGRAM_CHAT_ID\", \"text\": \"$escaped_message\", \"parse_mode\": \"Markdown\"}" \
        2>/dev/null)
    
    if echo "$response" | grep -q '"ok":true'; then
        echo "[OK] Notification sent: $message"
        return 0
    else
        echo "[ERROR] Telegram API error: $response"
        return 1
    fi
}

# Parse arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options] <message>"
        echo ""
        echo "Options:"
        echo "  --chat-id ID    Telegram chat ID"
        echo "  --token TOKEN   Telegram bot token"
        echo "  --urgent       Send as urgent (warning emoji)"
        echo ""
        echo "Environment variables:"
        echo "  TELEGRAM_BOT_TOKEN"
        echo "  TELEGRAM_CHAT_ID"
        echo "  OPENCLAW_TELEGRAM_CHAT_ID"
        exit 0
        ;;
    --chat-id)
        TELEGRAM_CHAT_ID="$2"
        shift 2
        ;;
    --token)
        TELEGRAM_BOT_TOKEN="$2"
        shift 2
        ;;
    --urgent)
        local prefix="⚠️ "
        local message="$prefix$1"
        shift
        ;;
esac

# Send notification
if [[ $# -gt 0 ]]; then
    send_notification "$*"
else
    # Read from stdin
    while IFS= read -r line; do
        send_notification "$line"
    done
fi
