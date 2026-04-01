#!/usr/bin/env bash
set -euo pipefail

cd /data/.openclaw/workspace/projects/mission-control
RUNTIME_DIR="${MISSION_CONTROL_PREVIEW_RUNTIME_DIR:-/data/.openclaw/workspace/projects/mission-control/.preview-runtime}"
ENV_FILE="$RUNTIME_DIR/mission-control-preview.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

rm -rf .next
npm run build
