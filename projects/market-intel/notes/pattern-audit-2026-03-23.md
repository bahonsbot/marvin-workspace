# Market Intel Pattern Audit — 2026-03-23

## Executive summary
The live Market Intel pattern base is usable and worth building on, but it is uneven. The strongest current value is in macro, geopolitical-energy, and credit-stress patterns. The weakest area is not pattern count, but pattern specificity: several patterns are too broad or are being used as umbrella analogies for multiple regimes.

Current recommendation:
- keep the core pattern base
- refine the broad umbrella patterns before expanding aggressively
- add roughly 10-15 new high-utility patterns in the next deep-research pass, not 30+

## Live baseline
- Source of truth: `projects/market-intel/data/patterns.json`
- Total live patterns: **34**
- Docs drift found: `projects/market-intel/docs/pattern-matching.md` still said **24** patterns before this audit
- Validation data observed:
  - `tracked_signals.json` currently contains 20 tracked items, but most auditable pattern/category data lives inside nested `signal` objects
  - `model_feedback.json` sample size is still small (`15`), but it suggests macro patterns are currently strongest, while some sentiment/geopolitical mappings are noisier

## What the current feedback suggests
### Stronger current utility
- `US Credit Rating Downgrade` / macro bucket is heavily used and currently scoring well, but the label is too narrow for what it is actually doing
- `Saudi Oil Attacks` has positive feedback bias
- macro + energy + rates patterns appear to match current intake best

### Weaker / noisier current utility
- `Russia-Ukraine Conflict` has recent incorrect examples when used on broad Russia-related headlines rather than actual conflict-escalation setups
- `GameStop Short Squeeze` / sentiment-social family remains useful conceptually, but current small-sample feedback is weaker than macro

## Audit matrix

### KEEP — strong core patterns
These still look operationally valuable and aligned with the actual feed mix.

| ID | Pattern | Why keep |
|---|---|---|
| p001 | Saudi Oil Attacks | Strong energy-shock analogy, still highly relevant to current oil/war feed flow |
| p004 | COVID-19 Market Crash | Valid macro shock template for compounding global risk events |
| p006 | SVB Collapse | Strong bank-run / liquidity-stress playbook |
| p008 | FTX Collapse | Useful for centralized-exchange / trust-collapse crypto events |
| p015 | China Devaluation 2015 | Good FX / China spillover template |
| p018 | Regional Banking Crisis 2023 | Useful for follow-on bank stress events |
| p020 | European Debt Crisis | Good sovereign spread / eurozone stress template |
| p022 | LTCM Collapse | Useful leverage / forced-liquidation template |
| p025 | UK LDI/Gilt Crisis 2022 | Strong rates/liquidity shock pattern |
| p026 | VIX ETN Volmageddon 2018 | Useful volatility-structure shock template |
| p027 | Swiss Franc Unpeg Shock 2015 | Good sudden-FX-repricing analogy |
| p028 | Yen Carry Unwind Regime | Relevant if carry unwind / Japan-linked volatility rises |
| p029 | US Regional CRE Stress Wave | Useful slow-burn commercial real-estate credit stress template |
| p030 | Mega-Cap Earnings Shock | Relevant to current tech-heavy market structure |
| p031 | M&A Antitrust Block | Still useful for regulatory deal-break / spread widening events |
| p033 | US Tariff War Escalation | High current relevance for geopolitics + trade + inflation spillover |
| p034 | Major Accounting Scandal | Useful single-name trust-collapse template |

### REFINE — keep, but rename/split/tighten matcher logic
These are valuable, but too broad, too symbolic, or currently mis-mapped.

| ID | Pattern | Why refine |
|---|---|---|
| p002 | Russia-Ukraine Conflict | Current matcher can over-trigger on generic Russia headlines; needs escalation-specific boundaries |
| p003 | Reddit GPU/Semis Thread | Useful theme, but should probably become a clearer AI/semis supply-chain pattern rather than a single Reddit-thread story |
| p005 | GameStop Short Squeeze | Keep, but separate true short-squeeze conditions from generic meme chatter |
| p007 | Evergrande Crisis | Valuable as China credit/property stress, but category naming and trigger rules could be clearer |
| p009 | Brexit Vote | Keep as political-volatility template, but likely lower current utility than broader policy shock patterns |
| p010 | Tesla Stock Splits | Too narrow for the broad corporate-event matcher it currently powers |
| p014 | US Credit Rating Downgrade | Most important refinement target: currently behaving like a broad macro/rates/inflation regime bucket |
| p016 | Iran Nuclear Deal | Keep, but likely needs to be folded into a broader sanctions/oil-supply diplomacy framework |
| p017 | Tension Taiwan/China | Valuable, but should key on semis/shipping/escalation context more precisely |
| p019 | Asian Financial Crisis 1997 | Valuable concept, but category should likely be macro/FX/EM stress rather than geopolitical |
| p021 | Emerging Market Crisis 2018 | Useful, but should be clearly tied to dollar/funding/capital-flight setups |
| p023 | Dot-com Bubble | Keep as valuation/mania template, but currently broad label risks weak matching |
| p024 | Retail Options Sentiment | Keep, but split generic options chatter from true positioning-instability signals |
| p032 | US Government Shutdown | Keep, but lower-actionability political pattern unless tied to debt ceiling / funding market stress |

### LOW PRIORITY / CONDITIONAL VALUE
Not bad, just not first in line for expansion attention.

| ID | Pattern | Why lower priority |
|---|---|---|
| p011 | Black Monday 1987 | Important historically, but less likely to be the best current analog for normal live feed flow |
| p012 | Japan Lost Decade | Long-horizon macro template, but less actionable for short-cycle signal generation |
| p013 | Arab Spring | Still useful in some MENA unrest contexts, but lower direct utility than focused oil/war patterns |

## Main gaps worth filling in the next deep-research pass
Target roughly **10-15** additions, with priority on:
1. energy / shipping chokepoint disruptions
2. inflation surprise / central-bank regime shifts
3. AI capex / semis supply bottlenecks
4. labor / consumer slowdown warnings
5. defense-escalation with commodity spillover
6. commodity squeeze / freight / logistics stress
7. sovereign funding stress outside the existing euro examples
8. China stimulus / property rescue / policy reversal patterns

## Recommended Stage 2 follow-up
1. Refine labels and trigger boundaries for the broad umbrella patterns, especially `p014`
2. Research and propose 10-15 new patterns only after the taxonomy is clearer
3. Sync docs so they describe the live 34-pattern system, not the old 24-pattern snapshot
