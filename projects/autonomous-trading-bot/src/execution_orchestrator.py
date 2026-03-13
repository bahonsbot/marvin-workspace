"""Execution orchestrator for paper-only order submission.

Consumes validated signal + context + risk decision and decides whether to submit
an Alpaca paper order. Includes deterministic idempotency suppression.
"""

from __future__ import annotations

import fcntl
import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from .trade_notifier import TelegramNotifier

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_IDEMPOTENCY_STORE = ROOT / "data" / "state" / "idempotency.json"
IDEMPOTENCY_LOCK = ROOT / "data" / "state" / "idempotency.lock"

logger = logging.getLogger(__name__)


def _candidate_metadata(signal: Dict[str, Any]) -> Dict[str, Any] | None:
    metadata = {
        "candidate_id": signal.get("candidate_id"),
        "signal_id": signal.get("signal_id"),
        "pattern_id": signal.get("pattern_id"),
        "pattern_name": signal.get("pattern_name"),
        "expected_horizon": signal.get("expected_horizon"),
        "evidence_strength": signal.get("evidence_strength"),
        "risk_overlay_hint": signal.get("risk_overlay_hint"),
    }
    filtered = {k: v for k, v in metadata.items() if v not in (None, "")}
    return filtered or None


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
        candidate_meta = _candidate_metadata(signal)

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
                    "candidate_metadata": candidate_meta,
                },
            }

        # Use file-based locking to prevent race conditions on concurrent webhooks
        lock_path = IDEMPOTENCY_LOCK
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(lock_path, "w") as lock_file:
            try:
                os.chmod(lock_path, 0o600)
            except OSError:
                pass
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
                        "audit": {
                            "first_seen": store[idempotency_key].get("created_at"),
                            "candidate_metadata": candidate_meta,
                        },
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
                    "candidate_id": signal.get("candidate_id"),
                    "signal_id": signal.get("signal_id"),
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
                "candidate_metadata": candidate_meta,
            },
        }

    @staticmethod
    def build_idempotency_key(*, signal: Dict[str, Any], source: str) -> str:
        candidate_id = str(signal.get("candidate_id", "")).strip()
        if candidate_id:
            raw = f"candidate:{candidate_id}|{source}"
            return hashlib.sha256(raw.encode("utf-8")).hexdigest()

        signal_id = str(signal.get("signal_id", "")).strip()
        if signal_id:
            raw = f"signal:{signal_id}|{source}"
            return hashlib.sha256(raw.encode("utf-8")).hexdigest()

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
                "candidate_metadata": _candidate_metadata(signal),
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
            # Corrupted: not a dict
            logger.error(f"Idempotency store corrupted (not a dict), quarantining and starting fresh")
            self._quarantine_store("not_a_dict")
            return {}
        except json.JSONDecodeError as e:
            logger.error(f"Idempotency store JSON corrupted: {e}, quarantining and starting fresh")
            self._quarantine_store(f"json_error:{str(e)[:50]}")
            return {}
        except OSError as e:
            logger.error(f"Idempotency store read error: {e}")
            return {}
    
    def _quarantine_store(self, reason: str) -> None:
        """Backup corrupted store file with timestamp for investigation."""
        path = self.idempotency_store_path
        if not path.exists():
            return
        try:
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            quarantine_path = path.with_suffix(f".corrupted.{timestamp}.bak")
            path.rename(quarantine_path)
            logger.warning(f"Quarantined corrupted idempotency store to {quarantine_path}")
            # Ensure quarantine file has restrictive permissions
            try:
                os.chmod(quarantine_path, 0o600)
            except OSError:
                pass
        except Exception as e:
            logger.error(f"Failed to quarantine corrupted store: {e}")

    def _write_store(self, store: Dict[str, Any]) -> None:
        path = self.idempotency_store_path
        path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = path.with_suffix(".tmp")
        temp_path.write_text(json.dumps(store, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
        temp_path.replace(path)
        # Ensure restrictive permissions on write
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass

    @staticmethod
    def _utc_now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()
