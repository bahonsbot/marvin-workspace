#!/usr/bin/env python3
"""
Pre-Market Trading Brief Generator

Generates a daily trading brief for manual trading decisions.
Runs at 8:00 PM ICT (90 min before US market open).

Features:
- Sharp movers (>3% in 24h) with catalyst analysis
- Overnight news developments
- Sentiment summary (RSS vs Reddit vs bot)
- Actionable insights

Delivery: Telegram DM to Philippe
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add parent to path for imports
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent  # manual-trading-brief/
WORKSPACE_ROOT = PROJECT_ROOT.parent  # workspace/

# Use venv yfinance
sys.path.insert(0, str(WORKSPACE_ROOT / ".venv" / "lib" / "python3.14" / "site-packages"))

import yfinance as yf

# Import market intel context
market_intel_src = WORKSPACE_ROOT / "projects" / "market-intel" / "src"
if market_intel_src.exists():
    sys.path.insert(0, str(market_intel_src))
    from cron_context import CronContext
else:
    # Fallback if cron_context not available
    class CronContext:
        @classmethod
        def load(cls):
            return cls()
        def get_job(self, name):
            return {}


# ============== CONFIGURATION ==============

TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_PHILIPPE_CHAT_ID", "")  # Set via environment

SHARP_MOVER_THRESHOLD = 3.0  # % change threshold
TOP_MOVERS_COUNT = 5  # Top N gainers/losers to show

# Watchlist: Major indices + sector ETFs + popular stocks
WATCHLIST_SYMBOLS = [
    # Indices
    "SPY", "QQQ", "DIA", "IWM",
    # Sectors
    "XLK", "XLE", "XLF", "XLV", "XLI", "XLB", "XLY", "XLP", "XLU", "XLRE", "XLC",
    # Commodities
    "USO", "GLD", "SLV",
    # Volatility
    "VIX",
    # Tech giants
    "AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "TSLA", "ADBE",
    # Defense
    "RTX", "LMT", "NOC", "GD",
    # Finance
    "JPM", "BAC", "GS", "MS",
    # Other popular
    "AMD", "INTC", "NFLX", "DIS", "BA"
]


# ============== MARKET DATA ==============

def fetch_sharp_movers(threshold: float = 3.0, top_n: int = 5) -> Dict[str, List[Dict]]:
    """
    Fetch stocks with significant price moves (>threshold% in 24h).
    
    Returns dict with 'gainers' and 'losers' lists.
    """
    gainers = []
    losers = []
    
    print(f"Fetching market data for {len(WATCHLIST_SYMBOLS)} symbols...")
    
    for symbol in WATCHLIST_SYMBOLS:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.fast_info
            hist = ticker.history(period="2d")
            
            if len(hist) < 2:
                continue
            
            # Calculate 24h change
            current_price = hist['Close'].iloc[-1]
            previous_price = hist['Close'].iloc[-2]
            pct_change = ((current_price - previous_price) / previous_price) * 100
            
            # Get volume
            volume = hist['Volume'].iloc[-1]
            avg_volume = ticker.info.get('volume', 0)
            volume_ratio = volume / avg_volume if avg_volume > 0 else 1.0
            
            data = {
                "symbol": symbol,
                "price": round(float(current_price), 2),
                "change_pct": round(float(pct_change), 2),
                "volume": int(volume),
                "volume_ratio": round(volume_ratio, 2),
                "market_cap": ticker.info.get('marketCap', 0),
                "sector": ticker.info.get('sector', 'N/A'),
                "industry": ticker.info.get('industry', 'N/A')
            }
            
            if pct_change >= threshold:
                gainers.append(data)
            elif pct_change <= -threshold:
                losers.append(data)
                
        except Exception as e:
            print(f"  Warning: Could not fetch {symbol}: {e}")
            continue
    
    # Sort by absolute change (most dramatic first)
    gainers.sort(key=lambda x: x['change_pct'], reverse=True)
    losers.sort(key=lambda x: x['change_pct'])  # Most negative first
    
    print(f"  Found {len(gainers)} gainers, {len(losers)} losers (>{threshold}%)")
    
    return {
        "gainers": gainers[:top_n * 2],  # Get extra for filtering
        "losers": losers[:top_n * 2]
    }


def analyze_catalyst(symbol: str, change_pct: float, sector: str) -> str:
    """
    Analyze why a stock might be moving.
    
    Uses:
    - Sector context (what's happening in the sector)
    - Recent news from RSS alerts
    - Common catalysts (earnings, geopolitical, etc.)
    """
    # Load RSS alerts to search for this symbol
    rss_path = WORKSPACE_ROOT / "projects" / "market-intel" / "data" / "rss_alerts.json"
    reddit_path = WORKSPACE_ROOT / "projects" / "market-intel" / "data" / "reddit_alerts.json"
    
    catalysts = []
    
    # Search RSS for symbol mentions
    if rss_path.exists():
        try:
            with open(rss_path) as f:
                rss_data = json.load(f)
            
            for item in rss_data[:50]:  # Check recent 50
                title = item.get('title', '').lower()
                if symbol.lower() in title or sector.lower() in title:
                    catalysts.append(f"News: {item.get('title', '')[:80]}")
                    break
        except Exception:
            pass
    
    # Search Reddit for symbol mentions
    if reddit_path.exists():
        try:
            with open(reddit_path) as f:
                reddit_data = json.load(f)
            
            for item in reddit_data[:30]:  # Check recent 30
                title = item.get('title', '').lower()
                if symbol.lower() in title:
                    catalysts.append(f"Reddit buzz: {item.get('title', '')[:80]}")
                    break
        except Exception:
            pass
    
    # Generate analysis based on sector and move direction
    direction = "up" if change_pct > 0 else "down"
    
    if not catalysts:
        # No specific news, provide sector-based explanation
        if sector == "Technology":
            reason = "Tech sector movement" + (" (Fed rate headlines)" if change_pct < 0 else "")
        elif sector == "Energy":
            reason = "Energy sector" + (" rallying on oil prices" if change_pct > 0 else " under pressure")
        elif sector == "Financial":
            reason = "Financial sector" + (" on rate outlook" if change_pct > 0 else " pressure")
        elif sector == "Healthcare":
            reason = "Healthcare sector movement"
        elif "Defense" in sector or symbol in ["RTX", "LMT", "NOC", "GD"]:
            reason = "Defense stocks" + (" on geopolitical headlines" if change_pct > 0 else "")
        else:
            reason = f"{sector} sector {direction}"
        
        return reason
    
    return catalysts[0]


# ============== CONTEXT INTEGRATION ==============

def get_overnight_developments() -> List[str]:
    """Get top overnight news from RSS + Reddit."""
    developments = []
    
    # Load RSS alerts
    rss_path = WORKSPACE_ROOT / "projects" / "market-intel" / "data" / "rss_alerts.json"
    if rss_path.exists():
        try:
            with open(rss_path) as f:
                rss_data = json.load(f)
            
            # Get top 3-5 stories
            for item in rss_data[:5]:
                title = item.get('title', '')
                feed = item.get('feed', '')
                developments.append(f"• {title} ({feed})")
        except Exception as e:
            print(f"Warning: Could not load RSS: {e}")
    
    return developments


def get_sentiment_summary() -> Dict[str, Any]:
    """Get sentiment from RSS, Reddit, and auto-bot."""
    ctx = CronContext.load()
    
    sentiment = {
        "rss": "neutral",
        "reddit": "neutral",
        "bot_signals": 0,
        "bot_status": "no signals"
    }
    
    # Get RSS sentiment (from recent items)
    rss_path = WORKSPACE_ROOT / "projects" / "market-intel" / "data" / "rss_alerts.json"
    if rss_path.exists():
        try:
            with open(rss_path) as f:
                rss_data = json.load(f)
            
            # Simple keyword-based sentiment
            bearish_keywords = ["fed", "rate", "crisis", "war", "conflict", "miss", "layoff"]
            bullish_keywords = ["beat", "rally", "surge", "breakthrough", "deal", "growth"]
            
            bearish = sum(1 for item in rss_data[:50] if any(k in item.get('title', '').lower() for k in bearish_keywords))
            bullish = sum(1 for item in rss_data[:50] if any(k in item.get('title', '').lower() for k in bullish_keywords))
            
            if bearish > bullish * 1.5:
                sentiment["rss"] = f"{int(bearish/50*100)}% bearish"
            elif bullish > bearish * 1.5:
                sentiment["rss"] = f"{int(bullish/50*100)}% bullish"
            else:
                sentiment["rss"] = "mixed"
        except Exception:
            pass
    
    # Get Reddit sentiment
    reddit_path = WORKSPACE_ROOT / "projects" / "market-intel" / "data" / "reddit_alerts.json"
    if reddit_path.exists():
        try:
            with open(reddit_path) as f:
                reddit_data = json.load(f)
            
            # WSB is generally bullish, check tone
            bullish_subs = ["wallstreetbets", "stocks", "investing"]
            wsb_items = [item for item in reddit_data if item.get('subreddit', '') in bullish_subs]
            
            if len(wsb_items) > 20:
                sentiment["reddit"] = "bullish (WSB active)"
            elif len(wsb_items) > 10:
                sentiment["reddit"] = "neutral"
            else:
                sentiment["reddit"] = "quiet"
        except Exception:
            pass
    
    # Get bot signals from cron context
    signal_job = ctx.get_job("signal-generator")
    if signal_job:
        signals = signal_job.get("signals_generated", 0)
        sentiment["bot_signals"] = signals
        if signals > 5:
            sentiment["bot_status"] = f"{signals} STRONG BUY signals"
        elif signals > 0:
            sentiment["bot_status"] = f"{signals} signals"
        else:
            sentiment["bot_status"] = "no signals"
    
    return sentiment


# ============== BRIEF GENERATION ==============

def generate_brief() -> str:
    """Generate the full pre-market trading brief."""
    print("=" * 50)
    print("Generating Pre-Market Trading Brief")
    print("=" * 50)
    
    lines = []
    today = datetime.now().strftime("%b %d, %Y")
    
    # Header
    lines.append(f"🌅 Pre-Market Brief — {today}")
    lines.append("")
    
    # 1. Overnight Developments
    print("\n1. Fetching overnight developments...")
    developments = get_overnight_developments()
    if developments:
        lines.append("OVERNIGHT DEVELOPMENTS")
        lines.extend(developments[:5])
        lines.append("")
    
    # 2. Sharp Movers
    print("2. Fetching sharp movers...")
    movers = fetch_sharp_movers(SHARP_MOVER_THRESHOLD, TOP_MOVERS_COUNT)
    
    if movers["gainers"] or movers["losers"]:
        lines.append("📈 SHARP MOVERS (24h)")
        lines.append("")
        
        # Gainers
        if movers["gainers"]:
            lines.append("Gainers:")
            selected_gainers = []
            
            for stock in movers["gainers"][:TOP_MOVERS_COUNT * 2]:
                if len(selected_gainers) >= TOP_MOVERS_COUNT:
                    break
                
                # Analyze catalyst
                catalyst = analyze_catalyst(
                    stock["symbol"],
                    stock["change_pct"],
                    stock.get("sector", "")
                )
                
                selected_gainers.append((stock, catalyst))
            
            for stock, catalyst in selected_gainers:
                lines.append(f"{stock['symbol']} +{stock['change_pct']}% — {stock.get('sector', 'N/A')}")
                lines.append(f"  Why: {catalyst}")
                if stock.get('market_cap', 0) > 0:
                    cap = stock['market_cap']
                    if cap > 1e12:
                        cap_str = f"${cap/1e12:.1f}T"
                    elif cap > 1e9:
                        cap_str = f"${cap/1e9:.0f}B"
                    else:
                        cap_str = f"${cap/1e6:.0f}M"
                    lines.append(f"  Fundamentals: {cap_str} market cap")
                lines.append("")
        
        # Losers
        if movers["losers"]:
            lines.append("Losers:")
            selected_losers = []
            
            for stock in movers["losers"][:TOP_MOVERS_COUNT * 2]:
                if len(selected_losers) >= TOP_MOVERS_COUNT:
                    break
                
                catalyst = analyze_catalyst(
                    stock["symbol"],
                    stock["change_pct"],
                    stock.get("sector", "")
                )
                
                selected_losers.append((stock, catalyst))
            
            for stock, catalyst in selected_losers:
                lines.append(f"{stock['symbol']} {stock['change_pct']}% — {stock.get('sector', 'N/A')}")
                lines.append(f"  Why: {catalyst}")
                if stock.get('market_cap', 0) > 0:
                    cap = stock['market_cap']
                    if cap > 1e12:
                        cap_str = f"${cap/1e12:.1f}T"
                    elif cap > 1e9:
                        cap_str = f"${cap/1e9:.0f}B"
                    else:
                        cap_str = f"${cap/1e6:.0f}M"
                    lines.append(f"  Fundamentals: {cap_str} market cap")
                lines.append("")
    
    # 3. Sentiment Summary
    print("3. Getting sentiment summary...")
    sentiment = get_sentiment_summary()
    
    lines.append("📊 SENTIMENT")
    lines.append(f"• RSS: {sentiment['rss']}")
    lines.append(f"• Reddit: {sentiment['reddit']}")
    lines.append(f"• Auto-bot: {sentiment['bot_status']}")
    lines.append("")
    
    # 4. Your Move (actionable insight)
    lines.append("🎯 YOUR MOVE")
    
    # Generate insight based on data
    insights = []
    
    if sentiment['bot_signals'] > 3:
        insights.append(f"Bot sees {sentiment['bot_signals']} — check energy/defense for momentum")
    
    if "bearish" in sentiment['rss']:
        insights.append("Fed/rate headlines pressuring market — watch for support levels")
    
    if "bullish" in sentiment['reddit']:
        insights.append("WSB active — retail momentum on speculative plays")
    
    if movers["gainers"] and any(s.get('sector') == 'Energy' for s in movers["gainers"][:3]):
        insights.append("Energy sector showing strength — oil-related names in focus")
    
    if not insights:
        insights.append("Mixed signals — wait for clearer setup")
        insights.append("Focus on stocks with catalyst + price confirmation")
    
    for insight in insights[:3]:
        lines.append(f"• {insight}")
    
    lines.append("")
    lines.append("---")
    lines.append("Generated by Marvin's Pre-Market Brief")
    lines.append("Data: Yahoo Finance (15-min delayed) + RSS/Reddit sentiment")
    
    brief = "\n".join(lines)
    print(f"\n{'=' * 50}")
    print(f"Brief generated: {len(lines)} lines")
    print(f"{'=' * 50}")
    
    return brief


# ============== DELIVERY ==============

def send_telegram(message: str) -> bool:
    """
    Send message to Philippe via Telegram.
    
    Tries multiple methods:
    1. Direct Telegram API (if credentials configured)
    2. Fallback: Print to console (for manual copy/paste)
    """
    import urllib.request
    import urllib.parse
    import json as json_lib
    
    # Try to get credentials from trading bot .env
    # Use absolute path to avoid working directory issues
    env_path = Path("/data/.openclaw/workspace/projects/autonomous-trading-bot/.env")
    
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.getenv("TELEGRAM_PHILIPPE_CHAT_ID", "")
    
    # Try to load from .env if not in environment
    if (not bot_token or not chat_id) and env_path.exists():
        try:
            import stat
            file_mode = env_path.stat().st_mode
            if file_mode & stat.S_IROTH:
                raise RuntimeError(
                    f"Refusing to read Telegram credentials from world-readable env file: {env_path}. "
                    "Fix permissions with chmod 600 or provide credentials via environment."
                )

            for line in env_path.read_text().splitlines():
                line = line.strip()
                if "=" not in line or line.startswith("#"):
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"\'')
                if key == "TELEGRAM_BOT_TOKEN":
                    bot_token = value
                    print(f"  Found bot token (len={len(bot_token)})")
                elif key == "TELEGRAM_PHILIPPE_CHAT_ID":
                    chat_id = value
                    print("  Found chat ID: [REDACTED]")
        except Exception as e:
            print(f"  Warning: Could not parse .env: {e}")
    
    if not bot_token or not chat_id:
        print("⚠ Telegram credentials not configured")
        print("  Set TELEGRAM_BOT_TOKEN and TELEGRAM_PHILIPPE_CHAT_ID in environment or .env")
        return False
    
    # URL encode the message (preserve formatting)
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown"
    }
    data = urllib.parse.urlencode(payload).encode()
    
    req = urllib.request.Request(url, data=data, method="POST")
    
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json_lib.loads(resp.read().decode())
            if result.get("ok"):
                print("✓ Sent to Telegram (chat: [REDACTED])")
                return True
            else:
                print(f"✗ Telegram API error: {result}")
                return False
    except Exception as e:
        print(f"✗ Failed to send: {e}")
        return False


# ============== MAIN ==============

def main():
    """Main entry point."""
    # Generate brief
    brief = generate_brief()
    
    # Send to Telegram
    print("\n4. Sending to Telegram...")
    success = send_telegram(brief)
    
    if success:
        print("\n✓ Pre-market brief delivered successfully")
        return 0
    else:
        print("\n✗ Failed to deliver brief")
        # Print brief to console as fallback
        print("\n" + "=" * 50)
        print("BRIEF CONTENT (fallback):")
        print("=" * 50)
        print(brief)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
