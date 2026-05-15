import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import patch

from scripts import dispatch_market_intel_signals as dispatcher


class TestDispatchMarketIntelSignals(unittest.TestCase):
    def test_quoted_confidence_env_normalizes(self):
        self.assertEqual(dispatcher._normalize_confidence_label('"HIGH_PRIORITY"'), "HIGH_PRIORITY")
        self.assertEqual(dispatcher._normalize_confidence_label('"STRONG BUY"'), "HIGH_PRIORITY")

    @patch.dict("os.environ", {"AUTO_MIN_CONFIDENCE": '"HIGH_PRIORITY"'}, clear=False)
    def test_cfg_strips_quoted_confidence_env(self):
        cfg = dispatcher._cfg()
        self.assertEqual(cfg.confidence, "HIGH_PRIORITY")

    def test_unknown_recommendation_does_not_default_to_buy(self):
        self.assertIsNone(dispatcher._normalize_side({"recommendation": "HOLD"}))
        self.assertIsNone(dispatcher._normalize_side({"recommendation": ""}))

    def test_candidate_payload_preserves_source_timestamp(self):
        now = datetime(2026, 5, 14, 12, 0, tzinfo=UTC)
        candidate = {
            "primary_instrument": {"symbol": "AAPL", "direction_bias": "long", "mapping_type": "company_direct"},
            "source_timestamp": "2026-05-14T11:55:00Z",
            "source_title": "Apple headline",
        }

        payload = dispatcher._candidate_dispatch_payload(candidate, now=now, qty=1)

        self.assertIsNotNone(payload)
        self.assertEqual(payload["timestamp"], "2026-05-14T11:55:00Z")
        self.assertEqual(payload["side"], "buy")

    def test_shadow_ticker_research_artifact_is_not_loaded_for_dispatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            shadow_path = Path(tmp) / "ticker_research_shadow.json"
            shadow_path.write_text(
                '{"promotion":{"dispatcher_eligible":false},"candidates":[{"research_ideas":[{"symbol":"ZZZ","executable":false}]}]}',
                encoding="utf-8",
            )

            with patch.object(dispatcher, "_read_json", return_value=[]), \
                patch.object(dispatcher, "load_ready_execution_candidates", return_value={"ok": True, "candidates": [], "warnings": []}), \
                patch.object(dispatcher, "_check_webhook_health", return_value=True), \
                patch.object(dispatcher, "_post_webhook") as post_webhook, \
                patch.dict("os.environ", {"WEBHOOK_SHARED_SECRET": "secret", "EXECUTION_CANDIDATES_ENABLED": "true"}, clear=False):
                exit_code = dispatcher.main()

            self.assertEqual(exit_code, 0)
            post_webhook.assert_not_called()

    def test_rejected_webhook_response_is_not_marked_sent(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = Path(tmp) / "auto_signal_dispatch.json"
            candidate = {
                "candidate_id": "cand_rejected",
                "signal_id": "sig_rejected",
                "confidence_level": "HIGH_PRIORITY",
                "reasoning_score": 95,
                "dispatch_readiness": {"ready": True},
                "primary_instrument": {"symbol": "AAPL", "direction_bias": "long", "mapping_type": "company_direct"},
                "source_timestamp": datetime.now(UTC).isoformat(),
                "source_title": "Rejected dispatch test",
            }
            cfg = dispatcher.Config(
                webhook_url="http://127.0.0.1:8000/webhook",
                webhook_secret="secret",
                execution_candidates_enabled=True,
                confidence="HIGH_PRIORITY",
                min_reasoning_score=80,
                qty=1,
                max_qty=1,
                market_hours_only=False,
                fast_regime_enabled=False,
                fast_min_reasoning_score=75,
                fast_qty_multiplier=1.25,
                fast_geo_threshold=3,
                fast_high_conf_threshold=30,
            )

            with patch.object(dispatcher, "STATE_PATH", state_path), \
                patch.object(dispatcher, "_cfg", return_value=cfg), \
                patch.object(dispatcher, "_check_webhook_health", return_value=True), \
                patch.object(dispatcher, "_read_json", return_value=[]), \
                patch.object(dispatcher, "load_context_snapshot", return_value={"summary": {}}), \
                patch.object(dispatcher, "load_ready_execution_candidates", return_value={"ok": True, "candidates": [candidate], "warnings": []}), \
                patch.object(dispatcher, "_post_webhook", return_value=(422, {"accepted": False, "status": "rejected"})), \
                patch.object(dispatcher, "_send_digest"):
                exit_code = dispatcher.main()

            self.assertEqual(exit_code, 0)
            state = dispatcher._read_json(state_path, {})
            self.assertEqual(state.get("sent"), {})


if __name__ == "__main__":
    unittest.main()
