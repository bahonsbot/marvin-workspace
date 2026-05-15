import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from ticker_research_shadow import build_ticker_research_shadow, write_ticker_research_shadow  # noqa: E402


class TickerResearchShadowTest(unittest.TestCase):
    def test_shadow_artifact_is_research_only_and_has_roles(self) -> None:
        artifact = build_ticker_research_shadow([self._candidate()])

        self.assertEqual(artifact["mode"], "research_only_shadow")
        self.assertFalse(artifact["promotion"]["dispatcher_eligible"])
        self.assertFalse(artifact["promotion"]["live_order_path_changed"])
        self.assertEqual(artifact["summary"]["candidate_count"], 1)

        row = artifact["candidates"][0]
        self.assertEqual(row["promotion"]["status"], "shadow_only")
        self.assertTrue(row["promotion"]["requires_human_review"])
        roles = {idea["role"] for idea in row["research_ideas"]}
        self.assertIn("direct_beneficiary", roles)
        self.assertIn("hidden_supplier", roles)
        self.assertIn("hedge_or_short_leg", roles)
        self.assertIn("etf_fallback", roles)
        for idea in row["research_ideas"]:
            self.assertFalse(idea["dispatcher_eligible"])
            self.assertFalse(idea["executable"])
            self.assertEqual(idea["promotion_status"], "shadow_only")
            self.assertIn("liquidity_tier", idea)
            self.assertIn("provenance", idea)

    def test_write_shadow_artifact_from_execution_candidates(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            input_path = Path(tmp) / "execution_candidates.json"
            output_path = Path(tmp) / "ticker_research_shadow.json"
            input_path.write_text(__import__("json").dumps([self._candidate()]), encoding="utf-8")

            artifact = write_ticker_research_shadow(input_path=input_path, output_path=output_path)

            self.assertTrue(output_path.exists())
            self.assertEqual(artifact["summary"]["total_research_ideas"], len(artifact["candidates"][0]["research_ideas"]))

    def _candidate(self) -> dict:
        return {
            "candidate_id": "cand_test",
            "signal_id": "sig_test",
            "generated_at": "2026-05-15T00:00:00Z",
            "source_title": "OPEC+ supply shock test",
            "source_url": "https://example.com/oil",
            "source_timestamp": "2026-05-15T00:00:00Z",
            "pattern_id": "p001",
            "pattern_name": "Saudi Oil Attacks",
            "theme": "energy_infrastructure",
            "chain_layer": "industrial_inputs",
            "chain_sublayer": "oil_supply",
            "execution_priority": 0.9,
            "dispatch_readiness": {"ready": True, "reasons": []},
            "primary_instrument": {
                "symbol": "XOM",
                "instrument_type": "equity",
                "direction_bias": "long",
                "mapping_type": "value_chain_operator",
                "mapping_confidence": 0.9,
                "reason": "Integrated oil major with direct supply sensitivity",
            },
            "instrument_candidates": [
                {
                    "symbol": "XOM",
                    "instrument_type": "equity",
                    "direction_bias": "long",
                    "mapping_type": "value_chain_operator",
                    "mapping_confidence": 0.9,
                    "relevance_score": 0.9,
                    "reason": "Integrated oil major with direct supply sensitivity",
                },
                {
                    "symbol": "CVX",
                    "instrument_type": "equity",
                    "direction_bias": "long",
                    "mapping_type": "value_chain_operator",
                    "mapping_confidence": 0.88,
                    "relevance_score": 0.88,
                    "reason": "Integrated oil major alternative",
                },
                {
                    "symbol": "DAL",
                    "instrument_type": "equity",
                    "direction_bias": "short",
                    "mapping_type": "value_chain_operator",
                    "mapping_confidence": 0.72,
                    "relevance_score": 0.72,
                    "reason": "Fuel-cost pressure on airlines",
                },
                {
                    "symbol": "XLE",
                    "instrument_type": "etf",
                    "direction_bias": "long",
                    "mapping_type": "value_chain_theme",
                    "mapping_confidence": 0.82,
                    "relevance_score": 0.82,
                    "reason": "Energy sector fallback",
                },
            ],
        }


if __name__ == "__main__":
    unittest.main()
