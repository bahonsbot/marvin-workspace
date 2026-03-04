#!/usr/bin/env python3
"""Intelligent symbol mapping for Market Intel signals.

Maps signals to appropriate tickers based on:
- Signal category (macro, sector, company-specific)
- Keywords in title/content
- Confidence level
- Reasoning components

Returns: (symbol, confidence, reasoning)
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

# Sector/Industry ETF mappings
SECTOR_ETF = {
    "technology": "XLK",
    "tech": "XLK",
    "semiconductor": "SOXX",
    "chip": "SOXX",
    "ai": "AIQ",
    "artificial intelligence": "AIQ",
    "software": "IGV",
    "cloud": "SKYY",
    "cybersecurity": "CIBR",
    "finance": "XLF",
    "financial": "XLF",
    "bank": "KRE",
    "banking": "KRE",
    "insurance": "KIE",
    "asset management": "AMZA",
    "private credit": "PSEC",
    "energy": "XLE",
    "oil": "USO",
    "crude": "USO",
    "gas": "UNG",
    "natural gas": "UNG",
    "renewable": "ICLN",
    "solar": "TAN",
    "nuclear": "URA",
    "uranium": "URA",
    "healthcare": "XLV",
    "pharma": "XBI",
    "pharmaceutical": "XBI",
    "biotech": "IBB",
    "medical": "IHI",
    "consumer": "XLY",
    "retail": "XRT",
    "e-commerce": "IBUY",
    "automotive": "CARZ",
    "ev": "DRIV",
    "electric vehicle": "DRIV",
    "industrial": "XLI",
    "aerospace": "ITA",
    "defense": "ITA",
    "materials": "XLB",
    "mining": "PICK",
    "gold": "GLD",
    "precious metal": "GLD",
    "agriculture": "DBA",
    "commodity": "DBC",
    "real estate": "VNQ",
    "reit": "VNQ",
    "property": "VNQ",
    "telecom": "XLC",
    "communication": "XLC",
    "media": "PBS",
    "entertainment": "PEJ",
    "transportation": "IYT",
    "shipping": "SEA",
    "logistics": "IYT",
    "airline": "JETS",
    "aviation": "JETS",
}

# Macro/Geopolitical ETF mappings
MACRO_ETF = {
    "sp500": "SPY",
    "s&p": "SPY",
    "nasdaq": "QQQ",
    "russell": "IWM",
    "dow": "DIA",
    "vix": "VIXY",
    "volatility": "VIXY",
    "treasury": "TLT",
    "bond": "TLT",
    "yield": "TLT",
    "dollar": "UUP",
    "usd": "UUP",
    "currency": "FXE",
    "euro": "FXE",
    "emerging market": "EEM",
    "em": "EEM",
    "china": "FXI",
    "japan": "EWJ",
    "europe": "VGK",
    "uk": "EWU",
    "germany": "EWG",
    "korea": "EWY",
    "india": "INDA",
    "brazil": "EWZ",
    "russia": "ERUS",
    "middle east": "TUR",
    "israel": "EIS",
    "iran": "TUR",  # No direct Iran ETF, Turkey as regional proxy
    "saudi": "KSA",
    "uae": "UAE",
    "dubai": "UAE",
    "oil price": "USO",
    "inflation": "TIP",
    "cpi": "TIP",
    "fed": "TLT",
    "interest rate": "TLT",
    "recession": "SH",
    "gdp": "SPY",
    "jobs": "SPY",
    "employment": "SPY",
    "adp": "SPY",
    "nonfarm": "SPY",
    "unemployment": "SH",
}

# Company ticker mappings (common large caps)
COMPANY_TICKER = {
    "apple": "AAPL",
    "aapl": "AAPL",
    "microsoft": "MSFT",
    "msft": "MSFT",
    "google": "GOOGL",
    "alphabet": "GOOGL",
    "amazon": "AMZN",
    "amzn": "AMZN",
    "meta": "META",
    "facebook": "META",
    "tesla": "TSLA",
    "tsla": "TSLA",
    "nvidia": "NVDA",
    "nvda": "NVDA",
    "jp morgan": "JPM",
    "jpmorgan": "JPM",
    "jpm": "JPM",
    "goldman sachs": "GS",
    "goldman": "GS",
    "morgan stanley": "MS",
    "bank of america": "BAC",
    "wells fargo": "WFC",
    "citigroup": "C",
    "blackrock": "BLK",
    "vanguard": "VOO",
    "berkshire hathaway": "BRK.B",
    "visa": "V",
    "mastercard": "MA",
    "paypal": "PYPL",
    "netflix": "NFLX",
    "disney": "DIS",
    "boeing": "BA",
    "lockheed": "LMT",
    "exxon": "XOM",
    "chevron": "CVX",
    "pfizer": "PFE",
    "johnson & johnson": "JNJ",
    "unitedhealth": "UNH",
    "walmart": "WMT",
    "costco": "COST",
    "home depot": "HD",
    "coca-cola": "KO",
    "pepsi": "PEP",
    "starbucks": "SBUX",
    "mcdonald": "MCD",
    "nike": "NKE",
    "intel": "INTC",
    "amd": "AMD",
    "qualcomm": "QCOM",
    "cisco": "CSCO",
    "oracle": "ORCL",
    "salesforce": "CRM",
    "adobe": "ADBE",
    "ibm": "IBM",
    "uber": "UBER",
    "lyft": "LYFT",
    "airbnb": "ABNB",
    "coinbase": "COIN",
    "block": "SQ",
    "square": "SQ",
    "alibaba": "BABA",
    "tencent": "TCEHY",
    "blue owl": "OWL",
}


@dataclass
class SymbolDecision:
    symbol: str
    confidence: float
    reasoning: str
    category: str  # macro, sector, company


def classify_signal(signal: dict[str, Any]) -> str:
    """Classify signal as macro, sector, or company-specific."""
    title = str(signal.get("title", "")).lower()
    pattern = str(signal.get("pattern", "")).lower()
    category = str(signal.get("category", "")).lower()

    # Company-specific patterns
    company_keywords = [
        "earnings", "beat", "miss", "guidance", "revenue",
        "ceo", "cfo", "layoff", "hiring", "strike",
        "lawsuit", "settlement", "investigation", "probe",
        "merger", "acquisition", "spinoff", "ipo",
        "upgrade", "downgrade", "target price", "analyst"
    ]

    # Check if title mentions specific company
    for company in COMPANY_TICKER.keys():
        if company in title:
            return "company"

    # Check pattern names for company-specific signals
    if any(kw in pattern for kw in company_keywords):
        if any(kw in title for kw in ["beat", "miss", "earnings", "revenue"]):
            return "company"

    # Macro/geopolitical categories
    macro_categories = ["geopolitical", "macroeconomic", "sentiment_news", "sentiment_social"]
    if category in macro_categories:
        return "macro"

    # Sector-specific patterns
    sector_keywords = list(SECTOR_ETF.keys())
    if any(kw in title or kw in pattern for kw in sector_keywords):
        return "sector"

    # Default to macro for broad market signals
    return "macro"


def extract_companies(title: str) -> list[str]:
    """Extract company names from title."""
    title_lower = title.lower()
    found = []
    for company in COMPANY_TICKER.keys():
        if company in title_lower:
            found.append(company)
    return found


def extract_sectors(title: str) -> list[str]:
    """Extract sector/industry keywords from title."""
    title_lower = title.lower()
    found = []
    for sector in SECTOR_ETF.keys():
        if sector in title_lower:
            found.append(sector)
    return found


def extract_macro_themes(title: str) -> list[str]:
    """Extract macro/geopolitical themes from title."""
    title_lower = title.lower()
    found = []
    for theme in MACRO_ETF.keys():
        if theme in title_lower:
            found.append(theme)
    return found


def map_signal_to_symbol(signal: dict[str, Any]) -> SymbolDecision:
    """Main mapping function. Returns (symbol, confidence, reasoning, category)."""
    title = str(signal.get("title", ""))
    category = classify_signal(signal)
    reasoning_score = float(signal.get("reasoning_score", 0) or 0)

    # Company-specific signals
    if category == "company":
        companies = extract_companies(title)
        if companies:
            company = companies[0]  # Primary company
            ticker = COMPANY_TICKER.get(company, "SPY")
            confidence = min(0.95, reasoning_score / 100)
            return SymbolDecision(
                symbol=ticker,
                confidence=confidence,
                reasoning=f"Company-specific signal: {company} → {ticker}",
                category="company"
            )

    # Sector-specific signals
    if category == "sector":
        sectors = extract_sectors(title)
        if sectors:
            sector = sectors[0]  # Primary sector
            etf = SECTOR_ETF.get(sector, "XLK")
            confidence = min(0.85, reasoning_score / 100)
            return SymbolDecision(
                symbol=etf,
                confidence=confidence,
                reasoning=f"Sector signal: {sector} → {etf}",
                category="sector"
            )

    # Macro/geopolitical signals
    if category == "macro":
        themes = extract_macro_themes(title)
        if themes:
            theme = themes[0]  # Primary theme
            etf = MACRO_ETF.get(theme, "SPY")
            confidence = min(0.80, reasoning_score / 100)
            return SymbolDecision(
                symbol=etf,
                confidence=confidence,
                reasoning=f"Macro signal: {theme} → {etf}",
                category="macro"
            )

        # Fallback for macro without clear theme
        return SymbolDecision(
            symbol="SPY",
            confidence=min(0.70, reasoning_score / 100),
            reasoning="Broad macro signal → SPY (market beta)",
            category="macro"
        )

    # Unknown category - skip
    return SymbolDecision(
        symbol="",
        confidence=0.0,
        reasoning="Unable to classify signal - no suitable ticker mapping",
        category="unknown"
    )
