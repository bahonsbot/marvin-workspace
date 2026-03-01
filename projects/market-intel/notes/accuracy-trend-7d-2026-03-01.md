# Market Intel Signal Accuracy Trend (7-day) — 2026-03-01

## Scope and method
- Source: `projects/market-intel/data/tracked_signals.json`
- Window: last 7 calendar days ending 2026-03-01 (2026-02-23 to 2026-03-01, GMT+8)
- Inclusion: signals with `added_at` in window
- Accuracy metric:
  - **Strict hit rate** = `correct / verified`
  - **Lenient hit rate** = `(correct + 0.5*partial) / verified`

## 7-day totals
- Total tracked signals in window: **5**
- Verified signals: **1**
- Pending verification: **4**
- Outcomes among verified: **1 correct / 0 partial / 0 incorrect**
- Strict hit rate: **100.0%**
- Lenient hit rate: **100.0%**

## Daily trend snapshot
| Date | New tracked | Verified | Correct | Partial | Incorrect |
|---|---:|---:|---:|---:|---:|
| 2026-02-28 | 2 | 1 | 1 | 0 | 0 |
| 2026-03-01 | 3 | 0 | 0 | 0 | 0 |

## Category performance (verified outcomes)
| Category | Verified | Correct | Partial | Incorrect | Strict hit rate | Pending |
|---|---:|---:|---:|---:|---:|---:|
| financial_credit | 1 | 1 | 0 | 0 | 100.0% | 0 |
| geopolitical | 0 | 0 | 0 | 0 | N/A | 3 |
| macroeconomic | 0 | 0 | 0 | 0 | N/A | 1 |

## Best/Worst categories (requested top-3)
Data is currently **insufficient** to produce statistically valid top-3 best and worst causal categories.

Reason:
- Only **1 verified** signal exists in the 7-day window.
- Only **1 category** has measurable hit rate (`financial_credit`, n=1).
- Other categories have pending items but no verified outcomes yet.

### Provisional read (low confidence)
- **Best (measurable):** `financial_credit` (100.0%, n=1)
- **Worst (measurable):** none yet (no category with verified misses)
- **Highest verification backlog:** `geopolitical` (3 pending), then `macroeconomic` (1 pending)

## Recommendation
Prioritize verification throughput before making category-level allocation decisions:
1. Verify the 4 pending signals (especially geopolitical backlog).
2. Re-run this analysis once each major category has at least 3-5 verified outcomes.
3. Add a rolling category dashboard (verified count + strict/lenient hit rate) to avoid over-interpreting tiny samples.
