"""Local paper-only webhook receiver.

Exposes a minimal HTTP endpoint (POST /webhook) for local testing.
Validates payloads, evaluates risk decision, logs structured results locally,
and can optionally submit to Alpaca PAPER endpoint only.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import sys
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from time import time
from typing import Any, Dict

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Load .env from project root
_env_path = ROOT / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, val = line.split("=", 1)
            os.environ.setdefault(key.strip(), val.strip())

from src.broker_adapter_alpaca import AlpacaPaperAdapter, PaperOnlyViolationError
from src.context_adapter import load_context_snapshot
from src.execution_orchestrator import ExecutionOrchestrator
from src.risk_manager import AccountState, RiskConfig, evaluate_risk_decision
from src.signal_fusion import derive_decision_context
from src.signal_validator import validate_signal_payload
import secrets

LOG_PATH = ROOT / "logs" / "webhook_decisions.jsonl"
MAX_PAYLOAD_SIZE = 1024 * 1024  # 1MB
MAX_BUCKETS = 1000  # Global cap on rate-limit buckets to prevent memory exhaustion

_RATE_LIMIT_BUCKETS: Dict[str, list[float]] = {}
_RATE_LIMIT_LOCK = Lock()
_bucket_access_order: list[str] = []  # LRU tracking

# Sensitive field names to redact (case-insensitive)
_SENSITIVE_FIELDS = frozenset({
    "secret", "token", "api_key", "api_secret", "password",
    "authorization", "bearer", "access_token", "refresh_token",
    "private_key", "client_secret", "credentials",
})


def _redact_sensitive(data: Any) -> Any:
    """Recursively redact sensitive fields from data structure."""
    if isinstance(data, dict):
        redacted = {}
        for key, value in data.items():
            if key.lower() in _SENSITIVE_FIELDS:
                redacted[key] = "[REDACTED]"
            else:
                redacted[key] = _redact_sensitive(value)
        return redacted
    elif isinstance(data, list):
        return [_redact_sensitive(item) for item in data]
    else:
        return data


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _env_flag(name: str, *, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, *, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def _get_client_ip(headers: Dict[str, str], client_address: tuple | None) -> str:
    """Get client IP with X-Forwarded-For support and trusted proxy validation."""
    import ipaddress
    
    # Direct connection - use socket peer IP
    if not client_address:
        return "unknown"
    
    direct_ip = client_address[0]
    
    # Check if behind trusted proxy
    trusted_proxies = os.getenv("WEBHOOK_TRUSTED_PROXIES", "").strip().split(",")
    trusted_proxies = [p.strip() for p in trusted_proxies if p.strip()]
    
    # Only trust X-Forwarded-For if direct IP is explicitly in trusted proxies
    if trusted_proxies and direct_ip in trusted_proxies:
        xff = headers.get("X-Forwarded-For", "")
        if xff:
            # X-Forwarded-For can have multiple IPs: client, proxy1, proxy2
            # First one is the original client
            xff_ip = xff.split(",")[0].strip()
            # Validate it's a proper IP address to prevent header injection
            try:
                ipaddress.ip_address(xff_ip)
                return xff_ip
            except ValueError:
                # Invalid IP in X-Forwarded-For, fall back to direct
                pass
    
    # Fall back to direct connection IP (localhost webhook - safe default)
    return direct_ip


def _rate_limit_allowed(client_ip: str) -> bool:
    enabled = _env_flag("WEBHOOK_RATE_LIMIT_ENABLED", default=True)
    if not enabled:
        return True

    max_requests = _env_int("WEBHOOK_RATE_LIMIT_MAX_REQUESTS", default=120)
    window_seconds = _env_int("WEBHOOK_RATE_LIMIT_WINDOW_SECONDS", default=60)
    now = time()

    with _RATE_LIMIT_LOCK:
        # Evict oldest buckets if at global cap (LRU eviction)
        if client_ip not in _RATE_LIMIT_BUCKETS and len(_RATE_LIMIT_BUCKETS) >= MAX_BUCKETS:
            # Remove oldest accessed bucket
            while _bucket_access_order:
                oldest_ip = _bucket_access_order.pop(0)
                if oldest_ip in _RATE_LIMIT_BUCKETS:
                    del _RATE_LIMIT_BUCKETS[oldest_ip]
                    break

        # Initialize bucket if new
        if client_ip not in _RATE_LIMIT_BUCKETS:
            _RATE_LIMIT_BUCKETS[client_ip] = []
            _bucket_access_order.append(client_ip)

        bucket = _RATE_LIMIT_BUCKETS[client_ip]
        cutoff = now - window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.pop(0)

        if len(bucket) >= max_requests:
            return False

        bucket.append(now)
        return True


def _health_rate_limit_allowed(client_ip: str) -> bool:
    """Rate limit for health endpoints.

    Uses a separate bucket namespace from /webhook traffic.
    """
    enabled = _env_flag("HEALTH_RATE_LIMIT_ENABLED", default=True)
    if not enabled:
        return True

    max_requests = _env_int("HEALTH_RATE_LIMIT_MAX_REQUESTS", default=60)
    window_seconds = _env_int("HEALTH_RATE_LIMIT_WINDOW_SECONDS", default=60)
    now = time()
    bucket_key = f"health:{client_ip}"

    with _RATE_LIMIT_LOCK:
        if bucket_key not in _RATE_LIMIT_BUCKETS and len(_RATE_LIMIT_BUCKETS) >= MAX_BUCKETS:
            while _bucket_access_order:
                oldest_ip = _bucket_access_order.pop(0)
                if oldest_ip in _RATE_LIMIT_BUCKETS:
                    del _RATE_LIMIT_BUCKETS[oldest_ip]
                    break

        if bucket_key not in _RATE_LIMIT_BUCKETS:
            _RATE_LIMIT_BUCKETS[bucket_key] = []
            _bucket_access_order.append(bucket_key)

        bucket = _RATE_LIMIT_BUCKETS[bucket_key]
        cutoff = now - window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.pop(0)

        if len(bucket) >= max_requests:
            return False

        bucket.append(now)
        return True


def _auth_allowed(headers: Dict[str, str], payload: Dict[str, Any] | None = None, body_bytes: bytes | None = None) -> bool:
    """Optional shared-secret auth for incoming webhooks with replay protection.

    Accepts any of:
    - Header: X-Webhook-Secret
    - Header: Authorization: Bearer <secret>

    Plus replay protection (when signature present):
    - Header: X-Timestamp (ISO-8601, must be within 5 minutes)
    - Header: X-Signature (HMAC-SHA256 of timestamp + body)
    """
    secret = os.getenv("WEBHOOK_SHARED_SECRET", "").strip()
    if not secret:
        logger.error("Webhook receiver started without WEBHOOK_SHARED_SECRET - rejecting all requests")
        return False  # Fail-closed: reject if no secret configured

    # Basic secret validation (backward compatible)
    header_secret = headers.get("X-Webhook-Secret", "")
    bearer_secret = ""
    auth_header = headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        bearer_secret = auth_header[7:]
    # Use constant-time comparison to prevent timing attacks
    x_webhook_match = secrets.compare_digest(header_secret.encode(), secret.encode())
    bearer_match = secrets.compare_digest(bearer_secret.encode(), secret.encode())
    basic_auth_ok = x_webhook_match or bearer_match
    
    if not basic_auth_ok:
        return False
    
    # Require both timestamp and signature for all authenticated requests.
    # This prevents replay attacks - requests without HMAC headers are rejected.
    timestamp_str = headers.get("X-Timestamp", "")
    signature = headers.get("X-Signature", "")
    
    # Reject if either timestamp or signature is missing
    if not timestamp_str or not signature or body_bytes is None:
        logger.warning("Webhook requires both X-Timestamp and X-Signature headers")
        return False
    
    # Validate timestamp window (5 minutes)
    try:
        # Parse ISO-8601 timestamp
        timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        age = (now - timestamp).total_seconds()
        if abs(age) > 300:  # 5 minute window
            logger.warning(f"Webhook timestamp outside 5-min window: age={age:.1f}s")
            return False
    except (ValueError, TypeError) as e:
        logger.warning(f"Invalid webhook timestamp format: {e}")
        return False
    
    # Validate HMAC signature
    try:
        # Reconstruct the signed message
        body_str = body_bytes.decode('utf-8')
        message = f"{timestamp_str}:{body_str}"
        expected_sig = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
        if not secrets.compare_digest(signature.encode(), expected_sig.encode()):
            logger.warning("Webhook signature mismatch")
            return False
    except Exception as e:
        logger.warning(f"Signature validation error: {e}")
        return False
    
    return True


def process_webhook_payload(
    payload: Dict[str, Any],
    *,
    state: AccountState | None = None,
    config: RiskConfig | None = None,
    paper_execute: bool | None = None,
) -> Dict[str, Any]:
    """Validate signal, derive context modifiers, run risk, optionally execute paper order."""
    validation = validate_signal_payload(payload)

    if state is None:
        state = AccountState(daily_pnl=0.0, open_positions=0)
    if config is None:
        config = RiskConfig(
            kill_switch_enabled=False,
            daily_loss_cap=100.0,
            max_position_size=1.0,
            max_open_positions=3,
        )
    if paper_execute is None:
        paper_execute = _env_flag("PAPER_EXECUTE", default=False)

    if not validation["ok"]:
        return {
            "accepted": False,
            "reasons": validation["errors"],
            "validation": validation,
            "context": None,
            "decision_context": None,
            "proposal": None,
            "risk": None,
            "execution": {
                "executed": False,
                "status": "validation_failed",
                "paper_execute": paper_execute,
                "paper_only": True,
            },
            "paper_only": True,
        }

    normalized = dict(validation["normalized"])

    # Broker-backed symbol existence/tradability validation (fail-open on broker outage).
    if _env_flag("BROKER_SYMBOL_VALIDATION_ENABLED", default=True):
        try:
            adapter = AlpacaPaperAdapter()
            symbol_ok, symbol_reason = adapter.validate_symbol(normalized.get("symbol", ""))
            if not symbol_ok:
                reason = f"Field 'symbol' failed broker validation: {symbol_reason}"
                return {
                    "accepted": False,
                    "reasons": [reason],
                    "validation": validation,
                    "context": None,
                    "decision_context": None,
                    "proposal": None,
                    "risk": None,
                    "execution": {
                        "executed": False,
                        "status": "validation_failed",
                        "paper_execute": paper_execute,
                        "paper_only": True,
                    },
                    "paper_only": True,
                }
        except Exception as exc:
            logger.warning(f"Broker symbol validation unavailable; continuing with format validation only: {exc}")

    context_snapshot = load_context_snapshot()
    decision_context = derive_decision_context(normalized, context_snapshot)

    raw_qty = float(normalized.get("qty", 0.0) or 0.0)
    adjusted_qty = round(raw_qty * decision_context["size_multiplier"], 6)
    adjusted_signal = dict(normalized)
    adjusted_signal["qty"] = adjusted_qty

    risk_decision = evaluate_risk_decision(adjusted_signal, state, config)

    reasons = list(risk_decision["reasons"])
    if decision_context["block_reason"]:
        reasons.append(decision_context["block_reason"])

    accepted = risk_decision["allow"] and decision_context["block_reason"] is None

    execution: Dict[str, Any] = {
        "executed": False,
        "status": "dry_run",
        "paper_execute": paper_execute,
        "paper_only": True,
    }

    if paper_execute:
        try:
            adapter = AlpacaPaperAdapter()
            orchestrator = ExecutionOrchestrator(adapter)
            execution = orchestrator.execute(
                signal=adjusted_signal,
                context=context_snapshot,
                decision_context=decision_context,
                risk_decision={"allow": accepted, "reasons": reasons},
                source="webhook",
            )
            execution["paper_execute"] = True
        except PaperOnlyViolationError as exc:
            execution = {
                "executed": False,
                "status": "paper_guard_blocked",
                "reason": str(exc),
                "paper_execute": True,
                "paper_only": True,
            }

    return {
        "accepted": accepted,
        "reasons": reasons,
        "validation": validation,
        "context": context_snapshot,
        "decision_context": decision_context,
        "proposal": {
            "raw_qty": raw_qty,
            "adjusted_qty": adjusted_qty,
            "size_multiplier": decision_context["size_multiplier"],
            "confidence_adjustment": decision_context["confidence_adjustment"],
        },
        "risk": risk_decision,
        "execution": execution,
        "paper_only": True,
    }


def _append_log(record: Dict[str, Any], *, log_path: Path = LOG_PATH) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    # Create log file with restrictive permissions if it doesn't exist
    if not log_path.exists():
        log_path.touch(mode=0o600)
    with log_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
    # Ensure permissions stay restrictive after write (umask may have changed)
    try:
        os.chmod(log_path, 0o600)
    except OSError:
        pass  # Best-effort permission hardening
    # Prune old entries if log is too large (30-day retention, ~10MB max)
    _prune_log_if_needed(log_path)


def _prune_log_if_needed(log_path: Path, max_size_mb: int = 10, retention_days: int = 30) -> None:
    """Prune old entries if log exceeds size threshold."""
    try:
        if not log_path.exists():
            return
        size_mb = log_path.stat().st_size / (1024 * 1024)
        if size_mb < max_size_mb:
            return
        # Log too large - keep only recent entries (last 30 days)
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
        kept = []
        with log_path.open("r", encoding="utf-8") as f:
            for line in f:
                try:
                    entry = json.loads(line)
                    ts = entry.get("timestamp", "")
                    if ts:
                        entry_time = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                        if entry_time >= cutoff:
                            kept.append(line)
                except json.JSONDecodeError:
                    continue
        # Overwrite with kept entries
        with log_path.open("w", encoding="utf-8") as f:
            f.writelines(kept)
    except Exception:
        pass  # Best-effort pruning, don't break logging


class WebhookHandler(BaseHTTPRequestHandler):
    """Minimal webhook handler for local paper-mode testing."""

    server_version = "ATBWebhook/0.1"

    def _send_json(self, status: int, body: Dict[str, Any]) -> None:
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        # Security headers
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("X-XSS-Protection", "1; mode=block")
        self.send_header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        self.end_headers()
        self.wfile.write(encoded)

    def do_POST(self) -> None:  # noqa: N802 (BaseHTTPRequestHandler naming)
        if self.path != "/webhook":
            self._send_json(404, {"error": "Not found", "paper_only": True})
            return

        client_ip = _get_client_ip(dict(self.headers), self.client_address)
        if not _rate_limit_allowed(client_ip):
            self._send_json(429, {"error": "Rate limit exceeded", "paper_only": True})
            return

        content_length = self.headers.get("Content-Length")
        if not content_length:
            self._send_json(400, {"error": "Missing Content-Length", "paper_only": True})
            return

        # Validate Content-Length is a valid non-negative integer
        if not content_length.strip().isdigit():
            self._send_json(400, {"error": "Invalid Content-Length format", "paper_only": True})
            return

        content_length_int = int(content_length)
        if content_length_int < 0 or content_length_int > MAX_PAYLOAD_SIZE:
            self._send_json(413, {"error": "Payload too large", "max_size": MAX_PAYLOAD_SIZE, "paper_only": True})
            return

        try:
            raw = self.rfile.read(content_length_int)
            payload = json.loads(raw.decode("utf-8"))
        except (ValueError, json.JSONDecodeError):
            self._send_json(400, {"error": "Invalid JSON payload", "paper_only": True})
            return

        if not _auth_allowed(dict(self.headers), payload, raw):
            self._send_json(401, {"error": "Unauthorized webhook", "paper_only": True})
            return

        result = process_webhook_payload(payload)
        status = 200 if result["accepted"] else 422

        # Redact sensitive fields before logging (comprehensive redaction)
        log_payload = _redact_sensitive(payload)

        record = {
            "timestamp": _utc_now_iso(),
            "path": self.path,
            "request": log_payload,
            "result": result,
            "paper_only": True,
        }
        _append_log(record)

        response = {
            "accepted": result["accepted"],
            "reasons": result["reasons"],
            "proposal": result.get("proposal"),
            "decision_context": result.get("decision_context"),
            "execution": result.get("execution"),
            "paper_only": True,
        }
        self._send_json(status, response)

    def do_GET(self) -> None:  # noqa: N802
        client_ip = _get_client_ip(dict(self.headers), self.client_address)
        if self.path in {"/health", "/health/auth"} and not _health_rate_limit_allowed(client_ip):
            self._send_json(429, {"error": "Health endpoint rate limit exceeded", "paper_only": True})
            return

        if self.path == "/health":
            self._send_json(200, {"ok": True, "paper_only": True})
            return
        if self.path == "/health/auth":
            # Validate that shared secret is configured and auth path works
            secret = os.getenv("WEBHOOK_SHARED_SECRET", "").strip()
            if not secret:
                self._send_json(503, {"ok": False, "error": "Service not configured", "paper_only": True})
                return
            # Test auth validation with the configured secret
            test_headers = {"X-Webhook-Secret": secret}
            if _auth_allowed(test_headers):
                self._send_json(200, {"ok": True, "auth": "valid", "paper_only": True})
            else:
                self._send_json(503, {"ok": False, "error": "Auth validation failed", "paper_only": True})
            return
        self._send_json(404, {"error": "Not found", "paper_only": True})

    def log_message(self, format: str, *args: Any) -> None:
        # Keep console output quiet by default. Structured events are written to logs.
        return


def run_server(host: str = "127.0.0.1", port: int = 8000) -> None:
    """Run the local webhook HTTP server."""
    allow_non_local = _env_flag("ALLOW_NON_LOCALHOST_BIND", default=False)
    if host not in {"127.0.0.1", "localhost", "::1"} and not allow_non_local:
        raise ValueError(
            f"Refusing to bind webhook receiver to non-local host '{host}'. "
            "Set ALLOW_NON_LOCALHOST_BIND=true only for explicit dev/testing use."
        )

    server = ThreadingHTTPServer((host, port), WebhookHandler)
    print(f"Paper-only webhook receiver listening on http://{host}:{port}/webhook")
    print(f"PAPER_EXECUTE={'true' if _env_flag('PAPER_EXECUTE', default=False) else 'false'}")
    print(f"ALLOW_NON_LOCALHOST_BIND={'true' if allow_non_local else 'false'}")
    print(f"Logging decisions to: {LOG_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    host = os.getenv("WEBHOOK_HOST", "127.0.0.1")
    try:
        port = int(os.getenv("WEBHOOK_PORT", "8000"))
    except ValueError:
        port = 8000
    run_server(host=host, port=port)
