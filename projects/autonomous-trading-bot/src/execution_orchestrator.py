"""Execution orchestrator for paper-only order submission.

Consumes validated signal + context + risk decision and decides whether to submit
an Alpaca paper order. Includes deterministic idempotency suppression.
"""

from __future__ import annotations

import fcntl
import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from .trade_notifier import TelegramNotifier

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_IDEMPOTENCY_STORE = ROOT / "data" / "state" / "idempotency.json"
IDEMPOTENCY_LOCK = ROOT / "data" / "state" / "idempotency.lock"

logger = logging.getLogger(__name__)


class ExecutionOrchestrator:
    def __init__(
        self,
        broker_adapter: Any,
        *,
        idempotency_store_path: Path = DEFAULT_IDEMPOTENCY_STORE,
        notifier: Optional[TelegramNotifier] = None,
    ) -> None:
        self.broker_adapter = broker_adapter
        self.idempotency_store_path = Path(idempotency_store_path)
        self.notifier = notifier
       

    def execute(
        self,
        *,
        signal: Dict[str, Any],
        context: Dict[str, Any] | None,
        decision_context: Dict[str, Any] | None,
        risk_decision: Dict[str, Any],
        source: str = "webhook",
    ) -> Dict[str, Any]:
        idempotency_key = self.build_idempotency_key(signal=signal, source=source)

        if not risk_decision.get("allow", False):
            # Send Telegram notification for rejected trade
            if self.notifier:
                try:
                    reasons = ", ".join(risk_decision.get("reasons", ["unknown"]))
                    self.notifier.notify_trade_rejected(
                        ticker=signal.get("symbol", "UNKNOWN"),
                        side=signal.get("side", "unknown"),
                        reason=reasons,
                        timestamp=signal.get("timestamp"),
                    )
                except Exception as e:
                    logger.warning(f"Failed to send rejection notification: {e}")

            return {
                "executed": False,
                "status": "denied",
                "reason": "risk_denied",
                "idempotency_key": idempotency_key,
                "order_intent": None,
                "broker_result": None,
                "paper_only": True,
                "audit": {
                    "risk_reasons": list(risk_decision.get("reasons", [])),
                    "context_summary": (context or {}).get("summary") if isinstance(context, dict) else None,
                },
            }

        # Use file-based locking to prevent race conditions on concurrent webhooks
        lock_path = IDEMPOTENCY_LOCK
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(lock_path, "w") as lock_file:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
            try:
                store = self._read_store()
                if idempotency_key in store:
                    return {
                        "executed": False,
                        "status": "duplicate_suppressed",
                        "reason": "idempotency_key_exists",
                        "idempotency_key": idempotency_key,
                        "order_intent": None,
                        "broker_result": None,
                        "paper_only": True,
                        "audit": {"first_seen": store[idempotency_key].get("created_at")},
                    }

                order_intent = self._build_order_intent(
                    signal=signal,
                    decision_context=decision_context or {},
                    idempotency_key=idempotency_key,
                )
                broker_result = self.broker_adapter.submit_order(order_intent)

                # Send Telegram notification if notifier is configured
                if self.notifier:
                    try:
                        order_id = broker_result.get("id", order_intent.get("client_order_id", ""))
                        filled_price = broker_result.get("filled_avg_price") or broker_result.get("filled_price")
                        self.notifier.notify_trade_execution(
                            ticker=order_intent["symbol"],
                            side=order_intent["side"],
                            quantity=order_intent["qty"],
                            price=float(filled_price) if filled_price else None,
                            order_id=str(order_id),
                            timestamp=signal.get("timestamp"),
                        )
                    except Exception as e:
                        logger.warning(f"Failed to send trade notification: {e}")

                store[idempotency_key] = {
                    "created_at": self._utc_now_iso(),
                    "symbol": signal.get("symbol"),
                    "side": signal.get("side"),
                    "timestamp": signal.get("timestamp"),
                    "source": source,
                    "client_order_id": order_intent["client_order_id"],
                }
                self._write_store(store)
            finally:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)

        return {
            "executed": True,
            "status": "submitted",
            "reason": "accepted",
            "idempotency_key": idempotency_key,
            "order_intent": order_intent,
            "broker_result": broker_result,
            "paper_only": True,
            "audit": {
                "risk_reasons": list(risk_decision.get("reasons", [])),
                "context_summary": (context or {}).get("summary") if isinstance(context, dict) else None,
            },
        }

    @staticmethod
    def build_idempotency_key(*, signal: Dict[str, Any], source: str) -> str:
        symbol = str(signal.get("symbol", "")).upper().strip()
        side = str(signal.get("side", "")).lower().strip()
        timestamp = str(signal.get("timestamp", "")).strip()
        raw = f"{symbol}|{side}|{timestamp}|{source}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def _build_order_intent(
        self,
        *,
        signal: Dict[str, Any],
        decision_context: Dict[str, Any],
        idempotency_key: str,
    ) -> Dict[str, Any]:
        qty = float(signal.get("qty", 0.0) or 0.0)
        return {
            "symbol": str(signal["symbol"]).upper(),
            "side": str(signal["side"]).lower(),
            "qty": round(qty, 6),
            "type": "market",
            "time_in_force": "day",
            "client_order_id": idempotency_key[:48],
            "meta": {
                "idempotency_key": idempotency_key,
                "confidence_adjustment": decision_context.get("confidence_adjustment"),
                "size_multiplier": decision_context.get("size_multiplier"),
            },
        }

    def _read_store(self) -> Dict[str, Any]:
        path = self.idempotency_store_path
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            return {}
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
            return {}
        except (json.JSONDecodeError, OSError):
            return {}

    def _write_store(self, store: Dict[str, Any]) -> None:
        path = self.idempotency_store_path
        path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = path.with_suffix(".tmp")
        temp_path.write_text(json.dumps(store, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
        temp_path.replace(path)

    @staticmethod
    def _utc_now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()
