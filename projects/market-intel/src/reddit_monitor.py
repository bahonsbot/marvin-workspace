#!/usr/bin/env python3
"""
Reddit Monitor: Watches subreddits for market-relevant posts
Uses Reddit's JSON endpoints - Free, no API key needed
"""
import json
import os
import random
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

# Import context manager for cron pipeline
sys.path.insert(0, str(Path(__file__).parent))
from cron_context import CronContext


def scrub_pii(text: str) -> str:
    """Remove common PII patterns from text."""
    if not text:
        return text
    
    # Email addresses
    text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL_REDACTED]', text, flags=re.IGNORECASE)
    
    # Phone numbers (various formats)
    text = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[PHONE_REDACTED]', text)
    
    # Reddit usernames (u/username or /u/username)
    text = re.sub(r'/?u/[A-Za-z0-9_-]+', '[USER_REDACTED]', text)
    
    return text


class RedditMonitor:
    def __init__(self, quiet: bool = False):
        self.base_dir = Path(__file__).resolve().parents[1]
        self.quiet = quiet
        self.subreddits = [
            "wallstreetbets",
            "investing",
            "options",
            "StockMarket",
            "securityanalysis",
            "economics",
            "finance",
            "trading",
            "stocks",
            "ValueInvesting",
            "Daytrading",
            "Cryptocurrency",
        ]

        self.watch_keywords = [
            "earnings", "beat", "miss", "revenue", "guidance", "split", "dividend",
            "buyback", "ipo", "offering", "merger", "acquisition",
            "bank", "default", "collapse", "failure", "crisis", "bankruptcy",
            "short squeeze", "gamma squeeze", "bull", "bear",
            "options flow", "call", "put", "strike",
            "fed", "rate hike", "inflation", "cpi", "recession",
            "war", "sanction", "oil", "energy",
            "ai", "semiconductor", "chip", "nvda", "tesla",
        ]

        self.reddit_timeout = 10
        self.max_top_comments = 3
        self.fetch_top_comments = True
        self.selftext_snippet_chars = 280
        self.comment_snippet_chars = 220

    def log(self, msg: str):
        if not self.quiet:
            print(msg)

    def resolve_path(self, path: str) -> Path:
        p = Path(path)
        if p.is_absolute():
            return p
        return self.base_dir / p

    def request_json(self, url: str, timeout: int = 10) -> Dict:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "MarketIntelBot/1.1",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))

    def fetch_post_comments(self, permalink: str) -> List[str]:
        """Best-effort fetch of top comments for a post."""
        if not self.fetch_top_comments or self.max_top_comments <= 0:
            return []

        comments_url = (
            f"https://www.reddit.com{permalink}.json?raw_json=1&limit={self.max_top_comments}&sort=top"
        )

        try:
            payload = self.request_json(comments_url, timeout=self.reddit_timeout)
            if not isinstance(payload, list) or len(payload) < 2:
                return []

            children = payload[1].get("data", {}).get("children", [])
            top_comments: List[str] = []
            for child in children:
                data = child.get("data", {})
                body = (data.get("body") or "").strip()
                if body and body not in ("[removed]", "[deleted]"):
                    top_comments.append(body)
                if len(top_comments) >= self.max_top_comments:
                    break

            return top_comments
        except Exception:
            return []

    def fetch_subreddit(self, subreddit: str, limit: int = 25) -> List[Dict]:
        """Fetch newest posts from subreddit JSON endpoint."""
        url = f"https://www.reddit.com/r/{subreddit}/new/.json?limit={limit}&raw_json=1"

        try:
            data = self.request_json(url, timeout=self.reddit_timeout)
            posts = []
            for item in data.get("data", {}).get("children", []):
                post = item.get("data", {})
                permalink = post.get("permalink", "")

                created_utc = post.get("created_utc", 0)
                post_time = (
                    datetime.fromtimestamp(created_utc, tz=timezone.utc).isoformat().replace("+00:00", "Z")
                    if created_utc
                    else ""
                )

                selftext = scrub_pii((post.get("selftext") or "").strip())
                top_comments = [scrub_pii(c) for c in self.fetch_post_comments(permalink)] if permalink else []

                posts.append(
                    {
                        "title": post.get("title", ""),
                        "selftext": selftext,
                        "top_comments": top_comments,
                        "url": "https://reddit.com" + permalink if permalink else "",
                        "score": post.get("score", 0),
                        "num_comments": post.get("num_comments", 0),
                        "subreddit": post.get("subreddit", subreddit),
                        "timestamp": post_time,
                    }
                )

                # tiny jitter to avoid burst comment fetching against Reddit
                if self.fetch_top_comments:
                    time.sleep(random.uniform(0.05, 0.12))

            return posts

        except Exception as e:
            self.log(f"  ⚠ r/{subreddit}: {e}")
            return []

    @staticmethod
    def build_keyword_text(post: Dict) -> str:
        parts = [post.get("title", ""), post.get("selftext", "")]
        comments = post.get("top_comments") or []
        if comments:
            parts.append(" ".join(comments))
        return " ".join(p for p in parts if p).lower()

    def scan_subreddits(self) -> List[Dict]:
        """Scan subreddits for keyword matches across title/selftext/comments."""
        results: List[Dict] = []
        subreddit_count = len(self.subreddits)
        self.log(f"Scanning {subreddit_count} subreddits...")

        scanned_posts = 0
        posts_with_selftext = 0
        posts_with_comment_snippets = 0

        for sub in self.subreddits:
            posts = self.fetch_subreddit(sub)

            for post in posts:
                scanned_posts += 1
                if post.get("selftext"):
                    posts_with_selftext += 1
                if post.get("top_comments"):
                    posts_with_comment_snippets += 1

                text = self.build_keyword_text(post)
                for keyword in self.watch_keywords:
                    if keyword in text:
                        selftext = post.get("selftext", "")
                        top_comments = post.get("top_comments") or []
                        # Use the timestamp already in the post from fetch_subreddit (which has created_utc)
                        post_timestamp = post.get("timestamp", "")
                        results.append(
                            {
                                "subreddit": post.get("subreddit", ""),
                                "title": post.get("title", ""),
                                "selftext": selftext,
                                "selftext_snippet": selftext[: self.selftext_snippet_chars],
                                "top_comments": top_comments,
                                "top_comment_snippet": (top_comments[0] if top_comments else "")[: self.comment_snippet_chars],
                                "url": post.get("url", ""),
                                "score": post.get("score", 0),
                                "comments": post.get("num_comments", 0),
                                "keyword_matched": keyword,
                                # Use actual Reddit creation time from fetch, fallback to now only if missing
                                "timestamp": post_timestamp if post_timestamp else datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                            }
                        )
                        break

        self.log(
            f"Reddit enrichment: posts={scanned_posts}, with_selftext={posts_with_selftext}, "
            f"with_top_comments={posts_with_comment_snippets}, matches={len(results)}"
        )
        return results

    def save_results(self, results: List[Dict], output_file: str = "data/reddit_alerts.json"):
        """Save results to JSON"""
        if not results:
            return 0

        output_path = self.resolve_path(output_file)
        existing = []
        if output_path.exists():
            with output_path.open("r", encoding="utf-8") as f:
                existing = json.load(f)

        existing = results + existing
        existing = existing[:50]

        os.makedirs(output_path.parent, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2)

        return len(results)

    def run(self):
        """Run the monitor"""
        self.log("=== Reddit Market Monitor ===")
        self.log(f"Watching r/{', r/'.join(self.subreddits)}")
        self.log(f"Keywords: {len(self.watch_keywords)}")
        self.log(
            f"Enrichment: selftext=on, top_comments={'on' if self.fetch_top_comments else 'off'}({self.max_top_comments})\n"
        )

        results = self.scan_subreddits()

        if results:
            self.log(f"\n✓ Found {len(results)} relevant posts:")
            for r in results[:5]:
                self.log(f"  [r/{r['subreddit']}] {r['title'][:50]}...")
                self.log(f"    Keyword: {r.get('keyword_matched')} | ↑{r['score']}")

            count = self.save_results(results)
            self.log(f"\nSaved {count} posts to data/reddit_alerts.json")
        else:
            self.log("\nNo matching posts found.")

        # Write to shared cron context for pipeline
        self._update_cron_context(results)

        return results

    def _update_cron_context(self, results: List[Dict]) -> None:
        """Update shared cron context with this run's results."""
        try:
            ctx = CronContext.load()
            
            # Build summary
            items_found = len(results)
            if items_found > 0:
                # Extract top posts and correlations
                top_posts = [f"{r.get('title', '')[:80]} ({r.get('score', 0)} upvotes)" for r in results[:5]]
                
                # Try to find correlations with RSS (if RSS already ran this hour)
                correlations = []
                rss_summary = ctx.get_job_summary('rss-feed-monitor').lower()
                reddit_titles = ' '.join([r.get('title', '').lower() for r in results])
                
                for keyword in ['oil', 'iran', 'war', 'fed', 'jobs', 'credit', 'ai']:
                    if keyword in rss_summary and keyword in reddit_titles:
                        correlations.append(f"{keyword}: Trending on both RSS + Reddit")
                
                summary = f"{items_found} posts after enrichment. Top discussions: {', '.join(top_posts[:2])}"
                
                ctx.update_job('reddit-monitor', {
                    'last_run': datetime.now(timezone.utc).isoformat(),
                    'status': 'ok',
                    'items_found': items_found,
                    'summary': summary,
                    'context': {
                        'top_posts': top_posts,
                        'correlations_with_rss': correlations
                    }
                })
            else:
                ctx.update_job('reddit-monitor', {
                    'last_run': datetime.now(timezone.utc).isoformat(),
                    'status': 'ok',
                    'items_found': 0,
                    'summary': 'No matching posts found',
                    'context': {}
                })
            
            ctx.save()
            self.log("✓ Updated cron-context.json")
        except Exception as e:
            self.log(f"⚠️  Failed to update cron context: {e}")


if __name__ == "__main__":
    quiet = "--quiet" in sys.argv or "-q" in sys.argv
    monitor = RedditMonitor(quiet=quiet)
    monitor.run()
