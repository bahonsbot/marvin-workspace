# DefeatBeta Phase 0 Prototype Report

Date: 2026-05-07
Lane: Mission Control Lab Trading / Analytics
Status: prototype probe completed

## Summary

DefeatBeta is worth using for the first Analytics-side integration, but only behind an adapter/sidecar boundary and only after symbol normalization.

The package successfully returned rich Analytics-grade data for plain symbols:

- historical prices
- quarterly and annual financial statements
- historical valuation ratios: TTM PE, PS, PB
- quality/capital metrics: ROE, ROIC, WACC
- dividends and splits
- earnings-call transcript catalogs
- DCF workbook output

It should not replace current quote truth. It is useful as an analytical-depth source.

## Install/runtime notes

Attempted `python3 -m venv`, but this container lacks `ensurepip` / `python3.13-venv`. To avoid apt/container mutation, the prototype used a project-local package target instead:

```text
projects/mission-control-lab/services/defeatbeta-probe/.python-packages/
```

This keeps the install local to Lab, but it is not as clean as a real venv. A dedicated sidecar should use a normal container image with a proper venv or system-layer install.

Approximate local footprint after install/probe:

- `.python-packages/`: about 417 MB
- `.duckdb/`: about 18 MB
- `/tmp/defeatbeta`: about 103 MB after DCF/NLTK/workbook outputs

Important: DefeatBeta currently writes some runtime artifacts under `/tmp/defeatbeta` despite our environment variables. A sidecar should explicitly manage or mount this path.

## Smoke results

Report files are ignored by git and stored under:

```text
projects/mission-control-lab/services/defeatbeta-probe/reports/
```

Main plain-symbol report:

```text
reports/probe-20260507-064853.json
```

Symbols tested: `AAPL`, `MSFT`, `ASML`, `TSM`.

All major calls succeeded for all four symbols. Representative result sizes:

| Symbol | Prices | Quarterly income | Annual income | Balance sheet | Cash flow | TTM PE | PS | PB | ROE | ROIC | WACC | Dividends | Transcripts | DCF |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| AAPL | 7907 | 39 | 39 | 71 | 53 | 7907 | 524 | 963 | 10 | 10 | 650 | 61 | 83 | ok |
| MSFT | 7907 | 47 | 48 | 79 | 61 | 7907 | 524 | 963 | 11 | 11 | 34 | 89 | 82 | ok |
| ASML | 7835 | 40 | 46 | 90 | 59 | 5810 | 524 | 963 | 11 | 11 | 963 | 35 | 72 | ok |
| TSM | 7184 | 52 | 54 | 94 | 72 | 6814 | 524 | 963 | 10 | 10 | 94 | 41 | 79 | ok |

Runtime:

- Cold-ish AAPL full probe: about 35s after package install/cache initialization.
- Subsequent symbols: about 7-10s each.
- Four-symbol full probe: about 67s total.

## Symbol mapping finding

Existing Lab exchange-suffixed symbols did not work directly.

Report:

```text
reports/probe-20260507-064945.json
```

Tested symbols: `ASML.AS`, `EQNR.OL`, `9988.HK`.

Result: calls mostly returned empty zero-row DataFrames, and WACC/DCF failed with insufficient data. Plain `ASML` worked. This means the Mission Control adapter must not pass Lab symbols through blindly.

Initial mapping rule for prototype integration:

- Use plain symbol candidates first where DefeatBeta coverage exists, e.g. `ASML.AS -> ASML`, `TSM.US/TSM -> TSM`, `AAPL.US -> AAPL`.
- Treat non-US/non-ADR exchange suffixes as unresolved until we build a verified map.
- If DefeatBeta returns zero-row core datasets, mark the source unavailable rather than showing empty charts as truth.

## Recommendation for Analytics page

Proceed with a thin internal adapter next, not UI-first.

Best first Analytics modules:

1. Historical valuation ratios: PE, PS, PB, WACC.
2. Statement trend panels: revenue, gross profit, operating income, net income, operating cash flow, free cash flow where available.
3. Quality/capital trend chips: ROE and ROIC.
4. DCF sandbox as a secondary panel, clearly labelled as model output, not advice.

Do not use DefeatBeta for primary quotes/prices yet. Keep EODHD/Yahoo/yfinance/SEC where they already work.

## Sidecar implications

A dedicated internal sidecar is still the right production shape because:

- Python dependency footprint is large.
- DuckDB/extensions/cache behavior should be isolated.
- Runtime writes to `/tmp/defeatbeta` need ownership.
- DCF can create workbook artifacts.
- We need timeouts and response-size limits before exposing this to the Lab app.

Suggested next implementation slice:

```text
projects/mission-control-lab/services/defeatbeta-sidecar/
```

Expose only:

```text
GET /health
GET /v1/ticker/{symbol}/analytics-summary
```

Where `analytics-summary` returns a compact normalized payload for ratios/statements/quality metrics and explicit `coverage` flags. Leave raw transcripts and DCF files out of the first UI slice.
