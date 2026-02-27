# Case Study 03: Reddit GPU price complaints (2020–2022) → semiconductor valuations

## Event summary
From late 2020 through 2021, Reddit communities (e.g., r/buildapc, r/nvidia) showed sustained complaints about GPU shortages and severe street-price inflation before/alongside broad mainstream framing of the chip shortage and supply-demand imbalance. Semiconductor equities (notably NVDA, AMD) rose strongly through 2021, then compressed in 2022 as cycle/valuation expectations reset.

## Timeline (early signal → news → market reaction)
- **Late 2020 (early signal):**
  - Reddit users report inability to buy new RTX cards near MSRP; examples cite 3080 street prices around €1,200–€1,500 vs $699 MSRP equivalent framing.
- **Jan–Feb 2021:**
  - Complaint density remains high (availability + inflated pricing threads across PC-build communities).
  - Tom’s Hardware tracks extreme market dislocation; by early 2022 still well above MSRP (Nvidia ~157% median, AMD ~145% median in cited markets).
- **2021 market phase:**
  - Semiconductor names maintain strong momentum (annual closes: NVDA +125.48% in 2021; AMD +56.91% in 2021, Macrotrends annual table).
- **2022 normalization/reset:**
  - Street GPU pricing falls steadily; by Aug 2022, Tom’s reports most current-gen GPUs at/below MSRP.
  - Semiconductor stocks de-rate in risk-off + cycle-reset environment (NVDA -50.26% annual in 2022; AMD -54.99% annual in 2022).

## Time lag estimate
- From first clear Reddit retail-stress signals (Q4 2020) to broad valuation expansion peak in semis (2021 highs): **~6–12 months**.
- From sustained complaint regime to measured retail-price normalization (mid/late 2022): **~12–18 months**.

## Market outcome
- **Consumer hardware market:** prolonged street-price inflation, then normalization.
- **Equities:** strong 2021 semiconductor valuation expansion followed by 2022 contraction (macro + demand/supply normalization + rates).

## Price data references
- Reddit early-signal examples:
  - r/buildapc (Jan 3, 2021): price/availability frustration
    - https://www.reddit.com/r/buildapc/comments/kphkii/the_price_and_availability_for_good_gpus_nowadays/
  - r/buildapc (Feb 7, 2021): “when will GPU prices drop?”
    - https://www.reddit.com/r/buildapc/comments/leymyd/when_will_gpu_prices_drop/
  - r/nvidia (Dec 25, 2020): 3080 pricing far above MSRP
    - https://www.reddit.com/r/nvidia/comments/kjw6kx/prices_of_3080_cards_in_2021/
- GPU pricing trend benchmarks:
  - Tom’s Hardware (Feb 14, 2022): still far above MSRP, but declining
    - https://www.tomshardware.com/news/gpu-prices-trending-lower-as-supply-improves
  - Tom’s Hardware (Aug 1, 2022): most cards at/below MSRP
    - https://www.tomshardware.com/news/graphics-card-prices-august-2022
- Semiconductor stock valuation/price history (annual context):
  - NVDA history table: https://www.macrotrends.net/stocks/charts/NVDA/nvidia/stock-price-history
  - AMD history table: https://www.macrotrends.net/stocks/charts/AMD/amd/stock-price-history

## Early signal sources (that a system could have monitored)
1. **Reddit complaint-intensity NLP** on price/availability keywords by SKU/region.
2. **Retail scrape feeds** (in-stock %, markup vs MSRP, resale premiums on marketplaces).
3. **PC component media trackers** (monthly MSRP premium indices).
4. **Cross-linking to semiconductor equity factors** (momentum, valuation, guidance sensitivity).

## Feasibility assessment (could we have caught this?)
**Yes (moderate-to-strong), with caveats.**
- Social chatter offered early, persistent evidence of demand/supply imbalance in consumer GPUs.
- Signal-to-noise is lower than geopolitical event cases; requires robust filtering and regional normalization.
- Best use: as a **nowcasting input** for hardware tightness regimes, then mapped probabilistically to semiconductor revenue/valuation expectations rather than direct short-term trading signals.