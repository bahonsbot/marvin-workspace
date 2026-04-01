#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="openclaw-ktrt-openclaw-1"
SERVICE_SRC_IN_CONTAINER="/data/.openclaw/workspace/deploy/marvin-webhook-receiver.service"
SERVICE_DST="/etc/systemd/system/marvin-webhook-receiver.service"
TMP_SERVICE="/tmp/marvin-webhook-receiver.service"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "Container not running: $CONTAINER_NAME" >&2
  exit 1
fi

docker cp "$CONTAINER_NAME:$SERVICE_SRC_IN_CONTAINER" "$TMP_SERVICE"
install -m 0644 "$TMP_SERVICE" "$SERVICE_DST"
rm -f "$TMP_SERVICE"
systemctl daemon-reload
systemctl enable --now marvin-webhook-receiver.service
systemctl status marvin-webhook-receiver.service --no-pager --lines=20
