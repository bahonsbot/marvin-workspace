#!/usr/bin/env python3
"""
Generate a combined RSS + Reddit feed for the Market Intel News Reader.

Design goals:
- Work regardless of current working directory (cron-safe)
- Prefer cached alerts from projects/market-intel/data
- Gracefully recover when upstream fetches fail or are rate-limited
- Keep dependencies to Python standard library only
"""
import json
import os
import random
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/123.0.0.0 Safari/537.36 "
    "MarketIntelNewsReader/1.1"
)

RSS_FALLBACK_FEEDS = [
    ("Business", "https://rss.app/feeds/J4g3h9IgJtdC9DFI.xml"),
    ("FinancialJuice", "https://rss.app/feeds/mZ8QxKASBRr35JlU.xml"),
    ("ZeroHedge", "https://rss.app/feeds/2pl8vwqzm5ByJ2Zf.xml"),
    ("Reuters", "https://rss.app/feeds/T0vT7xQ2IYsN1tuW.xml"),
    ("MarketWatch", "https://feeds.marketwatch.com/marketwatch/topstories/"),
    ("TechCrunch", "https://techcrunch.com/feed/"),
    ("YahooFinance", "https://finance.yahoo.com/news/rssindex"),
]

REDDIT_SUBREDDITS = [
    "wallstreetbets",
    "investing",
    "options",
    "StockMarket",
    "securityanalysis",
]


def now_iso() -> str:
    from datetime import timezone
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def safe_load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def extract_text(el: Optional[ET.Element], default: str = "") -> str:
    if el is None:
        return default
    if el.text:
        return el.text.strip()
    return default


class FeedGenerator:
    def __init__(self):
        self.script_path = Path(__file__).resolve()
        self.project_root = self.script_path.parents[1]  # market-intel-news-reader
        self.workspace_root = self.script_path.parents[3]  # /data/.openclaw/workspace
        self.market_intel_root = self.workspace_root / "projects" / "market-intel"

        self.rss_alerts_path = self.market_intel_root / "data" / "rss_alerts.json"
        self.reddit_alerts_path = self.market_intel_root / "data" / "reddit_alerts.json"

        self.output_file = self.project_root / "news_feed.json"
        self.cache_dir = self.project_root / "cache"
        self.cache_file = self.cache_dir / "rss_fetch_cache.json"

    def request_bytes(
        self,
        url: str,
        timeout: int = 12,
        retries: int = 3,
        backoff_seconds: float = 1.5,
    ) -> Optional[bytes]:
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml, application/xml, application/json, text/xml, */*",
            "Accept-Language": "en-US,en;q=0.9",
        }

        for attempt in range(retries):
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=timeout) as response:
                    return response.read()
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    wait_time = backoff_seconds * (2 ** attempt) + random.uniform(0.1, 0.5)
                    print(f"  ⚠ 429 rate-limited: {url} (retry in {wait_time:.1f}s)")
                    time.sleep(wait_time)
                    continue
                if 500 <= e.code <= 599 and attempt < retries - 1:
                    wait_time = backoff_seconds * (2 ** attempt)
                    print(f"  ⚠ HTTP {e.code}: {url} (retry in {wait_time:.1f}s)")
                    time.sleep(wait_time)
                    continue
                print(f"  ⚠ HTTP {e.code}: {url}")
                return None
            except Exception as e:
                if attempt < retries - 1:
                    wait_time = backoff_seconds * (2 ** attempt)
                    print(f"  ⚠ fetch error: {url} ({e}) retry in {wait_time:.1f}s")
                    time.sleep(wait_time)
                else:
                    print(f"  ⚠ fetch error: {url} ({e})")
                    return None

        return None

    def parse_feed_xml(self, content: bytes, feed_name: str, max_items: int = 8) -> List[Dict]:
        alerts: List[Dict] = []
        root = ET.fromstring(content)

        # RSS format
        rss_items = root.findall(".//item")
        if rss_items:
            for item in rss_items[:max_items]:
                title = extract_text(item.find("title"))
                link = extract_text(item.find("link"))
                summary = extract_text(item.find("description"))
                published = extract_text(item.find("pubDate"))
                if not title:
                    continue
                alerts.append(
                    {
                        "title": title,
                        "summary": summary,
                        "link": link,
                        "feed": feed_name,
                        "published": published,
                        "timestamp": now_iso(),
                    }
                )
            return alerts

        # Atom fallback
        atom_entries = root.findall(".//{http://www.w3.org/2005/Atom}entry")
        for entry in atom_entries[:max_items]:
            title = extract_text(entry.find("{http://www.w3.org/2005/Atom}title"))
            summary = extract_text(entry.find("{http://www.w3.org/2005/Atom}summary"))
            if not summary:
                summary = extract_text(entry.find("{http://www.w3.org/2005/Atom}content"))
            updated = extract_text(entry.find("{http://www.w3.org/2005/Atom}updated"))

            link = ""
            for link_node in entry.findall("{http://www.w3.org/2005/Atom}link"):
                href = link_node.attrib.get("href")
                rel = link_node.attrib.get("rel", "alternate")
                if href and rel == "alternate":
                    link = href
                    break
                if href and not link:
                    link = href

            if not title:
                continue

            alerts.append(
                {
                    "title": title,
                    "summary": summary,
                    "link": link,
                    "feed": feed_name,
                    "published": updated,
                    "timestamp": now_iso(),
                }
            )

        return alerts

    def load_rss_cache(self) -> Dict:
        return safe_load_json(self.cache_file, {"updated": "", "items": []})

    def save_rss_cache(self, items: List[Dict]):
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        with self.cache_file.open("w", encoding="utf-8") as f:
            json.dump({"updated": now_iso(), "items": items}, f, indent=2)

    def fetch_all_rss_feeds(self) -> List[Dict]:
        print("Fetching fallback RSS feeds...")

        alerts: List[Dict] = []
        for name, url in RSS_FALLBACK_FEEDS:
            content = self.request_bytes(url)
            if not content:
                continue
            try:
                alerts.extend(self.parse_feed_xml(content, name))
            except Exception as e:
                print(f"  ⚠ parse error ({name}): {e}")
            time.sleep(0.6)  # gentle pacing for upstream limits

        # Dedupe by (title, link)
        deduped = {}
        for item in alerts:
            key = (item.get("title", ""), item.get("link", ""))
            deduped[key] = item

        output = list(deduped.values())

        if output:
            self.save_rss_cache(output)
            return output

        # Last resort: return cached fallback if available
        cached = self.load_rss_cache().get("items", [])
        if cached:
            print(f"  ⚠ using cached RSS fallback ({len(cached)} items)")
            return cached

        return []

    def fetch_reddit_json(self, subreddit: str, limit: int = 12) -> List[Dict]:
        # Use /new/ instead of /hot/ to get truly newest posts by creation time
        url = f"https://www.reddit.com/r/{subreddit}/new/.json?limit={limit}&raw_json=1"
        content = self.request_bytes(url, timeout=10, retries=3)
        if not content:
            return []

        try:
            data = json.loads(content.decode("utf-8"))
        except Exception as e:
            print(f"  ⚠ reddit JSON parse ({subreddit}): {e}")
            return []

        items = []
        for child in data.get("data", {}).get("children", []):
            post = child.get("data", {})
            title = post.get("title", "")
            permalink = post.get("permalink", "")
            if not title or not permalink:
                continue
            
            # Use Reddit's actual creation time, not fetch time
            created_utc = post.get("created_utc", 0)
            post_timestamp = datetime.utcfromtimestamp(created_utc).isoformat() + "Z" if created_utc else now_iso()
            
            selftext = (post.get("selftext") or "").strip()
            items.append(
                {
                    "subreddit": post.get("subreddit", subreddit),
                    "title": title,
                    "selftext": selftext,
                    "selftext_snippet": selftext[:280],
                    "top_comment_snippet": "",
                    "url": "https://reddit.com" + permalink,
                    "score": post.get("score", 0),
                    "comments": post.get("num_comments", 0),
                    "timestamp": post_timestamp,
                    "published": post_timestamp,  # For relative time display
                }
            )

        return items

    def fetch_reddit_rss(self, subreddit: str, limit: int = 8) -> List[Dict]:
        url = f"https://www.reddit.com/r/{subreddit}/.rss"
        content = self.request_bytes(url, timeout=12, retries=2)
        if not content:
            return []

        try:
            parsed = self.parse_feed_xml(content, f"r/{subreddit}", max_items=limit)
        except Exception as e:
            print(f"  ⚠ reddit RSS parse ({subreddit}): {e}")
            return []

        items = []
        for entry in parsed:
            # Use the entry's published date if available
            pub_date = entry.get("published", "")
            items.append(
                {
                    "subreddit": subreddit,
                    "title": entry.get("title", ""),
                    "selftext": "",
                    "selftext_snippet": "",
                    "top_comment_snippet": "",
                    "url": entry.get("link", ""),
                    "score": 0,
                    "comments": 0,
                    "timestamp": pub_date or now_iso(),
                    "published": pub_date or now_iso(),
                }
            )
        return items

    def fetch_reddit_alerts(self) -> List[Dict]:
        print("Fetching Reddit fallback feed...")
        alerts: List[Dict] = []

        for sub in REDDIT_SUBREDDITS:
            posts = self.fetch_reddit_json(sub)
            if not posts:
                posts = self.fetch_reddit_rss(sub)
            alerts.extend(posts)
            time.sleep(0.8)

        # Dedupe by URL
        deduped = {}
        for post in alerts:
            key = post.get("url", "")
            if key:
                deduped[key] = post

        return list(deduped.values())

    def load_alerts(self) -> Tuple[List[Dict], List[Dict]]:
        rss_alerts = safe_load_json(self.rss_alerts_path, [])
        reddit_alerts = safe_load_json(self.reddit_alerts_path, [])

        # If upstream monitor data is missing/empty, self-heal with fallback fetch.
        if len(rss_alerts) < 10:
            fetched_rss = self.fetch_all_rss_feeds()
            if fetched_rss:
                rss_alerts = fetched_rss

        if len(reddit_alerts) < 5:
            fetched_reddit = self.fetch_reddit_alerts()
            if fetched_reddit:
                reddit_alerts = fetched_reddit

        return rss_alerts, reddit_alerts


def categorize_alert(alert: Dict) -> List[str]:
    text = (
        f"{alert.get('title', '')} {alert.get('summary', '')} "
        f"{alert.get('selftext', '')} {alert.get('selftext_snippet', '')} {alert.get('top_comment_snippet', '')}"
    ).lower()

    categories = {
        "geopolitical": ["war", "invasion", "russia", "ukraine", "china", "iran", "israel", "sanction", "military", "conflict", "troops", "nato", "putin", "biden", "trump"],
        "financial": ["bank", "svb", "default", "crisis", "credit", "fed", "interest", "rate", "deposit", "liquidity", "spread", "yield", "treasury", "bond"],
        "macro": ["inflation", "cpi", "pce", "gdp", "recession", "economy", "market", "unemployment", "jobs", "consumer", "retail", "manufacturing"],
        "corporate": ["earnings", "revenue", "acquisition", "merger", "ipo", "stock split", "dividend", "guidance", "forecast", "buyout", "takeover"],
        "sentiment": ["reddit", "wsb", "wallstreetbets", "meme", "short squeeze", "gme", "gamestop", "gamma squeeze", "call buying", "retail traders", "days to cover", "short interest", "navy", " AMC", "bed bath", "BBBY", "robinhood", "options activity", "squeeze", "calls", "calls surge", "wallstreetbets"],
    }

    matched = []
    for cat, keywords in categories.items():
        if any(kw in text for kw in keywords):
            matched.append(cat)

    return matched if matched else ["other"]


def transform_rss_alert(alert: Dict) -> Dict:
    ts = alert.get("timestamp", now_iso())
    article_excerpt = (alert.get("article_excerpt") or "")[:280]
    summary = alert.get("summary", "")[:240]
    if article_excerpt:
        summary = (summary + " | " if summary else "") + f"Excerpt: {article_excerpt}"

    return {
        "id": f"rss_{ts.replace(':', '').replace('.', '')}",
        "title": alert.get("title", "")[:150],
        "summary": summary[:450],
        "url": alert.get("link", ""),
        "source": f"RSS: {alert.get('feed', 'unknown')}",
        "category": categorize_alert(alert),
        "published": alert.get("published", ""),
        "timestamp": ts,
        "type": "rss",
        "enriched_text_source": alert.get("enriched_text_source", "headline_only"),
        "article_excerpt": article_excerpt,
    }


def transform_reddit_alert(alert: Dict) -> Dict:
    ts = alert.get("timestamp", now_iso())
    selftext_snippet = (alert.get("selftext_snippet") or alert.get("selftext") or "")[:280]
    top_comment_snippet = (alert.get("top_comment_snippet") or "")[:220]

    summary_parts = [f"{alert.get('score', 0)} upvotes", f"{alert.get('comments', 0)} comments"]
    if selftext_snippet:
        summary_parts.append(f"Post: {selftext_snippet}")
    if top_comment_snippet:
        summary_parts.append(f"Top comment: {top_comment_snippet}")

    return {
        "id": f"reddit_{ts.replace(':', '').replace('.', '')}",
        "title": alert.get("title", "")[:150],
        "summary": " | ".join(summary_parts)[:450],
        "url": alert.get("url", ""),
        "source": f"Reddit: r/{alert.get('subreddit', 'unknown')}",
        "category": categorize_alert(alert),
        "published": ts,
        "timestamp": ts,
        "type": "reddit",
        "score": alert.get("score", 0),
        "selftext_snippet": selftext_snippet,
        "top_comment_snippet": top_comment_snippet,
    }


def generate_feed() -> Dict:
    generator = FeedGenerator()
    rss_alerts, reddit_alerts = generator.load_alerts()

    feed_items = []
    feed_items.extend(transform_rss_alert(a) for a in rss_alerts[:60])
    feed_items.extend(transform_reddit_alert(a) for a in reddit_alerts[:40])

    # Keep valid URL-bearing entries only
    feed_items = [x for x in feed_items if x.get("title") and x.get("url")]
    feed_items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    feed_items = feed_items[:80]

    return {
        "version": "1.1",
        "generated": now_iso(),
        "categories": ["geopolitical", "financial", "macro", "corporate", "sentiment", "other"],
        "items": feed_items,
        "stats": {
            "total": len(feed_items),
            "rss": len([x for x in feed_items if x["type"] == "rss"]),
            "reddit": len([x for x in feed_items if x["type"] == "reddit"]),
        },
    }


def main():
    print("=== Generating Market Intel News Feed ===")

    generator = FeedGenerator()
    feed = generate_feed()

    generator.project_root.mkdir(parents=True, exist_ok=True)
    with generator.output_file.open("w", encoding="utf-8") as f:
        json.dump(feed, f, indent=2)

    print(f"✓ Generated {feed['stats']['total']} items")
    print(f"  RSS: {feed['stats']['rss']}")
    print(f"  Reddit: {feed['stats']['reddit']}")
    print(f"  Saved to: {generator.output_file}")


if __name__ == "__main__":
    main()
