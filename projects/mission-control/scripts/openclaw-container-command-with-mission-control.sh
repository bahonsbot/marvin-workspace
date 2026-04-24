#!/usr/bin/env bash
set -euo pipefail

MISSION_CONTROL_RUNNER="/data/.openclaw/workspace/projects/mission-control/scripts/mission-control-service-run.sh"
MISSION_CONTROL_HEALTH="/data/.openclaw/workspace/projects/mission-control/scripts/mission-control-service-health.sh"
SHUTTING_DOWN=0
PRIMARY_PID=""
MISSION_CONTROL_PID=""
PRIMARY_EXITED=0

if [[ ! -x "$MISSION_CONTROL_RUNNER" ]]; then
  echo "[openclaw-with-mission-control] missing executable runner: $MISSION_CONTROL_RUNNER" >&2
  exit 1
fi

if [[ "$#" -gt 0 ]]; then
  PRIMARY_CMD=() 
  for arg in "$@"; do
    PRIMARY_CMD+=("$arg")
  done
else
  PRIMARY_CMD=(node /hostinger/server.mjs)
fi

ensure_runtime_path() {
  local extra_paths=(
    "/data/.npm-global/bin"
    "/data/.local/bin"
    "/data/bin"
    "/data/.bun/bin"
    "/usr/local/bin"
    "/usr/bin"
    "/bin"
  )

  local path_value="${PATH:-}"
  for candidate in "${extra_paths[@]}"; do
    if [[ -d "$candidate" ]] && [[ ":$path_value:" != *":$candidate:"* ]]; then
      if [[ -n "$path_value" ]]; then
        path_value="$candidate:$path_value"
      else
        path_value="$candidate"
      fi
    fi
  done
  export PATH="$path_value"
}

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

ensure_runtime_path

echo "[openclaw-with-mission-control] PATH=$PATH"
if command -v openclaw >/dev/null 2>&1; then
  echo "[openclaw-with-mission-control] openclaw=$(command -v openclaw)"
else
  echo "[openclaw-with-mission-control] warning: openclaw not found on PATH before startup" >&2
fi

echo "[openclaw-with-mission-control] starting Mission Control runner"
"$MISSION_CONTROL_RUNNER" &
MISSION_CONTROL_PID=$!

echo "[openclaw-with-mission-control] starting primary command: ${PRIMARY_CMD[*]}"
"${PRIMARY_CMD[@]}" &
PRIMARY_PID=$!

set +e
wait -n "$MISSION_CONTROL_PID" "$PRIMARY_PID"
STATUS=$?
if [[ -n "$PRIMARY_PID" ]] && ! kill -0 "$PRIMARY_PID" 2>/dev/null; then
  PRIMARY_EXITED=1
fi
set -e

if [[ "$PRIMARY_EXITED" == "1" ]]; then
  echo "[openclaw-with-mission-control] primary command exited, shutting down Mission Control bundle" >&2
  shutdown_children
  exit "$STATUS"
fi

if [[ -x "$MISSION_CONTROL_HEALTH" ]] && "$MISSION_CONTROL_HEALTH" >/dev/null 2>&1; then
  echo "[openclaw-with-mission-control] Mission Control runner exited while health still passed; preserving primary command" >&2
  wait "$PRIMARY_PID"
  exit $?
fi

echo "[openclaw-with-mission-control] one child exited, shutting down remaining processes" >&2
shutdown_children
exit "$STATUS"
