import unittest

from src.risk_manager import AccountState, RiskConfig, evaluate_risk_decision


class TestRiskManager(unittest.TestCase):
    @staticmethod
    def _base_signal():
        return {"symbol": "AAPL", "side": "buy", "qty": 1, "timestamp": "2026-03-01T00:00:00Z"}

    @staticmethod
    def _base_state():
        return AccountState(daily_pnl=0.0, open_positions=0)

    @staticmethod
    def _base_config():
        return RiskConfig(
            kill_switch_enabled=False,
            daily_loss_cap=100.0,
            max_position_size=2.0,
            max_open_positions=3,
        )

    def test_denies_when_kill_switch_enabled(self):
        config = RiskConfig(
            kill_switch_enabled=True,
            daily_loss_cap=100.0,
            max_position_size=2.0,
            max_open_positions=3,
        )

        decision = evaluate_risk_decision(self._base_signal(), self._base_state(), config)

        self.assertFalse(decision["allow"])
        self.assertTrue(any("Kill switch is enabled" in reason for reason in decision["reasons"]))

    def test_denies_when_daily_loss_cap_breached(self):
        state = AccountState(daily_pnl=-100.0, open_positions=0)

        decision = evaluate_risk_decision(self._base_signal(), state, self._base_config())

        self.assertFalse(decision["allow"])
        self.assertTrue(any("Daily loss cap breached" in reason for reason in decision["reasons"]))

    def test_denies_when_max_position_size_breached(self):
        signal = self._base_signal()
        signal["qty"] = 10

        decision = evaluate_risk_decision(signal, self._base_state(), self._base_config())

        self.assertFalse(decision["allow"])
        self.assertTrue(any("Position size exceeds max" in reason for reason in decision["reasons"]))

    def test_denies_when_max_open_positions_reached(self):
        state = AccountState(daily_pnl=10.0, open_positions=3)

        decision = evaluate_risk_decision(self._base_signal(), state, self._base_config())

        self.assertFalse(decision["allow"])
        self.assertTrue(any("Max open positions reached" in reason for reason in decision["reasons"]))

    def test_allows_valid_signal_in_safe_state(self):
        decision = evaluate_risk_decision(self._base_signal(), self._base_state(), self._base_config())

        self.assertTrue(decision["allow"])
        self.assertEqual(decision["reasons"], [])
        self.assertTrue(decision["paper_only"])


if __name__ == "__main__":
    unittest.main()
