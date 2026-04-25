#!/usr/bin/env bash
set -euo pipefail

MISSION_CONTROL_RUNNER="/data/.openclaw/workspace/projects/mission-control/scripts/mission-control-service-run.sh"
MISSION_CONTROL_HEALTH="/data/.openclaw/workspace/projects/mission-control/scripts/mission-control-service-health.sh"
LAB_RUNNER="/data/.openclaw/workspace/projects/mission-control-lab/scripts/mission-control-service-run.sh"
LAB_HEALTH="/data/.openclaw/workspace/projects/mission-control-lab/scripts/mission-control-service-health.sh"
MISSION_CONTROL_ENABLE_LAB="${MISSION_CONTROL_ENABLE_LAB:-1}"
SHUTTING_DOWN=0
PRIMARY_PID=""
MISSION_CONTROL_PID=""
LAB_PID=""
PRIMARY_EXITED=0
MISSION_CONTROL_EXITED=0
LAB_EXITED=0

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

  if [[ -n "$LAB_PID" ]] && kill -0 "$LAB_PID" 2>/dev/null; then
    kill -TERM "$LAB_PID" 2>/dev/null || true
  fi

  if [[ -n "$MISSION_CONTROL_PID" ]] && kill -0 "$MISSION_CONTROL_PID" 2>/dev/null; then
    kill -TERM "$MISSION_CONTROL_PID" 2>/dev/null || true
  fi

  if [[ -n "$PRIMARY_PID" ]] && kill -0 "$PRIMARY_PID" 2>/dev/null; then
    kill -TERM "$PRIMARY_PID" 2>/dev/null || true
  fi

  wait "$LAB_PID" 2>/dev/null || true
  wait "$MISSION_CONTROL_PID" 2>/dev/null || true
  wait "$PRIMARY_PID" 2>/dev/null || true
}

start_lab_runner() {
  if [[ "$MISSION_CONTROL_ENABLE_LAB" == "0" ]]; then
    echo "[openclaw-with-mission-control] lab runner disabled by MISSION_CONTROL_ENABLE_LAB=0"
    LAB_PID=""
    return 0
  fi

  if [[ ! -x "$LAB_RUNNER" ]]; then
    echo "[openclaw-with-mission-control] lab runner not found/executable, skipping: $LAB_RUNNER" >&2
    LAB_PID=""
    return 0
  fi

  echo "[openclaw-with-mission-control] starting Mission Control lab runner"
  "$LAB_RUNNER" &
  LAB_PID=$!
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

start_lab_runner

echo "[openclaw-with-mission-control] starting primary command: ${PRIMARY_CMD[*]}"
"${PRIMARY_CMD[@]}" &
PRIMARY_PID=$!

while true; do
  WAIT_PIDS=("$MISSION_CONTROL_PID" "$PRIMARY_PID")
  if [[ -n "$LAB_PID" ]]; then
    WAIT_PIDS+=("$LAB_PID")
  fi

  set +e
  wait -n "${WAIT_PIDS[@]}"
  STATUS=$?
  set -e

  PRIMARY_EXITED=0
  MISSION_CONTROL_EXITED=0
  LAB_EXITED=0

  if [[ -n "$PRIMARY_PID" ]] && ! kill -0 "$PRIMARY_PID" 2>/dev/null; then
    PRIMARY_EXITED=1
  fi
  if [[ -n "$MISSION_CONTROL_PID" ]] && ! kill -0 "$MISSION_CONTROL_PID" 2>/dev/null; then
    MISSION_CONTROL_EXITED=1
  fi
  if [[ -n "$LAB_PID" ]] && ! kill -0 "$LAB_PID" 2>/dev/null; then
    LAB_EXITED=1
  fi

  if [[ "$PRIMARY_EXITED" == "1" ]]; then
    echo "[openclaw-with-mission-control] primary command exited, shutting down Mission Control bundles" >&2
    shutdown_children
    exit "$STATUS"
  fi

  if [[ "$MISSION_CONTROL_EXITED" == "1" ]]; then
    if [[ -x "$MISSION_CONTROL_HEALTH" ]] && "$MISSION_CONTROL_HEALTH" >/dev/null 2>&1; then
      echo "[openclaw-with-mission-control] Mission Control runner exited while health still passed; preserving primary command" >&2
      wait "$PRIMARY_PID"
      exit $?
    fi

    echo "[openclaw-with-mission-control] Mission Control runner exited and health failed, shutting down remaining processes" >&2
    shutdown_children
    exit "$STATUS"
  fi

  if [[ "$LAB_EXITED" == "1" ]]; then
    echo "[openclaw-with-mission-control] Mission Control lab runner exited; restarting optional lab runner" >&2
    LAB_PID=""
    sleep 5
    start_lab_runner
    continue
  fi

done
