# switch_model_auto.sh
# Usage: bash switch_model_auto.sh <command>

set -e
CONFIG=/data/.openclaw/openclaw.json
CMD_INPUT="$1"

# Validate input - only allow known commands
case "$CMD_INPUT" in
  /model minimax|switch to minimax|minimax|/model codex|switch to codex|codex) ;;
  *) echo "Unknown command. Supported: /model minimax, switch to minimax, /model codex, switch to codex."; exit 1 ;;
esac

CMD=$(echo "$CMD_INPUT" | tr '[:upper:]' '[:lower:]')

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
