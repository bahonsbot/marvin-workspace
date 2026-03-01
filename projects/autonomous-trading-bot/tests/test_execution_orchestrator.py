import json
import tempfile
import unittest
from pathlib import Path

from src.execution_orchestrator import ExecutionOrchestrator


class DummyAdapter:
    def __init__(self):
        self.calls = 0

    def submit_order(self, intent):
        self.calls += 1
        return {"id": f"paper-{self.calls}", "status": "accepted", "client_order_id": intent["client_order_id"]}


class TestExecutionOrchestrator(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.store_path = Path(self.tmp_dir.name) / "idempotency.json"
        self.adapter = DummyAdapter()
        self.orchestrator = ExecutionOrchestrator(self.adapter, idempotency_store_path=self.store_path)
        self.signal = {
            "symbol": "AAPL",
            "side": "buy",
            "qty": 1,
            "timestamp": "2026-03-01T12:00:00Z",
        }

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_duplicate_suppression_prevents_second_execution(self):
        first = self.orchestrator.execute(
            signal=self.signal,
            context={"summary": {"risk_bias": "neutral"}},
            decision_context={"size_multiplier": 1.0, "confidence_adjustment": 0.0},
            risk_decision={"allow": True, "reasons": []},
            source="webhook",
        )
        second = self.orchestrator.execute(
            signal=self.signal,
            context={"summary": {"risk_bias": "neutral"}},
            decision_context={"size_multiplier": 1.0, "confidence_adjustment": 0.0},
            risk_decision={"allow": True, "reasons": []},
            source="webhook",
        )

        self.assertTrue(first["executed"])
        self.assertEqual(first["status"], "submitted")
        self.assertFalse(second["executed"])
        self.assertEqual(second["status"], "duplicate_suppressed")
        self.assertEqual(self.adapter.calls, 1)

        store = json.loads(self.store_path.read_text(encoding="utf-8"))
        self.assertEqual(len(store.keys()), 1)

    def test_denied_path_never_executes(self):
        result = self.orchestrator.execute(
            signal=self.signal,
            context={"summary": {"risk_bias": "risk_off"}},
            decision_context={"size_multiplier": 0.5, "confidence_adjustment": -0.2},
            risk_decision={"allow": False, "reasons": ["Kill switch is enabled."]},
            source="webhook",
        )

        self.assertFalse(result["executed"])
        self.assertEqual(result["status"], "denied")
        self.assertEqual(self.adapter.calls, 0)
        self.assertFalse(self.store_path.exists())


if __name__ == "__main__":
    unittest.main()
