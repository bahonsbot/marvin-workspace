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
from urllib.parse import urlparse

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

class RSSMonitor:
    def __init__(self, config_file: str = "config/rss_feeds.txt"):
        self.config_file = config_file
        self.feeds = []
        self.watch_keywords = []
        self.load_config()

    @staticmethod
    def is_safe_feed_url(url: str) -> bool:
        """Allow only http/https feed URLs."""
        try:
            p = urlparse(url)
            return p.scheme in ("http", "https") and bool(p.netloc)
        except Exception:
            return False
    
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
                    feed_name = parts[0].strip()
                    feed_url = parts[1].strip()
                    if not self.is_safe_feed_url(feed_url):
                        print(f"Skipping unsafe feed URL for {feed_name}: {feed_url}")
                        continue
                    self.feeds.append({
                        'name': feed_name,
                        'url': feed_url,
                        'keywords': [k.strip().lower() for k in parts[2:]] if len(parts) > 2 else []
                    })
    
    def fetch_feed(self, url: str) -> Dict:
        """Fetch and parse an RSS/Atom feed using standard library"""
        try:
            request = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(request, timeout=15) as response:
                content = response.read()

            root = ET.fromstring(content)
            ns = {'atom': 'http://www.w3.org/2005/Atom'}

            # Get feed title (RSS then Atom)
            title_node = root.find('channel/title')
            if title_node is None:
                title_node = root.find('atom:title', ns)
            title = title_node.text if title_node is not None and title_node.text else 'Unknown'

            entries = []
            rss_items = root.findall('.//item')
            atom_items = root.findall('.//atom:entry', ns)
            items = rss_items if rss_items else atom_items

            for item in items[:10]:  # Last 10 entries
                # RSS defaults
                entry_title = item.find('title')
                entry_link = item.find('link')
                entry_desc = item.find('description')
                entry_pub = item.find('pubDate')

                title_text = unescape(entry_title.text) if entry_title is not None and entry_title.text else ''
                link_text = entry_link.text if entry_link is not None and entry_link.text else ''
                summary_text = unescape(entry_desc.text) if entry_desc is not None and entry_desc.text else ''
                pub_text = entry_pub.text if entry_pub is not None and entry_pub.text else ''

                # Atom fallback
                if not title_text:
                    atom_title = item.find('atom:title', ns)
                    if atom_title is not None and atom_title.text:
                        title_text = unescape(atom_title.text)

                if not link_text:
                    atom_link = item.find('atom:link', ns)
                    if atom_link is not None:
                        link_text = atom_link.get('href', '')

                if not summary_text:
                    atom_summary = item.find('atom:summary', ns)
                    if atom_summary is None:
                        atom_summary = item.find('atom:content', ns)
                    if atom_summary is not None and atom_summary.text:
                        summary_text = unescape(atom_summary.text)

                if not pub_text:
                    atom_pub = item.find('atom:updated', ns)
                    if atom_pub is None:
                        atom_pub = item.find('atom:published', ns)
                    if atom_pub is not None and atom_pub.text:
                        pub_text = atom_pub.text

                entries.append({
                    'title': title_text,
                    'link': link_text,
                    'summary': summary_text,
                    'published': pub_text,
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
        
        # Add new results (max 200)
        existing = results + existing
        existing = existing[:200]
        
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
