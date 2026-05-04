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
    "eodhd": ROOT / "lib" / "trading" / "sources" / "eodhd.ts",
    "yfinance_bridge": ROOT / "lib" / "trading" / "sources" / "yfinance-bridge.ts",
    "wikipedia": ROOT / "lib" / "trading" / "sources" / "wikipedia.ts",
    "xbrl_filings": ROOT / "lib" / "trading" / "sources" / "xbrl-filings.ts",
    "trading_styles": ROOT / "components" / "pages" / "trading" / "trading.module.css",
    "watchlist_client": ROOT / "components" / "pages" / "trading" / "watchlist" / "WatchlistClient.tsx",
    "watchlist_metadata_route": ROOT / "app" / "api" / "trading" / "watchlist-metadata" / "route.ts",
    "ticker_watchlist_button": ROOT / "components" / "pages" / "trading" / "ticker" / "TickerWatchlistButton.tsx",
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

    def test_ticker_page_uses_fund_specific_sections_for_etfs(self) -> None:
        ticker_page = read_source("ticker_page")
        styles = read_source("trading_styles")

        self.assertIn("buildFundMetricFacts", ticker_page)
        self.assertIn("FundMetricsPanel", ticker_page)
        self.assertIn("FundUnavailablePanel", ticker_page)
        self.assertIn("Fund metrics", ticker_page)
        self.assertIn("Holdings provider not connected", ticker_page)
        self.assertIn("Expense and AUM coverage pending", ticker_page)
        self.assertIn("This page will not infer holdings from the fund name", ticker_page)
        self.assertIn("!isFundProfile", ticker_page)
        self.assertIn("trading-fund-metric-facts", styles)
        self.assertIn("trading-fund-unavailable-panel", styles)

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


    def test_cached_bad_iren_profile_is_forced_to_refresh(self) -> None:
        ticker_profile = read_source("ticker_profile")

        self.assertIn("antisemitic treatise", ticker_profile)
        self.assertIn("martin luther", ticker_profile)
        self.assertIn("jews", ticker_profile)
        self.assertIn("sophia kianni", ticker_profile)
        self.assertIn("phia ai", ticker_profile)

    def test_eodhd_dotted_symbol_resolution_uses_search_metadata(self) -> None:
        eodhd = read_source("eodhd")

        self.assertIn("parseDottedSymbol", eodhd)
        self.assertIn("fetchEodhdSearch(parsed.code)", eodhd)
        self.assertIn("searchResult: exact", eodhd)
        self.assertIn("preferredInstrumentName", eodhd)

    def test_etf_fallback_profile_summary_is_honest_and_not_provider_debug_copy(self) -> None:
        eodhd = read_source("eodhd")
        reference = read_source("reference_enrichment")

        self.assertIn("fallbackProfileSummary", eodhd)
        self.assertIn("verified fund strategy summary is not available yet", eodhd)
        self.assertNotIn("covered by EODHD market-data endpoints", eodhd)
        self.assertIn("isFundLikeQuoteType", reference)
        self.assertIn("fallbackSummary", reference)

    def test_watchlist_table_prefers_provider_metadata_names_without_overwriting_saved_rows(self) -> None:
        watchlist = read_source("watchlist_client")
        route = read_source("watchlist_metadata_route")

        self.assertIn("resolvedWatchlistName", watchlist)
        self.assertIn("metadata?.name", watchlist)
        self.assertIn("isProviderPlaceholderDisplayName", watchlist)
        self.assertIn("covered by eodhd market-data endpoints", watchlist)
        self.assertIn("resolvedWatchlistSymbol", watchlist)
        self.assertIn("metadata?.symbol", watchlist)
        self.assertIn("name: profile.name", route)

    def test_wikipedia_profile_repair_guards_cover_recent_bad_profile_classes(self) -> None:
        wikipedia = read_source("wikipedia")
        ticker_profile = read_source("ticker_profile")

        self.assertIn("'MU.US': 'Micron Technology'", wikipedia)
        self.assertIn("'VRT.US': 'Vertiv'", wikipedia)
        self.assertIn("'WAWI.OL': 'Wallenius Wilhelmsen'", wikipedia)
        self.assertIn("'9988.HK': 'Alibaba Group'", wikipedia)
        self.assertIn("'2454.TW': 'MediaTek'", wikipedia)
        self.assertIn("'2646.TW': 'Starlux Airlines'", wikipedia)
        self.assertIn("'IREN.US': 'Iris Energy'", wikipedia)
        self.assertIn("'PHIA.AS': 'Philips'", wikipedia)
        self.assertIn("antisemitic treatise", wikipedia)
        self.assertIn("may refer to:", wikipedia)
        self.assertIn("title.startsWith('list of ')", wikipedia)
        self.assertIn("stock market index", wikipedia)
        self.assertIn("hang seng index", wikipedia)
        self.assertIn("identityTokens", wikipedia)
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

    def test_watchlist_add_symbol_reuses_ticker_search_endpoint(self) -> None:
        watchlist = read_source("watchlist_client")
        styles = read_source("trading_styles")

        self.assertIn("/api/trading/search?q=", watchlist)
        self.assertIn("Search by ticker or company", watchlist)
        self.assertIn("selectTicker(result)", watchlist)
        self.assertIn("name: lockedTicker?.name", watchlist)
        self.assertIn("exchange: lockedTicker?.exchange", watchlist)
        self.assertIn("currency: lockedTicker?.currency", watchlist)
        self.assertIn("trading-watchlist-symbol-results", styles)
        self.assertIn("trading-watchlist-symbol-selected", styles)

    def test_watchlist_redesign_keeps_table_first_management_and_news_placeholders(self) -> None:
        watchlist = read_source("watchlist_client")
        styles = read_source("trading_styles")

        self.assertIn("trading-watchlist-command-bar", watchlist)
        self.assertIn("trading-watchlist-tabs", watchlist)
        self.assertIn("Manage watchlist", watchlist)
        self.assertIn("Pin to Overview", watchlist)
        self.assertIn("Watchlist news", watchlist)
        self.assertIn("No linked headlines yet", watchlist)
        self.assertIn("<th>Price</th>", watchlist)
        metadata_route = read_source("watchlist_metadata_route")
        ticker_button = read_source("ticker_watchlist_button")
        ticker_page = read_source("ticker_page")

        self.assertIn("<th>5D</th>", watchlist)
        self.assertIn("<th>P/E</th>", watchlist)
        self.assertIn("<th>52W</th>", watchlist)
        self.assertIn("WatchlistLogo", watchlist)
        self.assertIn("FiveDaySparkline", watchlist)
        self.assertIn("Week52Range", watchlist)
        self.assertIn("Sort by", watchlist)
        self.assertIn("PinIcon", watchlist)
        self.assertIn("/api/trading/watchlist-metadata", watchlist)
        self.assertNotIn("Market cap", watchlist)
        self.assertNotIn("Convex live", watchlist)
        self.assertIn("trading-watchlist-page-table", styles)
        self.assertIn("trading-watchlist-news-placeholder", styles)
        self.assertIn("trading-watchlist-logo", styles)
        self.assertIn("trading-watchlist-52w", styles)
        self.assertIn("trading-watchlist-mini-spark", styles)
        self.assertIn("rangeSeries?.['5D']", metadata_route)
        self.assertIn("TickerWatchlistButton", ticker_page)
        self.assertIn("watchlistApi.listWatchlists", ticker_button)
        self.assertIn("watchlistApi.add", ticker_button)
        self.assertIn("Choose where to save", ticker_button)
        self.assertIn("trading-ticker-watchlist-menu", styles)


if __name__ == "__main__":
    unittest.main(verbosity=2)
