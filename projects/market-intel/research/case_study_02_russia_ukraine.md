# Case Study 02: 2022 Russia-Ukraine buildup → defense + energy stocks

## Event summary
Russia’s full invasion began **24 Feb 2022**, but military buildup and intelligence warnings were visible for months beforehand. Markets began pricing risk before invasion and then repriced sharply at invasion confirmation.

## Timeline (early signal → news → market reaction)
- **Oct–Dec 2021 (early signal window):**
  - Public reporting on unusual Russian troop buildup and satellite imagery near Ukraine.
  - 3 Dec 2021 reporting (WP + syndications) cited U.S. intelligence warning of possible multi-front operation involving up to ~175,000 troops.
- **Mid-Jan to Feb 2022:**
  - EIA notes geopolitical risk from possible further invasion had already contributed to higher/more volatile crude prices since mid-January.
- **24 Feb 2022 (invasion):**
  - Risk repricing accelerates across energy and defense.
- **Late Feb 2022:**
  - Defense shares rise (Guardian/Reuters reports: LMT/RTX/NOC notable gains; EU defense complex up on spending commitments).
  - Oil jumps above $100/b (EIA).

## Time lag estimate
- First strong public buildup signals (Nov–Dec 2021) to invasion-day peak repricing (late Feb 2022): **~10–12 weeks**.
- Mid-Jan 2022 risk signals to >$100 crude and defense surge: **~4–6 weeks**.
- Invasion headline to sector moves: **intra-day to few trading days**.

## Market outcome
- **Energy:** Brent front-month settled above $100 on Feb 28 and near $115 by Mar 2 (EIA), with significantly elevated intraday volatility.
- **Defense:** Reuters/Guardian reported immediate outperformance in defense names and ETFs post-invasion; examples include sizable short-window gains in Raytheon, Lockheed, Northrop and European defense names after policy announcements.

## Price data references
- EIA (Mar 2022 article, republished Dec 2022): crude >$100, volatility stats
  - https://www.eia.gov/todayinenergy/detail.php?id=55020
- EIA Brent history table:
  - https://www.eia.gov/dnav/pet/hist/rbrtem.htm
- Reuters snapshot on defense stocks (search result archive):
  - https://www.reuters.com/world/europe/european-defence-stocks-rise-russia-invades-ukraine-2022-02-24/
- Guardian defense move summary (with specific stock move examples):
  - https://www.theguardian.com/business/2022/feb/28/defense-cybersecurity-stocks-russia-ukraine-eu

## Early signal sources (that a system could have monitored)
1. **Satellite imagery + force-mobility indicators** (troop/equipment concentration near border).
2. **Open-source intelligence + government warning releases** (US/UK intelligence disclosures).
3. **Energy risk proxies** (Brent term structure/volatility breakout).
4. **Policy signals** (NATO/EU emergency defense spending commitments).

## Feasibility assessment (could we have caught this?)
**Yes (strongly).**
- This is a high-feasibility case for event-driven modeling because precursor signals were persistent and multi-source.
- Key modeling lesson: separate **pre-event buildup phase** (slow repricing) from **trigger phase** (invasion confirmation) for better timing.
- Practical alpha likely came from regime-shift detection (rising invasion probability) rather than exact date prediction.