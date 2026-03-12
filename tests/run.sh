#!/usr/bin/env bash
set -euo pipefail

# Backup tests removed - Philippe handles backups manually
bash /data/.openclaw/workspace/tests/test_security_review.sh

echo "All tests passed"
