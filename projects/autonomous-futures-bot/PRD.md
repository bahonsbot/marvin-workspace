# Autonomous Futures Bot — PRD

**Version:** 1.0  
**Date:** 2026-03-04  
**Status:** Approved (implementation pending)

---

## Executive Summary

Build a **separate, dedicated futures trading bot** that operates alongside the existing equity bot. Both bots share the Market Intel signal pipeline but execute independently with instrument-appropriate risk models and broker integrations.

**Why separate:**
- Different broker required (Alpaca = equities only)
- Futures mechanics differ (contracts, expiration, margin, rollover)
- Risk isolation (margin calls shouldn't affect equity positions)
- Cleaner architecture and debugging

---

## Goals

### Primary
1. Execute futures trades based on Market Intel signals
2. Support major contracts: `/ES`, `/NQ`, `/CL`, `/GC`, `/SI`, `/ZB`
3. Paper-trading foundation first (safety)
4. Shared intelligence, separate execution

### Secondary
1. Telegram notifications for futures trades
2. Daily P&L reporting
3. Contract expiration awareness
4. Rollover logic (future phase)

---

## Non-Goals (Out of Scope for Phase 1)

- Live trading (paper-only initially)
- Options on futures
- Spread trades / multi-leg strategies
- Auto-rollover (manual for Phase 1)
- Crypto futures
- International exchanges (CME/NYMEX/COMEX only initially)

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Market Intel Pipeline                     │
│  (signals_enriched.json, reasoning, context fusion)          │
└─────────────────────┬───────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
┌─────────────────┐      ┌─────────────────┐
│   Equity Bot    │      │   Futures Bot   │
│   (existing)    │      │   (new)         │
│                 │      │                 │
│  Alpaca Paper   │      │  Tradovate/     │
│  Stocks/ETFs    │      │  IBKR Paper     │
│                 │      │  Futures        │
└─────────────────┘      └─────────────────┘
```

### Shared Components
- Market Intel signal source (`enhanced_signals.json`)
- Webhook receiver pattern
- Context fusion logic
- Telegram notifier
- Dispatch script (`dispatch_market_intel_signals.py`)

### Futures-Specific Components
- Futures broker adapter (Tradovate or IBKR)
- Contract symbol mapper (e.g., "oil" → `/CL`, "gold" → `/GC`)
- Position manager (contract-aware)
- Risk manager (margin-based, not notional)
- Expiration tracker
- P&L calculator (tick-value aware)

---

## Broker Selection

### Recommended: **Tradovate**
**Pros:**
- Futures-focused API (clean, modern)
- Paper trading available (free)
- Commission-included pricing
- Good Python SDK
- No account minimum for paper

**Cons:**
- Less known than IBKR
- Fewer asset classes (but we only need futures)

### Alternative: **Interactive Brokers (IBKR)**
**Pros:**
- Industry standard
- Access to global futures
- Robust API

**Cons:**
- More complex API
- Overkill for our needs
- Data fees even for paper

**Decision:** Start with **Tradovate** for simplicity. Can add IBKR later if needed.

---

## Supported Contracts (Phase 1)

| Category | Contracts | Symbol Mapping |
|----------|-----------|----------------|
| Equity Index | E-mini S&P 500, E-mini Nasdaq | `/ES`, `/NQ` |
| Energy | Crude Oil, Natural Gas | `/CL`, `/NG` |
| Metals | Gold, Silver | `/GC`, `/SI` |
| Rates | 10-Year Treasury Note | `/ZN` |
| Agriculture | Corn, Soybeans, Wheat | `/ZC`, `/ZS`, `/ZW` |

### Symbol Mapping Examples
- "S&P" → `/ES`
- "Nasdaq" → `/NQ`
- "Oil" → `/CL`
- "Gold" → `/GC`
- "Treasury" → `/ZN`
- "Corn" → `/ZC`

---

## Risk Management (Phase 1)

### Position Sizing
- **Max contracts per signal:** 1 (conservative start)
- **Max open positions:** 3 contracts total
- **Daily loss cap:** $500 (paper) / configurable for live

### Margin Awareness
- Track buying power usage
- Block new trades if margin > 50% of account
- Alert at 30% margin usage

### Contract-Specific Risk
- Tick value awareness (e.g., `/ES` = $12.50/tick, `/CL` = $10.00/tick)
- Max adverse excursion tracking
- Time-based stops (exit EOD if no thesis progress)

### Market Hours Gate
- Only trade during regular session hours (RTH)
- Avoid overnight gap risk (Phase 1)
- Configurable per contract

---

## Signal Mapping (Futures-Specific)

### Category → Contract Mapping

| Signal Category | Keywords | Mapped Contract |
|-----------------|----------|-----------------|
| Equity Index | "S&P", "Nasdaq", "Dow", "SPX", "NDX" | `/ES`, `/NQ` |
| Energy | "oil", "crude", "OPEC", "energy" | `/CL` |
| Energy | "natural gas", "NG", "heating" | `/NG` |
| Metals | "gold", "precious metal", "Fed" | `/GC` |
| Metals | "silver", "industrial metal" | `/SI` |
| Rates | "Treasury", "yield", "Fed", "bond" | `/ZN` |
| Agriculture | "corn", "soybean", "wheat", "crop" | `/ZC`, `/ZS`, `/ZW` |
| Inflation | "CPI", "inflation", "PCE" | `/GC` (inflation hedge) |
| Recession | "recession", "unemployment", "GDP" | `/ES` (short bias) |

### Confidence Adjustments
- Futures are leveraged → **lower base position size**
- Require higher reasoning score threshold (85 vs 80 for equities)
- Geopolitical signals → favor `/CL`, `/GC`
- Macro signals → favor `/ES`, `/ZN`

---

## Execution Flow

1. **Signal Received** (from Market Intel dispatch)
2. **Symbol Mapping** → futures contract (e.g., "oil crisis" → `/CL`)
3. **Risk Check** (margin, position limits, market hours)
4. **Order Construction** (contract, quantity, side, duration)
5. **Broker Submission** (Tradovate API)
6. **Confirmation** (order ID, fill status)
7. **Logging** (webhook_decisions.jsonl + futures-specific log)
8. **Telegram Alert** (contract, side, qty, price, P&L estimate)

---

## Data Model

### Position Record
```json
{
  "contract": "CL",
  "symbol": "/CL",
  "side": "long",
  "qty": 1,
  "entry_price": 78.50,
  "entry_time": "2026-03-05T14:30:00Z",
  "contract_month": "2026-04",
  "expiration": "2026-03-20",
  "tick_value": 10.00,
  "unrealized_pnl": 0.00,
  "realized_pnl": 0.00,
  "exit_price": null,
  "exit_time": null,
  "exit_reason": null
}
```

### Daily P&L Summary
```json
{
  "date": "2026-03-05",
  "trades": 3,
  "winners": 2,
  "losers": 1,
  "gross_pnl": 450.00,
  "commissions": 0.00,
  "net_pnl": 450.00,
  "max_drawdown": -125.00,
  "sharpe": null,
  "contracts_traded": ["CL", "ES", "GC"]
}
```

---

## Project Structure

```
projects/autonomous-futures-bot/
├── PRD.md                          # This document
├── README.md                       # Setup + usage guide
├── .env.example                    # Env var template
├── config/
│   └── settings.example.yaml       # Conservative defaults
├── src/
│   ├── __init__.py
│   ├── broker_adapter_tradovate.py # Tradovate API wrapper
│   ├── contract_mapper.py          # Signal → contract mapping
│   ├── risk_manager.py             # Margin + position limits
│   ├── position_manager.py         # Track open positions
│   ├── execution_orchestrator.py   # Orchestrate trade flow
│   ├── pnl_calculator.py           # Tick-value P&L logic
│   ├── expiration_tracker.py       # Contract expiry awareness
│   └── telegram_notifier.py        # Futures-specific alerts
├── scripts/
│   ├── run_webhook_receiver.sh     # Webhook daemon
│   ├── dispatch_futures_signals.py # Market Intel → futures
│   ├── daily_report.py             # Daily P&L summary
│   └── check_expirations.py        # Weekly expiration check
├── tests/
│   ├── test_contract_mapper.py
│   ├── test_risk_manager.py
│   ├── test_pnl_calculator.py
│   └── fixtures.py
├── logs/
│   └── webhook_decisions.jsonl
├── data/
│   ├── state/
│   │   └── idempotency.json
│   └── simulations/
│       └── sample_signals.jsonl
└── docs/
    ├── tradovate-setup.md
    ├── contract-specs.md
    └── futures-trading-basics.md
```

---

## Phase 1 Milestones

### P1 — Safety + Core Flow (Must Complete)
- [ ] P1.1 Tradovate paper account setup + API auth
- [ ] P1.2 Contract mapper (signal → futures contract)
- [ ] P1.3 Risk manager (margin, position limits, market hours)
- [ ] P1.4 Position manager (track open contracts, P&L)
- [ ] P1.5 Webhook receiver (futures-specific endpoint)
- [ ] P1.6 Execution orchestrator (validate → risk → execute)
- [ ] P1.7 Paper-only safety docs + kill switch

### P2 — Reporting + Monitoring
- [ ] P2.1 Daily P&L report script
- [ ] P2.2 Telegram notifications (futures channel)
- [ ] P2.3 Expiration tracker + alerts
- [ ] P2.4 Unit tests (mapper, risk, P&L)
- [ ] P2.5 Dry-run CLI simulation

### P3 — Live Readiness (Future, Disabled)
- [ ] P3.1 Live account integration (separate config)
- [ ] P3.2 Manual approval gate for live mode
- [ ] P3.3 30-day paper run evidence
- [ ] P3.4 Loss cap validation
- [ ] P3.5 Rollover logic (auto or manual prompt)

---

## Environment Variables

```bash
# Broker
TRADOVATE_API_KEY=
TRADOVATE_API_SECRET=
TRADOVATE_BASE_URL=https://api.tradovate.com
PAPER_MODE=true

# Safety
KILL_SWITCH=true
DAILY_LOSS_CAP=500.0
MAX_CONTRACTS_PER_SIGNAL=1
MAX_OPEN_POSITIONS=3
MARGIN_WARNING_THRESHOLD=0.30
MARGIN_HARD_CAP=0.50

# Market Hours
MARKET_HOURS_ONLY=true
ALLOW_OVERNIGHT=false

# Webhook
WEBHOOK_SHARED_SECRET=
AUTO_WEBHOOK_URL=http://127.0.0.1:8001/webhook

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_FUTURES_CHAT_ID=-100xxxxxx
```

---

## Success Metrics (Phase 1)

| Metric | Target |
|--------|--------|
| Paper trades executed | 20+ |
| Win rate | >45% (directional accuracy) |
| Max drawdown | <10% of paper account |
| Sharpe ratio | >1.0 (annualized) |
| Signal-to-trade latency | <5 seconds |
| Zero live trades (safety) | ✅ |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Margin call (live phase) | Hard cap at 50% margin usage |
| Contract expiration missed | Weekly expiration check + alerts |
| Overleveraging | Max 3 contracts total, 1 per signal |
| Overnight gap risk | Market-hours-only gate (Phase 1) |
| Wrong contract mapping | Manual review of first 20 trades |
| API rate limits | 120 req/min with backoff |

---

## Open Questions

1. **Broker final choice:** Tradovate vs IBKR? (revisit after paper testing)
2. **Contract coverage:** Start with 3 contracts (`/ES`, `/CL`, `/GC`) or full list?
3. **Rollover:** Manual (Phase 1) or auto-prompt user?
4. **Telegram channel:** Separate futures channel or combined with equity bot?

---

## Approval

**Approved by:** Philippe  
**Date:** 2026-03-04  
**Next Step:** Implementation (Phase 1) — scheduled for 2026-03-05

---

*This PRD is a living document. Update as implementation reveals new requirements.*
