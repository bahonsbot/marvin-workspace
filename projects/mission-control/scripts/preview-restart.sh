#!/usr/bin/env bash
set -euo pipefail

cd /data/.openclaw/workspace/projects/mission-control

./scripts/preview-stop.sh || true
./scripts/preview-build.sh
./scripts/preview-start.sh

sleep 2
curl -I http://127.0.0.1:3005
