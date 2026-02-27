#!/usr/bin/env python3
"""
RSS Feed Monitor: Fetches financial news feeds and flags relevant content
Uses standard library only (no external dependencies)
"""
import urllib.request
import xml.etree.ElementTree as ET
import re
import json
import os
from datetime import datetime
from typing import List, Dict
from html import unescape

class RSSMonitor:
    def __init__(self, config_file: str = "config/rss_feeds.txt"):
        self.config_file = config_file
        self.feeds = []
        self.watch_keywords = []
        self.load_config()
    
    def load_config(self):
        """Load feeds and keywords from config file"""
        with open(self.config_file, 'r') as f:
            content = f.read()
        
        # Parse feeds
        in_keywords = False
        for line in content.split('\n'):
            line = line.strip()
            
            if line.startswith('WATCH_KEYWORDS:'):
                in_keywords = True
                continue
            
            if in_keywords and line:
                self.watch_keywords.extend([k.strip().lower() for k in line.split(',')])
            
            if line and not line.startswith('#') and not in_keywords:
                parts = line.split(',')
                if len(parts) >= 2:
                    self.feeds.append({
                        'name': parts[0].strip(),
                        'url': parts[1].strip(),
                        'keywords': [k.strip().lower() for k in parts[2:]] if len(parts) > 2 else []
                    })
    
    def fetch_feed(self, url: str) -> Dict:
        """Fetch and parse an RSS feed using standard library"""
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                content = response.read().decode('utf-8')
            
            root = ET.fromstring(content)
            
            # Get feed title
            title = root.find('channel/title')
            title = title.text if title is not None else 'Unknown'
            
            entries = []
            for item in root.findall('.//item')[:10]:  # Last 10 entries
                entry_title = item.find('title')
                entry_link = item.find('link')
                entry_desc = item.find('description')
                entry_pub = item.find('pubDate')
                
                entries.append({
                    'title': unescape(entry_title.text) if entry_title is not None else '',
                    'link': entry_link.text if entry_link is not None else '',
                    'summary': unescape(entry_desc.text) if entry_desc is not None else '',
                    'published': entry_pub.text if entry_pub is not None else '',
                })
            
            return {'title': title, 'entries': entries}
            
        except Exception as e:
            return {'title': 'Error', 'error': str(e), 'entries': []}
    
    def check_keywords(self, text: str) -> List[str]:
        """Check if any keywords match in text"""
        text_lower = text.lower()
        matches = []
        for keyword in self.watch_keywords:
            if keyword in text_lower:
                matches.append(keyword)
        return matches
    
    def scan_feeds(self) -> List[Dict]:
        """Scan all feeds and return matching entries"""
        results = []
        
        print(f"Scanning {len(self.feeds)} feeds for {len(self.watch_keywords)} keywords...")
        
        for feed_info in self.feeds:
            feed_data = self.fetch_feed(feed_info['url'])
            
            if 'error' in feed_data:
                print(f"  ⚠ {feed_info['name']}: {feed_data['error']}")
                continue
            
            for entry in feed_data['entries']:
                # Combine title and summary for checking
                text = f"{entry['title']} {entry['summary']}"
                matches = self.check_keywords(text)
                
                if matches:
                    results.append({
                        'feed': feed_info['name'],
                        'title': entry['title'],
                        'link': entry['link'],
                        'published': entry['published'],
                        'matched_keywords': matches,
                        'timestamp': datetime.now().isoformat()
                    })
        
        return results
    
    def save_results(self, results: List[Dict], output_file: str = "data/rss_alerts.json"):
        """Save results to JSON file"""
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        # Load existing
        existing = []
        if os.path.exists(output_file):
            with open(output_file, 'r') as f:
                existing = json.load(f)
        
        # Add new results (max 50)
        existing = results + existing
        existing = existing[:50]
        
        with open(output_file, 'w') as f:
            json.dump(existing, f, indent=2)
        
        return len(results)
    
    def run(self):
        """Run the RSS monitor"""
        print("=== RSS Feed Monitor ===")
        print(f"Watching {len(self.watch_keywords)} keywords across {len(self.feeds)} feeds\n")
        
        results = self.scan_feeds()
        
        if results:
            print(f"\n✓ Found {len(results)} matching entries:")
            for r in results[:5]:  # Show top 5
                print(f"  [{r['feed']}] {r['title'][:60]}...")
                print(f"    Keywords: {', '.join(r['matched_keywords'])}")
            
            count = self.save_results(results)
            print(f"\nSaved {count} alerts to data/rss_alerts.json")
        else:
            print("\nNo matching entries found.")
        
        return results


if __name__ == "__main__":
    import sys
    
    quiet = '--quiet' in sys.argv or '-q' in sys.argv
    
    monitor = RSSMonitor()
    results = monitor.run()
    
    if not quiet:
        print("\n=== Matching Alerts ===")
        for r in results:
            print(f"[{r['matched_keywords']}] {r['title'][:70]}")
