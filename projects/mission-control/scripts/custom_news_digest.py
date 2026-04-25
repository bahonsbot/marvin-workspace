#!/usr/bin/env python3
from __future__ import annotations
import json, re, urllib.parse, urllib.request, xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from pathlib import Path
from typing import Dict, List, Optional

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

FEEDS = [
    {"name": "FD", "url": "https://fd.nl/?rss", "priority": 1},
    {"name": "NRC", "url": "https://nrc.nl/rss", "priority": 2},
    {"name": "IEX", "url": "https://rss.app/feeds/NV6eLUUDbfKCeMbI.xml", "priority": 3},
]

OUTPUT_PATH = Path("/data/.openclaw/workspace/projects/mission-control/data/custom-news-briefings.json")
MAX_ITEMS = 30
MAX_ENTRIES_PER_FEED = 35
WINDOW_HOURS = 24

INTEREST_BUCKETS: List[tuple[str, int, List[str]]] = [
    ("technology_ai", 500, ["ai","artificial intelligence","chip","chips","semiconductor","openai","anthropic","meta","microsoft","google","software","cloud","data center","data centres","robot","robots","eu ai","algorithm","cyber","cybersecurity","hack","hacker","vulnerability"]),
    ("dutch_economy", 420, ["dutch","netherlands","amsterdam","rotterdam","economie","economy","inflation","employment","gdp","trade","export","interest rate","ecb","fiscal","belasting"]),
    ("entrepreneurship_startups", 360, ["startup","founder","venture","funding","seed","series a","scaleup","entrepreneur","innovation"]),
    ("politics_real_world", 300, ["election","parliament","government","cabinet","minister","sanction","tariff","defense","immigration","law","bill","treaty","coalition","vote"]),
    ("opinion_high_quality", 220, ["opinion","analysis","column","commentary","editorial","essay"]),
]
DEPRIORITIZE_TERMS = {"celebrity","royal","entertainment","weather","forecast","sport","football","soccer","tennis","crime","murder","accident","lifestyle","travel tips","fashion"}

# Boilerplate phrases that indicate a generic site tagline, not real article content.
KNOWN_TAGLINES = [
    "iex.nl is het beleggersplatform van nederland",
    "iex.nl is the investor platform in the netherlands",
    "stay up to date with all relevant information",
    "beleggersplatform van nederland",
    "investor platform in the netherlands",
    "alle relevante informatie over aandelen en andere beleggingsproducten",
    "all relevant information about shares and other investment products",
]

@dataclass
class FeedItem:
    source: str
    source_priority: int
    title: str
    summary: str
    link: str
    published_at: datetime

def sanitize_html_to_text(html_text: str) -> str:
    text = re.sub(r"(?is)<(script|style|noscript).*?>.*?</\1>", " ", html_text or "")
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?is)</p>", "\n", text)
    text = re.sub(r"(?is)<.*?>", " ", text)
    text = unescape(text)
    text = text.replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text

def parse_date(value: str | None) -> Optional[datetime]:
    if not value:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        dt = parsedate_to_datetime(value)
        return dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        pass
    try:
        normalized = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        return dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None

def fetch_feed(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as response:
        return response.read()

def parse_feed(source: str, priority: int, xml_bytes: bytes) -> List[FeedItem]:
    root = ET.fromstring(xml_bytes)
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    items = root.findall(".//item")
    if not items:
        items = root.findall(".//atom:entry", ns)
    parsed: List[FeedItem] = []
    for item in items[:MAX_ENTRIES_PER_FEED]:
        title = (item.findtext("title") or item.findtext("atom:title", default="", namespaces=ns) or "").strip()
        summary = (item.findtext("description") or item.findtext("summary") or item.findtext("content") or item.findtext("atom:summary", default="", namespaces=ns) or item.findtext("atom:content", default="", namespaces=ns) or "").strip()
        link = (item.findtext("link") or "").strip()
        if not link:
            atom_link = item.find("atom:link", ns)
            if atom_link is not None:
                link = (atom_link.attrib.get("href") or "").strip()
        published_raw = (item.findtext("pubDate") or item.findtext("published") or item.findtext("updated") or item.findtext("atom:updated", default="", namespaces=ns) or item.findtext("atom:published", default="", namespaces=ns) or "").strip()
        published_at = parse_date(published_raw)
        if not title or not link or not published_at:
            continue
        parsed.append(FeedItem(source=source, source_priority=priority, title=sanitize_html_to_text(title), summary=sanitize_html_to_text(summary), link=link, published_at=published_at))
    return parsed

class Translator:
    def __init__(self) -> None:
        self.cache: Dict[str, str] = {}

    def to_english(self, text: str) -> str:
        text = (text or "").strip()
        if not text or text in self.cache:
            return self.cache.get(text, text)
        query = urllib.parse.urlencode({"client": "gtx", "sl": "auto", "tl": "en", "dt": "t", "q": text[:1200]})
        url = f"https://translate.googleapis.com/translate_a/single?{query}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=12) as response:
                payload = json.loads(response.read().decode("utf-8", errors="ignore"))
            translated = "".join((chunk[0] or "") for chunk in payload[0] if isinstance(chunk, list) and chunk)
            translated = re.sub(r"\s+", " ", translated).strip()
            if translated:
                self.cache[text] = translated
                return translated
        except Exception:
            pass
        self.cache[text] = text
        return text

def tokenize(text: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]{3,}", (text or "").lower()) if token not in {"with","from","that","this","over","into","about","after","have","will","their","your"}}

def term_matches(term: str, normalized_text: str, tokens: set[str]) -> bool:
    term = (term or "").strip().lower()
    if not term:
        return False
    if " " in term:
        pattern = rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])"
        return re.search(pattern, normalized_text) is not None
    return term in tokens

def score_item(text: str) -> tuple[int, str]:
    normalized = (text or "").lower()
    tokens = tokenize(normalized)
    best_label = "general"
    best = 0
    for label, base_score, terms in INTEREST_BUCKETS:
        hits = sum(1 for term in terms if term_matches(term, normalized, tokens))
        if hits <= 0:
            continue
        score = base_score + hits * 12
        if score > best:
            best = score
            best_label = label
    penalty = sum(40 for term in DEPRIORITIZE_TERMS if term_matches(term, normalized, tokens))
    return max(0, best - penalty), best_label

def brief_headline(title_en: str) -> str:
    headline = re.sub(r"\s+", " ", (title_en or "").strip())
    return headline[:140].rstrip(" .") if headline else "Dutch news update"

def is_likely_tagline(text: str) -> bool:
    normalized = (text or "").lower().replace("\xa0", " ")
    for phrase in KNOWN_TAGLINES:
        if phrase in normalized:
            return True
    return False

def try_fetch_article_snippet(url: str, timeout: int = 8) -> str:
    """Extract article content from an IEX page when the feed summary is a generic tagline."""
    try:
        from html import unescape as _unescape
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
        text = re.sub(r"(?is)<(script|style|noscript|footer|nav|aside|header).*?>.*?</\1>", " ", html)
        text = re.sub(r"(?is)<(p|div|span|h[1-6]|article|section|li).*?>", "\n", text)
        text = re.sub(r"(?is)<.*?>", " ", text)
        text = _unescape(text)
        text = re.sub(r"\s+", " ", text).strip()

        # Strip IEX page header/branding block from the start.
        # The IEX layout starts with: "IEX.nl | Beurs - Beleggen - ... - Columns\n"
        # followed by a Beeld: attribution line.
        text = re.sub(r"^IEX\.nl\s+\|[^C]*Columns\s+", "", text)
        text = re.sub(r"^Beeld:\s*", "", text)   # Remove "Beeld: Reuters" prefix
        text = re.sub(r"\s+", " ", text).strip()

        if not text:
            return ""
        sentences = re.split(r"(?<=[.!?])\s+", text)
        # IEX prepends a credit line as the first "sentence":
        # "Reuters Door Utkarsh Shetti 20 april (Reuters) - ..."
        # Skip the first sentence if it starts with a credit pattern.
        real_sentences = [
            s for i, s in enumerate(sentences)
            if not (i == 0 and "Door" in s[:40])
        ]
        meaningful = [s.strip() for s in real_sentences if len(s.strip()) > 60 and not is_likely_tagline(s.strip())]
        if meaningful:
            return " ".join(meaningful[:2])[:360]
    except Exception:
        pass
    return ""

def compact_sentences(text: str, max_sentences: int = 2, link: str = "") -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    if not text or is_likely_tagline(text):
        if link:
            snippet = try_fetch_article_snippet(link)
            if snippet:
                # Snippet is Dutch — translate to English before returning.
                translator = Translator()
                return translator.to_english(snippet)
        return "No additional detail was available in the feed excerpt."
    parts = re.split(r"(?<=[.!?])\s+", text)
    return " ".join(parts[:max_sentences]).strip()[:360]

def why_it_matters(label: str, headline: str) -> str:
    normalized = (headline or "").lower()
    if label == "technology_ai":
        if any(t in normalized for t in ["ai","artificial intelligence","openai","anthropic","llm"]):
            return "This may influence AI product strategy, regulation, or competitive positioning in Europe and beyond."
        if any(t in normalized for t in ["hack","hacker","cyber","security","privacy","vulnerability"]):
            return "It points to cybersecurity, privacy, or infrastructure risk that could affect trust, compliance, and operational resilience."
        if any(t in normalized for t in ["chip","chips","semiconductor"]):
            return "It matters for European tech supply chains, industrial capacity, and strategic control over critical hardware."
        return "It signals a broader shift in the European tech landscape, with potential effects on product direction, competition, or regulation."
    if label == "dutch_economy":
        return "This affects Dutch economic confidence, business planning, and near-term market expectations."
    if label == "entrepreneurship_startups":
        return "It signals shifts in startup funding climate, founder opportunities, or ecosystem momentum in the Netherlands."
    if label == "politics_real_world":
        return "Policy decisions here can quickly flow into company costs, investor sentiment, and cross-border business operations."
    if label == "opinion_high_quality":
        return "The perspective adds strategic context that can shape decision-making beyond headline events."
    return "This story has practical implications for business and policy watchers following Dutch and global developments."

def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / max(1, len(a | b))

def build_digest(items: List[FeedItem]) -> dict:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=WINDOW_HOURS)
    recent = [item for item in items if item.published_at >= cutoff]
    translator = Translator()
    prepared = []
    for item in recent:
        title_en = translator.to_english(item.title)
        summary_en = translator.to_english(item.summary) if item.summary else ""
        combined = f"{title_en} {summary_en}"
        score, label = score_item(combined)
        prepared.append({"item": item, "title_en": title_en, "summary_en": summary_en, "score": score, "label": label, "tokens": tokenize(title_en)})
    prepared.sort(key=lambda row: (row["score"], -row["item"].source_priority, row["item"].published_at), reverse=True)
    clusters: List[dict] = []
    for row in prepared:
        placed = None
        for cluster in clusters:
            similarity = jaccard(cluster["tokens"], row["tokens"])
            if similarity >= 0.56:
                placed = cluster
                break
        if placed is None:
            clusters.append({"primary": row, "items": [row], "tokens": set(row["tokens"])})
            continue
        placed["items"].append(row)
        placed["tokens"].update(row["tokens"])
        if row["item"].source_priority < placed["primary"]["item"].source_priority:
            placed["primary"] = row
    briefings = []
    for cluster in clusters:
        primary = cluster["primary"]
        linked = sorted(cluster["items"], key=lambda row: (row["item"].source_priority, -row["score"], row["item"].published_at))
        sources = list(dict.fromkeys(row["item"].source for row in linked))
        links = [{"title": row["title_en"][:140], "url": row["item"].link} for row in linked[:2]]
        differing_views = None
        if len(sources) >= 2:
            tones = [row["summary_en"].lower() for row in linked if row["summary_en"]]
            if any(w in t for t in tones for w in ["however","but","critics"]):
                differing_views = "Coverage diverges on interpretation, with at least one source stressing risks while another stresses opportunity or policy upside."
        briefings.append({
            "id": re.sub(r"[^a-z0-9]+", "-", primary["title_en"].lower()).strip("-")[:72] or f"custom-{len(briefings)+1}",
            "headline": brief_headline(primary["title_en"]),
            "sources": sources,
            "whatHappened": compact_sentences(primary["summary_en"] or primary["title_en"], max_sentences=2, link=primary["item"].link),
            "whyItMatters": why_it_matters(primary["label"], primary["title_en"]),
            "differingViews": differing_views,
            "links": links,
            "publishedAt": primary["item"].published_at.isoformat().replace("+00:00", "Z"),
            "category": primary["label"],
            "score": primary["score"],
        })
    briefings.sort(key=lambda row: (row.get("score") or 0, row.get("publishedAt") or ""), reverse=True)
    return {
        "generatedAt": now.isoformat().replace("+00:00", "Z"),
        "windowHours": WINDOW_HOURS,
        "feeds": [{"name": f["name"], "url": f["url"], "priority": f["priority"]} for f in FEEDS],
        "items": [{"id": b["id"], "headline": b["headline"], "sources": b["sources"], "whatHappened": b["whatHappened"], "whyItMatters": b["whyItMatters"], "differingViews": b["differingViews"], "links": b["links"], "publishedAt": b["publishedAt"]} for b in briefings],
        "stats": {"itemsFetched": len(items), "itemsInWindow": len(recent), "itemsPublished": len(briefings)},
    }

def main() -> int:
    all_items: List[FeedItem] = []
    for feed in FEEDS:
        try:
            xml_bytes = fetch_feed(feed["url"])
            parsed = parse_feed(feed["name"], feed["priority"], xml_bytes)
            all_items.extend(parsed)
        except Exception as exc:
            print(f"FAIL feed {feed['name']}: {exc}")
    digest = build_digest(all_items)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(digest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(digest['items'])} briefings from {digest['stats']['itemsInWindow']} items in last {WINDOW_HOURS}h")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
