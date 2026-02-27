#!/usr/bin/env python3
"""
Reddit Monitor: Watches subreddits for market-relevant posts
Uses Reddit's JSON endpoints - Free, no API key needed
"""
import urllib.request
import json
import os
from datetime import datetime
from typing import List, Dict

class RedditMonitor:
    def __init__(self):
        self.subreddits = [
            'wallstreetbets',
            'investing', 
            'options',
            'StockMarket',
            'securityanalysis'
        ]
        
        # Keywords from patterns
        self.watch_keywords = [
            'earnings', 'beat', 'miss', 'revenue', 'guidance', 'split', 'dividend',
            'buyback', 'IPO', 'offering', 'merger', 'acquisition',
            'bank', 'default', 'collapse', 'failure', 'crisis', 'bankruptcy',
            'short squeeze', 'gamma squeeze', 'bull', 'bear',
            'options flow', 'call', 'put', 'strike',
            'fed', 'rate hike', 'inflation', 'CPI', 'recession',
            'war', 'sanction', 'oil', 'energy',
            'AI', 'semiconductor', 'chip', 'NVDA', 'Tesla'
        ]
    
    def fetch_subreddit(self, subreddit: str, limit=25) -> List[Dict]:
        """Fetch hot posts from a subreddit via JSON"""
        url = f"https://www.reddit.com/r/{subreddit}/hot/.json?limit={limit}"
        
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'MarketIntelBot/1.0'
            })
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))
            
            posts = []
            for item in data['data']['children']:
                post = item['data']
                posts.append({
                    'title': post.get('title', ''),
                    'url': 'https://reddit.com' + post.get('permalink', ''),
                    'score': post.get('score', 0),
                    'num_comments': post.get('num_comments', 0),
                    'subreddit': post.get('subreddit', subreddit)
                })
            return posts
            
        except Exception as e:
            print(f"  ⚠ r/{subreddit}: {e}")
            return []
    
    def scan_subreddits(self) -> List[Dict]:
        """Scan all subreddits for relevant posts"""
        results = []
        
        print(f"Scanning {len(self.subreddits)} subreddits...")
        
        for sub in self.subreddits:
            posts = self.fetch_subreddit(sub)
            
            for post in posts:
                text = post['title'].lower()
                
                for keyword in self.watch_keywords:
                    if keyword.lower() in text:
                        results.append({
                            'subreddit': post['subreddit'],
                            'title': post['title'],
                            'url': post['url'],
                            'score': post['score'],
                            'comments': post['num_comments'],
                            'keyword_matched': keyword,
                            'timestamp': datetime.now().isoformat()
                        })
                        break
        
        return results
    
    def save_results(self, results: List[Dict], output_file: str = "data/reddit_alerts.json"):
        """Save results to JSON"""
        if not results:
            return 0
        
        existing = []
        if os.path.exists(output_file):
            with open(output_file, 'r') as f:
                existing = json.load(f)
        
        existing = results + existing
        existing = existing[:50]
        
        with open(output_file, 'w') as f:
            json.dump(existing, f, indent=2)
        
        return len(results)
    
    def run(self):
        """Run the monitor"""
        print("=== Reddit Market Monitor ===")
        print(f"Watching r/{', r/'.join(self.subreddits)}")
        print(f"Keywords: {len(self.watch_keywords)}\n")
        
        results = self.scan_subreddits()
        
        if results:
            print(f"\n✓ Found {len(results)} relevant posts:")
            for r in results[:5]:
                print(f"  [r/{r['subreddit']}] {r['title'][:50]}...")
                print(f"    Keyword: {r.get('keyword_matched')} | ↑{r['score']}")
            
            count = self.save_results(results)
            print(f"\nSaved {count} posts to data/reddit_alerts.json")
        else:
            print("\nNo matching posts found.")
        
        return results


if __name__ == "__main__":
    monitor = RedditMonitor()
    monitor.run()
