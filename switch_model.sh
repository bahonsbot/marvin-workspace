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

if [ "$MODEL_LOWER" = "minimax" ]; then
  jq '(.agents.defaults.model.primary) = "MiniMax 2.5"' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
  "$AUDIT_LOG" "model_switch" "target=MiniMax 2.5 source=switch_model.sh"
  echo "Switched default model to MiniMax 2.5"
elif [ "$MODEL_LOWER" = "codex" ]; then
  jq '(.agents.defaults.model.primary) = "OpenAI Codex GPT-5.2"' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
  "$AUDIT_LOG" "model_switch" "target=OpenAI Codex GPT-5.2 source=switch_model.sh"
  echo "Switched default model to OpenAI Codex GPT-5.2"
else
  echo "Usage: bash switch_model.sh <minimax|codex>"
  exit 1
fi
