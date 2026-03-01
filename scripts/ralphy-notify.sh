#!/bin/bash
set -euo pipefail
# Ralph Loop Telegram Notifier
# Sends notifications to Telegram when Ralph loop completes or errors

# Load config or use defaults
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
WORKSPACE="${WORKSPACE:-/data/.openclaw/workspace}"

send_notification() {
    local message="$1"
    local priority="${2:-normal}"
    
    # If no bot token, try OpenClaw config JSON safely (explicit key path)
    if [[ -z "$TELEGRAM_BOT_TOKEN" ]]; then
        local cfg_path="$WORKSPACE/../openclaw.json"
        if [[ -f "$cfg_path" ]]; then
            local config_token
            config_token=$(python3 - <<'PY' "$cfg_path" 2>/dev/null || true
import json,sys
p=sys.argv[1]
try:
    j=json.load(open(p))
    tok=(j.get('channels',{}).get('telegram',{}).get('botToken') or '').strip()
    if tok:
        print(tok)
except Exception:
    pass
PY
)
            if [[ -n "${config_token:-}" ]]; then
                TELEGRAM_BOT_TOKEN="$config_token"
            fi
        fi
    fi

    # If still no token, try openclaw CLI
    if [[ -z "$TELEGRAM_BOT_TOKEN" ]]; then
        TELEGRAM_BOT_TOKEN=$(openclaw config get channels.telegram.botToken 2>/dev/null | tr -d '"' || true)
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
    
    # Send via Telegram API without exposing token in process args
    local response
    response=$(TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" TELEGRAM_CHAT_ID="$TELEGRAM_CHAT_ID" TELEGRAM_MESSAGE="$message" python3 - <<'PY' 2>/dev/null || true
import json, os, urllib.request

token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
chat_id = os.environ.get('TELEGRAM_CHAT_ID', '')
message = os.environ.get('TELEGRAM_MESSAGE', '')

url = f"https://api.telegram.org/bot{token}/sendMessage"
payload = json.dumps({
    "chat_id": chat_id,
    "text": message,
    "parse_mode": "Markdown"
}).encode('utf-8')

req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        print(r.read().decode('utf-8', errors='replace'))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))
PY
)

    if echo "$response" | grep -q '"ok":true'; then
        echo "[OK] Notification sent: $message"
        return 0
    else
        echo "[ERROR] Telegram API error: $response"
        return 1
    fi
}

# Parse arguments
URGENT=0
while [[ $# -gt 0 ]]; do
    case "${1:-}" in
        --help|-h)
            echo "Usage: $0 [options] <message>"
            echo ""
            echo "Options:"
            echo "  --chat-id ID    Telegram chat ID"
            echo "  --urgent        Prefix message with warning emoji"
            echo ""
            echo "Environment variables:"
            echo "  TELEGRAM_BOT_TOKEN (or set via openclaw config)"
            echo "  TELEGRAM_CHAT_ID"
            echo "  OPENCLAW_TELEGRAM_CHAT_ID"
            exit 0
            ;;
        --chat-id)
            TELEGRAM_CHAT_ID="${2:-}"
            shift 2
            ;;
        --urgent)
            URGENT=1
            shift
            ;;
        --)
            shift
            break
            ;;
        *)
            break
            ;;
    esac
done

# Send notification
if [[ $# -gt 0 ]]; then
    msg="$*"
    if [[ "$URGENT" -eq 1 ]]; then
        msg="⚠️ $msg"
    fi
    send_notification "$msg"
else
    # Read from stdin
    while IFS= read -r line; do
        if [[ "$URGENT" -eq 1 ]]; then
            line="⚠️ $line"
        fi
        send_notification "$line"
    done
fi
