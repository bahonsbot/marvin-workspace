#!/usr/bin/env bash
set -euo pipefail
export PATH="/data/.local/bin:/data/.bun/bin:$PATH"
export OPENCLAW_STATE_DIR="/data/.openclaw/rehearsals/v2026.4.12/state"
export OPENCLAW_CONFIG_PATH="/data/.openclaw/rehearsals/v2026.4.12/state/openclaw.json"
export OPENCLAW_GATEWAY_PORT="19001"
exec "/data/.openclaw/rehearsals/v2026.4.12/cli/node_modules/.bin/openclaw" "$@"
