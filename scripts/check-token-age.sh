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

echo "=== Token Age Check ==="
echo "Max allowed age: ${MAX_AGE_DAYS} days"
echo "Manifest: ${MANIFEST_PATH}"
echo ""

# Check if manifest exists
if [[ ! -f "$MANIFEST_PATH" ]]; then
    echo -e "${RED}Error: Token manifest not found at ${MANIFEST_PATH}${NC}"
    echo "Please set TOKEN_MANIFEST_PATH or create the manifest file."
    exit 1
fi

# Get current date in seconds since epoch
CURRENT_EPOCH=$(date +%s)

# Calculate threshold epoch (current time - max age days)
THRESHOLD_EPOCH=$((CURRENT_EPOCH - MAX_AGE_DAYS * 86400))

# Parse JSON and check each token
# Using grep and awk for simple parsing without jq dependency

EXPIRED_COUNT=0
WARNING_COUNT=0
OK_COUNT=0

# Read tokens from manifest (simple grep approach)
TOKEN_NAMES=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$MANIFEST_PATH" | cut -d'"' -f4)
TOKEN_CREATED=$(grep -o '"created"[[:space:]]*:[[:space:]]*"[^"]*"' "$MANIFEST_PATH" | cut -d'"' -f4)

# Convert to arrays
IFS=$'\n' read -r -d '' -a NAME_ARRAY <<< "$TOKEN_NAMES" || true
IFS=$'\n' read -r -d '' -a CREATED_ARRAY <<< "$TOKEN_CREATED" || true

# Check if we have tokens
if [[ ${#NAME_ARRAY[@]} -eq 0 ]]; then
    echo -e "${YELLOW}No tokens found in manifest${NC}"
    exit 0
fi

echo "Checking tokens..."
echo "----------------------------------------"

for i in "${!NAME_ARRAY[@]}"; do
    TOKEN_NAME="${NAME_ARRAY[$i]}"
    CREATED="${CREATED_ARRAY[$i]}"
    
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
