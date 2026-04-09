#!/bin/bash
#
# check-token-age.sh - Check if tokens have exceeded the maximum age threshold
#
# DEPRECATED (2026-03-19): This script is no longer maintained.
# Cron jobs and scripts must use the Python equivalent directly:
#   python3 scripts/check_token_age.py [days]
#
# This file is retained as a tombstone to make old references fail visibly
# rather than silently delegate to an unversioned fallback path.
#

set -euo pipefail

echo "ERROR: check-token-age.sh is deprecated." >&2
echo "Use: python3 scripts/check_token_age.py [days]" >&2
exit 1
