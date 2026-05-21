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

    def test_event_cluster_id_takes_precedence_for_dispatch_state_key(self):
        self.assertEqual(
            dispatcher._signal_key(
                {
                    "candidate_id": "cand_second",
                    "signal_id": "sig_second",
                    "event_cluster_id": "event_same_story",
                }
            ),
            "event_cluster:event_same_story",
        )

    def test_candidate_payload_includes_event_cluster_id(self):
        now = datetime(2026, 5, 14, 12, 0, tzinfo=UTC)
        candidate = {
            "candidate_id": "cand_one",
            "event_cluster_id": "event_one",
            "semantic_fit": {"score": 0.92, "reasons": ["semantic_exact_family_match"]},
            "primary_instrument": {
                "symbol": "AAPL",
                "direction_bias": "long",
                "mapping_type": "company_direct",
                "ticker_fit": {"score": 0.9, "directness": "direct_company", "reasons": ["ticker_direct_company_mention"]},
            },
            "source_timestamp": "2026-05-14T11:55:00Z",
            "source_title": "Apple headline",
        }

        payload = dispatcher._candidate_dispatch_payload(candidate, now=now, qty=1)

        self.assertIsNotNone(payload)
        self.assertEqual(payload["candidate_id"], "cand_one")
        self.assertEqual(payload["event_cluster_id"], "event_one")
        self.assertEqual(payload["semantic_fit_score"], 0.92)
        self.assertEqual(payload["ticker_fit_score"], 0.9)
        self.assertEqual(payload["ticker_fit_directness"], "direct_company")

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
                explorer_enabled=False,
                explorer_qty=0.5,
                explorer_max_per_run=1,
                explorer_min_confidence=0.60,
                max_symbol_attempts_per_run=2,
                max_sector_attempts_per_run=4,
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

    def test_explorer_lane_uses_shadow_idea_with_half_share_qty(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = Path(tmp) / "auto_signal_dispatch.json"
            candidate = {
                "candidate_id": "cand_explorer",
                "signal_id": "sig_explorer",
                "confidence_level": "HIGH_PRIORITY",
                "reasoning_score": 95,
                "dispatch_readiness": {"ready": True},
                "primary_instrument": {"symbol": "AAPL", "direction_bias": "long", "mapping_type": "company_direct"},
                "source_timestamp": datetime.now(UTC).isoformat(),
                "source_title": "Explorer dispatch test",
            }
            shadow = {
                "cand_explorer": {
                    "research_ideas": [
                        {
                            "role": "hidden_supplier",
                            "symbol": "NVDA",
                            "side": "buy",
                            "rationale": "AI supplier",
                            "research_confidence": 0.85,
                            "liquidity_tier": "very_high",
                            "promotion_status": "shadow_only",
                            "dispatcher_eligible": False,
                            "executable": False,
                            "source": "test",
                        }
                    ]
                }
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
                explorer_enabled=True,
                explorer_qty=0.5,
                explorer_max_per_run=1,
                explorer_min_confidence=0.60,
                max_symbol_attempts_per_run=2,
                max_sector_attempts_per_run=4,
            )
            posts = []

            def fake_post(_url, body, _secret):
                posts.append(body)
                return 200, {"accepted": True, "status": "accepted"}

            with patch.object(dispatcher, "STATE_PATH", state_path), \
                patch.object(dispatcher, "_cfg", return_value=cfg), \
                patch.object(dispatcher, "_check_webhook_health", return_value=True), \
                patch.object(dispatcher, "_read_json", return_value=[]), \
                patch.object(dispatcher, "load_context_snapshot", return_value={"summary": {}}), \
                patch.object(dispatcher, "load_ready_execution_candidates", return_value={"ok": True, "candidates": [candidate], "warnings": []}), \
                patch.object(dispatcher, "_load_ticker_research_shadow", return_value=shadow), \
                patch.object(dispatcher, "_post_webhook", side_effect=fake_post), \
                patch.object(dispatcher, "_send_digest"):
                exit_code = dispatcher.main()

            self.assertEqual(exit_code, 0)
            self.assertEqual(len(posts), 2)
            self.assertEqual(posts[1]["strategy"], "market-intel-explorer")
            self.assertEqual(posts[1]["symbol"], "NVDA")
            self.assertEqual(posts[1]["qty"], 0.5)
            self.assertEqual(posts[1]["market_intel_mode"], "ticker_research_explorer")
            state = dispatcher._read_json(state_path, {})
            self.assertIn("explorer:cand_explorer:hidden_supplier:NVDA", state.get("explorer_sent", {}))

    def test_repeated_event_cluster_is_suppressed_even_with_distinct_candidate_ids(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = Path(tmp) / "auto_signal_dispatch.json"
            candidates = []
            for idx in range(2):
                candidates.append(
                    {
                        "candidate_id": f"cand_wave_{idx}",
                        "event_cluster_id": "event_same_headline_wave",
                        "signal_id": f"sig_wave_{idx}",
                        "confidence_level": "HIGH_PRIORITY",
                        "reasoning_score": 95,
                        "dispatch_readiness": {"ready": True},
                        "primary_instrument": {"symbol": "LMT", "direction_bias": "long", "mapping_type": "value_chain_operator"},
                        "source_timestamp": datetime.now(UTC).isoformat(),
                        "source_title": f"Repeated defense headline wave {idx}",
                    }
                )
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
                explorer_enabled=False,
                explorer_qty=0.5,
                explorer_max_per_run=1,
                explorer_min_confidence=0.60,
                max_symbol_attempts_per_run=10,
                max_sector_attempts_per_run=10,
            )
            posts = []

            def fake_post(_url, body, _secret):
                posts.append(body)
                return 200, {"accepted": True, "status": "accepted"}

            with patch.object(dispatcher, "STATE_PATH", state_path), \
                patch.object(dispatcher, "_cfg", return_value=cfg), \
                patch.object(dispatcher, "_check_webhook_health", return_value=True), \
                patch.object(dispatcher, "_read_json", return_value=[]), \
                patch.object(dispatcher, "load_context_snapshot", return_value={"summary": {}}), \
                patch.object(dispatcher, "load_ready_execution_candidates", return_value={"ok": True, "candidates": candidates, "warnings": []}), \
                patch.object(dispatcher, "_post_webhook", side_effect=fake_post), \
                patch.object(dispatcher, "_send_digest"):
                exit_code = dispatcher.main()

            self.assertEqual(exit_code, 0)
            self.assertEqual(len(posts), 1)
            state = dispatcher._read_json(state_path, {})
            self.assertIn("event_cluster:event_same_headline_wave", state.get("sent", {}))
            self.assertEqual(state["sent"]["event_cluster:event_same_headline_wave"]["candidate_id"], "cand_wave_0")

    def test_concentration_caps_skip_repeated_symbol_without_webhook_post(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = Path(tmp) / "auto_signal_dispatch.json"
            candidates = []
            for idx in range(3):
                candidates.append(
                    {
                        "candidate_id": f"cand_lmt_{idx}",
                        "signal_id": f"sig_lmt_{idx}",
                        "confidence_level": "HIGH_PRIORITY",
                        "reasoning_score": 95,
                        "dispatch_readiness": {"ready": True},
                        "primary_instrument": {"symbol": "LMT", "direction_bias": "long", "mapping_type": "value_chain_operator"},
                        "source_timestamp": datetime.now(UTC).isoformat(),
                        "source_title": f"LMT concentration test {idx}",
                    }
                )
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
                explorer_enabled=False,
                explorer_qty=0.5,
                explorer_max_per_run=1,
                explorer_min_confidence=0.60,
                max_symbol_attempts_per_run=2,
                max_sector_attempts_per_run=10,
            )
            posts = []

            def fake_post(_url, body, _secret):
                posts.append(body)
                return 200, {"accepted": True, "status": "accepted"}

            with patch.object(dispatcher, "STATE_PATH", state_path), \
                patch.object(dispatcher, "_cfg", return_value=cfg), \
                patch.object(dispatcher, "_check_webhook_health", return_value=True), \
                patch.object(dispatcher, "_read_json", return_value=[]), \
                patch.object(dispatcher, "load_context_snapshot", return_value={"summary": {}}), \
                patch.object(dispatcher, "load_ready_execution_candidates", return_value={"ok": True, "candidates": candidates, "warnings": []}), \
                patch.object(dispatcher, "_post_webhook", side_effect=fake_post), \
                patch.object(dispatcher, "_send_digest"):
                exit_code = dispatcher.main()

            self.assertEqual(exit_code, 0)
            self.assertEqual(len(posts), 2)
            self.assertTrue(all(post["symbol"] == "LMT" for post in posts))


if __name__ == "__main__":
    unittest.main()
