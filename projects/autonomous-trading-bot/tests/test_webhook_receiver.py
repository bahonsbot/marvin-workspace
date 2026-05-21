import unittest
from datetime import datetime, timezone
from unittest.mock import Mock, patch

from src.risk_manager import AccountState, RiskConfig
from src.webhook_receiver import _public_webhook_response, process_webhook_payload


class TestWebhookReceiver(unittest.TestCase):
    @staticmethod
    def _payload():
        return {"symbol": "AAPL", "side": "buy", "qty": 1, "timestamp": datetime.now(timezone.utc).isoformat()}

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

    @patch.dict("os.environ", {"KILL_SWITCH": "true"}, clear=False)
    @patch("src.webhook_receiver.load_context_snapshot", return_value={"summary": {"available_context": False}})
    def test_default_risk_config_honors_env_kill_switch(self, _mock_context):
        result = process_webhook_payload(
            self._payload(),
            state=self._state(),
            config=None,
            paper_execute=False,
        )

        self.assertFalse(result["accepted"])
        self.assertIn("Kill switch is enabled. Trading is blocked.", result["reasons"])
        self.assertFalse(result["risk"]["allow"])

    @patch.dict("os.environ", {"KILL_SWITCH": "false", "MAX_POSITION_SIZE": "0.5"}, clear=False)
    @patch("src.webhook_receiver.load_context_snapshot", return_value={"summary": {"available_context": False}})
    def test_default_risk_config_honors_env_position_size(self, _mock_context):
        result = process_webhook_payload(
            self._payload(),
            state=self._state(),
            config=None,
            paper_execute=False,
        )

        self.assertFalse(result["accepted"])
        self.assertIn("Position size exceeds max: qty=1.0 > max_position_size=0.5.", result["reasons"])

    @patch.dict("os.environ", {"KILL_SWITCH": "false", "BROKER_ACCOUNT_STATE_ENABLED": "true"}, clear=False)
    @patch("src.webhook_receiver.load_context_snapshot", return_value={"summary": {"available_context": False}})
    @patch("src.webhook_receiver.AlpacaPaperAdapter")
    def test_default_account_state_uses_broker_positions_for_sell_guard(self, mock_adapter_cls, _mock_context):
        adapter = Mock()
        adapter.get_account.return_value = {"equity": "1000.00", "last_equity": "1000.00"}
        adapter.list_positions.return_value = [{"symbol": "AAPL", "qty": "2", "market_value": "300.00"}]
        mock_adapter_cls.return_value = adapter
        payload = {**self._payload(), "side": "sell"}

        result = process_webhook_payload(
            payload,
            state=None,
            config=None,
            paper_execute=False,
        )

        self.assertTrue(result["accepted"])
        self.assertEqual(result["state_warnings"], [])
        self.assertTrue(adapter.get_account.called)
        self.assertTrue(adapter.list_positions.called)

    @patch.dict("os.environ", {"KILL_SWITCH": "false", "BROKER_ACCOUNT_STATE_ENABLED": "true", "MAX_SYMBOL_POSITION_QTY": "3"}, clear=False)
    @patch("src.webhook_receiver.load_context_snapshot", return_value={"summary": {"available_context": False}})
    @patch("src.webhook_receiver.AlpacaPaperAdapter")
    def test_default_account_state_blocks_symbol_concentration(self, mock_adapter_cls, _mock_context):
        adapter = Mock()
        adapter.get_account.return_value = {"equity": "1000.00", "last_equity": "1000.00"}
        adapter.list_positions.return_value = [{"symbol": "LMT", "qty": "4.2", "market_value": "2200.00"}]
        mock_adapter_cls.return_value = adapter
        payload = {**self._payload(), "symbol": "LMT"}

        result = process_webhook_payload(
            payload,
            state=None,
            config=None,
            paper_execute=False,
        )

        self.assertFalse(result["accepted"])
        self.assertTrue(any("Symbol concentration reached" in reason for reason in result["reasons"]))

    @patch.dict("os.environ", {"KILL_SWITCH": "false", "BROKER_ACCOUNT_STATE_ENABLED": "true"}, clear=False)
    @patch("src.webhook_receiver.load_context_snapshot", return_value={"summary": {"available_context": False}})
    @patch("src.webhook_receiver.AlpacaPaperAdapter")
    def test_default_account_state_blocks_sell_without_inventory(self, mock_adapter_cls, _mock_context):
        adapter = Mock()
        adapter.get_account.return_value = {"equity": "1000.00", "last_equity": "1000.00"}
        adapter.list_positions.return_value = []
        mock_adapter_cls.return_value = adapter
        payload = {**self._payload(), "side": "sell"}

        result = process_webhook_payload(
            payload,
            state=None,
            config=None,
            paper_execute=False,
        )

        self.assertFalse(result["accepted"])
        self.assertTrue(any("Sell blocked" in reason for reason in result["reasons"]))

    @patch.dict(
        "os.environ",
        {"KILL_SWITCH": "false", "BROKER_ACCOUNT_STATE_ENABLED": "true", "BROKER_SYMBOL_VALIDATION_ENABLED": "false"},
        clear=False,
    )
    @patch("src.webhook_receiver.load_context_snapshot", return_value={"summary": {"available_context": False}})
    @patch("src.webhook_receiver.AlpacaPaperAdapter")
    def test_broker_state_warning_can_continue_in_dry_run(self, mock_adapter_cls, _mock_context):
        adapter = Mock()
        adapter.get_account.side_effect = RuntimeError("account unavailable")
        adapter.list_positions.return_value = []
        mock_adapter_cls.return_value = adapter

        result = process_webhook_payload(
            self._payload(),
            state=None,
            config=None,
            paper_execute=False,
        )

        self.assertTrue(result["accepted"])
        self.assertEqual(result["execution"]["status"], "dry_run")
        self.assertTrue(any("account_state_unavailable" in warning for warning in result["state_warnings"]))

    @patch.dict(
        "os.environ",
        {"KILL_SWITCH": "false", "BROKER_ACCOUNT_STATE_ENABLED": "true", "BROKER_SYMBOL_VALIDATION_ENABLED": "false"},
        clear=False,
    )
    @patch("src.webhook_receiver.load_context_snapshot", return_value={"summary": {"available_context": False}})
    @patch("src.webhook_receiver.ExecutionOrchestrator")
    @patch("src.webhook_receiver.AlpacaPaperAdapter")
    def test_broker_state_warning_fails_closed_in_paper_execution(self, mock_adapter_cls, mock_orchestrator_cls, _mock_context):
        adapter = Mock()
        adapter.get_account.side_effect = RuntimeError("account unavailable")
        adapter.list_positions.return_value = []
        mock_adapter_cls.return_value = adapter

        result = process_webhook_payload(
            self._payload(),
            state=None,
            config=None,
            paper_execute=True,
        )

        self.assertFalse(result["accepted"])
        self.assertEqual(result["execution"]["status"], "broker_state_unavailable")
        self.assertTrue(any("Broker account state unavailable" in reason for reason in result["reasons"]))
        self.assertFalse(mock_orchestrator_cls.called)
        response = _public_webhook_response(result)
        self.assertFalse(response["accepted"])
        self.assertEqual(response["execution_status"], "broker_state_unavailable")

    def test_public_response_includes_execution_status_for_dry_run(self):
        result = process_webhook_payload(
            self._payload(),
            state=self._state(),
            config=self._config(),
            paper_execute=False,
        )

        response = _public_webhook_response(result)

        self.assertTrue(response["accepted"])
        self.assertFalse(response["executed"])
        self.assertEqual(response["execution_status"], "dry_run")
        self.assertEqual(response["status"], "dry_run")

    @patch("src.webhook_receiver.load_context_snapshot", return_value={"summary": {"available_context": False}})
    @patch("src.webhook_receiver.ExecutionOrchestrator")
    @patch("src.webhook_receiver.AlpacaPaperAdapter")
    def test_paper_execution_failure_is_rejected(self, _mock_adapter_cls, mock_orchestrator_cls, _mock_context):
        orchestrator = Mock()
        orchestrator.execute.side_effect = RuntimeError("broker unavailable")
        mock_orchestrator_cls.return_value = orchestrator

        result = process_webhook_payload(
            self._payload(),
            state=self._state(),
            config=self._config(),
            paper_execute=True,
        )

        self.assertFalse(result["accepted"])
        self.assertEqual(result["execution"]["status"], "execution_failed")
        response = _public_webhook_response(result)
        self.assertFalse(response["accepted"])
        self.assertEqual(response["execution_status"], "execution_failed")


if __name__ == "__main__":
    unittest.main()
