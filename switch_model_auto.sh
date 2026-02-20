# switch_model_auto.sh
# Usage: bash switch_model_auto.sh <command>

set -e
CONFIG=/data/.openclaw/openclaw.json
CMD=$(echo "$1" | tr '[:upper:]' '[:lower:]')

case "$CMD" in
  "/model minimax"|"switch to minimax"|"minimax")
    jq '(.agents.defaults.model.primary) = "MiniMax 2.5"' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
    echo "Switched default model to MiniMax 2.5"
    ;;
  "/model codex"|"switch to codex"|"codex")
    jq '(.agents.defaults.model.primary) = "OpenAI Codex GPT-5.2"' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
    echo "Switched default model to OpenAI Codex GPT-5.2"
    ;;
  *)
    echo "Unknown command. Supported: /model minimax, switch to minimax, /model codex, switch to codex."
    exit 1
    ;;
esac
