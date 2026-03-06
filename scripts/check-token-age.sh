#!/bin/bash
#
# check-token-age.sh - Check if tokens have exceeded the maximum age threshold
#
# Usage:
#   ./scripts/check-token-age.sh [days]
#
# Arguments:
#   days    Maximum age in days (default: 30)
#
# Environment:
#   TOKEN_MANIFEST_PATH   Path to token manifest JSON (default: config/token-manifest.json)
#

set -euo pipefail

# Default values
MAX_AGE_DAYS="${1:-30}"
MANIFEST_PATH="${TOKEN_MANIFEST_PATH:-config/token-manifest.json}"

# Colors for output
RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Telegram alert function
send_telegram_alert() {
    local message="$1"
    local chat_id="${TELEGRAM_CHAT_ID:-}"
    local bot_token="${TELEGRAM_BOT_TOKEN:-}"
    
    if [[ -z "$chat_id" || -z "$bot_token" ]]; then
        echo "[ALERT] Would send Telegram: $message"
        return
    fi
    
    # URL encode the message (sanitize: pass via env var, not shell interpolation)
    local encoded_message
    encoded_message=$(MESSAGE="$message" python3 -c "import urllib.parse,os; print(urllib.parse.quote(os.environ['MESSAGE']))" 2>/dev/null || echo "$message")
    
    # Note: Telegram Bot API requires token in URL path (no header auth support)
    # This is an accepted risk - Telegram's API design limitation
    # Token may appear in proxy/access logs if not on localhost
    curl -s -X POST "https://api.telegram.org/bot${bot_token}/sendMessage" \
        -d "chat_id=${chat_id}" \
        -d "text=${encoded_message}" \
        -d "parse_mode=Markdown" \
        >/dev/null 2>&1 || true
}

echo "=== Token Age Check ==="
echo "Max allowed age: ${MAX_AGE_DAYS} days"
echo "Manifest: ${MANIFEST_PATH}"
echo ""

# Check if manifest exists
if [[ ! -f "$MANIFEST_PATH" ]]; then
    echo -e "${RED}Error: Token manifest not found${NC}"
    echo "Please set TOKEN_MANIFEST_PATH or create the manifest file."
    exit 1
fi

# Get current date in seconds since epoch
CURRENT_EPOCH=$(date +%s)

# Calculate threshold epoch (current time - max age days)
THRESHOLD_EPOCH=$((CURRENT_EPOCH - MAX_AGE_DAYS * 86400))

# Parse JSON and check each token using jq (robust JSON parsing)
# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed${NC}"
    exit 1
fi

EXPIRED_COUNT=0
WARNING_COUNT=0
OK_COUNT=0

# Read tokens from manifest using jq (reliable JSON parsing)
TOKEN_COUNT=$(jq '.tokens | length' "$MANIFEST_PATH")

# Check if we have tokens
if [[ "$TOKEN_COUNT" -eq 0 ]] || [[ "$TOKEN_COUNT" == "null" ]]; then
    echo -e "${YELLOW}No tokens found in manifest${NC}"
    exit 0
fi

echo "Checking tokens..."
echo "----------------------------------------"

for i in $(jq '.tokens | keys | .[]' "$MANIFEST_PATH" 2>/dev/null | tr -d '"'); do
    TOKEN_NAME=$(jq -r ".tokens[$i].name // empty" "$MANIFEST_PATH")
    CREATED=$(jq -r ".tokens[$i].created // empty" "$MANIFEST_PATH")
    EXPIRES=$(jq -r ".tokens[$i].expires // empty" "$MANIFEST_PATH")
    
    if [[ -z "$TOKEN_NAME" ]]; then
        continue
    fi
    
    # Check expires date first
    if [[ -n "$EXPIRES" && "$EXPIRES" != "null" ]]; then
        EXPIRES_EPOCH=$(date -d "$EXPIRES" +%s 2>/dev/null) || {
            echo -e "${RED}[ERROR]${NC} Invalid expires date for '$TOKEN_NAME': $EXPIRES"
            continue
        }
        
        # Calculate days until expiry
        SECONDS_UNTIL_EXPIRY=$((EXPIRES_EPOCH - CURRENT_EPOCH))
        DAYS_UNTIL_EXPIRY=$((SECONDS_UNTIL_EXPIRY / 86400))
        
        if [[ $SECONDS_UNTIL_EXPIRY -lt 0 ]]; then
            echo -e "${RED}[EXPIRED]${NC} $TOKEN_NAME - expired on $EXPIRES"
            EXPIRED_COUNT=$((EXPIRED_COUNT + 1))
            send_telegram_alert "🚨 TOKEN EXPIRED: $TOKEN_NAME\n\nExpired on: $EXPIRES\n\nImmediate action required."
            continue
        elif [[ $DAYS_UNTIL_EXPIRY -le 7 ]]; then
            echo -e "${RED}[CRITICAL]${NC} $TOKEN_NAME - expires in ${DAYS_UNTIL_EXPIRY} days ($EXPIRES)"
            EXPIRED_COUNT=$((EXPIRED_COUNT + 1))
            send_telegram_alert "⚠️ TOKEN EXPIRING SOON: $TOKEN_NAME\n\nExpires in ${DAYS_UNTIL_EXPIRY} days ($EXPIRES)\n\nPlease rotate this token."
            continue
        elif [[ $DAYS_UNTIL_EXPIRY -le 14 ]]; then
            echo -e "${YELLOW}[WARNING]${NC} $TOKEN_NAME - expires in ${DAYS_UNTIL_EXPIRY} days ($EXPIRES)"
            WARNING_COUNT=$((WARNING_COUNT + 1))
            continue
        else
            # Expires date is OK (>14 days), skip created date check
            echo -e "${GREEN}[OK]${NC} $TOKEN_NAME - expires in ${DAYS_UNTIL_EXPIRY} days"
            OK_COUNT=$((OK_COUNT + 1))
            continue
        fi
    fi
    
    if [[ -z "$CREATED" ]]; then
        echo -e "${RED}[ERROR]${NC} Token '$TOKEN_NAME' has no created date"
        continue
    fi
    
    # Convert created date to epoch
    CREATED_EPOCH=$(date -d "$CREATED" +%s 2>/dev/null) || {
        echo -e "${RED}[ERROR]${NC} Invalid date format for '$TOKEN_NAME': $CREATED"
        continue
    }
    
    # Calculate age in days
    AGE_SECONDS=$((CURRENT_EPOCH - CREATED_EPOCH))
    AGE_DAYS=$((AGE_SECONDS / 86400))
    
    # Check status
    if [[ $CREATED_EPOCH -lt $THRESHOLD_EPOCH ]]; then
        echo -e "${RED}[EXPIRED]${NC} $TOKEN_NAME - ${AGE_DAYS} days old (exceeded ${MAX_AGE_DAYS} day limit)"
        EXPIRED_COUNT=$((EXPIRED_COUNT + 1))
    elif [[ $AGE_DAYS -ge $((MAX_AGE_DAYS / 2)) ]]; then
        echo -e "${YELLOW}[WARNING]${NC} $TOKEN_NAME - ${AGE_DAYS} days old (approaching limit)"
        WARNING_COUNT=$((WARNING_COUNT + 1))
    else
        echo -e "${GREEN}[OK]${NC} $TOKEN_NAME - ${AGE_DAYS} days old"
        OK_COUNT=$((OK_COUNT + 1))
    fi
done

echo "----------------------------------------"
echo ""
echo "=== Summary ==="
echo -e "${RED}Expired:${NC} $EXPIRED_COUNT"
echo -e "${YELLOW}Warning:${NC} $WARNING_COUNT"
echo -e "${GREEN}OK:${NC} $OK_COUNT"
echo ""

# Exit with error if any expired tokens found
if [[ $EXPIRED_COUNT -gt 0 ]]; then
    echo -e "${RED}Action required: Some tokens have exceeded the maximum age limit!${NC}"
    exit 1
elif [[ $WARNING_COUNT -gt 0 ]]; then
    echo -e "${YELLOW}Action recommended: Some tokens are approaching their rotation deadline.${NC}"
    exit 0
else
    echo -e "${GREEN}All tokens are within the acceptable age range.${NC}"
    exit 0
fi
