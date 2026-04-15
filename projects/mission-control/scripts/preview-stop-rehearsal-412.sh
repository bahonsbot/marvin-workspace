#!/usr/bin/env bash
set -euo pipefail
export MISSION_CONTROL_PREVIEW_RUNTIME_DIR="/data/.openclaw/rehearsals/v2026.4.12/mission-control-preview"
exec /data/.openclaw/workspace/projects/mission-control/scripts/preview-stop.sh "$@"
