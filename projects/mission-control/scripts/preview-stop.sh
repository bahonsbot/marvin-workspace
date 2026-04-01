#!/usr/bin/env bash
set -euo pipefail

RUNTIME_DIR="${MISSION_CONTROL_PREVIEW_RUNTIME_DIR:-/data/.openclaw/workspace/projects/mission-control/.preview-runtime}"
PID_FILE="$RUNTIME_DIR/latest.pid"
SIDECAR_PID_FILE="$RUNTIME_DIR/ws-sidecar.pid"
NEXT_PID_FILE="$RUNTIME_DIR/next.pid"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" || true)"
  if [[ -n "${PID}" ]] && kill -0 "${PID}" 2>/dev/null; then
    kill "${PID}" || true
    sleep 1
    kill -9 "${PID}" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

if [[ -f "$SIDECAR_PID_FILE" ]]; then
  SIDECAR_PID="$(cat "$SIDECAR_PID_FILE" || true)"
  if [[ -n "${SIDECAR_PID}" ]] && kill -0 "${SIDECAR_PID}" 2>/dev/null; then
    kill "${SIDECAR_PID}" || true
    sleep 1
    kill -9 "${SIDECAR_PID}" 2>/dev/null || true
  fi
  rm -f "$SIDECAR_PID_FILE"
fi

if [[ -f "$NEXT_PID_FILE" ]]; then
  NEXT_PID="$(cat "$NEXT_PID_FILE" || true)"
  if [[ -n "${NEXT_PID}" ]] && kill -0 "${NEXT_PID}" 2>/dev/null; then
    kill "${NEXT_PID}" || true
    sleep 1
    kill -9 "${NEXT_PID}" 2>/dev/null || true
  fi
  rm -f "$NEXT_PID_FILE"
fi

pkill -f 'next start --hostname 127.0.0.1 --port 3005' 2>/dev/null || true
pkill -f 'next start --hostname 0.0.0.0 --port 3005' 2>/dev/null || true
pkill -f 'next start --hostname 127.0.0.1 --port 3007' 2>/dev/null || true
pkill -f 'next-server' 2>/dev/null || true
pkill -f 'runtime-bridge-ws-sidecar.js' 2>/dev/null || true
pkill -f 'preview-origin-proxy.js' 2>/dev/null || true
