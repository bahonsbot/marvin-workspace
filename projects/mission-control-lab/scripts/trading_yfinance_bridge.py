#!/usr/bin/env python3
"""Small JSON bridge for Mission Control Lab Trading yfinance enrichment."""
from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from typing import Any


def safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        number = float(value)
        if math.isnan(number) or math.isinf(number):
            return None
        return number
    except Exception:
        return None


def fmt_large(value: Any) -> str | None:
    number = safe_float(value)
    if number is None:
        return None
    sign = '-' if number < 0 else ''
    number = abs(number)
    if number >= 1_000_000_000_000:
        return f"{sign}{number / 1_000_000_000_000:.2f}T"
    if number >= 1_000_000_000:
        return f"{sign}{number / 1_000_000_000:.2f}B"
    if number >= 1_000_000:
        return f"{sign}{number / 1_000_000:.1f}M"
    return f"{sign}{number:,.0f}"


def fmt_number(value: Any, digits: int = 2) -> str | None:
    number = safe_float(value)
    if number is None:
        return None
    return f"{number:.{digits}f}"


def fmt_pct(value: Any) -> str | None:
    number = safe_float(value)
    if number is None:
        return None
    return f"{number * 100:.2f}%"


def metric(label: str, value: str | None, note: str | None = None) -> dict[str, Any] | None:
    if not value or value in {"nan", "None"}:
        return None
    output: dict[str, Any] = {"label": label, "value": value, "status": "available"}
    if note:
        output["note"] = note
    return output


def df_metric(df: Any, period: str, column: str) -> Any:
    try:
        if df is None or getattr(df, "empty", True):
            return None
        if period not in df.index or column not in df.columns:
            return None
        value = df.loc[period, column]
        if hasattr(value, "item"):
            value = value.item()
        return value
    except Exception:
        return None


def read_statement_row(df: Any, labels: list[str]) -> dict[str, float]:
    output: dict[str, float] = {}
    try:
        if df is None or getattr(df, "empty", True):
            return output
        for label in labels:
            if label not in df.index:
                continue
            row = df.loc[label]
            for column, raw in row.items():
                number = safe_float(raw)
                if number is None:
                    continue
                key = str(getattr(column, "date", lambda: column)())
                output[key] = number
            if output:
                return output
    except Exception:
        return {}
    return output


def latest_year(values: dict[str, float]) -> str | None:
    years = sorted(values.keys())
    return years[-1] if years else None


def main() -> int:
    symbol = sys.argv[1].strip().upper() if len(sys.argv) > 1 else ""
    if not symbol:
        print(json.dumps({"error": "missing symbol"}))
        return 2

    try:
        import yfinance as yf
    except Exception as exc:  # pragma: no cover
        print(json.dumps({"symbol": symbol, "error": f"yfinance unavailable: {exc}"}))
        return 1

    ticker = yf.Ticker(symbol)
    try:
        info = dict(ticker.info or {})
    except Exception:
        info = {}
    try:
        annual_income_stmt = ticker.get_income_stmt(freq="yearly")
    except Exception:
        annual_income_stmt = None
    try:
        annual_balance_sheet = ticker.get_balance_sheet(freq="yearly")
    except Exception:
        annual_balance_sheet = None
    try:
        annual_cashflow = ticker.get_cashflow(freq="yearly")
    except Exception:
        annual_cashflow = None

    facts = []
    for label, key in [
        ("Company Name", "longName"),
        ("Sector", "sector"),
        ("Industry", "industry"),
        ("Country", "country"),
        ("Website", "website"),
        ("Employees", "fullTimeEmployees"),
        ("Quote Type", "quoteType"),
        ("ISIN", "isin"),
    ]:
        value = info.get(key)
        if value not in (None, "", "-"):
            facts.append({"label": label, "value": fmt_large(value) if key == "fullTimeEmployees" else str(value)})

    try:
        isin = ticker.get_isin()
        if isin and isin != "-" and not any(f["label"] == "ISIN" for f in facts):
            facts.append({"label": "ISIN", "value": str(isin)})
    except Exception:
        pass

    header_candidates = [
        metric("Market Cap", f"{info.get('currency', 'USD')} {fmt_large(info.get('marketCap'))}" if fmt_large(info.get("marketCap")) else None, "yfinance/Yahoo Finance profile."),
        metric("P/E (TTM)", fmt_number(info.get("trailingPE")), "Trailing P/E from yfinance."),
        metric("Sector", str(info.get("sector")) if info.get("sector") else None),
        metric("Industry", str(info.get("industry")) if info.get("industry") else None),
        metric("Country", str(info.get("country")) if info.get("country") else None),
    ]

    ratio_candidates = [
        metric("P/E Ratio", fmt_number(info.get("trailingPE")), "Trailing P/E from yfinance."),
        metric("Forward P/E", fmt_number(info.get("forwardPE")), "Forward P/E from yfinance analyst consensus."),
        metric("PEG Ratio", fmt_number(info.get("pegRatio")), "PEG ratio from yfinance when available."),
        metric("Price / Sales", fmt_number(info.get("priceToSalesTrailing12Months")), "Trailing price/sales from yfinance."),
        metric("Price / Book", fmt_number(info.get("priceToBook")), "Price/book from yfinance."),
        metric("Beta", fmt_number(info.get("beta")), "Beta from yfinance profile."),
        metric("Shares Outstanding", fmt_large(info.get("sharesOutstanding")), "Shares outstanding from yfinance."),
    ]

    estimates = []
    try:
        targets = ticker.get_analyst_price_targets()
    except Exception:
        targets = None
    if isinstance(targets, dict):
        currency = info.get("currency", "")
        for label, key in [("Target mean", "mean"), ("Target median", "median"), ("Target high", "high"), ("Target low", "low")]:
            value = fmt_number(targets.get(key))
            if value:
                estimates.append({"label": label, "value": f"{currency} {value}".strip(), "status": "available", "note": "Analyst price target from yfinance."})

    for label, key in [("Recommendation", "recommendationKey"), ("Analyst count", "numberOfAnalystOpinions")]:
        value = info.get(key)
        if value not in (None, ""):
            estimates.append({"label": label, "value": str(value).replace("_", " ").title(), "status": "available", "note": "Yahoo/yfinance analyst summary."})

    try:
        earnings = ticker.get_earnings_estimate()
    except Exception:
        earnings = None
    for label, period, column in [
        ("EPS current year", "0y", "avg"),
        ("EPS next year", "+1y", "avg"),
        ("EPS growth next year", "+1y", "growth"),
    ]:
        raw = df_metric(earnings, period, column)
        value = fmt_pct(raw) if "growth" in label.lower() else fmt_number(raw)
        if value:
            estimates.append({"label": label, "value": value, "status": "available", "note": "Consensus estimate from yfinance."})

    try:
        rec = ticker.get_recommendations_summary()
        if rec is not None and not rec.empty:
            row = rec.iloc[0].to_dict()
            parts = []
            for key in ["strongBuy", "buy", "hold", "sell", "strongSell"]:
                val = row.get(key)
                if val is not None:
                    parts.append(f"{key}: {int(val)}")
            if parts:
                estimates.append({"label": "Recommendation trend", "value": " · ".join(parts), "status": "available", "note": "Current-month recommendation distribution from yfinance."})
    except Exception:
        pass

    ownership = []
    for label, key in [
        ("Insiders held", "heldPercentInsiders"),
        ("Institutions held", "heldPercentInstitutions"),
        ("Float held by institutions", "heldPercentInstitutions"),
    ]:
        value = fmt_pct(info.get(key))
        if value:
            ownership.append({"label": label, "value": value, "status": "available", "note": "Holder percentage from yfinance."})
    try:
        holders = ticker.get_major_holders()
        if holders is not None and not holders.empty:
            text = str(holders).replace("\n", " ")[:180]
            if text:
                ownership.append({"label": "Holder table", "value": "Available", "status": "available", "note": text})
    except Exception:
        pass

    dividends = []
    for label, key in [("Dividend rate", "dividendRate"), ("Dividend yield", "dividendYield"), ("Payout ratio", "payoutRatio")]:
        value = fmt_pct(info.get(key)) if "yield" in label.lower() or "ratio" in label.lower() else fmt_number(info.get(key))
        if value:
            dividends.append({"label": label, "value": value, "status": "available", "note": "Dividend field from yfinance."})

    revenue_by_year = read_statement_row(annual_income_stmt, ["Total Revenue", "Operating Revenue"])
    net_income_by_year = read_statement_row(annual_income_stmt, ["Net Income", "Net Income Common Stockholders"])
    gross_profit_by_year = read_statement_row(annual_income_stmt, ["Gross Profit"])
    operating_income_by_year = read_statement_row(annual_income_stmt, ["Operating Income"])
    total_assets_by_year = read_statement_row(annual_balance_sheet, ["Total Assets"])
    total_liabilities_by_year = read_statement_row(annual_balance_sheet, ["Total Liabilities Net Minority Interest", "Total Liabilities"])
    total_equity_by_year = read_statement_row(annual_balance_sheet, ["Stockholders Equity", "Total Equity Gross Minority Interest"])
    cash_by_year = read_statement_row(annual_balance_sheet, ["Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments"])
    debt_current_by_year = read_statement_row(annual_balance_sheet, ["Current Debt", "Current Debt And Capital Lease Obligation"])
    debt_noncurrent_by_year = read_statement_row(annual_balance_sheet, ["Long Term Debt", "Long Term Debt And Capital Lease Obligation"])
    operating_cashflow_by_year = read_statement_row(annual_cashflow, ["Operating Cash Flow", "Cash Flow From Continuing Operating Activities"])
    capex_by_year = read_statement_row(annual_cashflow, ["Capital Expenditure", "Capital Expenditures"])
    free_cashflow_by_year = read_statement_row(annual_cashflow, ["Free Cash Flow"])

    debt_by_year: dict[str, float] = {}
    for year in set(debt_current_by_year.keys()) | set(debt_noncurrent_by_year.keys()):
        debt_by_year[year] = debt_current_by_year.get(year, 0.0) + debt_noncurrent_by_year.get(year, 0.0)

    ratio_values = {
        "P/E Ratio": fmt_number(info.get("trailingPE")),
        "Forward P/E": fmt_number(info.get("forwardPE")),
        "PEG Ratio": fmt_number(info.get("pegRatio")),
        "Price / Sales": fmt_number(info.get("priceToSalesTrailing12Months")),
        "Price / Book": fmt_number(info.get("priceToBook")),
        "Enterprise Value / EBITDA": fmt_number(info.get("enterpriseToEbitda")),
        "Current Ratio": fmt_number(info.get("currentRatio")),
        "Quick Ratio": fmt_number(info.get("quickRatio")),
        "Debt / Equity": fmt_number(info.get("debtToEquity")),
        "Return on Equity": fmt_pct(info.get("returnOnEquity")),
        "Return on Assets": fmt_pct(info.get("returnOnAssets")),
        "Gross Margin": fmt_pct(info.get("grossMargins")),
        "Operating Margin": fmt_pct(info.get("operatingMargins")),
        "Profit Margin": fmt_pct(info.get("profitMargins")),
    }

    latest_rev_year = latest_year(revenue_by_year)
    latest_net_income_year = latest_year(net_income_by_year)
    latest_balance_year = latest_year(total_assets_by_year)
    latest_cash_year = latest_year(cash_by_year)
    latest_ocf_year = latest_year(operating_cashflow_by_year)
    latest_fcf_year = latest_year(free_cashflow_by_year)

    result = {
        "symbol": symbol,
        "asOf": datetime.now(timezone.utc).isoformat(),
        "sourceNote": "yfinance bridge over Yahoo Finance data. Used for profile, ratios, estimates, ownership, and dividend enrichment.",
        "info": {k: info.get(k) for k in ["longName", "shortName", "currency", "sector", "industry", "country", "marketCap", "trailingPE", "forwardPE", "recommendationKey"] if k in info},
        "facts": facts[:8],
        "headerStats": [item for item in header_candidates if item],
        "keyRatios": [item for item in ratio_candidates if item],
        "estimates": estimates[:10],
        "ownership": ownership[:6],
        "dividends": dividends[:5],
        "fundamentals": {
            "currency": str(info.get("financialCurrency") or info.get("currency") or "USD"),
            "highlights": {
                "revenue": {"year": latest_rev_year, "value": revenue_by_year.get(latest_rev_year) if latest_rev_year else None},
                "netIncome": {"year": latest_net_income_year, "value": net_income_by_year.get(latest_net_income_year) if latest_net_income_year else None},
                "grossProfit": {"year": latest_year(gross_profit_by_year), "value": gross_profit_by_year.get(latest_year(gross_profit_by_year) or "")},
                "operatingIncome": {"year": latest_year(operating_income_by_year), "value": operating_income_by_year.get(latest_year(operating_income_by_year) or "")},
                "freeCashFlow": {"year": latest_fcf_year, "value": free_cashflow_by_year.get(latest_fcf_year) if latest_fcf_year else None},
            },
            "cashDebtSnapshot": {
                "year": latest_cash_year,
                "cash": cash_by_year.get(latest_cash_year) if latest_cash_year else None,
                "debt": debt_by_year.get(latest_cash_year) if latest_cash_year else None,
                "operatingCashFlow": operating_cashflow_by_year.get(latest_ocf_year) if latest_ocf_year else None,
                "freeCashFlow": free_cashflow_by_year.get(latest_fcf_year) if latest_fcf_year else None,
            },
            "balanceSheet": {
                "latestYear": latest_balance_year,
                "assets": total_assets_by_year.get(latest_balance_year) if latest_balance_year else None,
                "liabilities": total_liabilities_by_year.get(latest_balance_year) if latest_balance_year else None,
                "equity": total_equity_by_year.get(latest_balance_year) if latest_balance_year else None,
                "cash": cash_by_year.get(latest_balance_year) if latest_balance_year else None,
                "debt": debt_by_year.get(latest_balance_year) if latest_balance_year else None,
                "annual": [
                    {
                        "year": year,
                        "assets": total_assets_by_year.get(year),
                        "liabilities": total_liabilities_by_year.get(year),
                        "equity": total_equity_by_year.get(year),
                        "cash": cash_by_year.get(year),
                        "debt": debt_by_year.get(year),
                    }
                    for year in sorted(set(total_assets_by_year.keys()) | set(total_liabilities_by_year.keys()) | set(total_equity_by_year.keys()))[-4:]
                ],
            },
            "financialOverview": {
                "annual": [
                    {"year": year, "revenue": revenue_by_year.get(year), "netIncome": net_income_by_year.get(year)}
                    for year in sorted(set(revenue_by_year.keys()) & set(net_income_by_year.keys()))[-4:]
                ],
            },
            "ratios": [{"label": label, "value": value} for label, value in ratio_values.items() if value],
            "statements": {
                "annualIncomeStatement": {
                    "revenueByYear": revenue_by_year,
                    "netIncomeByYear": net_income_by_year,
                    "grossProfitByYear": gross_profit_by_year,
                    "operatingIncomeByYear": operating_income_by_year,
                },
                "annualBalanceSheet": {
                    "assetsByYear": total_assets_by_year,
                    "liabilitiesByYear": total_liabilities_by_year,
                    "equityByYear": total_equity_by_year,
                    "cashByYear": cash_by_year,
                    "debtByYear": debt_by_year,
                },
                "annualCashFlow": {
                    "operatingCashFlowByYear": operating_cashflow_by_year,
                    "capitalExpenditureByYear": capex_by_year,
                    "freeCashFlowByYear": free_cashflow_by_year,
                },
            },
            "source": {"provider": "yfinance", "asOf": datetime.now(timezone.utc).isoformat(), "note": "Derived from yfinance info and annual statements endpoints."},
        },
    }
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
