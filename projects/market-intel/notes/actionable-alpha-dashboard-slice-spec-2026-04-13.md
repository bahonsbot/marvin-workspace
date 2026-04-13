# Actionable Alpha Dashboard Slice Spec (Trading)

## 1) Module name
**Module:** `Actionable Alpha Decision Panel`

A single operator-facing panel that fuses sentiment, technical, and fundamental signals into one decision-ready view for one ticker at a time.

---

## 2) Operator decision supported
**Primary decision:**
> For ticker **X**, should the operator mark the setup as **Trade Now**, **Watchlist**, or **Avoid** for the current session?

**Decision guardrails:**
- This module supports triage and prioritization, not automated order execution.
- The module must expose conflicting evidence clearly, not force false certainty.
- If any required input is stale or missing, the panel must default to a non-actionable state (`Insufficient data`).

---

## 3) FE layout and hierarchy
**Scope:** one module only, designed for eventual Mission Control Trading domain integration.

### Layout map (top to bottom)
1. **Header row (context + freshness)**
   - Ticker symbol + company name
   - Last update timestamp (per input family)
   - Data health badge: `Healthy`, `Partial`, `Stale`

2. **Decision strip (highest visual priority)**
   - Composite recommendation pill: `Trade Now` / `Watchlist` / `Avoid` / `Insufficient data`
   - Confidence band (Low / Medium / High)
   - Compact rationale chips (max 3): e.g., `Sentiment ↑`, `RSI recovering`, `Valuation neutral`

3. **Three evidence columns (equal weight, single scan line)**
   - **Sentiment block**
     - Net sentiment score
     - 24h sentiment delta
     - Mention velocity
   - **Technical block**
     - Trend regime (Up / Sideways / Down)
     - RSI band
     - MACD state
   - **Fundamentals block**
     - Valuation posture (Cheap / Fair / Expensive)
     - Growth quality flag
     - Profitability flag

4. **Conflict + caveat row (always visible when applicable)**
   - Explicit contradiction callout: e.g., `Bullish sentiment vs bearish trend`
   - Missing/stale input notices by family

5. **Operator action footer**
   - Primary actions: `Mark Trade Now`, `Mark Watchlist`, `Mark Avoid`
   - Secondary action: `Open full analysis` (future deep-link placeholder)

### Visual hierarchy notes
- Decision strip is visually dominant; evidence blocks support the decision.
- Utility copy only, no marketing language.
- Keep dense but readable: short labels, numeric first, explanation second.

---

## 4) Required inputs and data contract
**Truthfulness note:** This spec defines required contract fields only. It does **not** claim these feeds are already wired in Mission Control.

### Input object: `ActionableAlphaInput`
```ts
type Freshness = {
  asOfIso: string;           // ISO-8601 timestamp
  ageMinutes: number;        // derived or supplied
  status: 'healthy' | 'partial' | 'stale';
};

type SentimentInput = {
  netScore: number | null;           // expected range -1.0..1.0
  delta24h: number | null;           // change in net score
  mentionVelocity: number | null;    // mentions/hour (or agreed unit)
  freshness: Freshness;
};

type TechnicalInput = {
  trendRegime: 'up' | 'sideways' | 'down' | null;
  rsi14: number | null;              // 0..100
  macdState: 'bullish' | 'neutral' | 'bearish' | null;
  freshness: Freshness;
};

type FundamentalsInput = {
  valuationPosture: 'cheap' | 'fair' | 'expensive' | null;
  growthQuality: 'strong' | 'mixed' | 'weak' | null;
  profitability: 'strong' | 'mixed' | 'weak' | null;
  freshness: Freshness;
};

type DecisionOutput = {
  recommendation: 'trade_now' | 'watchlist' | 'avoid' | 'insufficient_data';
  confidence: 'low' | 'medium' | 'high';
  rationale: string[];       // 1..3 short reason chips
  conflicts: string[];       // contradiction statements
};

type ActionableAlphaInput = {
  ticker: string;
  instrumentName: string;
  sentiment: SentimentInput;
  technical: TechnicalInput;
  fundamentals: FundamentalsInput;
  decision: DecisionOutput;
};
```

### Rendering rules tied to contract
- Any `null` in critical fields renders explicit `Unavailable` label, never fake defaults.
- If any family freshness is `stale`, show stale badge and downgrade recommendation to `insufficient_data` unless decision engine explicitly permits otherwise.
- Rationale chip count hard cap: 3.

---

## 5) QA acceptance checks and edge cases
### Acceptance checks
1. **Single-decision clarity**
   - Panel always presents one clear recommendation state from allowed enum.
2. **Input transparency**
   - Missing values render as `Unavailable` with no placeholder fabrication.
3. **Freshness correctness**
   - Header freshness badges reflect each family status accurately.
4. **Conflict surfacing**
   - When contradictions exist, conflict row becomes visible and readable.
5. **Action gating**
   - If recommendation is `insufficient_data`, primary action buttons are disabled or guarded with confirmation copy.
6. **Hierarchy scan test**
   - Operator can infer recommendation + top 3 reasons within one quick scan (<10 seconds).

### Edge cases
- **All three families stale** → force `insufficient_data`, show aggregate stale warning.
- **One family missing entirely** (e.g., no fundamentals) → partial state with explicit caveat.
- **High confidence with low data quality** → reject or downgrade in UI; cannot display as valid high-confidence actionable state.
- **Conflicting strong signals** (sentiment bullish, technical bearish, fundamentals weak) → show `watchlist` or `avoid` with conflict callout.
- **Ticker change race condition** → prevent mixed-ticker rendering by keying module state on ticker symbol.

---

## 6) Recommended smallest next build slice
**Next slice:** Static FE module scaffold with typed mock contract and state rendering matrix.

### Slice boundary
- Build only the `Actionable Alpha Decision Panel` UI component in Trading domain style.
- Use local typed fixture variants (healthy / partial / stale / conflict).
- No backend integration, no runtime bridge changes, no cross-page redesign.

### Done criteria for this slice
- Component renders all four recommendation states.
- Freshness + missing-data behavior matches this spec.
- Story/demo fixture coverage includes at least: healthy actionable, stale insufficient, conflict-heavy watchlist.
- Ready for later wiring to real upstream data providers.
