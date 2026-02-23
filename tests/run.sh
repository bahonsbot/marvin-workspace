#!/usr/bin/env bash
set -euo pipefail

bash /data/.openclaw/workspace/tests/test_backup_workspace.sh
bash /data/.openclaw/workspace/tests/test_security_review.sh

echo "All tests passed"
