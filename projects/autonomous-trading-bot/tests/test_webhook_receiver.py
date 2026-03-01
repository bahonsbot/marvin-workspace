import unittest
from unittest.mock import patch

from src.risk_manager import AccountState, RiskConfig
from src.webhook_receiver import process_webhook_payload


class TestWebhookReceiver(unittest.TestCase):
    @staticmethod
    def _payload():
        return {"symbol": "AAPL", "side": "buy", "qty": 1, "timestamp": "2026-03-01T00:00:00Z"}

    @staticmethod
    def _state():
        return AccountState(daily_pnl=0.0, open_positions=0)

    @staticmethod
    def _config():
        return RiskConfig(
            kill_switch_enabled=False,
            daily_loss_cap=100.0,
            max_position_size=2.0,
            max_open_positions=3,
        )

    def test_applies_context_modifier_before_risk(self):
        fake_context = {"summary": {"available_context": True, "risk_bias": "risk_off", "severity": "high", "geopolitical_count": 5}}

        with patch("src.webhook_receiver.load_context_snapshot", return_value=fake_context):
            result = process_webhook_payload(self._payload(), state=self._state(), config=self._config())

        self.assertIn("proposal", result)
        self.assertLess(result["proposal"]["adjusted_qty"], result["proposal"]["raw_qty"])
        self.assertIn("decision_context", result)
        self.assertTrue(result["paper_only"])


if __name__ == "__main__":
    unittest.main()
