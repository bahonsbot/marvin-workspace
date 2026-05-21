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
TICKER_RESEARCH_SHADOW_PATH = ROOT.parent / "market-intel" / "data" / "ticker_research_shadow.json"


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
    explorer_enabled: bool
    explorer_qty: float
    explorer_max_per_run: int
    explorer_min_confidence: float
    max_symbol_attempts_per_run: int
    max_sector_attempts_per_run: int


def _env_value(name: str, default: str = "") -> str:
    """Read env values defensively, accepting shell-style quoted values."""
    return os.getenv(name, default).strip().strip('"\'').strip()


def _normalize_confidence_label(value: str) -> str:
    label = (value or "").strip().strip('"\'').strip().upper()
    legacy_map = {
        "STRONG BUY": "HIGH_PRIORITY",
        "BUY": "WATCH",
        "HOLD": "OBSERVE",
        "WEAK": "LOW_CONFIDENCE",
    }
    return legacy_map.get(label, label)


def _cfg() -> Config:
    webhook_url = os.getenv("AUTO_WEBHOOK_URL", "http://127.0.0.1:8000/webhook").strip()
    # Enforce HTTPS for non-local webhook URLs (allow plain HTTP only for local loopback)
    local_http_prefixes = (
        "http://localhost",
        "http://127.0.0.1",
        "http://[::1]",
    )
    if not webhook_url.startswith("https://") and not webhook_url.startswith(local_http_prefixes):
        raise ValueError(
            "AUTO_WEBHOOK_URL must use https:// for non-local destinations; "
            "plain http:// is allowed only for localhost/127.0.0.1/::1"
        )

    return Config(
        webhook_url=webhook_url,
        webhook_secret=_env_value("WEBHOOK_SHARED_SECRET"),
        execution_candidates_enabled=_env_value("EXECUTION_CANDIDATES_ENABLED", "false").lower() in {"1", "true", "yes", "on"},
        confidence=_normalize_confidence_label(_env_value("AUTO_MIN_CONFIDENCE", "HIGH_PRIORITY")),
        min_reasoning_score=float(_env_value("AUTO_MIN_REASONING_SCORE", "80")),
        qty=float(_env_value("AUTO_BASE_QTY", "1")),
        max_qty=float(_env_value("AUTO_MAX_QTY", "1")),
        market_hours_only=_env_value("AUTO_MARKET_HOURS_ONLY", "true").lower() in {"1", "true", "yes", "on"},
        fast_regime_enabled=_env_value("AUTO_FAST_REGIME_ENABLED", "true").lower() in {"1", "true", "yes", "on"},
        fast_min_reasoning_score=float(_env_value("AUTO_FAST_MIN_REASONING_SCORE", "75")),
        fast_qty_multiplier=float(_env_value("AUTO_FAST_QTY_MULTIPLIER", "1.25")),
        fast_geo_threshold=int(_env_value("AUTO_FAST_GEO_THRESHOLD", "3")),
        fast_high_conf_threshold=int(_env_value("AUTO_FAST_HIGH_CONF_THRESHOLD", "30")),
        explorer_enabled=_env_value("AUTO_EXPLORER_ENABLED", "false").lower() in {"1", "true", "yes", "on"},
        explorer_qty=float(_env_value("AUTO_EXPLORER_QTY", "0.5")),
        explorer_max_per_run=int(_env_value("AUTO_EXPLORER_MAX_PER_RUN", "1")),
        explorer_min_confidence=float(_env_value("AUTO_EXPLORER_MIN_CONFIDENCE", "0.60")),
        max_symbol_attempts_per_run=int(_env_value("AUTO_MAX_SYMBOL_ATTEMPTS_PER_RUN", "2")),
        max_sector_attempts_per_run=int(_env_value("AUTO_MAX_SECTOR_ATTEMPTS_PER_RUN", "4")),
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
    event_cluster_id = str(sig.get("event_cluster_id", "")).strip()
    if event_cluster_id:
        return f"event_cluster:{event_cluster_id}"

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


def _normalize_side(sig: dict[str, Any]) -> str | None:
    primary_instrument = sig.get("primary_instrument")
    if isinstance(primary_instrument, dict):
        direction_bias = str(primary_instrument.get("direction_bias", "")).lower().strip()
        if direction_bias == "short":
            return "sell"
        if direction_bias == "long":
            return "buy"

    rec = str(sig.get("recommendation", "")).upper().strip()
    if rec in {"TAKE", "BUY", "LONG", "STRONG BUY", "HIGH_PRIORITY", "WATCH"}:
        return "buy"
    if rec in {"SELL", "SHORT"}:
        return "sell"
    return None


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
    side = _normalize_side(sig)
    if side is None:
        return None

    return {
        "symbol": symbol_decision.symbol,
        "side": side,
        "qty": qty,
        "timestamp": sig.get("timestamp") or now.isoformat(),
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

    side = _normalize_side(candidate)
    if side is None:
        return None

    semantic_fit = candidate.get("semantic_fit") if isinstance(candidate.get("semantic_fit"), dict) else {}
    ticker_fit = primary_instrument.get("ticker_fit") if isinstance(primary_instrument.get("ticker_fit"), dict) else {}

    return {
        "symbol": symbol,
        "side": side,
        "qty": qty,
        "timestamp": candidate.get("source_timestamp") or now.isoformat(),
        "strategy": "market-intel-auto",
        "source_title": candidate.get("source_title", ""),
        "source_url": candidate.get("source_url", ""),
        "candidate_id": candidate.get("candidate_id"),
        "event_cluster_id": candidate.get("event_cluster_id"),
        "signal_id": candidate.get("signal_id"),
        "pattern_id": candidate.get("pattern_id"),
        "pattern_name": candidate.get("pattern_name"),
        "expected_horizon": candidate.get("expected_horizon"),
        "evidence_strength": candidate.get("evidence_strength"),
        "risk_overlay_hint": candidate.get("risk_overlay_hint"),
        "theme": candidate.get("theme"),
        "chain_layer": candidate.get("chain_layer"),
        "chain_sublayer": candidate.get("chain_sublayer"),
        "bottleneck_type": candidate.get("bottleneck_type"),
        "moat_type": candidate.get("moat_type"),
        "fragility_type": candidate.get("fragility_type"),
        "supplier_status": candidate.get("supplier_status"),
        "position_in_chain": candidate.get("position_in_chain"),
        "beneficiary_class": candidate.get("beneficiary_class"),
        "loser_class": candidate.get("loser_class"),
        "pair_trade_candidate": candidate.get("pair_trade_candidate"),
        "pair_trade_rationale": candidate.get("pair_trade_rationale"),
        "valuation_context": candidate.get("valuation_context"),
        "value_chain_notes": candidate.get("value_chain_notes"),
        "structural_interpretation_confidence": candidate.get("structural_interpretation_confidence"),
        "market_intel_mode": "execution_candidates",
        "symbol_reasoning": primary_instrument.get("mapping_type", "execution_candidate_primary"),
        "symbol_category": candidate.get("category"),
        "symbol_confidence": primary_instrument.get("mapping_confidence"),
        "semantic_fit_score": semantic_fit.get("score"),
        "semantic_fit_reasons": ",".join(str(reason) for reason in semantic_fit.get("reasons", [])[:5]),
        "ticker_fit_score": ticker_fit.get("score"),
        "ticker_fit_directness": ticker_fit.get("directness"),
        "ticker_fit_reasons": ",".join(str(reason) for reason in ticker_fit.get("reasons", [])[:5]),
    }



def _load_ticker_research_shadow(path: Path = TICKER_RESEARCH_SHADOW_PATH) -> dict[str, Any]:
    payload = _read_json(path, {})
    if not isinstance(payload, dict):
        return {}
    promotion = payload.get("promotion")
    if not isinstance(promotion, dict) or promotion.get("status") != "shadow_only":
        return {}
    by_candidate: dict[str, dict[str, Any]] = {}
    for row in payload.get("candidates", []):
        if not isinstance(row, dict):
            continue
        candidate_id = str(row.get("candidate_id") or "").strip()
        if candidate_id:
            by_candidate[candidate_id] = row
    return by_candidate


def _select_explorer_idea(row: dict[str, Any], *, min_confidence: float) -> dict[str, Any] | None:
    role_preference = ["hidden_supplier", "second_order_beneficiary", "hedge_or_short_leg", "etf_fallback"]
    ideas = [idea for idea in row.get("research_ideas", []) if isinstance(idea, dict)]
    eligible = []
    for idea in ideas:
        if idea.get("executable") is not False or idea.get("dispatcher_eligible") is not False:
            continue
        symbol = str(idea.get("symbol") or "").upper().strip()
        side = str(idea.get("side") or "").lower().strip()
        if not symbol or side not in {"buy", "sell"}:
            continue
        if float(idea.get("research_confidence") or 0) < min_confidence:
            continue
        if str(idea.get("liquidity_tier") or "") not in {"very_high", "high", "medium"}:
            continue
        eligible.append(idea)

    if not eligible:
        return None

    def rank(idea: dict[str, Any]) -> tuple[int, float, str]:
        role = str(idea.get("role") or "")
        try:
            role_rank = role_preference.index(role)
        except ValueError:
            role_rank = len(role_preference)
        return (role_rank, -float(idea.get("research_confidence") or 0), str(idea.get("symbol") or ""))

    return sorted(eligible, key=rank)[0]


def _explorer_dispatch_payload(candidate: dict[str, Any], idea: dict[str, Any], *, now: datetime, qty: float) -> dict[str, Any] | None:
    symbol = str(idea.get("symbol") or "").upper().strip()
    side = str(idea.get("side") or "").lower().strip()
    if not symbol or side not in {"buy", "sell"}:
        return None

    return {
        "symbol": symbol,
        "side": side,
        "qty": qty,
        "timestamp": candidate.get("source_timestamp") or now.isoformat(),
        "strategy": "market-intel-explorer",
        "source_title": candidate.get("source_title", ""),
        "source_url": candidate.get("source_url", ""),
        "candidate_id": f"{candidate.get('candidate_id')}:explorer:{idea.get('role')}:{symbol}",
        "event_cluster_id": candidate.get("event_cluster_id"),
        "signal_id": candidate.get("signal_id"),
        "pattern_id": candidate.get("pattern_id"),
        "pattern_name": candidate.get("pattern_name"),
        "expected_horizon": candidate.get("expected_horizon"),
        "evidence_strength": candidate.get("evidence_strength"),
        "theme": candidate.get("theme"),
        "chain_layer": candidate.get("chain_layer"),
        "chain_sublayer": candidate.get("chain_sublayer"),
        "market_intel_mode": "ticker_research_explorer",
        "symbol_reasoning": f"explorer_{idea.get('role')}",
        "symbol_category": candidate.get("category"),
        "symbol_confidence": idea.get("research_confidence"),
        "explorer_role": idea.get("role"),
        "explorer_rationale": idea.get("rationale", ""),
        "explorer_liquidity_tier": idea.get("liquidity_tier"),
        "explorer_source": idea.get("source"),
        "explorer_promotion_status": idea.get("promotion_status"),
    }


SECTOR_BY_SYMBOL = {
    "XOM": "energy",
    "CVX": "energy",
    "USO": "energy",
    "XLE": "energy",
    "LMT": "defense",
    "RTX": "defense",
    "NOC": "defense",
    "LHX": "defense",
    "GD": "defense",
    "ITA": "defense",
    "DAL": "airlines",
    "AAL": "airlines",
    "JETS": "airlines",
    "ZIM": "shipping",
    "MATX": "shipping",
    "SEA": "shipping",
    "SH": "hedge",
    "SPY": "broad_market",
}


def _symbol_sector(symbol: str) -> str:
    return SECTOR_BY_SYMBOL.get(str(symbol or "").upper().strip(), "unknown")


def _concentration_block_reason(body: dict[str, Any], symbol_attempts: dict[str, int], sector_attempts: dict[str, int], cfg: Config) -> str | None:
    symbol = str(body.get("symbol") or "").upper().strip()
    sector = _symbol_sector(symbol)
    if cfg.max_symbol_attempts_per_run > 0 and symbol_attempts.get(symbol, 0) >= cfg.max_symbol_attempts_per_run:
        return f"symbol_attempt_cap:{symbol}:{symbol_attempts.get(symbol, 0)}>={cfg.max_symbol_attempts_per_run}"
    if cfg.max_sector_attempts_per_run > 0 and sector_attempts.get(sector, 0) >= cfg.max_sector_attempts_per_run:
        return f"sector_attempt_cap:{sector}:{sector_attempts.get(sector, 0)}>={cfg.max_sector_attempts_per_run}"
    return None


def _record_concentration_attempt(body: dict[str, Any], symbol_attempts: dict[str, int], sector_attempts: dict[str, int]) -> None:
    symbol = str(body.get("symbol") or "").upper().strip()
    sector = _symbol_sector(symbol)
    if symbol:
        symbol_attempts[symbol] = symbol_attempts.get(symbol, 0) + 1
    sector_attempts[sector] = sector_attempts.get(sector, 0) + 1

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
    explorer_sent = state.setdefault("explorer_sent", {})
    shadow_by_candidate = _load_ticker_research_shadow() if cfg.explorer_enabled and signal_source == "execution_candidates" else {}

    dispatched = 0
    blocked = 0
    explorer_dispatched = 0
    explorer_blocked = 0
    concentration_blocked = 0
    symbol_attempts: dict[str, int] = {}
    sector_attempts: dict[str, int] = {}
    lines: list[str] = []

    for warning in (candidate_load or {}).get("warnings", []):
        logger.warning("execution candidates adapter warning: %s", warning)

    for sig in dispatch_items:
        if not isinstance(sig, dict):
            continue

        if signal_source == "execution_candidates":
            conf = _normalize_confidence_label(str(sig.get("confidence_level", "")))
            reasoning = float(sig.get("reasoning_score", 0) or 0)
            if conf != cfg.confidence:
                continue
            if reasoning < min_reasoning_score:
                continue
        else:
            conf = _normalize_confidence_label(str(sig.get("confidence_level", "")))
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

        value_chain_suffix = ""
        if signal_source == "execution_candidates":
            vc_bits = []
            if body.get("theme"):
                vc_bits.append(str(body.get("theme")))
            if body.get("chain_layer"):
                vc_bits.append(str(body.get("chain_layer")))
            if body.get("bottleneck_type") and body.get("bottleneck_type") != "none_clear":
                vc_bits.append(f"bottleneck={body.get('bottleneck_type')}")
            if body.get("beneficiary_class") and body.get("beneficiary_class") != "none_clear":
                vc_bits.append(f"beneficiary={body.get('beneficiary_class')}")
            if vc_bits:
                value_chain_suffix = " | " + " / ".join(vc_bits[:4])

        concentration_reason = _concentration_block_reason(body, symbol_attempts, sector_attempts, cfg)
        if concentration_reason:
            blocked += 1
            concentration_blocked += 1
            lines.append(
                f"⚠️ skipped concentration {concentration_reason} | {str(body.get('source_title',''))[:60]}{value_chain_suffix}"
            )
            continue

        _record_concentration_attempt(body, symbol_attempts, sector_attempts)
        status, resp = _post_webhook(cfg.webhook_url, body, cfg.webhook_secret)
        accepted = isinstance(resp, dict) and bool(resp.get("accepted")) and status in {200, 201}

        # Sanitize response before storing (never persist secrets)
        stored_resp = resp
        if isinstance(resp, dict):
            stored_resp = {k: v for k, v in resp.items() if k.lower() not in ("secret", "token", "auth", "api_key")}
        
        if accepted:
            sent[key] = {
                "title": sig.get("source_title", sig.get("title", "")),
                "candidate_id": sig.get("candidate_id"),
                "event_cluster_id": sig.get("event_cluster_id"),
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
                f"✅ {sym_info} {body['side']} qty={qty} [{signal_source}] | {str(body.get('source_title',''))[:60]}{value_chain_suffix}"
            )
        else:
            blocked += 1
            lines.append(
                f"⚠️ blocked status={status} [{signal_source}] | {str(body.get('source_title',''))[:60]}{value_chain_suffix}"
            )

        if (
            cfg.explorer_enabled
            and signal_source == "execution_candidates"
            and explorer_dispatched < max(0, cfg.explorer_max_per_run)
        ):
            shadow_row = shadow_by_candidate.get(str(sig.get("candidate_id") or ""))
            idea = _select_explorer_idea(shadow_row or {}, min_confidence=cfg.explorer_min_confidence)
            if idea is not None:
                explorer_key = f"explorer:{sig.get('candidate_id')}:{idea.get('role')}:{idea.get('symbol')}"
                if explorer_key not in explorer_sent:
                    explorer_body = _explorer_dispatch_payload(sig, idea, now=now, qty=cfg.explorer_qty)
                    if explorer_body is None:
                        explorer_blocked += 1
                    else:
                        concentration_reason = _concentration_block_reason(explorer_body, symbol_attempts, sector_attempts, cfg)
                        if concentration_reason:
                            explorer_blocked += 1
                            concentration_blocked += 1
                            lines.append(
                                f"⚠️ explorer skipped concentration {concentration_reason} {explorer_body['symbol']} "
                                f"role={idea.get('role')}"
                            )
                            continue

                        _record_concentration_attempt(explorer_body, symbol_attempts, sector_attempts)
                        explorer_status, explorer_resp = _post_webhook(cfg.webhook_url, explorer_body, cfg.webhook_secret)
                        explorer_accepted = isinstance(explorer_resp, dict) and bool(explorer_resp.get("accepted")) and explorer_status in {200, 201}
                        stored_explorer_resp = explorer_resp
                        if isinstance(explorer_resp, dict):
                            stored_explorer_resp = {k: v for k, v in explorer_resp.items() if k.lower() not in ("secret", "token", "auth", "api_key")}
                        if explorer_accepted:
                            explorer_sent[explorer_key] = {
                                "title": sig.get("source_title", ""),
                                "timestamp": now.isoformat(),
                                "status": explorer_status,
                                "accepted": True,
                                "source_mode": "ticker_research_explorer",
                                "response": stored_explorer_resp,
                            }
                            explorer_dispatched += 1
                            lines.append(
                                f"🧪 explorer {explorer_body['symbol']} {explorer_body['side']} qty={cfg.explorer_qty} "
                                f"role={idea.get('role')} | {str(idea.get('rationale', ''))[:60]}"
                            )
                        else:
                            explorer_blocked += 1
                            lines.append(
                                f"⚠️ explorer blocked status={explorer_status} {explorer_body['symbol']} "
                                f"role={idea.get('role')}"
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

    if dispatched or blocked or explorer_dispatched or explorer_blocked:
        _send_digest([mode_line, source_line, f"dispatched={dispatched} blocked={blocked} explorer_dispatched={explorer_dispatched} explorer_blocked={explorer_blocked} concentration_blocked={concentration_blocked}"] + lines[:8])

    state["last_mode"] = mode_name
    state["last_signal_source"] = signal_source
    state["updated_at"] = now.isoformat()
    _write_json(STATE_PATH, state)

    print(
        f"dispatch complete: {mode_line} {source_line} "
        f"dispatched={dispatched} blocked={blocked} explorer_dispatched={explorer_dispatched} explorer_blocked={explorer_blocked} concentration_blocked={concentration_blocked} mode_changed={mode_changed}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
