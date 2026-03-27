#!/usr/bin/env bash
set -euo pipefail

cd /data/.openclaw/workspace/projects/mission-control
RUNTIME_DIR="${MISSION_CONTROL_PREVIEW_RUNTIME_DIR:-/data/.openclaw/workspace/projects/mission-control/.preview-runtime}"
ENV_FILE="$RUNTIME_DIR/mission-control-preview.env"
mkdir -p "$RUNTIME_DIR"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

nohup npm run start -- --hostname 0.0.0.0 --port 3005 >"$RUNTIME_DIR/latest.log" 2>&1 &
echo $! > "$RUNTIME_DIR/latest.pid"
sleep 1
cat "$RUNTIME_DIR/latest.pid"
