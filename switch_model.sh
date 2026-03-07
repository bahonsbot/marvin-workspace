# switch_model.sh
# Usage: bash switch_model.sh <minimax|codex>

set -e
MODEL_INPUT="$1"
AUDIT_LOG="/data/.openclaw/workspace/scripts/audit-log.sh"

# Validate input - only allow known models
case "$MODEL_INPUT" in
  minimax|codex) ;;
  *) echo "Usage: bash switch_model.sh <minimax|codex>"; exit 1 ;;
esac

MODEL_LOWER=$(echo "$MODEL_INPUT" | tr '[:upper:]' '[:lower:]')
CONFIG=/data/.openclaw/openclaw.json
TEMP_CONFIG=$(mktemp /data/.openclaw/openclaw.json.XXXXXX)

# Backup current config before modification
BACKUP_CONFIG="${CONFIG}.bak.$(date +%Y%m%d_%H%M%S)"
cp "$CONFIG" "$BACKUP_CONFIG"

# Validate current config is valid JSON before modification
if ! jq empty "$CONFIG" 2>/dev/null; then
  echo "ERROR: Current config is invalid JSON, aborting switch"
  exit 1
fi

if [ "$MODEL_LOWER" = "minimax" ]; then
  jq '(.agents.defaults.model.primary) = "MiniMax 2.5"' "$CONFIG" > "$TEMP_CONFIG" && mv "$TEMP_CONFIG" "$CONFIG"
  # Validate new config
  if ! jq empty "$CONFIG" 2>/dev/null; then
    echo "ERROR: New config invalid, rolling back"
    mv "$BACKUP_CONFIG" "$CONFIG"
    exit 1
  fi
  "$AUDIT_LOG" "model_switch" "target=MiniMax 2.5 source=switch_model.sh"
  echo "Switched default model to MiniMax 2.5"
elif [ "$MODEL_LOWER" = "codex" ]; then
  jq '(.agents.defaults.model.primary) = "OpenAI Codex GPT-5.2"' "$CONFIG" > "$TEMP_CONFIG" && mv "$TEMP_CONFIG" "$CONFIG"
  # Validate new config
  if ! jq empty "$CONFIG" 2>/dev/null; then
    echo "ERROR: New config invalid, rolling back"
    mv "$BACKUP_CONFIG" "$CONFIG"
    exit 1
  fi
  "$AUDIT_LOG" "model_switch" "target=OpenAI Codex GPT-5.2 source=switch_model.sh"
  echo "Switched default model to OpenAI Codex GPT-5.2"
else
  echo "Usage: bash switch_model.sh <minimax|codex>"
  exit 1
fi

# Clean up backup on success (keep for 7 days)
find /data/.openclaw -name "openclaw.json.bak.*" -mtime +7 -delete 2>/dev/null || true
