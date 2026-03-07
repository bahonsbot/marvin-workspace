#!/usr/bin/env python3
"""
News Reader PWA Server

Serves the News Reader app with proper API endpoints for RSS/Reddit data.
Avoids CORS and file path issues from direct file:// access.

Usage:
    python3 scripts/serve_news_reader.py [--port 8080] [--host 0.0.0.0]
"""
import http.server
import json
import os
import socketserver
from pathlib import Path
from urllib.parse import urlparse, parse_qs

# Resolve paths from this script's location
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
APP_DIR = PROJECT_ROOT / "app"
MARKET_INTEL_DIR = PROJECT_ROOT.parent / "market-intel" / "data"

RSS_FILE = MARKET_INTEL_DIR / "rss_alerts.json"
REDDIT_FILE = MARKET_INTEL_DIR / "reddit_alerts.json"


class NewsReaderHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler that serves the app + API endpoints."""
    
    def __init__(self, *args, **kwargs):
        # Serve from app directory
        super().__init__(*args, directory=str(APP_DIR), **kwargs)
    
    def do_GET(self):
        """Handle GET requests - serve static files or API endpoints."""
        parsed = urlparse(self.path)
        
        # API endpoint: /api/rss
        if parsed.path == '/api/rss':
            self.send_json_file(RSS_FILE)
            return
        
        # API endpoint: /api/reddit
        if parsed.path == '/api/reddit':
            self.send_json_file(REDDIT_FILE)
            return
        
        # API endpoint: /api/combined (returns merged RSS + Reddit)
        if parsed.path == '/api/combined':
            self.send_combined_feed()
            return
        
        # Health check
        if parsed.path == '/api/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {
                'status': 'ok',
                'rss_file': str(RSS_FILE),
                'reddit_file': str(REDDIT_FILE),
                'rss_exists': RSS_FILE.exists(),
                'reddit_exists': REDDIT_FILE.exists(),
            }
            self.wfile.write(json.dumps(response).encode())
            return
        
        # Serve static files (index.html, CSS, JS)
        super().do_GET()
    
    def send_json_file(self, file_path: Path):
        """Send a JSON file with proper headers."""
        try:
            if not file_path.exists():
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'File not found'}).encode())
                return
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')  # CORS for local dev
            self.end_headers()
            self.wfile.write(json.dumps(data, indent=2).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
    
    def send_combined_feed(self):
        """Send combined and normalized RSS + Reddit feed."""
        try:
            rss_data = []
            reddit_data = []
            
            if RSS_FILE.exists():
                with open(RSS_FILE, 'r', encoding='utf-8') as f:
                    rss_data = json.load(f)
            
            if REDDIT_FILE.exists():
                with open(REDDIT_FILE, 'r', encoding='utf-8') as f:
                    reddit_data = json.load(f)
            
            # Normalize and combine (same logic as index.html)
            combined = [
                *rss_data,
                *reddit_data
            ]
            
            # Sort by timestamp (newest first)
            combined.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(combined, indent=2).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
    
    def log_message(self, format, *args):
        """Custom log format."""
        print(f"[{self.log_date_time_string()}] {args[0]}")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='News Reader PWA Server')
    parser.add_argument('--port', type=int, default=8080, help='Port to serve on (default: 8080)')
    parser.add_argument('--host', default='127.0.0.1', help='Host to bind to (default: 127.0.0.1)')
    args = parser.parse_args()
    
    # Verify data files exist
    print("=== Market Intel News Reader Server ===\n")
    print(f"RSS file: {RSS_FILE}")
    print(f"  Exists: {RSS_FILE.exists()}")
    if RSS_FILE.exists():
        with open(RSS_FILE) as f:
            rss_count = len(json.load(f))
        print(f"  Items: {rss_count}")
    
    print(f"\nReddit file: {REDDIT_FILE}")
    print(f"  Exists: {REDDIT_FILE.exists()}")
    if REDDIT_FILE.exists():
        with open(REDDIT_FILE) as f:
            reddit_count = len(json.load(f))
        print(f"  Items: {reddit_count}")
    
    print(f"\nServing app from: {APP_DIR}")
    print(f"\nEndpoints:")
    print(f"  App:        http://{args.host}:{args.port}/")
    print(f"  RSS API:    http://{args.host}:{args.port}/api/rss")
    print(f"  Reddit API: http://{args.host}:{args.port}/api/reddit")
    print(f"  Combined:   http://{args.host}:{args.port}/api/combined")
    print(f"  Health:     http://{args.host}:{args.port}/api/health")
    print(f"\nPress Ctrl+C to stop\n")
    
    with socketserver.TCPServer((args.host, args.port), NewsReaderHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")


if __name__ == "__main__":
    main()
