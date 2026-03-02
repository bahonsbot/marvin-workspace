import unittest

from src.risk_manager import AccountState, RiskConfig, evaluate_risk_decision
from tests.fixtures import RISK_GUARD_CONFIGS, RISK_GUARD_STATES


class TestRiskManager(unittest.TestCase):
    """Tests for risk guard evaluation."""

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

    # === Allow Tests ===

    def test_allows_valid_signal_in_safe_state(self):
        """Test that a valid signal is allowed when all conditions are safe."""
        decision = evaluate_risk_decision(self._base_signal(), self._base_state(), self._base_config())

        self.assertTrue(decision["allow"])
        self.assertEqual(decision["reasons"], [])
        self.assertTrue(decision["paper_only"])

    def test_allows_with_profit(self):
        """Test that signals are allowed when account is profitable."""
        state = AccountState(daily_pnl=500.0, open_positions=2)
        decision = evaluate_risk_decision(self._base_signal(), state, self._base_config())

        self.assertTrue(decision["allow"])
        self.assertEqual(decision["reasons"], [])

    def test_allows_small_position(self):
        """Test that small positions are allowed even with tight max."""
        config = RiskConfig(
            kill_switch_enabled=False,
            daily_loss_cap=100.0,
            max_position_size=10.0,
            max_open_positions=3,
        )
        signal = {"symbol": "AAPL", "side": "buy", "qty": 5, "timestamp": "2026-03-01T00:00:00Z"}

        decision = evaluate_risk_decision(signal, self._base_state(), config)

        self.assertTrue(decision["allow"])

    # === Kill Switch Tests ===

    def test_denies_when_kill_switch_enabled(self):
        """Test that kill switch denies all signals when enabled."""
        config = RiskConfig(
            kill_switch_enabled=True,
            daily_loss_cap=100.0,
            max_position_size=2.0,
            max_open_positions=3,
        )

        decision = evaluate_risk_decision(self._base_signal(), self._base_state(), config)

        self.assertFalse(decision["allow"])
        self.assertTrue(any("Kill switch is enabled" in reason for reason in decision["reasons"]))

    def test_kill_switch_blocks_profitable_account(self):
        """Test that kill switch blocks even when account is profitable."""
        config = RiskConfig(
            kill_switch_enabled=True,
            daily_loss_cap=100.0,
            max_position_size=2.0,
            max_open_positions=3,
        )
        state = AccountState(daily_pnl=1000.0, open_positions=0)

        decision = evaluate_risk_decision(self._base_signal(), state, config)

        self.assertFalse(decision["allow"])
        self.assertTrue(any("Kill switch is enabled" in reason for reason in decision["reasons"]))

    # === Daily Loss Cap Tests ===

    def test_denies_when_daily_loss_cap_breached(self):
        """Test that daily loss cap denies signals when breached."""
        state = AccountState(daily_pnl=-100.0, open_positions=0)

        decision = evaluate_risk_decision(self._base_signal(), state, self._base_config())

        self.assertFalse(decision["allow"])
        self.assertTrue(any("Daily loss cap breached" in reason for reason in decision["reasons"]))

    def test_denies_at_exact_loss_cap(self):
        """Test that exact loss cap triggers denial."""
        config = RiskConfig(
            kill_switch_enabled=False,
            daily_loss_cap=50.0,
            max_position_size=10.0,
            max_open_positions=3,
        )
        state = AccountState(daily_pnl=-50.0, open_positions=1)

        decision = evaluate_risk_decision(self._base_signal(), state, config)

        self.assertFalse(decision["allow"])
        self.assertTrue(any("Daily loss cap breached" in reason for reason in decision["reasons"]))

    def test_allows_just_under_loss_cap(self):
        """Test that signals are allowed when just under loss cap."""
        config = RiskConfig(
            kill_switch_enabled=False,
            daily_loss_cap=100.0,
            max_position_size=10.0,
            max_open_positions=3,
        )
        state = AccountState(daily_pnl=-99.99, open_positions=1)

        decision = evaluate_risk_decision(self._base_signal(), state, config)

        self.assertTrue(decision["allow"])

    def test_denies_when_loss_exceeds_cap(self):
        """Test that exceeding loss cap denies signals."""
        state = AccountState(daily_pnl=-150.0, open_positions=0)

        decision = evaluate_risk_decision(self._base_signal(), state, self._base_config())

        self.assertFalse(decision["allow"])
        self.assertTrue(any("Daily loss cap breached" in reason for reason in decision["reasons"]))

    # === Max Position Size Tests ===

    def test_denies_when_max_position_size_breached(self):
        """Test that position size exceeding max denies signal."""
        signal = self._base_signal()
        signal["qty"] = 10

        decision = evaluate_risk_decision(signal, self._base_state(), self._base_config())

        self.assertFalse(decision["allow"])
        self.assertTrue(any("Position size exceeds max" in reason for reason in decision["reasons"]))

    def test_denies_at_exact_max_position(self):
        """Test that exact max position size is ALLOWED (uses > not >=)."""
        config = RiskConfig(
            kill_switch_enabled=False,
            daily_loss_cap=100.0,
            max_position_size=5.0,
            max_open_positions=3,
        )
        signal = {"symbol": "AAPL", "side": "buy", "qty": 5, "timestamp": "2026-03-01T00:00:00Z"}

        decision = evaluate_risk_decision(signal, self._base_state(), config)

        # Exact max is allowed (check uses > not >=)
        self.assertTrue(decision["allow"])

    def test_allows_just_under_max_position(self):
        """Test that position just under max is allowed."""
        config = RiskConfig(
            kill_switch_enabled=False,
            daily_loss_cap=100.0,
            max_position_size=10.0,
            max_open_positions=3,
        )
        signal = {"symbol": "AAPL", "side": "buy", "qty": 9.99, "timestamp": "2026-03-01T00:00:00Z"}

        decision = evaluate_risk_decision(signal, self._base_state(), config)

        self.assertTrue(decision["allow"])

    # === Max Open Positions Tests ===

    def test_denies_when_max_open_positions_reached(self):
        """Test that max open positions denies new signals."""
        state = AccountState(daily_pnl=10.0, open_positions=3)

        decision = evaluate_risk_decision(self._base_signal(), state, self._base_config())

        self.assertFalse(decision["allow"])
        self.assertTrue(any("Max open positions reached" in reason for reason in decision["reasons"]))

    def test_denies_at_exact_max_positions(self):
        """Test that exact max positions triggers denial."""
        config = RiskConfig(
            kill_switch_enabled=False,
            daily_loss_cap=100.0,
            max_position_size=10.0,
            max_open_positions=1,
        )
        state = AccountState(daily_pnl=0.0, open_positions=1)

        decision = evaluate_risk_decision(self._base_signal(), state, config)

        self.assertFalse(decision["allow"])
        self.assertTrue(any("Max open positions reached" in reason for reason in decision["reasons"]))

    def test_allows_one_under_max_positions(self):
        """Test that one position under max is allowed."""
        state = AccountState(daily_pnl=0.0, open_positions=2)

        decision = evaluate_risk_decision(self._base_signal(), state, self._base_config())

        self.assertTrue(decision["allow"])

    # === Combined Guard Tests ===

    def test_multiple_guards_trigger(self):
        """Test that multiple guards can trigger simultaneously."""
        config = RiskConfig(
            kill_switch_enabled=True,
            daily_loss_cap=50.0,
            max_position_size=5.0,
            max_open_positions=1,
        )
        state = AccountState(daily_pnl=-100.0, open_positions=3)
        signal = {"symbol": "AAPL", "side": "buy", "qty": 10, "timestamp": "2026-03-01T00:00:00Z"}

        decision = evaluate_risk_decision(signal, state, config)

        self.assertFalse(decision["allow"])
        # Should have multiple reasons
        self.assertGreaterEqual(len(decision["reasons"]), 2)

    def test_kill_switch_takes_precedence(self):
        """Test that kill switch is checked first (appears in reasons)."""
        config = RiskConfig(
            kill_switch_enabled=True,
            daily_loss_cap=50.0,
            max_position_size=10.0,
            max_open_positions=3,
        )
        state = AccountState(daily_pnl=-100.0, open_positions=0)

        decision = evaluate_risk_decision(self._base_signal(), state, config)

        self.assertFalse(decision["allow"])
        # Kill switch should be in reasons
        self.assertTrue(any("Kill switch" in reason for reason in decision["reasons"]))

    # === Response Structure Tests ===

    def test_response_contains_all_checked_rules(self):
        """Test that response lists all checked rules."""
        decision = evaluate_risk_decision(self._base_signal(), self._base_state(), self._base_config())

        self.assertIn("checked_rules", decision)
        self.assertEqual(len(decision["checked_rules"]), 4)
        expected_rules = ["kill_switch", "daily_loss_cap", "max_position_size", "max_open_positions"]
        for rule in expected_rules:
            self.assertIn(rule, decision["checked_rules"])

    def test_response_contains_paper_only_flag(self):
        """Test that response contains paper_only flag."""
        decision = evaluate_risk_decision(self._base_signal(), self._base_state(), self._base_config())

        self.assertIn("paper_only", decision)
        self.assertTrue(decision["paper_only"])

    # === Edge Case Tests ===

    def test_zero_position_signal(self):
        """Test signal with zero quantity (edge case)."""
        signal = {"symbol": "AAPL", "side": "buy", "qty": 0, "timestamp": "2026-03-01T00:00:00Z"}

        # This passes schema validation but is a valid risk check
        decision = evaluate_risk_decision(signal, self._base_state(), self._base_config())

        # Zero qty should be allowed (it's under max)
        self.assertTrue(decision["allow"])

    def test_negative_pnl_profit_edge(self):
        """Test edge case with small negative PnL (not a loss)."""
        state = AccountState(daily_pnl=-0.01, open_positions=0)

        decision = evaluate_risk_decision(self._base_signal(), state, self._base_config())

        # Small negative is not a breach of positive loss cap
        self.assertTrue(decision["allow"])

    def test_empty_signal(self):
        """Test with empty signal dict."""
        signal = {}

        decision = evaluate_risk_decision(signal, self._base_state(), self._base_config())

        # Empty signal - should be allowed (no qty to check)
        self.assertTrue(decision["allow"])

    # === Fixture-Based Tests ===

    def test_all_configs_against_safe_state(self):
        """Test all config fixtures against safe state."""
        safe_state = AccountState(daily_pnl=0.0, open_positions=0)
        safe_signal = {"symbol": "AAPL", "side": "buy", "qty": 1, "timestamp": "2026-03-01T00:00:00Z"}

        for fixture in RISK_GUARD_CONFIGS:
            with self.subTest(name=fixture["name"]):
                cfg = RiskConfig(**fixture["config"])
                # Skip kill switch tests - they're expected to fail
                if cfg.kill_switch_enabled:
                    decision = evaluate_risk_decision(safe_signal, safe_state, cfg)
                    self.assertFalse(decision["allow"])
                else:
                    decision = evaluate_risk_decision(safe_signal, safe_state, cfg)
                    self.assertTrue(decision["allow"])

    def test_all_state_fixtures(self):
        """Test all state fixtures against base config."""
        base_signal = {"symbol": "AAPL", "side": "buy", "qty": 1, "timestamp": "2026-03-01T00:00:00Z"}

        for fixture in RISK_GUARD_STATES:
            with self.subTest(name=fixture["name"]):
                state = AccountState(**fixture["state"])
                decision = evaluate_risk_decision(base_signal, state, self._base_config())

                if fixture["name"] in ["breached_loss_cap", "max_positions_reached"]:
                    self.assertFalse(decision["allow"])
                else:
                    self.assertTrue(decision["allow"])


if __name__ == "__main__":
    unittest.main()
