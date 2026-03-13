#!/usr/bin/env python3
"""Dispatch high-confidence Market Intel signals to local trading webhook.

Paper-only, conservative by default.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import sys
from dataclasses import dataclass
from datetime import UTC, datetime, time
from pathlib import Path
from typing import Any
from urllib import error, request

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.context_adapter import load_context_snapshot
from src.execution_candidates_adapter import load_ready_execution_candidates
from src.trade_notifier import TelegramNotifier

try:
    from scripts.symbol_mapper import map_signal_to_symbol
except ImportError:
    from symbol_mapper import map_signal_to_symbol
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
    execution_candidates_enabled: bool
    confidence: str
    min_reasoning_score: float
    qty: float
    max_qty: float
    market_hours_only: bool
    fast_regime_enabled: bool
    fast_min_reasoning_score: float
    fast_qty_multiplier: float
    fast_geo_threshold: int
    fast_high_conf_threshold: int


def _cfg() -> Config:
    webhook_url = os.getenv("AUTO_WEBHOOK_URL", "http://127.0.0.1:8000/webhook").strip()
    # Enforce HTTPS for non-local webhook URLs (allow http for localhost)
    if not webhook_url.startswith("http://localhost") and not webhook_url.startswith("http://127.0.0.1"):
        if not webhook_url.startswith("https://"):
            logger.warning(f"WEBHOOK_SHARED_SECRET: Non-local webhook URL should use HTTPS: {webhook_url[:50]}...")
    
    return Config(
        webhook_url=webhook_url,
        webhook_secret=os.getenv("WEBHOOK_SHARED_SECRET", "").strip(),
        execution_candidates_enabled=os.getenv("EXECUTION_CANDIDATES_ENABLED", "false").lower() in {"1", "true", "yes", "on"},
        confidence=os.getenv("AUTO_MIN_CONFIDENCE", "STRONG BUY").strip().upper(),
        min_reasoning_score=float(os.getenv("AUTO_MIN_REASONING_SCORE", "80")),
        qty=float(os.getenv("AUTO_BASE_QTY", "1")),
        max_qty=float(os.getenv("AUTO_MAX_QTY", "1")),
        market_hours_only=os.getenv("AUTO_MARKET_HOURS_ONLY", "true").lower() in {"1", "true", "yes", "on"},
        fast_regime_enabled=os.getenv("AUTO_FAST_REGIME_ENABLED", "true").lower() in {"1", "true", "yes", "on"},
        fast_min_reasoning_score=float(os.getenv("AUTO_FAST_MIN_REASONING_SCORE", "75")),
        fast_qty_multiplier=float(os.getenv("AUTO_FAST_QTY_MULTIPLIER", "1.25")),
        fast_geo_threshold=int(os.getenv("AUTO_FAST_GEO_THRESHOLD", "3")),
        fast_high_conf_threshold=int(os.getenv("AUTO_FAST_HIGH_CONF_THRESHOLD", "30")),
    )


def _in_us_market_hours(now: datetime) -> bool:
    try:
        from zoneinfo import ZoneInfo

        et = now.astimezone(ZoneInfo("America/New_York"))
    except Exception as e:
        # Fail-closed: skip dispatch if timezone fails, but alert Philippe
        print(f"ERROR: Timezone detection failed - skipping dispatch: {e}")
        try:
            notifier = TelegramNotifier()
            notifier._send(
                "🚨 CRITICAL: Timezone detection failed in signal dispatcher\n\n"
                f"Error: {e}\n\n"
                "Signal dispatch is SKIPPED until fixed.\n"
                "Check dispatch_market_intel_signals.py"
            )
        except Exception as notify_err:
            print(f"Failed to send alert: {notify_err}")
        return False  # fail-closed: skip execution

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
    st = _read_json(STATE_PATH, {"sent": {}, "updated_at": None, "last_mode": None})
    if not isinstance(st, dict):
        st = {"sent": {}, "updated_at": None, "last_mode": None}
    st.setdefault("sent", {})
    st.setdefault("last_mode", None)
    return st


def _signal_key(sig: dict[str, Any]) -> str:
    candidate_id = str(sig.get("candidate_id", "")).strip()
    if candidate_id:
        return f"candidate:{candidate_id}"

    signal_id = str(sig.get("signal_id", "")).strip()
    if signal_id:
        return f"signal:{signal_id}"

    title = str(sig.get("title", ""))
    ts = str(sig.get("timestamp", ""))
    src = str(sig.get("source", ""))
    return hashlib.sha256(f"{title}|{ts}|{src}".encode()).hexdigest()


def _normalize_side(sig: dict[str, Any]) -> str:
    primary_instrument = sig.get("primary_instrument")
    if isinstance(primary_instrument, dict):
        direction_bias = str(primary_instrument.get("direction_bias", "")).lower().strip()
        if direction_bias == "short":
            return "sell"
        if direction_bias == "long":
            return "buy"

    rec = str(sig.get("recommendation", "TAKE")).upper()
    if rec in {"TAKE", "BUY", "LONG", "STRONG BUY"}:
        return "buy"
    if rec in {"SELL", "SHORT"}:
        return "sell"
    return "buy"


def _post_webhook(url: str, body: dict[str, Any], secret: str | None = None) -> tuple[int, dict[str, Any] | str]:
    data = json.dumps(body, sort_keys=True, separators=(',', ':')).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    
    if secret:
        # Add timestamp and HMAC signature for replay protection
        timestamp = datetime.now(UTC).isoformat()
        headers["X-Timestamp"] = timestamp
        # Sign: timestamp + canonicalized body to prevent replay with modified payload
        message = f"{timestamp}:{data.decode('utf-8')}"
        signature = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
        headers["X-Signature"] = signature
        # Keep Bearer auth for backward compatibility
        headers["Authorization"] = f"Bearer {secret}"
    
    req = request.Request(url, data=data, method="POST", headers=headers)
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


def _check_webhook_health(webhook_url: str) -> bool:
    """Check if webhook receiver is healthy before dispatching."""
    # Extract base URL (e.g., http://127.0.0.1:8000/webhook -> http://127.0.0.1:8000)
    base_url = webhook_url.rsplit("/", 1)[0] if "/" in webhook_url else webhook_url
    # Use /health/auth to validate auth path, not just basic health
    health_url = f"{base_url}/health/auth"
    
    try:
        req = request.Request(health_url, method="GET")
        with request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                return True
    except Exception:
        pass
    
    return False


def _legacy_dispatch_payload(sig: dict[str, Any], *, now: datetime, qty: float) -> dict[str, Any] | None:
    symbol_decision = map_signal_to_symbol(sig)
    if not symbol_decision.symbol:
        return None

    return {
        "symbol": symbol_decision.symbol,
        "side": _normalize_side(sig),
        "qty": qty,
        "timestamp": now.isoformat(),
        "strategy": "market-intel-auto",
        "source_title": sig.get("title", ""),
        "source_url": sig.get("url", ""),
        "symbol_reasoning": symbol_decision.reasoning,
        "symbol_category": symbol_decision.category,
        "symbol_confidence": symbol_decision.confidence,
        "market_intel_mode": "legacy_summary_fallback",
    }


def _candidate_dispatch_payload(candidate: dict[str, Any], *, now: datetime, qty: float) -> dict[str, Any] | None:
    primary_instrument = candidate.get("primary_instrument")
    if not isinstance(primary_instrument, dict):
        return None

    symbol = str(primary_instrument.get("symbol", "")).upper().strip()
    if not symbol:
        return None

    return {
        "symbol": symbol,
        "side": _normalize_side(candidate),
        "qty": qty,
        "timestamp": now.isoformat(),
        "strategy": "market-intel-auto",
        "source_title": candidate.get("source_title", ""),
        "source_url": candidate.get("source_url", ""),
        "candidate_id": candidate.get("candidate_id"),
        "signal_id": candidate.get("signal_id"),
        "pattern_id": candidate.get("pattern_id"),
        "pattern_name": candidate.get("pattern_name"),
        "expected_horizon": candidate.get("expected_horizon"),
        "evidence_strength": candidate.get("evidence_strength"),
        "risk_overlay_hint": candidate.get("risk_overlay_hint"),
        "market_intel_mode": "execution_candidates",
        "symbol_reasoning": primary_instrument.get("mapping_type", "execution_candidate_primary"),
        "symbol_category": candidate.get("category"),
        "symbol_confidence": primary_instrument.get("mapping_confidence"),
    }


def _fast_regime_active(cfg: Config, context_summary: dict[str, Any]) -> bool:
    if not cfg.fast_regime_enabled:
        return False
    severity = str(context_summary.get("severity", "")).lower()
    geo = int(context_summary.get("geopolitical_count", 0) or 0)
    high_conf = int(context_summary.get("high_confidence_signal_count", 0) or 0)

    return (
        severity in {"high", "critical"}
        and (
            geo >= cfg.fast_geo_threshold
            or high_conf >= cfg.fast_high_conf_threshold
        )
    )


def main() -> int:
    _load_env()
    cfg = _cfg()
    now = datetime.now(UTC)

    if cfg.market_hours_only and not _in_us_market_hours(now):
        print("Outside US market hours, skipping dispatch")
        # Silent skip - no notification needed every 5 minutes
        return 0

    # Check webhook health before attempting dispatch
    if not _check_webhook_health(cfg.webhook_url):
        print(f"ERROR: Webhook receiver not healthy at {cfg.webhook_url}")
        # Temporary mute during active construction/audit phase:
        # avoid Telegram spam from misleading health/auth failures until
        # monitoring logic is corrected and deduplicated.
        return 1

    if not cfg.webhook_secret:
        print("WEBHOOK_SHARED_SECRET missing, abort")
        return 1

    enhanced = _read_json(MI_DATA / "enhanced_signals.json", [])
    if not isinstance(enhanced, list):
        print("enhanced_signals.json invalid format")
        return 1

    context_snapshot = load_context_snapshot()
    context_summary = context_snapshot.get("summary", {}) if isinstance(context_snapshot, dict) else {}
    fast_mode = _fast_regime_active(cfg, context_summary)
    min_reasoning_score = cfg.fast_min_reasoning_score if fast_mode else cfg.min_reasoning_score
    qty_multiplier = cfg.fast_qty_multiplier if fast_mode else 1.0

    candidate_load = None
    signal_source = "enhanced_signals"
    dispatch_items: list[dict[str, Any]] = enhanced
    if cfg.execution_candidates_enabled:
        candidate_load = load_ready_execution_candidates()
        if candidate_load["ok"]:
            dispatch_items = candidate_load["candidates"]
            signal_source = "execution_candidates"
        else:
            signal_source = "enhanced_signals_fallback"

    state = _load_state()
    sent = state["sent"]

    dispatched = 0
    blocked = 0
    lines: list[str] = []

    for warning in (candidate_load or {}).get("warnings", []):
        logger.warning("execution candidates adapter warning: %s", warning)

    for sig in dispatch_items:
        if not isinstance(sig, dict):
            continue

        if signal_source == "execution_candidates":
            conf = str(sig.get("confidence_level", "")).upper()
            reasoning = float(sig.get("reasoning_score", 0) or 0)
            if conf != cfg.confidence:
                continue
            if reasoning < min_reasoning_score:
                continue
        else:
            conf = str(sig.get("confidence_level", "")).upper()
            reasoning = float(sig.get("reasoning_score", 0) or 0)
            if conf != cfg.confidence:
                continue
            if reasoning < min_reasoning_score:
                continue

        key = _signal_key(sig)
        if key in sent:
            continue

        qty = min(cfg.qty * qty_multiplier, cfg.max_qty)
        if signal_source == "execution_candidates":
            body = _candidate_dispatch_payload(sig, now=now, qty=qty)
            if body is None:
                blocked += 1
                lines.append(
                    f"⚠️ skipped (invalid primary instrument) | {str(sig.get('source_title', ''))[:70]}"
                )
                continue
        else:
            body = _legacy_dispatch_payload(sig, now=now, qty=qty)
            if body is None:
                blocked += 1
                lines.append(f"⚠️ skipped (no ticker) | {str(sig.get('title',''))[:70]}")
                continue

        status, resp = _post_webhook(cfg.webhook_url, body, cfg.webhook_secret)
        accepted = isinstance(resp, dict) and bool(resp.get("accepted")) and status in {200, 201}

        # Sanitize response before storing (never persist secrets)
        stored_resp = resp
        if isinstance(resp, dict):
            stored_resp = {k: v for k, v in resp.items() if k.lower() not in ("secret", "token", "auth", "api_key")}
        
        sent[key] = {
            "title": sig.get("source_title", sig.get("title", "")),
            "timestamp": now.isoformat(),
            "status": status,
            "accepted": accepted,
            "source_mode": signal_source,
            "response": stored_resp,
        }

        if accepted:
            dispatched += 1
            sym_info = f"{body['symbol']} ({body.get('symbol_category', 'unknown')})"
            lines.append(
                f"✅ {sym_info} {body['side']} qty={qty} [{signal_source}] | {str(body.get('source_title',''))[:60]}"
            )
        else:
            blocked += 1
            lines.append(
                f"⚠️ blocked status={status} [{signal_source}] | {str(body.get('source_title',''))[:60]}"
            )

    mode_name = 'FAST' if fast_mode else 'CONSERVATIVE'
    mode_line = (
        f"mode={mode_name} "
        f"min_score={min_reasoning_score} qty_mult={qty_multiplier}"
    )
    source_line = (
        f"candidate_mode={'on' if cfg.execution_candidates_enabled else 'off'} "
        f"signal_source={signal_source}"
    )

    if candidate_load and not candidate_load["ok"]:
        lines.insert(0, f"⚠️ execution_candidates fallback: {', '.join(candidate_load['warnings'])}")

    # Notify mode changes even when nothing dispatched (without spamming every cycle)
    mode_changed = state.get("last_mode") != mode_name
    if mode_changed:
        _send_digest([f"🔁 mode switched: {state.get('last_mode')} → {mode_name}", mode_line, source_line])

    if dispatched or blocked:
        _send_digest([mode_line, source_line, f"dispatched={dispatched} blocked={blocked}"] + lines[:8])

    state["last_mode"] = mode_name
    state["last_signal_source"] = signal_source
    state["updated_at"] = now.isoformat()
    _write_json(STATE_PATH, state)

    print(
        f"dispatch complete: {mode_line} {source_line} "
        f"dispatched={dispatched} blocked={blocked} mode_changed={mode_changed}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
