#!/usr/bin/env bash
set -euo pipefail

ROOT="/data/.openclaw/workspace/projects/autonomous-trading-bot"
LOG_DIR="$ROOT/logs"
OUT_LOG="$LOG_DIR/webhook_receiver.out.log"
ERR_LOG="$LOG_DIR/webhook_receiver.err.log"

mkdir -p "$LOG_DIR"
cd "$ROOT"

python3 -c "from src.log_utils import rotate_log; from pathlib import Path; rotate_log(Path('$OUT_LOG')); rotate_log(Path('$ERR_LOG'))" 2>/dev/null || true

set -u
for var in WEBHOOK_SHARED_SECRET ALPACA_API_KEY ALPACA_API_SECRET TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID AUTO_MIN_CONFIDENCE WEBHOOK_HOST WEBHOOK_PORT PAPER_EXECUTE; do
    if [[ -f ./.env ]]; then
        val=$(grep "^${var}=" ./.env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)
        if [[ -n "$val" ]]; then
            export "$var=$val"
        fi
    fi
done
set +u

export WEBHOOK_HOST="${WEBHOOK_HOST:-127.0.0.1}"
export WEBHOOK_PORT="${WEBHOOK_PORT:-8000}"

exec python3 -m src.webhook_receiver >>"$OUT_LOG" 2>>"$ERR_LOG"
