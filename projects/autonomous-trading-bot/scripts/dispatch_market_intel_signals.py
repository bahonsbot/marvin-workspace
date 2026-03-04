#!/usr/bin/env python3
"""Dispatch high-confidence Market Intel signals to local trading webhook.

Paper-only, conservative by default.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from dataclasses import dataclass
from datetime import UTC, datetime, time
from pathlib import Path
from typing import Any
from urllib import error, request

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.trade_notifier import TelegramNotifier
MI_DATA = ROOT.parent / "market-intel" / "data"
STATE_PATH = ROOT / "data" / "state" / "auto_signal_dispatch.json"


def _load_env() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


@dataclass
class Config:
    webhook_url: str
    webhook_secret: str
    confidence: str
    min_reasoning_score: float
    qty: float
    max_qty: float
    market_hours_only: bool


def _cfg() -> Config:
    return Config(
        webhook_url=os.getenv("AUTO_WEBHOOK_URL", "http://127.0.0.1:8000/webhook"),
        webhook_secret=os.getenv("WEBHOOK_SHARED_SECRET", "").strip(),
        confidence=os.getenv("AUTO_MIN_CONFIDENCE", "STRONG BUY").strip().upper(),
        min_reasoning_score=float(os.getenv("AUTO_MIN_REASONING_SCORE", "80")),
        qty=float(os.getenv("AUTO_BASE_QTY", "1")),
        max_qty=float(os.getenv("AUTO_MAX_QTY", "1")),
        market_hours_only=os.getenv("AUTO_MARKET_HOURS_ONLY", "true").lower() in {"1", "true", "yes", "on"},
    )


def _in_us_market_hours(now: datetime) -> bool:
    try:
        from zoneinfo import ZoneInfo

        et = now.astimezone(ZoneInfo("America/New_York"))
    except Exception:
        return True  # fail-open if tz db missing

    if et.weekday() >= 5:
        return False
    start = time(9, 30)
    end = time(16, 0)
    return start <= et.time() <= end


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _load_state() -> dict[str, Any]:
    st = _read_json(STATE_PATH, {"sent": {}, "updated_at": None})
    if not isinstance(st, dict):
        st = {"sent": {}, "updated_at": None}
    st.setdefault("sent", {})
    return st


def _signal_key(sig: dict[str, Any]) -> str:
    title = str(sig.get("title", ""))
    ts = str(sig.get("timestamp", ""))
    src = str(sig.get("source", ""))
    return hashlib.sha256(f"{title}|{ts}|{src}".encode()).hexdigest()


def _normalize_side(sig: dict[str, Any]) -> str:
    rec = str(sig.get("recommendation", "TAKE")).upper()
    if rec in {"TAKE", "BUY", "LONG", "STRONG BUY"}:
        return "buy"
    if rec in {"SELL", "SHORT"}:
        return "sell"
    return "buy"


def _post_webhook(url: str, body: dict[str, Any]) -> tuple[int, dict[str, Any] | str]:
    data = json.dumps(body).encode("utf-8")
    req = request.Request(url, data=data, method="POST", headers={"Content-Type": "application/json"})
    try:
        with request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.status, json.loads(raw)
            except Exception:
                return resp.status, raw
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(raw)
        except Exception:
            return exc.code, raw
    except Exception as exc:
        return 0, str(exc)


def _send_digest(lines: list[str]) -> None:
    if not lines:
        return
    try:
        notifier = TelegramNotifier()
        msg = "🤖 Auto Dispatch Summary\n" + "\n".join(lines)
        notifier._send(msg, parse_mode="Markdown")
    except Exception:
        pass


def main() -> int:
    _load_env()
    cfg = _cfg()
    now = datetime.now(UTC)

    if cfg.market_hours_only and not _in_us_market_hours(now):
        print("Outside US market hours, skipping dispatch")
        return 0

    if not cfg.webhook_secret:
        print("WEBHOOK_SHARED_SECRET missing, abort")
        return 1

    enhanced = _read_json(MI_DATA / "enhanced_signals.json", [])
    if not isinstance(enhanced, list):
        print("enhanced_signals.json invalid format")
        return 1

    state = _load_state()
    sent = state["sent"]

    dispatched = 0
    blocked = 0
    lines: list[str] = []

    for sig in enhanced:
        if not isinstance(sig, dict):
            continue

        conf = str(sig.get("confidence_level", "")).upper()
        reasoning = float(sig.get("reasoning_score", 0) or 0)
        if conf != cfg.confidence:
            continue
        if reasoning < cfg.min_reasoning_score:
            continue

        key = _signal_key(sig)
        if key in sent:
            continue

        qty = min(cfg.qty, cfg.max_qty)
        body = {
            "symbol": sig.get("symbol") or "AAPL",
            "side": _normalize_side(sig),
            "qty": qty,
            "timestamp": now.isoformat(),
            "strategy": "market-intel-auto",
            "secret": cfg.webhook_secret,
            "source_title": sig.get("title", ""),
            "source_url": sig.get("url", ""),
        }

        status, resp = _post_webhook(cfg.webhook_url, body)
        accepted = isinstance(resp, dict) and bool(resp.get("accepted")) and status in {200, 201}

        sent[key] = {
            "title": sig.get("title", ""),
            "timestamp": now.isoformat(),
            "status": status,
            "accepted": accepted,
            "response": resp,
        }

        if accepted:
            dispatched += 1
            lines.append(f"✅ {sig.get('symbol','AAPL')} {body['side']} qty={qty} | {str(sig.get('title',''))[:70]}")
        else:
            blocked += 1
            lines.append(f"⚠️ blocked status={status} | {str(sig.get('title',''))[:70]}")

    state["updated_at"] = now.isoformat()
    _write_json(STATE_PATH, state)

    if dispatched or blocked:
        _send_digest([f"dispatched={dispatched} blocked={blocked}"] + lines[:8])

    print(f"dispatch complete: dispatched={dispatched} blocked={blocked}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
