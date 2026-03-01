#!/usr/bin/env python3
"""
RSS Feed Monitor: Fetches financial news feeds and flags relevant content.
Best-effort article enrichment is capped and safe by default.
"""
import ipaddress
import json
import os
import random
import re
import socket
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urlparse

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"


class RSSMonitor:
    def __init__(self, config_file: str = "config/rss_feeds.txt", quiet: bool = False):
        self.base_dir = Path(__file__).resolve().parents[1]
        self.config_file = self.resolve_path(config_file)
        self.quiet = quiet
        self.feeds: List[Dict] = []
        self.watch_keywords: List[str] = []

        # conservative enrichment limits
        self.max_entries_per_feed = 10
        self.max_enriched_articles_per_run = 20
        self.max_article_chars = 2500
        self.max_response_bytes = 350_000
        self.enrich_timeout = 7
        self.enrich_retries = 2

        self.load_config()

    def log(self, msg: str):
        if not self.quiet:
            print(msg)

    def resolve_path(self, path: str) -> Path:
        p = Path(path)
        if p.is_absolute():
            return p
        return self.base_dir / p

    @staticmethod
    def is_safe_feed_url(url: str) -> bool:
        """Allow only http/https URLs."""
        try:
            p = urlparse(url)
            return p.scheme in ("http", "https") and bool(p.netloc)
        except Exception:
            return False

    @staticmethod
    def _is_safe_host(hostname: str) -> bool:
        """Reject localhost/private/link-local destinations to reduce SSRF risk."""
        if not hostname:
            return False
        lowered = hostname.lower()
        if lowered in {"localhost", "127.0.0.1", "::1"}:
            return False

        try:
            infos = socket.getaddrinfo(hostname, None)
        except Exception:
            return False

        for info in infos:
            ip_str = info[4][0]
            try:
                ip_obj = ipaddress.ip_address(ip_str)
                if (
                    ip_obj.is_private
                    or ip_obj.is_loopback
                    or ip_obj.is_link_local
                    or ip_obj.is_multicast
                    or ip_obj.is_unspecified
                    or ip_obj.is_reserved
                ):
                    return False
            except Exception:
                return False
        return True

    def is_safe_article_url(self, url: str) -> bool:
        if not self.is_safe_feed_url(url):
            return False
        try:
            host = urlparse(url).hostname or ""
            return self._is_safe_host(host)
        except Exception:
            return False

    @staticmethod
    def sanitize_html_to_text(html_text: str) -> str:
        text = re.sub(r"(?is)<(script|style|noscript).*?>.*?</\1>", " ", html_text)
        text = re.sub(r"(?i)<br\s*/?>", "\n", text)
        text = re.sub(r"(?is)</p>", "\n", text)
        text = re.sub(r"(?is)<.*?>", " ", text)
        text = unescape(text)
        text = text.replace("\xa0", " ")
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def load_config(self):
        """Load feeds and keywords from config file"""
        with self.config_file.open("r", encoding="utf-8") as f:
            content = f.read()

        in_keywords = False
        for line in content.split("\n"):
            line = line.strip()

            if line.startswith("WATCH_KEYWORDS:"):
                in_keywords = True
                continue

            if in_keywords and line:
                self.watch_keywords.extend([k.strip().lower() for k in line.split(",") if k.strip()])

            if line and not line.startswith("#") and not in_keywords:
                parts = line.split(",")
                if len(parts) >= 2:
                    feed_name = parts[0].strip()
                    feed_url = parts[1].strip()
                    if not self.is_safe_feed_url(feed_url):
                        self.log(f"Skipping unsafe feed URL for {feed_name}: {feed_url}")
                        continue
                    self.feeds.append(
                        {
                            "name": feed_name,
                            "url": feed_url,
                            "keywords": [k.strip().lower() for k in parts[2:] if k.strip()],
                        }
                    )

    def fetch_feed(self, url: str) -> Dict:
        """Fetch and parse an RSS/Atom feed using standard library"""
        try:
            request = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(request, timeout=15) as response:
                content = response.read()

            root = ET.fromstring(content)
            ns = {"atom": "http://www.w3.org/2005/Atom"}

            title_node = root.find("channel/title")
            if title_node is None:
                title_node = root.find("atom:title", ns)
            title = title_node.text if title_node is not None and title_node.text else "Unknown"

            entries = []
            rss_items = root.findall(".//item")
            atom_items = root.findall(".//atom:entry", ns)
            items = rss_items if rss_items else atom_items

            for item in items[: self.max_entries_per_feed]:
                entry_title = item.find("title")
                entry_link = item.find("link")
                entry_desc = item.find("description")
                entry_pub = item.find("pubDate")

                title_text = unescape(entry_title.text) if entry_title is not None and entry_title.text else ""
                link_text = entry_link.text if entry_link is not None and entry_link.text else ""
                summary_text = unescape(entry_desc.text) if entry_desc is not None and entry_desc.text else ""
                pub_text = entry_pub.text if entry_pub is not None and entry_pub.text else ""

                if not title_text:
                    atom_title = item.find("atom:title", ns)
                    if atom_title is not None and atom_title.text:
                        title_text = unescape(atom_title.text)

                if not link_text:
                    atom_link = item.find("atom:link", ns)
                    if atom_link is not None:
                        link_text = atom_link.get("href", "")

                if not summary_text:
                    atom_summary = item.find("atom:summary", ns) or item.find("atom:content", ns)
                    if atom_summary is not None and atom_summary.text:
                        summary_text = unescape(atom_summary.text)

                if not pub_text:
                    atom_pub = item.find("atom:updated", ns) or item.find("atom:published", ns)
                    if atom_pub is not None and atom_pub.text:
                        pub_text = atom_pub.text

                entries.append(
                    {
                        "title": title_text,
                        "link": link_text,
                        "summary": summary_text,
                        "published": pub_text,
                    }
                )

            return {"title": title, "entries": entries}

        except Exception as e:
            return {"title": "Error", "error": str(e), "entries": []}

    def fetch_article_excerpt(self, url: str) -> Optional[str]:
        if not self.is_safe_article_url(url):
            return None

        headers = {
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }

        for attempt in range(self.enrich_retries + 1):
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=self.enrich_timeout) as response:
                    content_type = (response.headers.get("Content-Type") or "").lower()
                    if "html" not in content_type and "xml" not in content_type:
                        return None

                    raw = response.read(self.max_response_bytes)
                    charset = "utf-8"
                    if "charset=" in content_type:
                        charset = content_type.split("charset=")[-1].split(";")[0].strip() or "utf-8"

                html_text = raw.decode(charset, errors="ignore")
                cleaned = self.sanitize_html_to_text(html_text)
                if len(cleaned) < 180:
                    return None
                return cleaned[: self.max_article_chars]
            except Exception:
                if attempt < self.enrich_retries:
                    time.sleep(0.35 + random.uniform(0.0, 0.25))
                    continue
                return None

        return None

    def check_keywords(self, text: str) -> List[str]:
        text_lower = text.lower()
        return [keyword for keyword in self.watch_keywords if keyword in text_lower]

    def scan_feeds(self) -> List[Dict]:
        """Scan feeds and return matching entries with best-effort enrichment."""
        results: List[Dict] = []

        self.log(f"Scanning {len(self.feeds)} feeds for {len(self.watch_keywords)} keywords...")

        enrich_attempted = 0
        enrich_success = 0

        for feed_info in self.feeds:
            feed_data = self.fetch_feed(feed_info["url"])
            if "error" in feed_data:
                self.log(f"  ⚠ {feed_info['name']}: {feed_data['error']}")
                continue

            for entry in feed_data["entries"]:
                summary = entry.get("summary", "")
                text_for_match = f"{entry.get('title', '')} {summary}"
                enriched_text_source = "headline_only"
                article_excerpt = ""

                if summary.strip():
                    enriched_text_source = "summary"

                link = entry.get("link", "")
                if link and enrich_attempted < self.max_enriched_articles_per_run:
                    enrich_attempted += 1
                    excerpt = self.fetch_article_excerpt(link)
                    if excerpt:
                        enrich_success += 1
                        article_excerpt = excerpt
                        enriched_text_source = "article_excerpt"
                        text_for_match = f"{text_for_match} {excerpt}"
                    time.sleep(random.uniform(0.05, 0.12))

                matches = self.check_keywords(text_for_match)
                if matches:
                    results.append(
                        {
                            "feed": feed_info["name"],
                            "title": entry.get("title", ""),
                            "summary": summary,
                            "link": link,
                            "published": entry.get("published", ""),
                            "matched_keywords": matches,
                            "enriched_text_source": enriched_text_source,
                            "article_excerpt": article_excerpt,
                            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                        }
                    )

        self.log(
            f"RSS enrichment: attempted={enrich_attempted}, success={enrich_success}, "
            f"hit_rate={(enrich_success / enrich_attempted * 100):.1f}%" if enrich_attempted else "RSS enrichment: attempted=0"
        )
        return results

    def save_results(self, results: List[Dict], output_file: str = "data/rss_alerts.json"):
        output_path = self.resolve_path(output_file)
        os.makedirs(output_path.parent, exist_ok=True)

        existing = []
        if output_path.exists():
            with output_path.open("r", encoding="utf-8") as f:
                existing = json.load(f)

        existing = results + existing
        existing = existing[:200]

        with output_path.open("w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2)

        return len(results)

    def run(self):
        self.log("=== RSS Feed Monitor ===")
        self.log(f"Watching {len(self.watch_keywords)} keywords across {len(self.feeds)} feeds")
        self.log(
            f"Enrichment caps: max_articles={self.max_enriched_articles_per_run}, "
            f"max_chars={self.max_article_chars}, timeout={self.enrich_timeout}s\n"
        )

        results = self.scan_feeds()

        if results:
            self.log(f"\n✓ Found {len(results)} matching entries:")
            for r in results[:5]:
                self.log(f"  [{r['feed']}] {r['title'][:60]}...")
                self.log(f"    Keywords: {', '.join(r['matched_keywords'])} | source={r['enriched_text_source']}")

            count = self.save_results(results)
            self.log(f"\nSaved {count} alerts to data/rss_alerts.json")
        else:
            self.log("\nNo matching entries found.")

        return results


if __name__ == "__main__":
    quiet = "--quiet" in sys.argv or "-q" in sys.argv

    monitor = RSSMonitor(quiet=quiet)
    results = monitor.run()

    if not quiet:
        print("\n=== Matching Alerts ===")
        for r in results:
            print(f"[{r['matched_keywords']}] {r['title'][:70]}")
