"""Webhook receiver for futures paper execution."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sys
from datetime import UTC, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from time import time
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.broker_adapter_tradovate import TradovatePaperAdapter
from src.execution_orchestrator import ExecutionOrchestrator
from src.position_manager import PositionManager
from src.risk_manager import AccountState, RiskConfig

LOG_PATH = ROOT / "logs" / "webhook_decisions.jsonl"
MAX_PAYLOAD_BYTES = 1_000_000

# Rate limiting: 120 requests per 60 seconds per IP
_RATE_LIMIT_BUCKETS: dict[str, list[float]] = {}
_RATE_LIMIT_LOCK = Lock()


def _load_env() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _redact_payload(payload: Any) -> Any:
    if not isinstance(payload, dict):
        return payload
    redacted = dict(payload)
    for key in ("secret", "token", "api_key", "api_secret", "password"):
        if key in redacted:
            redacted[key] = "[REDACTED]"
    return redacted


def _append_log(record: dict[str, Any], path: Path = LOG_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, sort_keys=True) + "\n")


def _authorized(headers: dict[str, str], payload: dict[str, Any], body_bytes: bytes | None = None) -> bool:
    """Validate webhook auth with optional HMAC replay protection.

    Supported basic auth paths (backward-compatible):
    - X-Webhook-Secret header
    - Authorization: Bearer <secret>
    - payload["secret"]

    Enhanced protection (recommended):
    - X-Timestamp (ISO-8601, within 5 minutes)
    - X-Signature (HMAC-SHA256 of "timestamp:body")
    """
    expected = os.getenv("WEBHOOK_SHARED_SECRET", "").strip()
    if not expected:
        return False

    header_secret = headers.get("X-Webhook-Secret", "")
    payload_secret = str(payload.get("secret", ""))
    bearer_secret = ""
    auth_header = headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        bearer_secret = auth_header[7:]

    basic_auth_ok = (
        secrets.compare_digest(header_secret.encode(), expected.encode())
        or secrets.compare_digest(payload_secret.encode(), expected.encode())
        or secrets.compare_digest(bearer_secret.encode(), expected.encode())
    )
    if not basic_auth_ok:
        return False

    timestamp_str = headers.get("X-Timestamp", "")
    signature = headers.get("X-Signature", "")

    # Backward compatibility path: allow basic auth when HMAC headers are absent.
    if not timestamp_str and not signature:
        return True

    # If one HMAC header is present, both must be present.
    if not timestamp_str or not signature or body_bytes is None:
        return False

    try:
        ts = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
    except ValueError:
        return False

    now = datetime.now(UTC)
    if abs((now - ts).total_seconds()) > timedelta(minutes=5).total_seconds():
        return False

    try:
        body_text = body_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return False

    message = f"{timestamp_str}:{body_text}".encode("utf-8")
    expected_sig = hmac.new(expected.encode("utf-8"), message, hashlib.sha256).hexdigest()
    return secrets.compare_digest(signature.encode("utf-8"), expected_sig.encode("utf-8"))


def _build_risk_config() -> RiskConfig:
    return RiskConfig(
        paper_mode=_env_bool("PAPER_MODE", True),
        kill_switch_enabled=_env_bool("KILL_SWITCH", True),
        daily_loss_cap=float(os.getenv("DAILY_LOSS_CAP", "500")),
        max_contracts_per_signal=int(os.getenv("MAX_CONTRACTS_PER_SIGNAL", "1")),
        max_open_contracts=int(os.getenv("MAX_OPEN_POSITIONS", "3")),
        margin_warning_threshold=float(os.getenv("MARGIN_WARNING_THRESHOLD", "0.30")),
        margin_hard_cap=float(os.getenv("MARGIN_HARD_CAP", "0.50")),
        market_hours_only=_env_bool("MARKET_HOURS_ONLY", True),
        allow_overnight=_env_bool("ALLOW_OVERNIGHT", False),
    )


def _build_account_state(adapter: TradovatePaperAdapter, positions: PositionManager) -> AccountState:
    snapshot = adapter.get_account_snapshot()
    today = datetime.now(UTC).date().isoformat()
    return AccountState(
        daily_realized_pnl=positions.daily_realized_pnl(today),
        open_contracts_total=positions.total_open_contracts(),
        margin_in_use=float(snapshot.get("margin_in_use", 0.0) or 0.0),
        account_equity=float(snapshot.get("account_equity", 1.0) or 1.0),
    )


def _rate_limit_allowed(client_ip: str) -> bool:
    """Check if request is within rate limit (120 req/60s per IP)."""
    max_requests = 120
    window_seconds = 60
    now = time()

    with _RATE_LIMIT_LOCK:
        bucket = _RATE_LIMIT_BUCKETS.setdefault(client_ip, [])
        cutoff = now - window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.pop(0)

        if len(bucket) >= max_requests:
            return False

        bucket.append(now)
        return True


class _WebhookHandler(BaseHTTPRequestHandler):
    server_version = "FuturesWebhook/0.1"

    def _send_json(self, status_code: int, body: dict[str, Any]) -> None:
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._send_json(200, {"ok": True, "paper_only": True})
            return
        self._send_json(404, {"error": "Not found", "paper_only": True})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/webhook":
            self._send_json(404, {"error": "Not found", "paper_only": True})
            return

        # Rate limiting check
        client_ip = self.client_address[0]
        if not _rate_limit_allowed(client_ip):
            self._send_json(429, {"error": "Rate limit exceeded", "paper_only": True})
            return

        content_length = self.headers.get("Content-Length", "")
        if not content_length.isdigit():
            self._send_json(400, {"error": "Invalid Content-Length", "paper_only": True})
            return

        size = int(content_length)
        if size > MAX_PAYLOAD_BYTES:
            self._send_json(413, {"error": "Payload too large", "paper_only": True})
            return

        try:
            raw = self.rfile.read(size)
            payload = json.loads(raw.decode("utf-8"))
        except (ValueError, json.JSONDecodeError):
            self._send_json(400, {"error": "Invalid JSON", "paper_only": True})
            return

        if not isinstance(payload, dict):
            self._send_json(400, {"error": "Payload must be a JSON object", "paper_only": True})
            return

        if not _authorized(dict(self.headers), payload, body_bytes=raw):
            self._send_json(401, {"error": "Unauthorized", "paper_only": True})
            return

        adapter = TradovatePaperAdapter()
        position_manager = PositionManager()
        orchestrator = ExecutionOrchestrator(
            broker_adapter=adapter,
            risk_config=_build_risk_config(),
            position_manager=position_manager,
        )
        account_state = _build_account_state(adapter, position_manager)
        result = orchestrator.process_signal(signal=payload, account_state=account_state)

        status = 200 if result.get("accepted") else 422
        record = {
            "timestamp": _utc_now_iso(),
            "path": self.path,
            "request": _redact_payload(payload),
            "result": result,
            "paper_only": True,
        }
        _append_log(record)

        response = {
            "accepted": bool(result.get("accepted")),
            "status": result.get("status", result.get("reason", "unknown")),
            "reason": result.get("reason"),
            "paper_only": True,
        }
        self._send_json(status, response)

    def log_message(self, format: str, *args: Any) -> None:
        return


def run_server(host: str = "127.0.0.1", port: int = 8001) -> None:
    _load_env()
    
    # Localhost-only bind protection (security: prevent accidental public exposure)
    allowed_hosts = ("127.0.0.1", "localhost", "::1")
    if host not in allowed_hosts:
        raise RuntimeError(
            f"Webhook receiver must bind to localhost only. Got: {host}. "
            f"Allowed: {', '.join(allowed_hosts)}. Set WEBHOOK_HOST=127.0.0.1"
        )
    
    server = ThreadingHTTPServer((host, port), _WebhookHandler)
    print(f"Futures webhook receiver listening on http://{host}:{port}/webhook")
    print(f"Health endpoint: http://{host}:{port}/health")
    print(f"Logging to: {LOG_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    _load_env()
    host = os.getenv("WEBHOOK_HOST", "127.0.0.1")
    try:
        port = int(os.getenv("WEBHOOK_PORT", "8001"))
    except ValueError:
        port = 8001
    run_server(host=host, port=port)
