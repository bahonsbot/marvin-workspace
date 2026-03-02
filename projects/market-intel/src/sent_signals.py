#!/usr/bin/env python3
"""
Signal deduplication: tracks signals already sent to Telegram to avoid duplicates
"""
import json
from pathlib import Path
from datetime import datetime, timezone

SENT_SIGNALS_FILE = Path(__file__).resolve().parents[1] / "data" / "sent_signals.json"

def load_sent_signals() -> dict:
    """Load previously sent signals"""
    if SENT_SIGNALS_FILE.exists():
        with open(SENT_SIGNALS_FILE, 'r') as f:
            return json.load(f)
    return {"sent": [], "last_updated": None}

def save_sent_signals(data: dict):
    """Save sent signals tracking"""
    data["last_updated"] = datetime.now(timezone.utc).isoformat()
    with open(SENT_SIGNALS_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def is_already_sent(signal_title: str, sent_data: dict) -> bool:
    """Check if signal was already sent"""
    return signal_title in sent_data.get("sent", [])

def mark_as_sent(signal_titles: list):
    """Mark signals as sent"""
    sent_data = load_sent_signals()
    for title in signal_titles:
        if title not in sent_data["sent"]:
            sent_data["sent"].append(title)
    save_sent_signals(sent_data)

def filter_new_signals(signals: list) -> list:
    """Filter out already-sent signals"""
    sent_data = load_sent_signals()
    new_signals = []
    for sig in signals:
        title = sig.get("title", "")
        if title and not is_already_sent(title, sent_data):
            new_signals.append(sig)
    return new_signals

if __name__ == "__main__":
    # CLI for testing
    import sys
    if len(sys.argv) > 1:
        if sys.argv[1] == "test":
            sent = load_sent_signals()
            print(f"Loaded {len(sent.get('sent', []))} sent signals")
        elif sys.argv[1] == "add" and len(sys.argv) > 2:
            mark_as_sent([sys.argv[2]])
            print(f"Marked as sent: {sys.argv[2]}")
