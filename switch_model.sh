# switch_model.sh
# Usage: bash switch_model.sh <minimax|codex>

set -e
MODEL_LOWER=$(echo "$1" | tr '[:upper:]' '[:lower:]')
CONFIG=/data/.openclaw/openclaw.json

if [ "$MODEL_LOWER" = "minimax" ]; then
  jq '(.agents.defaults.model.primary) = "MiniMax 2.5"' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
  echo "Switched default model to MiniMax 2.5"
elif [ "$MODEL_LOWER" = "codex" ]; then
  jq '(.agents.defaults.model.primary) = "OpenAI Codex GPT-5.2"' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
  echo "Switched default model to OpenAI Codex GPT-5.2"
else
  echo "Usage: bash switch_model.sh <minimax|codex>"
  exit 1
fi
