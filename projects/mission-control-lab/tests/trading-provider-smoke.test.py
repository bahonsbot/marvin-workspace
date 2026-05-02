#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BRIDGE = ROOT / "scripts" / "trading_yfinance_bridge.py"
SOURCE_FILES = {
    "ticker_page": ROOT / "app" / "trading" / "ticker" / "[symbol]" / "page.tsx",
    "quote_route": ROOT / "app" / "api" / "trading" / "quote" / "[symbol]" / "route.ts",
    "ticker_profile": ROOT / "lib" / "trading" / "ticker-profile.ts",
    "contracts": ROOT / "lib" / "trading" / "contracts.ts",
    "reference_enrichment": ROOT / "lib" / "trading" / "sources" / "reference-enrichment.ts",
    "yfinance_bridge": ROOT / "lib" / "trading" / "sources" / "yfinance-bridge.ts",
    "wikipedia": ROOT / "lib" / "trading" / "sources" / "wikipedia.ts",
    "xbrl_filings": ROOT / "lib" / "trading" / "sources" / "xbrl-filings.ts",
    "trading_styles": ROOT / "components" / "pages" / "trading" / "trading.module.css",
}


def run_bridge(symbol: str) -> dict:
    completed = subprocess.run(
        [sys.executable, str(BRIDGE), symbol],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=45,
        check=True,
    )
    return json.loads(completed.stdout)


def read_source(name: str) -> str:
    return SOURCE_FILES[name].read_text(encoding="utf-8")


def metric_values(items: list[dict]) -> dict[str, str]:
    return {str(item.get("label")): str(item.get("value")) for item in items if item.get("label")}


class TradingProviderSmokeTests(unittest.TestCase):
    def test_yfinance_bridge_bare_mu_has_valuation_estimates_and_fundamentals(self) -> None:
        data = run_bridge("MU")

        self.assertEqual(data["symbol"], "MU")
        self.assertIsNone(data.get("error"))
        self.assertTrue(data.get("facts"), "MU should expose yfinance company facts")

        ratios = metric_values(data.get("keyRatios", []))
        self.assertNotIn(ratios.get("P/E Ratio"), (None, "", "Data unavailable"))
        self.assertNotIn(ratios.get("Forward P/E"), (None, "", "Data unavailable"))

        estimates = metric_values(data.get("estimates", []))
        self.assertTrue(estimates.get("Target mean", "").startswith("USD "))
        self.assertNotIn(estimates.get("Recommendation"), (None, "", "Data unavailable"))

        highlights = data.get("fundamentals", {}).get("highlights", {})
        self.assertIsNotNone(highlights.get("eps", {}).get("value"))
        self.assertIsNotNone(highlights.get("grossMargin", {}).get("value"))
        self.assertTrue(highlights.get("eps", {}).get("trendYears"), "EPS should carry chart year labels")

    def test_dot_us_yahoo_fallback_and_cache_refresh_guards_are_present(self) -> None:
        enrichment = read_source("reference_enrichment")
        ticker_profile = read_source("ticker_profile")

        self.assertIn("normalized.endsWith('.US')", enrichment)
        self.assertIn("normalized.replace(/\\.US$/, '')", enrichment)
        self.assertIn("hasUsableYfinanceData", enrichment)
        self.assertIn("result.fundamentals?.highlights?.eps?.value != null", enrichment)
        self.assertIn("mergeFinancialHighlights", enrichment)

        self.assertIn("hasMissingUsYfinanceEnrichment", ticker_profile)
        self.assertIn("profile.symbol.toUpperCase().endsWith('.US')", ticker_profile)
        self.assertIn("hasMissingUsYfinanceEnrichment(cached)", ticker_profile)

    def test_ratio_label_normalization_prevents_ev_ebitda_duplicates(self) -> None:
        source = read_source("yfinance_bridge")

        self.assertIn("function normalizeRatioLabel", source)
        self.assertIn("enterprise value", source.lower())
        self.assertIn("ev/ebitda", source.lower())
        self.assertIn("mergeKeyRatiosFromFundamentals", source)

    def test_ticker_page_has_compact_finance_glossary(self) -> None:
        ticker_page = read_source("ticker_page")
        styles = read_source("trading_styles")

        self.assertIn("financeGlossaryItems", ticker_page)
        self.assertIn("finance-glossary", ticker_page)
        for term in ["P/E", "Forward P/E", "EV / EBITDA", "Gross margin", "Free cash flow", "ROE / ROIC", "Debt / Equity", "Current ratio"]:
            self.assertIn(term, ticker_page)
        self.assertIn("trading-glossary-grid", styles)
        self.assertIn("font-weight: 650", styles)
        self.assertIn("Educational context, not investment advice", ticker_page)

    def test_ticker_chart_accents_avoid_legacy_brown_palette(self) -> None:
        styles = read_source("trading_styles")

        self.assertIn("#4f6f7d", styles)
        self.assertNotIn("#9a6b46", styles)
        self.assertNotIn("rgba(154, 107, 70", styles)

    def test_quote_refresh_falls_back_to_cached_profile_quote_when_eodhd_live_quote_is_missing(self) -> None:
        route = read_source("quote_route")

        self.assertIn("getTickerProfile(normalized)", route)
        self.assertIn("profile?.quote?.rawPrice", route)
        self.assertIn("stale: true", route)
        self.assertIn("Cached quote; live refresh unavailable from EODHD", route)

    def test_yfinance_has_first_class_source_metadata(self) -> None:
        contracts = read_source("contracts")
        source = read_source("yfinance_bridge")
        ticker_page = read_source("ticker_page")

        self.assertIn("'yfinance'", contracts)
        self.assertIn("source: 'yfinance'", source)
        self.assertIn("source === 'yfinance'", ticker_page)
        self.assertIn("return 'Yahoo Finance'", ticker_page)
        self.assertNotIn("Yahoo / yfinance", ticker_page)

    def test_wikipedia_profile_repair_guards_cover_recent_bad_profile_classes(self) -> None:
        wikipedia = read_source("wikipedia")
        ticker_profile = read_source("ticker_profile")

        self.assertIn("'MU.US': 'Micron Technology'", wikipedia)
        self.assertIn("'VRT.US': 'Vertiv'", wikipedia)
        self.assertIn("'WAWI.OL': 'Wallenius Wilhelmsen'", wikipedia)
        self.assertIn("'9988.HK': 'Alibaba Group'", wikipedia)
        self.assertIn("'2454.TW': 'MediaTek'", wikipedia)
        self.assertIn("'2646.TW': 'Starlux Airlines'", wikipedia)
        self.assertIn("may refer to:", wikipedia)
        self.assertIn("title.startsWith('list of ')", wikipedia)
        self.assertIn("stock market index", wikipedia)
        self.assertIn("hang seng index", wikipedia)
        self.assertIn("hasMeaningfulIdentityOverlap", wikipedia)
        self.assertIn("is covered by eodhd market-data endpoints", ticker_profile)
        self.assertIn("'WAWI.OL': true", ticker_profile)
        self.assertIn("fetchFreshTickerProfile(normalizedSymbol)", ticker_profile)

    def test_unsupported_symbols_do_not_use_synthetic_sample_company_profiles(self) -> None:
        ticker_profile = read_source("ticker_profile")
        ticker_page = read_source("ticker_page")

        self.assertIn("isSyntheticSampleFallback", ticker_profile)
        self.assertIn("UnsupportedTickerProfileError", ticker_profile)
        self.assertIn("source.id === 'sample'", ticker_profile)
        self.assertIn("continue", ticker_profile)
        self.assertIn("Ticker not supported yet", ticker_page)
        self.assertIn("No placeholder company profile is shown", ticker_page)
        self.assertIn("INGA.AS instead of ING.AS", ticker_page)

    def test_official_non_us_filings_adapters_and_cache_refresh_are_present(self) -> None:
        xbrl = read_source("xbrl_filings")
        ticker_profile = read_source("ticker_profile")

        for symbol in ["ASRNL.AS", "ASML.AS", "ADYEN.AS"]:
            self.assertIn(symbol, xbrl)
        self.assertIn("resolveEntityFromProfile", xbrl)
        self.assertIn("Official ESEF filings", xbrl)
        self.assertIn("Structured XBRL data", xbrl)

        self.assertIn("isKoreanDisclosureSymbol", xbrl)
        self.assertIn("Official Korean disclosures", xbrl)
        self.assertIn("dart.fss.or.kr", xbrl)
        self.assertIn("englishdart.fss.or.kr", xbrl)
        self.assertIn("kind.krx.co.kr", xbrl)

        self.assertIn("isTaiwanDisclosureSymbol", xbrl)
        self.assertIn("Official Taiwan disclosures", xbrl)
        self.assertIn("emops.twse.com.tw", xbrl)
        self.assertIn("caption_id=000001", xbrl)

        self.assertIn("shouldRefreshCachedReferenceData", ticker_profile)
        self.assertIn("replaceMissingDisclosureResources", ticker_profile)
        self.assertIn("hasRegisteredNonUsFilingsSymbol(profile.symbol)", ticker_profile)
        self.assertIn("profile.sourceMap.filings.source === 'dart'", ticker_profile)
        self.assertIn("profile.sourceMap.filings.source === 'mops'", ticker_profile)
        self.assertIn("!profile.resources.some((group) => group.items.length)", ticker_profile)


if __name__ == "__main__":
    unittest.main(verbosity=2)
