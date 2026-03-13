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
            result = process_webhook_payload(
                self._payload(),
                state=self._state(),
                config=self._config(),
                paper_execute=False,
            )

        self.assertIn("proposal", result)
        self.assertLess(result["proposal"]["adjusted_qty"], result["proposal"]["raw_qty"])
        self.assertIn("decision_context", result)
        self.assertEqual(result["execution"]["status"], "dry_run")
        self.assertTrue(result["paper_only"])

    def test_default_mode_remains_dry_run(self):
        result = process_webhook_payload(self._payload(), state=self._state(), config=self._config(), paper_execute=False)
        self.assertFalse(result["execution"]["executed"])
        self.assertEqual(result["execution"]["status"], "dry_run")

    def test_candidate_metadata_survives_validation_and_proposal(self):
        payload = {
            **self._payload(),
            "candidate_id": "cand_1",
            "signal_id": "sig_1",
            "pattern_id": "p001",
            "pattern_name": "AI Momentum",
            "expected_horizon": "intraday",
            "evidence_strength": 0.88,
            "risk_overlay_hint": "macro_event_risk",
        }
        result = process_webhook_payload(payload, state=self._state(), config=self._config(), paper_execute=False)

        self.assertTrue(result["validation"]["ok"])
        self.assertEqual(result["validation"]["normalized"]["candidate_id"], "cand_1")
        self.assertEqual(result["validation"]["normalized"]["pattern_name"], "AI Momentum")
        self.assertEqual(result["execution"]["status"], "dry_run")


if __name__ == "__main__":
    unittest.main()
