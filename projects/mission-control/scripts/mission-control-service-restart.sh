#!/usr/bin/env bash
set -euo pipefail

cd /data/.openclaw/workspace/projects/mission-control

# Runtime supervision should not rebuild. Rebuilds are deliberate promotion/dev
# actions and can destabilize the live bundle if triggered by a watchdog.
./scripts/preview-stop.sh || true
exec ./scripts/preview-start.sh
