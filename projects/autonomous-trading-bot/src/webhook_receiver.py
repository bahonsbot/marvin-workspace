"""Local paper-only webhook receiver.

Exposes a minimal HTTP endpoint (POST /webhook) for local testing.
Validates payloads, evaluates risk decision, logs structured results locally,
and can optionally submit to Alpaca PAPER endpoint only.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict

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

LOG_PATH = ROOT / "logs" / "webhook_decisions.jsonl"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _env_flag(name: str, *, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


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
    with log_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")


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
            "proposal": result.get("proposal"),
            "decision_context": result.get("decision_context"),
            "execution": result.get("execution"),
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
    print(f"PAPER_EXECUTE={'true' if _env_flag('PAPER_EXECUTE', default=False) else 'false'}")
    print(f"Logging decisions to: {LOG_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    run_server()
