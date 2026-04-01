#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT=/data/.openclaw/workspace
PID_FILE="$WORKSPACE_ROOT/memory/deterministic-scheduler.pid"
LOG_FILE="$WORKSPACE_ROOT/memory/deterministic-scheduler.log"
PYTHON=/usr/bin/python3
SCRIPT="$WORKSPACE_ROOT/scripts/deterministic_scheduler.py"

process_matches_scheduler() {
  local pid="$1"
  ps -p "$pid" -o args= 2>/dev/null | grep -Fq "$SCRIPT"
}

status() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE")
    if [[ -n "$pid" ]] && { kill -0 "$pid" 2>/dev/null || process_matches_scheduler "$pid"; }; then
      echo "running pid=$pid"
      exit 0
    fi
  fi
  echo "stopped"
}

start() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE")
    if [[ -n "$pid" ]] && { kill -0 "$pid" 2>/dev/null || process_matches_scheduler "$pid"; }; then
      echo "already running pid=$pid"
      exit 0
    fi
    rm -f "$PID_FILE"
  fi
  nohup "$PYTHON" "$SCRIPT" >/dev/null 2>&1 &
  sleep 1
  status
}

stop() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      sleep 1
    fi
    rm -f "$PID_FILE"
  fi
  echo "stopped"
}

case "${1:-status}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  *) echo "usage: $0 {start|stop|restart|status}"; exit 2 ;;
esac
