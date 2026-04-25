#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/data/.openclaw/workspace/projects/mission-control-lab"
cd "$PROJECT_DIR"

HEALTH_LOG="/tmp/mission-control-lab-service-health.log"
STARTED_BY_RUNNER=0

cleanup() {
  if [[ "$STARTED_BY_RUNNER" == "1" ]]; then
    ./scripts/mission-control-service-stop.sh >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

start_bundle() {
  ./scripts/mission-control-service-stop.sh >/dev/null 2>&1 || true
  ./scripts/mission-control-service-start.sh
  ./scripts/mission-control-service-health.sh
  STARTED_BY_RUNNER=1
}

start_bundle

echo "[mission-control-lab-service-run] bundle started, entering foreground supervisor loop"

while true; do
  if ! ./scripts/mission-control-service-health.sh >"$HEALTH_LOG" 2>&1; then
    echo "[mission-control-lab-service-run] health check failed, restarting bundle" >&2
    cat "$HEALTH_LOG" >&2 || true
    ./scripts/mission-control-service-restart.sh
    ./scripts/mission-control-service-health.sh
    STARTED_BY_RUNNER=1
  fi
  sleep 15
done
