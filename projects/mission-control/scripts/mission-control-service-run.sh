#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/data/.openclaw/workspace/projects/mission-control"
cd "$PROJECT_DIR"

MAINTENANCE_LOCK="$PROJECT_DIR/.preview-runtime/maintenance.lock"
HEALTH_LOG="/tmp/mission-control-service-health.log"
STARTED_BY_RUNNER=0

cleanup() {
  if [[ "$STARTED_BY_RUNNER" == "1" ]]; then
    ./scripts/mission-control-service-stop.sh >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM


wait_for_maintenance_window() {
  while [[ -e "$MAINTENANCE_LOCK" ]]; do
    echo "[mission-control-service-run] maintenance lock present, pausing supervision: $MAINTENANCE_LOCK"
    sleep 15
  done
}

start_bundle() {
  wait_for_maintenance_window
  ./scripts/mission-control-service-stop.sh >/dev/null 2>&1 || true
  ./scripts/mission-control-service-start.sh
  ./scripts/mission-control-service-health.sh
  STARTED_BY_RUNNER=1
}

start_bundle

echo "[mission-control-service-run] bundle started, entering foreground supervisor loop"

while true; do
  wait_for_maintenance_window
  if ! ./scripts/mission-control-service-health.sh >"$HEALTH_LOG" 2>&1; then
    echo "[mission-control-service-run] health check failed, restarting bundle" >&2
    cat "$HEALTH_LOG" >&2 || true
    wait_for_maintenance_window
    ./scripts/mission-control-service-restart.sh
    ./scripts/mission-control-service-health.sh
    STARTED_BY_RUNNER=1
  fi
  sleep 15
done
