# switch_model_auto.sh
# Usage: bash switch_model_auto.sh <command>

set -e
CONFIG=/data/.openclaw/openclaw.json
CMD_INPUT="$1"
AUDIT_LOG="/data/.openclaw/workspace/scripts/audit-log.sh"
GUIDANCE_FILE="/data/.openclaw/workspace/model-guidance/gpt-5.4.md"

# Validate input - only allow known commands
case "$CMD_INPUT" in
  "/model minimax"|"switch to minimax"|"minimax"|"/model codex"|"switch to codex"|"codex"|"/model codex5.4"|"switch to codex5.4"|"codex5.4") ;;
  *) echo "Unknown command. Supported: /model minimax, switch to minimax, /model codex, switch to codex, /model codex5.4, switch to codex5.4."; exit 1 ;;
esac

CMD=$(echo "$CMD_INPUT" | tr '[:upper:]' '[:lower:]')
TEMP_CONFIG=$(mktemp /data/.openclaw/openclaw.json.XXXXXX)

case "$CMD" in
  "/model minimax"|"switch to minimax"|"minimax")
    jq '(.agents.defaults.model.primary) = "MiniMax 2.5"' "$CONFIG" > "$TEMP_CONFIG" && mv "$TEMP_CONFIG" "$CONFIG"
    "$AUDIT_LOG" "model_switch" "target=MiniMax 2.5 source=switch_model_auto.sh command=$CMD"
    echo "Switched default model to MiniMax 2.5"
    ;;
  "/model codex"|"switch to codex"|"codex")
    jq '(.agents.defaults.model.primary) = "openai-codex/gpt-5.3-codex"' "$CONFIG" > "$TEMP_CONFIG" && mv "$TEMP_CONFIG" "$CONFIG"
    "$AUDIT_LOG" "model_switch" "target=openai-codex/gpt-5.3-codex source=switch_model_auto.sh command=$CMD"
    echo "Switched default model to openai-codex/gpt-5.3-codex"
    ;;
  "/model codex5.4"|"switch to codex5.4"|"codex5.4")
    jq '(.agents.defaults.model.primary) = "openai-codex/gpt-5.4"' "$CONFIG" > "$TEMP_CONFIG" && mv "$TEMP_CONFIG" "$CONFIG"
    "$AUDIT_LOG" "model_switch" "target=openai-codex/gpt-5.4 source=switch_model_auto.sh command=$CMD"
    echo "Switched default model to openai-codex/gpt-5.4"
    if [ -f "$GUIDANCE_FILE" ]; then
      echo
      echo "=== GPT-5.4 guidance ==="
      cat "$GUIDANCE_FILE"
    else
      echo "NOTE: Guidance file not found at $GUIDANCE_FILE"
    fi
    ;;
  *)
    echo "Unknown command. Supported: /model minimax, switch to minimax, /model codex, switch to codex, /model codex5.4, switch to codex5.4."
    exit 1
    ;;
esac
