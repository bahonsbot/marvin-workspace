#!/bin/bash
# Auto-rebuild News Reader PWA with latest data
# Run this hourly via cron to keep the app fresh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Rebuild the app with latest RSS/Reddit data
./scripts/build_for_github_pages.sh > /tmp/news-reader-rebuild.log 2>&1

# Restart the server if it's not running
if ! pgrep -f "http.server 8081" > /dev/null; then
    cd app
    nohup python3 -m http.server 8081 > /tmp/news-reader-server.log 2>&1 &
    echo "Restarted News Reader server on port 8081" >> /tmp/news-reader-rebuild.log
fi
