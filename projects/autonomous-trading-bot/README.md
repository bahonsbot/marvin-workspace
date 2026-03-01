# Autonomous Trading Bot (Paper Mode Foundation)

This project is currently a **paper-trading safety foundation**.

## Current Status
- Paper mode scaffolding only
- Risk guards implemented (non-execution)
- Signal schema validation implemented (basic shape checks)
- Dry-run CLI available for local simulation
- **No broker integration, no live trading, no external calls**

## Safety Rules (Non-Negotiable)
1. **Paper mode only** until long-run validation is complete.
2. **No API secrets** in repo or `.env.example`.
3. **Kill switch must be respected** by default.
4. **Risk guards run before any execution logic**.
5. **No real order placement code** in this phase.

## Project Structure

```text
projects/autonomous-trading-bot/
├── PRD.md
├── TASKS.md
├── README.md
├── .env.example
├── config/
│   └── settings.example.yaml
├── logs/
│   └── .gitkeep
├── scripts/
│   └── dry_run.py
└── src/
    ├── __init__.py
    ├── webhook_receiver.py
    ├── signal_validator.py
    ├── risk_manager.py
    ├── order_executor.py
    └── reporter.py
```

## Setup

### 1) Create a local virtualenv
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2) Optional local env file
```bash
cp .env.example .env
```

### 3) Run dry-run simulation
```bash
python3 scripts/dry_run.py
```

## Dry-Run Runbook
1. Start with default conservative settings in `scripts/dry_run.py` or `config/settings.example.yaml`.
2. Confirm validator result (`ok: true`).
3. Inspect risk decision:
   - `allow: false` means block signal and review reasons.
   - `allow: true` means signal passes risk checks in paper mode.
4. Record findings in logs and iterate on thresholds.

## What Is Implemented
- `src/signal_validator.py`
  - Basic payload shape validation
  - Required fields and primitive type checks
- `src/risk_manager.py`
  - Kill switch check
  - Daily loss cap check
  - Max position size check
  - Max open positions check
  - Decision output with `allow` + `reasons`
- `scripts/dry_run.py`
  - Sample signal validation and risk evaluation

## Next Steps
- Add unit tests for validator and risk guard decisions.
- Add local webhook receiver endpoint and payload logging.
- Add paper execution simulator (logs intended orders only).
- Build daily reporting summary from local logs.

## Explicitly Not Implemented Yet
- Alpaca integration
- TradingView live webhook endpoint
- Telegram notifications
- Any live order execution path
