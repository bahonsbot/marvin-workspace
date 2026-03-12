#!/bin/bash
#
# check-token-age.sh - Check if tokens have exceeded the maximum age threshold
#
# DEPRECATED: This script is no longer maintained.
# Use Python equivalent: scripts/check_token_age.py
#
# Migration:
#   python3 scripts/check_token_age.py [days]
#

set -euo pipefail

echo "This script is deprecated. Please use: python3 scripts/check_token_age.py"
echo "Falling back to Python implementation..."

python3 "$(dirname "$0")/check_token_age.py" "$@"