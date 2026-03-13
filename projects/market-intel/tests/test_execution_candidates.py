import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from execution_candidates import build_execution_candidates  # noqa: E402


class ExecutionCandidatesTest(unittest.TestCase):
    def test_generation_is_deterministic_and_sorted(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            self._write_fixture_files(data_dir)

            first = build_execution_candidates(data_dir)
            second = build_execution_candidates(data_dir)

            self.assertEqual(first, second)
            self.assertEqual(
                [item["execution_priority"] for item in first],
                sorted([item["execution_priority"] for item in first], reverse=True),
            )

            oil_signal = self._find_candidate(first, "Oil tankers reroute after Strait disruption lifts crude prices")
            self.assertTrue(oil_signal["dispatch_readiness"]["ready"])
            self.assertEqual(oil_signal["primary_instrument"]["symbol"], "USO")
            self.assertEqual(oil_signal["signal_id"], self._find_candidate(second, oil_signal["source_title"])["signal_id"])
            self.assertEqual(oil_signal["candidate_id"], self._find_candidate(second, oil_signal["source_title"])["candidate_id"])

    def test_family_mismatch_blocks_geopolitical_title_with_meme_pattern(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            self._write_fixture_files(data_dir)

            candidates = build_execution_candidates(data_dir)
            mismatch = self._find_candidate(candidates, "U.S. Navy escorts tankers through Strait of Hormuz")

            self.assertFalse(mismatch["dispatch_readiness"]["ready"])
            self.assertIn("pattern_topic_mismatch", mismatch["dispatch_readiness"]["reasons"])
            self.assertIn("title_pattern_family_mismatch", mismatch["dispatch_readiness"]["reasons"])
            self.assertEqual(mismatch["primary_instrument"]["symbol"], "USO")

    def test_family_mismatch_blocks_semis_title_with_geopolitical_pattern(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            self._write_fixture_files(data_dir)

            candidates = build_execution_candidates(data_dir)
            mismatch = self._find_candidate(candidates, "ByteDance gets access to top Nvidia AI chips")

            self.assertFalse(mismatch["dispatch_readiness"]["ready"])
            self.assertIn("pattern_topic_mismatch", mismatch["dispatch_readiness"]["reasons"])
            self.assertEqual(mismatch["primary_instrument"]["symbol"], "SOXX")

    def test_broad_macro_roundup_is_not_ready_and_does_not_pick_uso(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            self._write_fixture_files(data_dir)

            candidates = build_execution_candidates(data_dir)
            roundup = self._find_candidate(candidates, "Stock futures are flat ahead of key inflation data")

            self.assertFalse(roundup["dispatch_readiness"]["ready"])
            self.assertIn("broad_roundup_title", roundup["dispatch_readiness"]["reasons"])
            self.assertNotEqual(roundup["primary_instrument"], {"symbol": "USO"})
            self.assertIsNone(roundup["primary_instrument"])
            self.assertFalse(any(item["symbol"] == "USO" for item in roundup["instrument_candidates"]))

    def test_mixed_macro_oil_title_is_not_ready_and_does_not_map_to_uso(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            self._write_fixture_files(data_dir)

            candidates = build_execution_candidates(data_dir)
            mixed = self._find_candidate(candidates, "Gold set for weekly drop as oil price surge weighs on rate-cut hopes")

            self.assertFalse(mixed["dispatch_readiness"]["ready"])
            self.assertIn("mixed_theme_title", mixed["dispatch_readiness"]["reasons"])
            self.assertIn("no_clear_primary_instrument", mixed["dispatch_readiness"]["reasons"])
            self.assertIsNone(mixed["primary_instrument"])
            self.assertFalse(any(item["symbol"] == "USO" for item in mixed["instrument_candidates"]))

    def test_fx_stress_geopolitical_title_does_not_casually_map_to_defense_proxy(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            self._write_fixture_files(data_dir)

            candidates = build_execution_candidates(data_dir)
            fx_stress = self._find_candidate(candidates, "Iran war pushes Indian rupee towards perfect storm")

            self.assertFalse(fx_stress["dispatch_readiness"]["ready"])
            self.assertIn("fx_stress_secondary_mapping", fx_stress["dispatch_readiness"]["reasons"])
            self.assertIn("no_clear_primary_instrument", fx_stress["dispatch_readiness"]["reasons"])
            self.assertIsNone(fx_stress["primary_instrument"])
            self.assertFalse(any(item["symbol"] == "ITA" for item in fx_stress["instrument_candidates"]))

    def test_materially_duplicate_ready_headlines_are_deduplicated(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            self._write_fixture_files(data_dir)

            candidates = build_execution_candidates(data_dir)
            duplicate_matches = [
                item
                for item in candidates
                if item["source_title"] == "Trump disbanded NSC pandemic unit that experts had praised - AP News"
            ]

            self.assertEqual(len(duplicate_matches), 1)

    def test_single_name_retail_title_with_credit_pattern_is_blocked(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            self._write_fixture_files(data_dir)

            candidates = build_execution_candidates(data_dir)
            mismatch = self._find_candidate(candidates, "Ulta Beauty warns shoppers are pulling back")

            self.assertFalse(mismatch["dispatch_readiness"]["ready"])
            self.assertIn("pattern_topic_mismatch", mismatch["dispatch_readiness"]["reasons"])
            self.assertEqual(mismatch["primary_instrument"]["symbol"], "ULTA")

    def _find_candidate(self, candidates: list[dict], title_fragment: str) -> dict:
        for candidate in candidates:
            if title_fragment in candidate["source_title"]:
                return candidate
        raise AssertionError(f"Candidate not found for title fragment: {title_fragment}")

    def _write_fixture_files(self, data_dir: Path) -> None:
        self._dump(
            data_dir / "enhanced_signals.json",
            [
                {
                    "source": "rss",
                    "feed": "Financial_Times",
                    "title": "Oil tankers reroute after Strait disruption lifts crude prices",
                    "url": "https://example.com/oil-shock",
                    "timestamp": "2026-03-13T12:00:00Z",
                    "pattern_id": "p001",
                    "pattern": "Saudi Oil Attacks",
                    "category": "geopolitical",
                    "confidence": "HIGH",
                    "time_horizon": "intraday",
                    "signal_score": 300,
                    "reasoning_score": 91.0,
                    "confidence_level": "STRONG BUY",
                    "recommendation": "TAKE",
                    "reasoning_components": {"feedback_bias_points": 7.5, "feedback_sample_size": 20},
                    "reasoning": "high-credibility source, strong historical pattern match.",
                    "predicted_outcomes": ["oil_spike"],
                    "predicted_causal_chain": ["Supply disruption", "Crude reprices"],
                    "signal_briefing": "Oil shock setup",
                },
                {
                    "source": "rss",
                    "feed": "CNBC",
                    "title": "Iran War: U.S. Navy escorts tankers through Strait of Hormuz",
                    "url": "https://example.com/hormuz-mismatch",
                    "timestamp": "2026-03-13T11:00:00Z",
                    "pattern_id": "p002",
                    "pattern": "GameStop Short Squeeze",
                    "category": "sentiment_social",
                    "confidence": "HIGH",
                    "time_horizon": "intraday",
                    "signal_score": 260,
                    "reasoning_score": 87.0,
                    "confidence_level": "BUY",
                    "recommendation": "TAKE",
                    "reasoning_components": {"feedback_bias_points": 4.0, "feedback_sample_size": 10},
                    "reasoning": "headline is strong, but upstream pattern may be off.",
                    "predicted_outcomes": ["oil_spike"],
                    "predicted_causal_chain": ["Escort", "Supply fears", "Crude reprices"],
                    "signal_briefing": "Hormuz shipping escalation",
                },
                {
                    "source": "rss",
                    "feed": "Reuters",
                    "title": "China's ByteDance gets access to top Nvidia AI chips, WSJ reports",
                    "url": "https://example.com/bytedance-nvda",
                    "timestamp": "2026-03-13T10:30:00Z",
                    "pattern_id": "p003",
                    "pattern": "Russia-Ukraine Conflict",
                    "category": "geopolitical",
                    "confidence": "HIGH",
                    "time_horizon": "short-term",
                    "signal_score": 220,
                    "reasoning_score": 83.0,
                    "confidence_level": "BUY",
                    "recommendation": "TAKE",
                    "reasoning_components": {"feedback_bias_points": 3.0, "feedback_sample_size": 12},
                    "reasoning": "strong company-specific title with wrong upstream pattern family.",
                    "predicted_outcomes": ["semis_rally"],
                    "predicted_causal_chain": ["Chip access", "AI demand", "Semi bid"],
                    "signal_briefing": "Semi access headline",
                },
                {
                    "source": "rss",
                    "feed": "CNBC",
                    "title": "Stock futures are flat ahead of key inflation data; traders monitor oil prices and bond yields",
                    "url": "https://example.com/macro-roundup",
                    "timestamp": "2026-03-13T09:30:00Z",
                    "pattern_id": "p004",
                    "pattern": "US Credit Rating Downgrade",
                    "category": "macroeconomic",
                    "confidence": "HIGH",
                    "time_horizon": "intraday",
                    "signal_score": 205,
                    "reasoning_score": 80.0,
                    "confidence_level": "BUY",
                    "recommendation": "TAKE",
                    "reasoning_components": {"feedback_bias_points": 1.5, "feedback_sample_size": 8},
                    "reasoning": "macro setup is broad, not a clean execution theme.",
                    "predicted_outcomes": ["mixed_open"],
                    "predicted_causal_chain": ["Await data", "Cross-asset watch"],
                    "signal_briefing": "Macro roundup",
                },
                {
                    "source": "rss",
                    "feed": "MarketWatch",
                    "title": "Ulta Beauty warns shoppers are pulling back as profit outlook weakens",
                    "url": "https://example.com/ulta-mismatch",
                    "timestamp": "2026-03-13T08:30:00Z",
                    "pattern_id": "p004",
                    "pattern": "US Credit Rating Downgrade",
                    "category": "macroeconomic",
                    "confidence": "HIGH",
                    "time_horizon": "short-term",
                    "signal_score": 190,
                    "reasoning_score": 78.0,
                    "confidence_level": "BUY",
                    "recommendation": "TAKE",
                    "reasoning_components": {"feedback_bias_points": 2.0, "feedback_sample_size": 6},
                    "reasoning": "single-name consumer weakness headline.",
                    "predicted_outcomes": ["retail_weakness"],
                    "predicted_causal_chain": ["Guidance miss", "Stock reprices"],
                    "signal_briefing": "Single-name retail miss",
                },
                {
                    "source": "rss",
                    "feed": "Nasdaq_News",
                    "title": "Gold set for weekly drop as oil price surge weighs on rate-cut hopes",
                    "url": "https://example.com/gold-oil-rates",
                    "timestamp": "2026-03-13T08:00:00Z",
                    "pattern_id": "p004",
                    "pattern": "US Credit Rating Downgrade",
                    "category": "macroeconomic",
                    "confidence": "HIGH",
                    "time_horizon": "short-term",
                    "signal_score": 210,
                    "reasoning_score": 82.0,
                    "confidence_level": "BUY",
                    "recommendation": "TAKE",
                    "reasoning_components": {"feedback_bias_points": 1.0, "feedback_sample_size": 5},
                    "reasoning": "mixed macro title with oil mention but no clean oil disruption setup.",
                    "predicted_outcomes": ["cross_asset_repricing"],
                    "predicted_causal_chain": ["Oil up", "Rate-cut odds fade", "Cross-macro rotation"],
                    "signal_briefing": "Cross-macro headline",
                },
                {
                    "source": "rss",
                    "feed": "Reuters_BreakingViews",
                    "title": "Iran war pushes Indian rupee towards perfect storm",
                    "url": "https://example.com/iran-rupee",
                    "timestamp": "2026-03-13T07:30:00Z",
                    "pattern_id": "p003",
                    "pattern": "Russia-Ukraine Conflict",
                    "category": "geopolitical",
                    "confidence": "HIGH",
                    "time_horizon": "short-term",
                    "signal_score": 215,
                    "reasoning_score": 84.0,
                    "confidence_level": "BUY",
                    "recommendation": "TAKE",
                    "reasoning_components": {"feedback_bias_points": 1.5, "feedback_sample_size": 5},
                    "reasoning": "geopolitical title framed through currency stress rather than defense demand.",
                    "predicted_outcomes": ["fx_stress"],
                    "predicted_causal_chain": ["Conflict risk", "Rupee pressure", "Risk-off spillover"],
                    "signal_briefing": "FX-stress geopolitical headline",
                },
                {
                    "source": "rss",
                    "feed": "AP_Top",
                    "title": "Trump disbanded NSC pandemic unit that experts had praised - AP News",
                    "url": "https://example.com/ap-pandemic",
                    "timestamp": "2026-03-13T07:00:00Z",
                    "pattern_id": "p005",
                    "pattern": "COVID-19 Market Crash",
                    "category": "macroeconomic",
                    "confidence": "HIGH",
                    "time_horizon": "intraday",
                    "signal_score": 200,
                    "reasoning_score": 79.0,
                    "confidence_level": "BUY",
                    "recommendation": "TAKE",
                    "reasoning_components": {"feedback_bias_points": 1.0, "feedback_sample_size": 5},
                    "reasoning": "pandemic policy readiness headline.",
                    "predicted_outcomes": ["risk_off"],
                    "predicted_causal_chain": ["Policy concern", "Pandemic memory", "Risk-off hedge bid"],
                    "signal_briefing": "AP duplicate one",
                },
                {
                    "source": "rss",
                    "feed": "AP_Top",
                    "title": "Trump disbanded NSC pandemic unit that experts had praised - AP News",
                    "url": "https://example.com/ap-pandemic",
                    "timestamp": "2026-03-13T07:05:00Z",
                    "pattern_id": "p005",
                    "pattern": "COVID-19 Market Crash",
                    "category": "macroeconomic",
                    "confidence": "HIGH",
                    "time_horizon": "intraday",
                    "signal_score": 200,
                    "reasoning_score": 79.0,
                    "confidence_level": "BUY",
                    "recommendation": "TAKE",
                    "reasoning_components": {"feedback_bias_points": 1.0, "feedback_sample_size": 5},
                    "reasoning": "pandemic policy readiness headline.",
                    "predicted_outcomes": ["risk_off"],
                    "predicted_causal_chain": ["Policy concern", "Pandemic memory", "Risk-off hedge bid"],
                    "signal_briefing": "AP duplicate two",
                },
            ],
        )
        self._dump(
            data_dir / "signals_enriched_shadow.json",
            [
                {
                    "source": "rss",
                    "feed": "Financial_Times",
                    "title": "Oil tankers reroute after Strait disruption lifts crude prices",
                    "url": "https://example.com/oil-shock",
                    "timestamp": "2026-03-13T12:00:00Z",
                    "signal_score": 280,
                }
            ],
        )
        self._dump(
            data_dir / "tracked_signals.json",
            [
                {
                    "signal": {
                        "pattern_id": "p001",
                        "category": "geopolitical",
                    },
                    "verified": True,
                    "actual_outcome": "CORRECT",
                },
                {
                    "signal": {
                        "pattern_id": "p002",
                        "category": "sentiment_social",
                    },
                    "verified": True,
                    "actual_outcome": "CORRECT",
                },
                {
                    "signal": {
                        "pattern_id": "p003",
                        "category": "geopolitical",
                    },
                    "verified": True,
                    "actual_outcome": "CORRECT",
                },
                {
                    "signal": {
                        "pattern_id": "p004",
                        "category": "macroeconomic",
                    },
                    "verified": True,
                    "actual_outcome": "CORRECT",
                },
            ],
        )
        self._dump(
            data_dir / "signal_ab_comparison.json",
            [
                {
                    "timestamp": "2026-03-13T12:05:00Z",
                    "enriched_lift": 26,
                }
            ],
        )
        self._dump(
            data_dir / "patterns.json",
            {
                "patterns": [
                    {"id": "p001", "name": "Saudi Oil Attacks", "category": "geopolitical", "time_horizon": "intraday", "confidence": "HIGH"},
                    {"id": "p002", "name": "GameStop Short Squeeze", "category": "sentiment_social", "time_horizon": "intraday", "confidence": "HIGH"},
                    {"id": "p003", "name": "Russia-Ukraine Conflict", "category": "geopolitical", "time_horizon": "short-term", "confidence": "HIGH"},
                    {"id": "p004", "name": "US Credit Rating Downgrade", "category": "macroeconomic", "time_horizon": "short-term", "confidence": "HIGH"},
                    {"id": "p005", "name": "COVID-19 Market Crash", "category": "macroeconomic", "time_horizon": "intraday", "confidence": "HIGH"},
                ]
            },
        )

    def _dump(self, path: Path, payload: object) -> None:
        path.write_text(json.dumps(payload), encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
