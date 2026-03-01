"""Local paper-only webhook receiver.

Exposes a minimal HTTP endpoint (POST /webhook) for local testing.
Validates payloads, evaluates risk decision, logs structured results locally,
and never executes broker actions.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.risk_manager import AccountState, RiskConfig, evaluate_risk_decision
from src.signal_validator import validate_signal_payload

LOG_PATH = ROOT / "logs" / "webhook_decisions.jsonl"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def process_webhook_payload(
    payload: Dict[str, Any],
    *,
    state: AccountState | None = None,
    config: RiskConfig | None = None,
) -> Dict[str, Any]:
    """Validate signal and run risk checks for a payload."""
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

    if not validation["ok"]:
        return {
            "accepted": False,
            "reasons": validation["errors"],
            "validation": validation,
            "risk": None,
            "paper_only": True,
        }

    risk_decision = evaluate_risk_decision(validation["normalized"], state, config)
    return {
        "accepted": risk_decision["allow"],
        "reasons": risk_decision["reasons"],
        "validation": validation,
        "risk": risk_decision,
        "paper_only": True,
    }


def _append_log(record: Dict[str, Any], *, log_path: Path = LOG_PATH) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


class WebhookHandler(BaseHTTPRequestHandler):
    """Minimal webhook handler for local paper-mode testing."""

    server_version = "ATBWebhook/0.1"

    def _send_json(self, status: int, body: Dict[str, Any]) -> None:
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_POST(self) -> None:  # noqa: N802 (BaseHTTPRequestHandler naming)
        if self.path != "/webhook":
            self._send_json(404, {"error": "Not found", "paper_only": True})
            return

        content_length = self.headers.get("Content-Length")
        if not content_length:
            self._send_json(400, {"error": "Missing Content-Length", "paper_only": True})
            return

        try:
            raw = self.rfile.read(int(content_length))
            payload = json.loads(raw.decode("utf-8"))
        except (ValueError, json.JSONDecodeError):
            self._send_json(400, {"error": "Invalid JSON payload", "paper_only": True})
            return

        result = process_webhook_payload(payload)
        status = 200 if result["accepted"] else 422

        record = {
            "timestamp": _utc_now_iso(),
            "path": self.path,
            "request": payload,
            "result": result,
            "paper_only": True,
        }
        _append_log(record)

        response = {
            "accepted": result["accepted"],
            "reasons": result["reasons"],
            "paper_only": True,
        }
        self._send_json(status, response)

    def log_message(self, format: str, *args: Any) -> None:
        # Keep console output quiet by default. Structured events are written to logs.
        return


def run_server(host: str = "127.0.0.1", port: int = 8000) -> None:
    """Run the local webhook HTTP server."""
    server = ThreadingHTTPServer((host, port), WebhookHandler)
    print(f"Paper-only webhook receiver listening on http://{host}:{port}/webhook")
    print(f"Logging decisions to: {LOG_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    run_server()
