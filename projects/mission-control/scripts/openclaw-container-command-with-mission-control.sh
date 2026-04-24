#!/usr/bin/env bash
set -euo pipefail

MISSION_CONTROL_RUNNER="/data/.openclaw/workspace/projects/mission-control/scripts/mission-control-service-run.sh"
SHUTTING_DOWN=0
PRIMARY_PID=""
MISSION_CONTROL_PID=""

if [[ ! -x "$MISSION_CONTROL_RUNNER" ]]; then
  echo "[openclaw-with-mission-control] missing executable runner: $MISSION_CONTROL_RUNNER" >&2
  exit 1
fi

if [[ "$#" -gt 0 ]]; then
  PRIMARY_CMD=("$@")
else
  PRIMARY_CMD=(node /hostinger/server.mjs)
fi

shutdown_children() {
  if [[ "$SHUTTING_DOWN" == "1" ]]; then
    return 0
  fi
  SHUTTING_DOWN=1

  if [[ -n "$MISSION_CONTROL_PID" ]] && kill -0 "$MISSION_CONTROL_PID" 2>/dev/null; then
    kill -TERM "$MISSION_CONTROL_PID" 2>/dev/null || true
  fi

  if [[ -n "$PRIMARY_PID" ]] && kill -0 "$PRIMARY_PID" 2>/dev/null; then
    kill -TERM "$PRIMARY_PID" 2>/dev/null || true
  fi

  wait "$MISSION_CONTROL_PID" 2>/dev/null || true
  wait "$PRIMARY_PID" 2>/dev/null || true
}

trap shutdown_children EXIT INT TERM

echo "[openclaw-with-mission-control] starting Mission Control runner"
"$MISSION_CONTROL_RUNNER" &
MISSION_CONTROL_PID=$!

echo "[openclaw-with-mission-control] starting primary command: ${PRIMARY_CMD[*]}"
"${PRIMARY_CMD[@]}" &
PRIMARY_PID=$!

set +e
wait -n "$MISSION_CONTROL_PID" "$PRIMARY_PID"
STATUS=$?
set -e

echo "[openclaw-with-mission-control] one child exited, shutting down remaining processes" >&2
shutdown_children
exit "$STATUS"
