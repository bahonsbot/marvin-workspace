#!/usr/bin/env python3
"""
Generate news feed from RSS and Reddit alerts for the Market Intel News Reader
"""
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

def load_alerts():
    """Load RSS and Reddit alerts"""
    rss_alerts = []
    reddit_alerts = []
    
    # Try to load cached RSS data
    if os.path.exists('projects/market-intel/data/rss_alerts.json'):
        with open('projects/market-intel/data/rss_alerts.json', 'r') as f:
            rss_alerts = json.load(f)
    
    # Also try fresh from RSS monitor's config
    if not rss_alerts:
        # Load directly from RSS config and fetch
        rss_alerts = fetch_all_rss_feeds()
    
    if os.path.exists('projects/market-intel/data/reddit_alerts.json'):
        with open('projects/market-intel/data/reddit_alerts.json', 'r') as f:
            reddit_alerts = json.load(f)
    
    return rss_alerts, reddit_alerts

def fetch_all_rss_feeds():
    """Fetch directly from RSS feeds for the news reader"""
    import urllib.request
    
    feeds_config = [
        ('Business', 'https://rss.app/feeds/J4g3h9IgJtdC9DFI.xml'),
        ('FinancialJuice', 'https://rss.app/feeds/mZ8QxKASBRr35JlU.xml'),
        ('ZeroHedge', 'https://rss.app/feeds/2pl8vwqzm5ByJ2Zf.xml'),
        ('Reuters', 'https://rss.app/feeds/T0vT7xQ2IYsN1tuW.xml'),
    ]
    
    alerts = []
    
    for name, url in feeds_config:
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                import xml.etree.ElementTree as ET
                root = ET.fromstring(response.read())
                for item in root.findall('.//item')[:10]:
                    title = item.find('title')
                    link = item.find('link')
                    alerts.append({
                        'title': title.text if title is not None else '',
                        'link': link.text if link is not None else '',
                        'feed': name,
                        'timestamp': datetime.now().isoformat()
                    })
        except Exception as e:
            print(f"  ⚠ {name}: {e}")
    
    return alerts

def categorize_alert(alert):
    """Categorize alert based on keywords"""
    text = f"{alert.get('title', '')} {alert.get('summary', '')}".lower()
    
    categories = {
        'geopolitical': ['war', 'invasion', 'russia', 'ukraine', 'china', 'iran', 'israel', 'sanction', 'military', 'conflict', 'troops'],
        'financial': ['bank', 'svb', 'default', 'crisis', 'credit', 'fed', 'interest', 'rate'],
        'macro': ['inflation', 'cpi', 'gdp', 'recession', 'economy', 'market'],
        'corporate': ['earnings', 'revenue', 'acquisition', 'merger', 'ipo', 'stock split', 'dividend'],
        'sentiment': ['reddit', 'wsb', 'wallstreetbets', 'meme', 'short squeeze', 'gme']
    }
    
    matched = []
    for cat, keywords in categories.items():
        for kw in keywords:
            if kw in text:
                matched.append(cat)
                break
    
    return matched if matched else ['other']

def transform_rss_alert(alert):
    """Transform RSS alert to feed format"""
    categories = categorize_alert(alert)
    
    return {
        'id': f"rss_{alert.get('timestamp', '').replace(':', '').replace('.', '')}",
        'title': alert.get('title', '')[:150],
        'summary': alert.get('summary', '')[:200] if alert.get('summary') else '',
        'url': alert.get('link', ''),
        'source': f"RSS: {alert.get('feed', 'unknown')}",
        'category': categories,
        'published': alert.get('published', ''),
        'timestamp': alert.get('timestamp', ''),
        'type': 'rss'
    }

def transform_reddit_alert(alert):
    """Transform Reddit alert to feed format"""
    categories = categorize_alert(alert)
    
    return {
        'id': f"reddit_{alert.get('timestamp', '').replace(':', '').replace('.', '')}",
        'title': alert.get('title', '')[:150],
        'summary': f"{alert.get('score', 0)} upvotes | {alert.get('comments', 0)} comments",
        'url': alert.get('url', ''),
        'source': f"Reddit: r/{alert.get('subreddit', 'unknown')}",
        'category': categories,
        'published': alert.get('timestamp', ''),
        'timestamp': alert.get('timestamp', ''),
        'type': 'reddit',
        'score': alert.get('score', 0)
    }

def generate_feed():
    """Generate the news feed"""
    rss_alerts, reddit_alerts = load_alerts()
    
    feed_items = []
    
    # Transform RSS alerts
    for alert in rss_alerts[:50]:  # Last 50
        feed_items.append(transform_rss_alert(alert))
    
    # Transform Reddit alerts
    for alert in reddit_alerts[:30]:  # Last 30
        feed_items.append(transform_reddit_alert(alert))
    
    # Sort by timestamp
    feed_items.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    
    # Take last 50
    feed_items = feed_items[:50]
    
    # Create feed output
    feed = {
        'version': '1.0',
        'generated': datetime.now().isoformat(),
        'categories': ['geopolitical', 'financial', 'macro', 'corporate', 'sentiment', 'other'],
        'items': feed_items,
        'stats': {
            'total': len(feed_items),
            'rss': len([x for x in feed_items if x['type'] == 'rss']),
            'reddit': len([x for x in feed_items if x['type'] == 'reddit'])
        }
    }
    
    return feed

def main():
    print("=== Generating Market Intel News Feed ===")
    
    feed = generate_feed()
    
    # Save to news reader project
    output_dir = Path('projects/market-intel-news-reader')
    output_dir.mkdir(parents=True, exist_ok=True)
    
    output_file = output_dir / 'news_feed.json'
    with open(output_file, 'w') as f:
        json.dump(feed, f, indent=2)
    
    print(f"✓ Generated {feed['stats']['total']} items")
    print(f"  RSS: {feed['stats']['rss']}")
    print(f"  Reddit: {feed['stats']['reddit']}")
    print(f"  Saved to: {output_file}")

if __name__ == "__main__":
    main()
