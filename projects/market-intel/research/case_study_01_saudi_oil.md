# Case Study 01: 2019 Saudi oil attacks → oil market reaction

## Event summary
On **14 Sep 2019** (Saturday), drone/missile strikes hit Saudi Aramco facilities at **Abqaiq** and **Khurais**, temporarily disrupting about **5.7 million b/d** (roughly half of Saudi output at the time). Oil markets reacted sharply at the first reopen.

## Timeline (early signal → news → market reaction)
- **Before mainstream market-open coverage (early signal layer):**
  - Regional conflict signal already elevated in 2019 (multiple prior attacks on Saudi oil infrastructure; AP describes Sept. strike as latest in a series of drone assaults).
  - **First public signal on attack day** came from **online videos showing fires/smoke** at Abqaiq before full official detail dissemination (AP).
- **14 Sep 2019 (local, Saturday):** Saudi confirms damage and production disruption.
- **16 Sep 2019 (first full trading day):** EIA: Brent and WTI saw the **largest single-day increase in the past decade**.
- **17 Sep 2019:** Saudi Aramco update on partial restoration; prices retraced part of spike.

## Time lag estimate
- From first open-source social signals (videos around pre-dawn local time) to major market repricing at global crude reopen: **hours to ~1 trading session**.
- From confirmed official outage statements to futures repricing: **same weekend / immediate next session**.

## Market outcome
- Crude benchmarks spiked sharply at reopen (multiple outlets reported near-20% intraday move in Brent on reopen; EIA confirms decade-largest one-day rise).
- Downstream sensitivity: EIA notes ~$1/b sustained crude move translates to ~2.4 cents/gal product impact in U.S. retail fuels.

## Price data references
- EIA Today in Energy (Sep 23, 2019): attack details + first trading-day spike context
  - https://www.eia.gov/todayinenergy/detail.php?id=41413
- EIA spot series reference for Brent:
  - https://www.eia.gov/dnav/pet/hist/rbrtem.htm
- AP event report with first-signal description (online videos/fires):
  - https://apnews.com/article/d20f80188e3543bfb36d512df7777cd4

## Early signal sources (that a system could have monitored)
1. **OSINT/social video bursts** from geolocated areas near critical oil infrastructure.
2. **Official/security channels** (Saudi Press Agency, ministry statements).
3. **Satellite/fire anomaly feeds** (e.g., thermal anomaly systems around Abqaiq/Khurais).
4. **Shipping/tanker flow feeds** (post-event confirmation and persistence of supply loss).

## Feasibility assessment (could we have caught this?)
**Yes (partially).**
- A real-time system likely could have detected an abnormal event **before full mainstream writeups**, via social-video + anomaly feeds.
- Predicting exact scale ex-ante is hard, but early classification (“critical upstream infrastructure disruption likely”) was feasible.
- Most practical edge: **minutes-to-hours warning** before broader narrative solidified and before full cross-asset repricing stabilized.