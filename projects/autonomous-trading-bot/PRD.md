# PRD: Autonomous Trading Bot

## 1. Executive Summary

### Problem
Manual trading requires constant attention and emotional discipline. Decision fatigue reduces effectiveness over time. Need an automated system that can execute trades based on predefined strategies while maintaining strict risk controls.

### Solution
An autonomous trading bot that executes trades on Alpaca (paper trading first) using TradingView webhook alerts or internal signal generation. Starts with modest capital and aims for consistent daily gains through futures/short selling.

### Target User
- Self-directed trader (Philippe)
- Focus: futures trading, short selling
- Starting budget: TBD (modest amount for testing)

### Guiding Principles
- **Safety first:** Paper trading before any real money
- **Strict limits:** Max daily loss cap, position sizing rules
- **Transparency:** All trades logged and reported
- **Human oversight:** Can override or pause at any time

---

## 2. Project Structure

### Location
`projects/autonomous-trading-bot/`

### Files
- `PRD.md` — This document
- `README.md` — Setup and usage instructions
- `config/` — Configuration (API keys, limits)
- `src/` — Bot source code

---

## 3. Core Components

### 3.1 Signal Sources

| Source | Type | Priority |
|--------|------|----------|
| TradingView Webhooks | External | High |
| Internal Technical Analysis | Custom | Medium |
| Market Regime Check | Custom | Medium |

### 3.2 Execution Engine

- **Alpaca API** — Paper trading first, live later
- **Supported assets:** Futures, stocks
- **Order types:** Market, Limit, Stop

### 3.3 Risk Management

- Daily loss cap (auto-stop trading if hit)
- Position sizing rules (max % per trade)
- Max open positions
- Trailing stop rules

### 3.4 Reporting

- Daily trade log
- Performance summary
- Telegram alerts on significant events

---

## 4. Architecture

```
[TradingView] → [Webhook] → [VPS/Bot] → [Alpaca API]
                                              ↓
                                        [Paper/Live]
                                              ↓
                                        [Trade Log]
```

### Components
1. **Webhook Receiver** — Listens for TradingView alerts
2. **Signal Validator** — Checks against risk rules
3. **Order Executor** — Places orders via Alpaca
4. **Position Monitor** — Tracks open positions, manages exits
5. **Reporter** — Logs trades, sends Telegram updates

---

## 5. Phases

### Phase 1: Foundation
- [ ] Set up Alpaca paper trading account
- [ ] Basic webhook receiver running on VPS
- [ ] Simple moving average crossover strategy
- [ ] Paper trading only
- [ ] Trade logging

### Phase 2: Signal Integration
- [ ] Connect TradingView webhook signals
- [ ] Add internal technical analysis (RSI, MACD, Squeeze)
- [ ] Position sizing implementation
- [ ] Daily loss cap enforcement

### Phase 3: Intelligence
- [ ] Integrate Market Intel research findings
- [ ] Cross-reference signals with historical patterns
- [ ] Confidence scoring before execution

### Phase 4: Autonomy (Optional)
- [ ] Self-adjusting parameters based on performance
- [ ] Auto-pause when underperforming
- [ ] Ask via Telegram when uncertain

---

## 6. Technical Stack

- **Language:** Python (primary), Node.js (webhook receiver)
- **Broker:** Alpaca (paper/live trading)
- **Signals:** TradingView webhooks, custom indicators
- **Hosting:** VPS (same as OpenClaw container or separate)
- **Notifications:** Telegram

---

## 7. Security & Safety

### NEVER
- Connect real money without extended paper testing
- Remove daily loss caps
- Allow unlimited position sizes
- Trade without stop losses

### ALWAYS
- Log every trade with timestamp, entry, exit, P&L
- Report daily results via Telegram
- Review performance weekly
- Maintain kill switch to stop all trading instantly

---

## 8. Success Metrics

- [ ] Run 30 days paper trading without loss cap triggered
- [ ] Consistent positive P&L in paper trading
- [ ] All trades logged with >90% accuracy
- [ ] Telegram alerts working reliably

---

## 9. Future Considerations

- Connect to live trading (small amount)
- Add more signal sources
- Multi-asset support (crypto, forex)
- Backtesting framework
