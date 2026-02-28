# PRD: Event-Driven Market Intelligence Tool

## Status: 🟡 IN PROGRESS - Signal Generation Complete (Feb 28, 2026)

## 1. Executive Summary

### Problem
Retail investors react too late to market-moving events. By the time news reaches mainstream channels or social media, the price move has often already happened or is priced in.

### Solution
A systematic research and detection system that:
1. Researches historical patterns between specific event types and short-term market reactions
2. Detects early signals before they become widely known
3. Provides actionable intelligence for day-trading and long-term position allocation

### Target User
- Self-directed trader (initially Philippe, potentially close inner circle)
- Focus on EU, US, and HK markets

### Guiding Principles
- Research-first: Prove patterns statistically before building detection
- Open-source friendly: Build from scratch where budget allows, borrow ideas where smart
- Modular: Day-trading and long-term modules can operate independently

---

## 2. Goals

### Phase 1: Research (Research-First Approach)
- Establish statistically significant correlations between event types and market movements
- Document 10+ historical case studies with confidence scores
- Define event taxonomy and time horizons

### Phase 2: Detection
- Build real-time ingestion pipeline for early signals
- NLP classification of events
- Knowledge graph for cause-effect relationships

### Phase 3: Reasoning
- Confidence scoring for signals
- Actionable output (alerts, recommendations)

---

## 3. Event Taxonomy

### 3.1 Primary Categories

| Category | Subcategories | Example Signals |
|----------|---------------|-----------------|
| **Geopolitical** | Troop movements, sanctions, treaties, conflicts | Satellite imagery, X posts from defense analysts, government announcements |
| **Legislative** | Policy bills, regulation changes, elections | Parliamentary feeds, policy white papers, election polls |
| **Corporate** | Earnings, M&A, guidance changes | SEC filings, press releases, whisper numbers |
| **Macroeconomic** | CPI, interest rates, employment data | Central bank calendars, economic indicators |
| **Sentiment/Social** | X trends, Reddit anomalies, viral stories | Social media monitoring, search trend spikes |
| **Supply Chain** | Shipping delays, shortages, logistics | Port data, freight tracking, industry forums |
| **Shopping/Consumer** | Retail trends, e-commerce shifts, seasonal patterns | Marketplace data, consumer sentiment, holiday shopping data |

### 3.2 Time Horizon Definitions

| Horizon | Definition | Use Case |
|---------|------------|----------|
| **Intraday** | 0-4 hours after event | Day-trading signals |
| **Short-term** | 1-5 trading days after event | Swing trades |
| **Medium-term** | 1-12 weeks | Position trades |
| **Long-term** | 3+ months | Allocation decisions |

---

## 4. Research Phase (Phase 1)

### 4.1 Objectives
- Establish proof-of-concept that specific event types correlate with predictable short-term market moves
- Build foundational database of historical patterns
- Determine minimum viable pattern set for detection phase

### 4.2 Historical Case Studies to Research

| # | Event Type | Early Signal | Date | Market Outcome | Confidence |
|---|------------|--------------|------|----------------|------------|
| 1 | Geopolitical | Troop movements near oil producers | 2019 Saudi attacks | Oil stocks spiked | High |
| 2 | Geopolitical | Russia-Ukraine tension buildup | 2022 | Brent Crude, defense stocks | High |
| 3 | Legislative | "Housing First" campaign rhetoric | 2020 | US homebuilder ETFs | Medium |
| 4 | Supply Chain | Reddit hardware complaints (GPU prices) | 2020-2022 | Semiconductor valuations | High |
| 5 | Technology | GitHub activity surge in AI repos | 2023 | NVIDIA, cloud providers | High |
| 6 | Corporate | Unusual options activity | Ongoing | Short-term price movement | Medium |
| 7 | Macroeconomic | Central bank hawkish pivots | 2022-2024 | Rate-sensitive sectors | High |
| 8 | Sentiment | X trending topic on retail brand | Ongoing | Short-term sentiment shift | Low-Medium |
| 9 | Consumer | Holiday shopping data surprises | 2023 | Retail sector movement | Medium |
| 10 | Shipping | Container freight rate spikes | 2021 | Shipping company valuations | High |

### 4.3 Statistical Framework

**Methodology: Event Study**
- Calculate Abnormal Returns (AR): Actual return - Expected return (market model)
- Calculate Cumulative Abnormal Returns (CAR): Sum of AR over event window
- Test statistical significance: t-statistic, p-value threshold (p < 0.05)

**Metrics Required:**
- CAR (Cumulative Abnormal Return)
- AAR (Average Abnormal Return)
- t-statistic
- p-value
- Sample size (N ≥ 10 for each event type)

### 4.4 Research Data Sources

| Source | Type | Cost |
|--------|------|------|
| GDELT | Global news events | Free |
| Wayback Machine | Historical news | Free |
| Yahoo Finance | Price data | Free |
| Alpha Vantage | Price + fundamentals | Free tier |
| SEC EDGAR | Corporate filings | Free |
| Reddit | Social signals | Free |
| X (Twitter) | Social signals | Free (API limited) |
| Tavily | AI research search | Free tier |

### 4.5 Deliverables
- Database of historical events with associated price data
- Statistical validation report (CAR, t-stats, confidence scores)
- Event taxonomy document (refined)
- Minimum Viable Pattern Set (5-10 proven correlations)
  - ✅ Created: `data/patterns.json` — 10 patterns with confidence scores
  - ✅ Created: `src/pattern_matcher.py` — Query tool for matching events

---

## 5. Detection Phase (Phase 2)

### 5.1 Architecture Overview

```
[Data Sources] → [Ingestion] → [NLP/Classification] → [Pattern Match] → [Signal Output]
```

### 5.2 Data Sources (Real-Time)

| Source | Category | Implementation |
|--------|----------|----------------|
| News APIs (Reuters, Bloomberg) | Primary | API integration |
| X (Twitter) | Social | Twitter API v2 |
| Reddit | Social | PRAW (Reddit API) |
| SEC Filings | Corporate | SEC API |
| GDELT | News | Free stream |
| Alternative: Glassdoor, Indeed | Employment | Scraping |

### 5.3 NLP Pipeline

1. **Ingestion:** Stream all sources into processing queue
2. **Classification:** Categorize into event taxonomy
3. **Entity Extraction:** Identify companies, commodities, locations
4. **Sentiment Analysis:** FinBERT for financial text
5. **Confidence Scoring:** Based on source credibility + signal clarity

### 5.4 Pattern Matching
- Match incoming events against historical pattern database
- Score based on:
  - Similarity to proven historical events
  - Source credibility
  - Time since first signal

---

## 6. Reasoning Phase (Phase 3)

### 6.1 Knowledge Graph
Build cause-effect relationships:
- Drought in Taiwan → Water shortage → Chip manufacturing impact → iPhone production → Put options

### 6.2 Confidence Scoring
- Combine multiple signals (social + news + data)
- Weight by historical accuracy
- Output: Signal strength (Low/Medium/High/Very High)

### 6.3 Output Formats
- Dashboard alerts
- Daily briefing
- Trade recommendations with confidence

---

## 7. Technical Architecture

### 7.1 Stack

| Layer | Technology |
|-------|------------|
| **Ingestion** | Python, asyncio, Airbyte |
| **NLP/ML** | FinBERT, spaCy, scikit-learn |
| **Storage** | Supabase (PostgreSQL) |
| **Price Data** | yfinance, Alpha Vantage |
| **Research** | Tavily, Beautiful Soup |
| **Execution** | Alpaca (if trading), manual |

### 7.2 Database Schema (Draft)

```sql
-- Events table
events
- id, event_type, description, source, source_url
- event_timestamp, created_at
- confidence_score

-- Historical patterns
pattern_matches
- id, event_type, historical_date, market_impact
- car_7d, car_14d, car_30d, t_stat, sample_size
- confidence_level

-- Signals (real-time)
signals
- id, event_id, pattern_match_id, generated_at
- confidence_score, status

-- Price data (cached)
price_moves
- symbol, date, open, high, low, close, volume
- event_id (optional link)
```

---

## 8. Market Scope

### 8.1 Supported Markets (via existing broker accounts)

Access to 30+ global exchanges:

| Region | Exchanges |
|--------|-----------|
| **EU (Euronext)** | Netherlands, Belgium, France, Portugal, Ireland |
| **Europe** | UK (LSE), Germany (Xetra), Switzerland, Austria, Denmark, Spain, Finland, Greece, Italy, Norway, Poland, Sweden, Czechia |
| **North America** | US (NYSE, NASDAQ), Canada |
| **Asia-Pacific** | Hong Kong, Australia, Japan, Singapore, Indonesia, Korea, Malaysia, Thailand, Taiwan, Philippines, China |
| **Priority** | US (NYSE, NASDAQ) — highest liquidity, lowest fees; Euronext NL/BE/FR; HK |
| **Secondary** | Other EU markets, Japan, Australia |

### 8.2 Initial Focus
- US equities (highest liquidity, lowest fees)
- Euronext EU stocks (NL, BE, FR)
- HK equities

### 8.3 Commodities (Future Phase)
- Oil (Brent, WTI)
- Key metals (copper, lithium)
- Not initial priority

### 8.4 Local Market Potential
- Any market with accessible exchange data is a potential signal source
- Local events in smaller markets may create larger relative moves
- System should flag opportunities across all accessible markets

---

## 9. Module Structure

### 9.1 Day-Trading Module (Priority)
- Intraday signals (0-4 hour horizon)
- High-frequency pattern matching
- Quick decision framework

### 9.2 Long-Term Allocation Module (Phase 2+)
- Weekly/monthly signals
- Position sizing recommendations
- Broader market analysis

---

## 10. Success Metrics

### Phase 1 (Research)
- [x] 10+ historical case studies documented
- [ ] Statistical validation complete (p < 0.05 for at least 3 patterns)
- [ ] Event taxonomy finalized

### Phase 2 (Detection)
- [ ] Real-time ingestion from 3+ sources
- [ ] Signal latency < 1 hour from first mention
- [ ] False positive rate < 30%

### Phase 3 (Reasoning)
- [ ] Confidence scoring operational
- [ ] Dashboard with alerts
- [ ] Paper trade capable

---

## 11. Execution Mode

### 11.1 Initial: Manual
- System generates alerts → human reviews → human places trade
- Rationale: Phase 1 is about learning what works; build intuition before automating

### 11.2 Future: Semi-Automated (Reminder Tag)
- System generates signal → human approves → system places trade
- Consider after: proven accuracy ≥ 70% over 50+ trades
- [ ] REMINDER: Evaluate semi-automated options once Phase 1 validated

---

## 12. Minimum Confidence Threshold

### 12.1 Signal Requirements
To act on a signal, require ALL of:
- At least **3 historical examples** of similar event → market reaction pattern
- **Statistical significance**: p-value < 0.10
- **Additional confirmation** (at least 2):
  - Social media buzz (X, Reddit)
  - Multiple news sources
  - Unusual options activity
  - Macro context

### 12.2 Source Timing Consideration
- Social media generally moves **faster** than mainstream news
- News generally moves **slower** but may have higher confidence
- Weight social signals for timing, news signals for confirmation

### 12.3 Threshold Levels

| Level | Requirement | Use Case |
|-------|-------------|----------|
| **Conservative** (initial) | 3+ examples + p<0.10 + 2 confirmations | Phase 1 research |
| **Medium** | 2+ examples + p<0.15 + 1 confirmation | After validation |
| **Aggressive** | 1 example + p<0.20 | Only if proven track record |

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Overfitting** | Require N ≥ 3 for initial patterns; out-of-sample validation |
| **Reflexivity** | Assume edge evaporates; build for speed |
| **Noise/Signal** | Credibility scoring for sources; ignore < 3-signal clusters |
| **Data Costs** | Prioritize free sources; max budget €50/month (only if proven necessary) |
| **Legal** | Research-only initially; no auto-trading without proper licensing |

---

## 14. Timeline

### Phase 1: Research (Goal: Complete by 2026-02-27)
- [x] Complete historical research (10 case studies)
- [ ] Set up data pipeline
- [ ] Build pattern database
- [ ] Validate 3+ proven patterns

### Phase 2 (TBD)
- [ ] Deploy real-time ingestion
- [ ] NLP classification operational
- [ ] First live signals

### Phase 3 (TBD)
- [ ] Knowledge graph basic
- [ ] Dashboard + alerts
- [ ] Paper trading capability

---

## 13. Open Questions

1. What minimum accuracy/edge is "good enough" to go live?
2. Manual execution or semi-automated signals?
3. Budget for premium data sources (Bloomberg, etc.)?
4. Timeline expectation for Phase 1 completion?

---

## Appendix: Research Resources

- Narrative Economics (Robert Shiller)
- Event Study Methodology (Campbell, Lo, MacKinlay)
- FinBERT: Financial Sentiment Analysis with Pre-trained Language Models
- GDELT Documentation
- QuantConnect / Quantopian for backtesting ideas
