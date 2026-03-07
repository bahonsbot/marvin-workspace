#!/bin/bash
# Build script for GitHub Pages deployment
# Copies RSS/Reddit data into app/ folder for static hosting

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."
APP_DIR="$PROJECT_ROOT/app"
MARKET_INTEL_DATA="$PROJECT_ROOT/../market-intel/data"

echo "=== Building News Reader for GitHub Pages ==="
echo ""

# Copy data files to app directory
echo "Copying RSS alerts..."
cp "$MARKET_INTEL_DATA/rss_alerts.json" "$APP_DIR/rss_alerts.json"

echo "Copying Reddit alerts..."
cp "$MARKET_INTEL_DATA/reddit_alerts.json" "$APP_DIR/reddit_alerts.json"

# Update index.html to use local paths
echo "Updating index.html to use local paths..."
sed -i.bak "s|const rssPath = '/api/rss';|const rssPath = './rss_alerts.json';|g" "$APP_DIR/index.html"
sed -i.bak "s|const redditPath = '/api/reddit';|const redditPath = './reddit_alerts.json';|g" "$APP_DIR/index.html"

# Clean up backup files
rm -f "$APP_DIR/index.html.bak"

echo ""
echo "✓ Build complete!"
echo ""
echo "Files ready for GitHub Pages:"
echo "  - $APP_DIR/index.html"
echo "  - $APP_DIR/rss_alerts.json ($(wc -c < "$APP_DIR/rss_alerts.json") bytes)"
echo "  - $APP_DIR/reddit_alerts.json ($(wc -c < "$APP_DIR/reddit_alerts.json") bytes)"
echo ""
echo "Next steps:"
echo "1. Push the app/ folder to your GitHub Pages branch"
echo "2. Or test locally: cd $APP_DIR && python3 -m http.server 8080"
echo "3. Open: http://localhost:8080"
