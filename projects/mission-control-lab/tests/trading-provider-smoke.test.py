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
    "justetf_fund_facts": ROOT / "lib" / "trading" / "sources" / "justetf-fund-facts.ts",
    "defeatbeta_source": ROOT / "lib" / "trading" / "sources" / "defeatbeta.ts",
    "defeatbeta_route": ROOT / "app" / "api" / "trading" / "defeatbeta" / "[symbol]" / "route.ts",
    "eodhd": ROOT / "lib" / "trading" / "sources" / "eodhd.ts",
    "yfinance_bridge": ROOT / "lib" / "trading" / "sources" / "yfinance-bridge.ts",
    "wikipedia": ROOT / "lib" / "trading" / "sources" / "wikipedia.ts",
    "xbrl_filings": ROOT / "lib" / "trading" / "sources" / "xbrl-filings.ts",
    "trading_styles": ROOT / "components" / "pages" / "trading" / "trading.module.css",
    "watchlist_client": ROOT / "components" / "pages" / "trading" / "watchlist" / "WatchlistClient.tsx",
    "watchlist_metadata_route": ROOT / "app" / "api" / "trading" / "watchlist-metadata" / "route.ts",
    "ticker_watchlist_button": ROOT / "components" / "pages" / "trading" / "ticker" / "TickerWatchlistButton.tsx",
    "portfolio_client": ROOT / "components" / "pages" / "trading" / "portfolio" / "PortfolioClient.tsx",
    "portfolio_convex": ROOT / "convex" / "portfolio.ts",
    "portfolio_fx": ROOT / "lib" / "trading" / "fx.ts",
    "portfolio_fx_route": ROOT / "app" / "api" / "trading" / "fx" / "route.ts",
    "portfolio_performance_route": ROOT / "app" / "api" / "trading" / "portfolio-performance" / "route.ts",
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
        self.assertIn("Cost, scale, and distribution", ticker_page)
        self.assertIn("{ label: 'Cost', href: '#key-ratios'", ticker_page)
        self.assertIn("!isFundProfile ? (", ticker_page)
        self.assertIn("Top holdings pending", ticker_page)
        self.assertIn("Country exposure pending", ticker_page)
        self.assertIn("Sector exposure pending", ticker_page)
        self.assertIn("Fund cost coverage pending", ticker_page)
        self.assertIn("This page will not infer constituents from the fund name", ticker_page)
        self.assertIn("!isFundProfile", ticker_page)
        self.assertIn("FundMetricListPanel", ticker_page)
        self.assertIn("showSource = true", ticker_page)
        self.assertIn("FundAnalyticsPanel", ticker_page)
        self.assertIn("ExposureBars", ticker_page)
        self.assertIn("buildFundAnalyticsGroups", ticker_page)
        self.assertIn("splitFundOwnershipMetrics", ticker_page)
        self.assertIn("profileSummaryParagraphs", ticker_page)
        self.assertIn("fundProfileIdentityFacts", ticker_page)
        self.assertIn("displayProfileFactsForPage", ticker_page)
        self.assertIn("AUM / Fund Size", ticker_page)
        self.assertIn("Fund Domicile", ticker_page)
        self.assertIn("fundOwnershipMetrics.countries", ticker_page)
        self.assertIn("fundOwnershipMetrics.sectors", ticker_page)
        self.assertIn("trading-ticker-fund-analytics-wide", styles)
        self.assertIn("trading-fund-analytics-panel", styles)
        self.assertIn("trading-fund-exposure-bars", styles)
        self.assertIn("trading-fund-metric-group", styles)
        self.assertIn("trading-fund-metric-facts", styles)
        self.assertIn("trading-fund-unavailable-panel", styles)
        self.assertIn("trading-fund-list-panel", styles)

    def test_justetf_fund_facts_enrichment_is_wired_by_isin(self) -> None:
        contracts = read_source("contracts")
        reference = read_source("reference_enrichment")
        justetf = read_source("justetf_fund_facts")

        self.assertIn("'justetf'", contracts)
        self.assertIn("fetchJustEtfFundFacts(profile)", reference)
        self.assertIn("mergeJustEtfSupplementalData", reference)
        self.assertIn("justETF profile", justetf)
        self.assertIn("JUSTETF_BASE_URL", justetf)
        self.assertIn("parseTopHoldings", justetf)
        self.assertIn("Expense Ratio", justetf)
        self.assertIn("Top 10 Weight", justetf)
        self.assertIn("Fund Provider", justetf)
        self.assertIn("Fund holding", justetf)
        self.assertIn("Country exposure", justetf)
        self.assertIn("Sector exposure", justetf)

    def test_defeatbeta_adapter_is_server_side_and_fails_soft(self) -> None:
        source = read_source("defeatbeta_source")
        route = read_source("defeatbeta_route")
        contracts = read_source("contracts")

        self.assertIn("import 'server-only'", source)
        self.assertIn("DEFEATBETA_SIDECAR_URL", source)
        self.assertIn("DEFAULT_BASE_URL = 'http://127.0.0.1:8791'", source)
        self.assertIn("DefeatBetaAdapterResult", source)
        self.assertIn("DefeatBeta sidecar is not reachable", source)
        self.assertIn("DefeatBeta sidecar request timed out", source)
        self.assertIn("coverage: { prices: false, statements: false, ratios: false, quality: false, events: false }", source)
        self.assertIn("getDefeatBetaAnalyticsSummary", route)
        self.assertIn("NextResponse.json(result", route)
        self.assertIn("'defeatbeta'", contracts)

    def test_etf_ticker_page_does_not_repeat_bottom_holdings_card(self) -> None:
        ticker_page = read_source("ticker_page")

        self.assertIn("!isFundProfile ? (", ticker_page)
        self.assertIn("<div className=\"trading-section-label\">Ownership</div>", ticker_page)
        self.assertNotIn("Holdings feed pending", ticker_page)



    def test_etf_profile_keeps_identity_facts_and_metrics_hold_fund_details(self) -> None:
        ticker_page = read_source("ticker_page")
        styles = read_source("trading_styles")

        self.assertIn("const keep = new Set(['instrument type', 'exchange', 'country', 'isin'])", ticker_page)
        self.assertIn("displayProfileFactsForPage", ticker_page)
        self.assertIn("fundProfileIdentityFacts(displayProfileFacts)", ticker_page)
        self.assertIn("AUM / Fund Size", ticker_page)
        self.assertIn("Fund Domicile", ticker_page)
        self.assertIn("font-weight: 500", styles)
        self.assertIn("font-weight: 450", styles)

    def test_etf_ticker_page_removes_news_and_uses_full_width_analytics(self) -> None:
        ticker_page = read_source("ticker_page")

        self.assertIn("!isFundProfile ? (", ticker_page)
        self.assertIn('<section id="recent-news"', ticker_page)
        self.assertIn('<section id="fund-analytics" className="trading-ticker-fund-analytics-wide"', ticker_page)
        self.assertIn("Cost, scale, and distribution", ticker_page)
        self.assertIn("showSource={false}", ticker_page)
        self.assertIn("sourceList(sourceMetrics, sourceMetrics[0]?.source).replace('Sources:', 'Source:')", ticker_page)


    def test_etf_ticker_page_omits_stock_only_glossary_and_estimates(self) -> None:
        ticker_page = read_source("ticker_page")

        self.assertIn("!isFundProfile ? (", ticker_page)
        self.assertIn('<section id="finance-glossary"', ticker_page)
        self.assertIn('<section id="estimates"', ticker_page)
        self.assertIn("{ label: 'Glossary', href: '#finance-glossary' }", ticker_page)
        fund_nav = ticker_page.split("if (isFundProfile)", 1)[1].split("return [", 1)[1].split("];", 1)[0]
        self.assertNotIn("#finance-glossary", fund_nav)
        self.assertNotIn("#estimates", fund_nav)

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
        self.assertIn("WATCHLIST_METADATA_CACHE_KEY", watchlist)
        self.assertIn("readWatchlistMetadataCache", watchlist)
        self.assertIn("writeWatchlistMetadataCache", watchlist)
        self.assertIn("mission-control-lab:watchlist-metadata:v1", watchlist)
        self.assertIn("watchlistMetadataForItem", watchlist)
        self.assertIn("safeMetadataName", watchlist)
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



    def test_portfolio_uses_base_currency_fx_conversion(self) -> None:
        portfolio = read_source("portfolio_client")
        fx = read_source("portfolio_fx")
        fx_route = read_source("portfolio_fx_route")
        styles = read_source("trading_styles")

        self.assertIn("PORTFOLIO_FX_CACHE_KEY", portfolio)
        self.assertIn("/api/trading/fx?base=", portfolio)
        self.assertIn("marketValueBase", portfolio)
        self.assertIn("totalPlBase", portfolio)
        self.assertIn("costBasisBase", portfolio)
        self.assertIn("formatFxRate", portfolio)
        self.assertIn("fxTooltipRows", portfolio)
        self.assertIn("trading-portfolio-fx-tooltip", portfolio)
        self.assertIn("Manual rows with live quote overlay and base-currency conversion", portfolio)
        self.assertIn("frankfurter.app", fx)
        self.assertIn("STATIC_TO_EUR", fx)
        self.assertIn("getFxRates", fx_route)
        self.assertIn("trading-portfolio-fx-kpi", styles)
        self.assertIn("trading-portfolio-fx-tooltip", styles)
        self.assertIn("overflow: visible", styles)
        self.assertIn("bottom: calc(100% + 8px)", styles)
        self.assertNotIn("trading-portfolio-fx-note", portfolio)

    def test_portfolio_cash_management_is_separate_from_ticker_holdings(self) -> None:
        portfolio = read_source("portfolio_client")
        styles = read_source("trading_styles")

        self.assertIn("CashManagementPanel", portfolio)
        self.assertIn("LiveCashManagementForm", portfolio)
        self.assertIn("cashSymbol(currency)", portfolio)
        self.assertIn("assetType: \"cash\"", portfolio)
        self.assertIn("investmentHoldings", portfolio)
        self.assertIn("holdings={sortedHoldings.filter", portfolio)
        self.assertIn("Cash management", portfolio)
        self.assertIn("Add cash", portfolio)
        self.assertIn("trading-portfolio-cash-panel", styles)
        self.assertIn("trading-portfolio-cash-form", styles)
        self.assertIn("trading-portfolio-cash-row", styles)

    def test_portfolio_holdings_imports_watchlist_market_visuals(self) -> None:
        portfolio = read_source("portfolio_client")
        styles = read_source("trading_styles")

        self.assertIn("FiveDayGlimmer", portfolio)
        self.assertIn("Week52Range", portfolio)
        self.assertIn("<th>5D</th>", portfolio)
        self.assertIn("<th>52W</th>", portfolio)
        self.assertIn("trading-portfolio-price-change", portfolio)
        self.assertIn("trading-portfolio-glimmer", styles)
        self.assertIn("trading-portfolio-52w", styles)
        self.assertNotIn("<th>Weight</th>", portfolio)
        self.assertNotIn("trading-portfolio-weight", portfolio)
        self.assertNotIn("<tfoot>", portfolio)

    def test_portfolio_holding_rows_show_logos_and_buy_more_flow(self) -> None:
        portfolio = read_source("portfolio_client")
        styles = read_source("trading_styles")

        self.assertIn("trading-portfolio-logo", portfolio)
        self.assertIn("holding.metadata?.logoUrl", portfolio)
        self.assertIn("initialsForHolding", portfolio)
        self.assertIn("BuyMoreForm", portfolio)
        self.assertIn("Add purchase", portfolio)
        self.assertIn("Purchase price", portfolio)
        self.assertIn("Transaction costs", portfolio)
        self.assertIn("nextAverageCost", portfolio)
        self.assertIn("holding.costBasis + addedQuantity * purchasePrice + transactionFee", portfolio)
        self.assertIn("trading-portfolio-buy-more", styles)
        self.assertIn("trading-portfolio-buy-more-form", styles)
        self.assertIn("trading-portfolio-holding-cell", styles)

    def test_portfolio_closed_positions_include_trade_fee_values(self) -> None:
        portfolio = read_source("portfolio_client")

        self.assertIn("function transactionFeeValue", portfolio)
        self.assertIn("function tradeNativeValue", portfolio)
        self.assertIn("current.fees += fee", portfolio)
        self.assertIn("side === \"buy\" ? gross + fee : Math.max(0, gross - fee)", portfolio)
        self.assertIn("<th>Fees</th>", portfolio)

    def test_portfolio_polish_keeps_search_edit_fee_flow(self) -> None:
        portfolio = read_source("portfolio_client")
        convex_portfolio = read_source("portfolio_convex")
        styles = read_source("trading_styles")

        self.assertIn("trading-portfolio-add-icon-button", portfolio)
        self.assertIn("<Plus size={16}", portfolio)
        self.assertIn("trading-portfolio-holdings-sort", portfolio)
        self.assertIn('className="trading-portfolio-edit"', portfolio)
        self.assertIn('mode="edit"', portfolio)
        self.assertIn("/api/trading/search?q=", portfolio)
        self.assertIn("applySearchResult", portfolio)
        self.assertIn("assetTypeFromSearchType", portfolio)
        self.assertIn("Transaction fee", portfolio)
        self.assertNotIn("<span>Sector</span>", portfolio)
        self.assertNotIn("<span>Country</span>", portfolio)
        self.assertIn("transactionFee: v.optional(v.number())", convex_portfolio)
        self.assertIn("quantity * averageCost + (transactionFee ?? 0)", convex_portfolio)
        self.assertIn("trading-portfolio-search-results", styles)
        self.assertIn("trading-portfolio-edit", styles)
        self.assertIn("#20b86f", portfolio)


    def test_analytics_page_is_valuation_workbench_without_portfolio_lens(self) -> None:
        analytics = (ROOT / "app" / "trading" / "analytics" / "page.tsx").read_text(encoding="utf-8")
        workbench = (ROOT / "components" / "pages" / "trading" / "analytics" / "AnalyticsWorkbenchClient.tsx").read_text(encoding="utf-8")
        styles = read_source("trading_styles")

        self.assertIn("AnalyticsWorkbenchClient", analytics)
        self.assertIn("hideHeader", analytics)
        self.assertIn("From symbol to fair-value range", workbench)
        self.assertIn("Valuation verdict", workbench)
        self.assertIn("Milou analysis panel", workbench)
        self.assertIn("Quick valuation", workbench)
        self.assertIn("Full thesis", workbench)
        self.assertIn("Reverse DCF", workbench)
        self.assertIn("fetch(`/api/trading/search", workbench)
        self.assertIn("fetch('/api/trading/valuation/quick'", workbench)
        self.assertIn("setValuation(payload.valuation)", workbench)
        self.assertIn("Choose a ticker result, then generate Quick Valuation.", workbench)
        self.assertIn("status: 'generating'", workbench)
        self.assertIn("Valuation run status", workbench)
        self.assertIn("coverageEntries", workbench)
        self.assertIn("formatElapsed", workbench)
        self.assertIn("Model interpretation only", workbench)
        self.assertIn("CorridorChart", workbench)
        self.assertIn("SensitivityBands", workbench)
        self.assertIn("Explainer", workbench)
        self.assertIn("trading-analytics-corridor-head", workbench)
        self.assertNotIn("Bear/base/bull range from the blended model", workbench)
        self.assertNotIn("Quick valuation complete. Uses simplified DCF proxy and available historical data.", workbench)
        valuation_model = (ROOT / "lib" / "trading" / "valuation" / "quick-valuation.ts").read_text(encoding="utf-8")
        self.assertIn("buildQuickValuation", valuation_model)
        self.assertIn("QuickValuationResult", valuation_model)
        self.assertIn("ValuationSubmodel", valuation_model)
        self.assertIn("buildDcfProxy", valuation_model)
        self.assertIn("buildMultiplesModel", valuation_model)
        self.assertIn("buildReverseDcfModel", valuation_model)
        self.assertIn("buildQualityRiskOverlay", valuation_model)
        self.assertIn("quick-valuation-submodels-v1", valuation_model)
        self.assertIn("ValuationRunStatus", valuation_model)
        self.assertIn("runStatus", valuation_model)
        self.assertIn("ValuationSensitivity", valuation_model)
        self.assertIn("sensitivityRows", valuation_model)
        self.assertIn("bear: number | null", valuation_model)
        self.assertIn("driver: string", valuation_model)
        self.assertIn("modelType: 'submodel-proxy'", valuation_model)
        self.assertIn("submodels,", valuation_model)
        self.assertIn("DCF proxy", valuation_model)
        self.assertIn("No fair-value range calculated without analytics coverage", valuation_model)
        self.assertIn("pendingMethods", valuation_model)
        self.assertIn("Needs analytics data", valuation_model)
        valuation_route = (ROOT / "app" / "api" / "trading" / "valuation" / "quick" / "route.ts").read_text(encoding="utf-8")
        self.assertIn("getDefeatBetaAnalyticsSummary", valuation_route)
        self.assertIn("timeoutMs: 30_000", valuation_route)
        self.assertIn("bestValidatedMatch", workbench)
        self.assertIn("result.symbol.toUpperCase() === normalized", workbench)
        self.assertIn("selectTicker", workbench)
        self.assertIn("trading-analytics-symbol-results", workbench)
        self.assertIn('aria-autocomplete="list"', workbench)
        self.assertIn("DefeatBeta + providers", workbench)
        self.assertNotIn("Portfolio Lens", workbench)
        self.assertNotIn("Portfolio Impact", workbench)
        self.assertIn("trading-analytics-workbench", styles)
        self.assertIn("trading-analytics-milou", styles)
        self.assertIn("trading-analytics-symbol-results", styles)
        self.assertIn("trading-analytics-symbol-search", styles)
        self.assertIn("trading-analytics-run-status", styles)
        self.assertIn("trading-analytics-coverage-row", styles)
        self.assertIn("trading-analytics-disclaimer", styles)
        self.assertIn("trading-analytics-corridor", styles)
        self.assertIn("trading-analytics-sensitivity-bands", styles)
        self.assertIn("trading-analytics-explainer", styles)
        self.assertIn("data-model='dcfProxy'", styles)
        self.assertIn("trading-analytics-corridor-head", styles)

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
        self.assertIn("WatchlistNewsItem", watchlist)
        self.assertIn("publishedAt", watchlist)
        self.assertIn("visibleNews", watchlist)
        self.assertIn("WatchlistNewsSortKey", watchlist)
        self.assertIn("All tickers", watchlist)
        self.assertIn("Newest", watchlist)
        self.assertIn("slice(0, 16)", watchlist)
        self.assertIn("WATCHLIST_NEWS_CACHE_KEY", watchlist)
        self.assertIn("readWatchlistNewsCache", watchlist)
        self.assertIn("writeWatchlistNewsCache", watchlist)
        self.assertIn("metadataLoading && !watchlistNews.length", watchlist)
        self.assertIn("No provider-linked headlines are available", watchlist)
        self.assertIn("trading-watchlist-news-list", watchlist)
        self.assertIn("<th>Price</th>", watchlist)
        metadata_route = read_source("watchlist_metadata_route")
        ticker_button = read_source("ticker_watchlist_button")
        ticker_page = read_source("ticker_page")

        self.assertIn("<th>5D</th>", watchlist)
        self.assertIn("<th>P/E</th>", watchlist)
        self.assertIn("<th>52W</th>", watchlist)
        self.assertIn("WatchlistLogo", watchlist)
        self.assertIn("<th>Price Alert</th>", watchlist)
        self.assertIn("<th>Status</th>", watchlist)
        self.assertIn("PriceAlertCell", watchlist)
        self.assertIn("PriceAlertStatusPill", watchlist)
        self.assertIn("alertMinPrice", watchlist)
        self.assertIn("alertMaxPrice", watchlist)
        self.assertIn("watchlistApi.move", watchlist)
        self.assertIn("Move {resolvedWatchlistSymbol", watchlist)
        self.assertIn("trading-watchlist-move-list", watchlist)
        self.assertNotIn("Why is this on the list?", watchlist)
        self.assertNotIn("has-note", watchlist)
        self.assertIn("FiveDaySparkline", watchlist)
        self.assertIn("Week52Range", watchlist)
        self.assertIn("Sort by", watchlist)
        self.assertIn("PinIcon", watchlist)
        self.assertIn("/api/trading/watchlist-metadata", watchlist)
        self.assertNotIn("Market cap", watchlist)
        self.assertNotIn("Convex live", watchlist)
        self.assertIn("trading-watchlist-page-table", styles)
        self.assertIn("trading-watchlist-news-placeholder", styles)
        self.assertIn("trading-watchlist-news-list", styles)
        self.assertIn("grid-template-columns: repeat(2, minmax(0, 1fr))", styles)
        self.assertIn("font-family: var(--font-serif)", styles)
        self.assertIn("trading-watchlist-news-controls", styles)
        self.assertIn("trading-watchlist-logo", styles)
        self.assertIn("trading-watchlist-inline-select", styles)
        self.assertIn("trading-watchlist-move-list", styles)
        self.assertIn("object-position: center", styles)
        self.assertIn("trading-watchlist-row-error", styles)
        self.assertIn("trading-watchlist-52w", styles)
        self.assertIn("trading-watchlist-mini-spark", styles)
        self.assertIn("rangeSeries?.['5D']", metadata_route)
        self.assertIn("newsFromProfile", metadata_route)
        self.assertIn("publishedAt", metadata_route)
        self.assertIn("newsSortValue", metadata_route)
        self.assertIn("slice(0, 16)", metadata_route)
        self.assertIn("dedupeNews", metadata_route)
        self.assertIn("return NextResponse.json({ items, news })", metadata_route)
        convex_watchlist = (ROOT / "convex" / "watchlist.ts").read_text(encoding="utf-8")
        self.assertIn("if (args.priority !== undefined) patch.priority = args.priority", convex_watchlist)
        self.assertIn("export const move", convex_watchlist)
        self.assertIn("targetWatchlistId", convex_watchlist)
        self.assertIn("ctx.db.delete(item._id)", convex_watchlist)
        self.assertIn("TickerWatchlistButton", ticker_page)
        self.assertIn("watchlistApi.listWatchlists", ticker_button)
        self.assertIn("watchlistApi.add", ticker_button)
        self.assertIn("Choose where to save", ticker_button)
        wikipedia = read_source("wikipedia")
        self.assertIn("'CRWV.US': 'CoreWeave'", wikipedia)
        self.assertIn("blockedLogoFiles", wikipedia)
        self.assertIn("object-position: center", styles)
        self.assertIn("trading-ticker-watchlist-menu", styles)


    def test_portfolio_performance_chart_uses_live_range_overlays(self) -> None:
        client = read_source("portfolio_client")
        route = read_source("portfolio_performance_route")
        self.assertIn('lightweight-charts', client)
        self.assertIn('const performanceRanges: PerformanceRange[] = [', client)
        for range_label in ['"1D"', '"5D"', '"1M"', '"6M"', '"YTD"', '"1Y"', '"5Y"']:
            self.assertIn(range_label, client)
        self.assertIn('/api/trading/portfolio-performance', client)
        self.assertNotIn('Benchmark overlays are Phase 1 scaffolding', client)
        self.assertIn('Reconstructed from current holdings, current FX, and historical market prices', client)
        self.assertIn("BENCHMARKS", route)
        self.assertIn("SPY.US", route)
        self.assertIn("VT.US", route)
        self.assertIn("QQQ.US", route)
        self.assertIn('getTickerProfile', route)
        self.assertIn('Portfolio line is reconstructed from current holdings, current FX rates, and historical prices', route)

if __name__ == "__main__":
    unittest.main(verbosity=2)
