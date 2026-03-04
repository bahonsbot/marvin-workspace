# Autonomous Trading Bot (Paper Mode Foundation)

This project is currently a **paper-trading safety foundation**.

## Quick Start

### 1. Prerequisites
- Python 3.9+
- Alpaca paper trading account (free) — get API keys at [alpaca.markets](https://alpaca.markets/)

### 2. Setup
```bash
# Clone and enter project
cd projects/autonomous-trading-bot

# Create virtualenv
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt  # if exists, otherwise skip

# Copy env template
cp .env.example .env
```

### 3. Run a Test Signal
```bash
# Dry-run simulation (no execution)
python3 scripts/dry_run.py
```

Or use the local webhook receiver:
```bash
# Start receiver
python3 -m src.webhook_receiver &

# Send test signal
curl -X POST http://127.0.0.1:8000/webhook \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","side":"buy","qty":1,"timestamp":"2026-03-01T12:00:00Z"}'
```

### 4. Check Execution
- Logs: `logs/webhook_decisions.jsonl`
- Simulation results: `data/simulations/latest_run.json`

---

## Current Status
- Paper mode scaffolding only
- Risk guards implemented (non-execution)
- Signal schema validation implemented (basic shape checks)
- Context adapter integrated (local Market Intel + optional News Reader artifacts)
- Deterministic context fusion rules applied before risk manager
- Dry-run CLI available for local simulation
- Deterministic paper simulation runner with JSON/JSONL replay + summary artifacts
- Alpaca **paper-only** adapter added with hard live-mode guards
- Execution orchestrator added with deterministic idempotency suppression
- Default mode remains dry-run (execution off unless explicitly enabled)

## Safety Rules (Non-Negotiable)
1. **Paper mode only** until long-run validation is complete.
2. **No API secrets** in repo or `.env.example`.
3. **Kill switch must be respected** by default.
4. **Risk guards run before any execution logic**.
5. **Live trading is prohibited**. If execution is enabled, it must use Alpaca paper endpoint only.

## Secret Hygiene (.env)
- `.env` is local-only and must never be committed.
- Never print environment variable values in logs or chat outputs.
- Keep only placeholders in `.env.example`.
- If a secret is exposed, rotate it immediately.

## Project Structure

```text
projects/autonomous-trading-bot/
├── PRD.md
├── TASKS.md
├── README.md
├── .env.example
├── config/
│   └── settings.example.yaml
├── data/
│   ├── simulations/
│   │   └── sample_signals.jsonl
│   └── state/
│       └── idempotency.json
├── logs/
│   └── .gitkeep
├── scripts/
│   ├── dry_run.py
│   └── run_simulation.py
└── src/
    ├── __init__.py
    ├── webhook_receiver.py
    ├── signal_validator.py
    ├── signal_fusion.py
    ├── context_adapter.py
    ├── risk_manager.py
    ├── broker_adapter_alpaca.py
    ├── execution_orchestrator.py
    ├── simulation_runner.py
    ├── simulation_report.py
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

### 4) Optional paper execution toggle (still paper-only)
Default is dry-run. Keep it that way unless you are ready for integration testing.

```bash
# .env
PAPER_EXECUTE=false
```

When preparing integration tests later:
- set `PAPER_EXECUTE=true`
- provide `ALPACA_API_KEY` and `ALPACA_API_SECRET` for **paper** account only
- keep `ALPACA_BASE_URL=https://paper-api.alpaca.markets`

If keys are absent now, no action is needed yet.

### 5) Run deterministic paper simulation replay (non-executing)
```bash
python3 scripts/run_simulation.py \
  --input data/simulations/sample_signals.jsonl \
  --output-dir data/simulations
```

This command is strictly paper-only. It does not place orders, call broker APIs, or execute trades.

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

## Tests
Run the paper-mode unit tests:

```bash
python3 -m unittest discover -s tests -v
```

## Local Webhook Receiver (Paper-Only)
Start a local endpoint:

```bash
python3 -m src.webhook_receiver
```

Send a sample webhook:

```bash
curl -X POST http://127.0.0.1:8000/webhook \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","side":"buy","qty":1,"timestamp":"2026-03-01T12:00:00Z"}'
```

Behavior:
- Validates payload using `src/signal_validator.py`
- Loads local context snapshot using `src/context_adapter.py`
- Applies deterministic context fusion rules via `src/signal_fusion.py`
- Adjusts proposed quantity in paper simulation only (`raw_qty` -> `adjusted_qty`)
- Evaluates risk decision using adjusted proposal in `src/risk_manager.py`
- In default mode (`PAPER_EXECUTE=false`), returns dry-run decision only
- In execution mode (`PAPER_EXECUTE=true`), uses `src/execution_orchestrator.py` and `src/broker_adapter_alpaca.py`
- Enforces Alpaca paper endpoint with hard checks that block any live-mode configuration
- Applies per-IP rate limiting by default (`120 req / 60s`) to reduce accidental endpoint spam
- Suppresses duplicate executions using deterministic idempotency keys in `data/state/idempotency.json`
- Writes structured events to `logs/webhook_decisions.jsonl`

## Context Layer (Paper-Only)
The webhook flow now includes a local context decision layer before risk checks:
1. Validate webhook payload
2. Build context snapshot from local artifacts:
   - `projects/market-intel/data/signals_enriched_shadow.json`
   - `projects/market-intel/data/tracked_signals.json`
   - `projects/market-intel/data/signal_ab_comparison.json`
   - Optional files under `projects/market-intel-news-reader/data/`
3. Derive context modifiers (`confidence_adjustment`, `size_multiplier`, optional `block_reason`)
4. Apply modifier to `qty` (paper simulation only)
5. Pass adjusted proposal into risk manager

Example decision/log fields:
- `proposal.raw_qty`
- `proposal.adjusted_qty`
- `proposal.size_multiplier`
- `proposal.confidence_adjustment`
- `decision_context.block_reason`
- `context.summary.risk_bias`
- `context.summary.severity`

Current limitations:
- Context is local-file based only, no freshness SLA yet
- Fusion rules are intentionally simple and static (rule-based v1)
- News Reader ingestion is best-effort and optional
- No symbol-specific macro mapping yet (uses portfolio-level regime hints)

## Simulation Outputs (Paper-Only)
`python3 scripts/run_simulation.py` writes:
- `data/simulations/latest_run.json`
  - Full replay payload, per-signal decisions, and embedded summary
- `data/simulations/latest_run.csv`
  - Flat table with symbol/side/raw_qty/adjusted_qty/accepted/reasons for quick review
- `data/simulations/summary.json`
  - Concise daily report metrics:
    - counts (`total`, `accepted`, `denied`)
    - denial reason breakdown
    - average size multiplier
    - average confidence adjustment
    - top context warnings encountered

All outputs are deterministic from the input file and current local context artifacts. This remains strictly non-executing paper simulation.

## Next Steps
- Extend simulation input fixtures over larger historical windows.
- Add trend comparison across multiple daily simulation summaries.

## Explicitly Not Implemented Yet
- TradingView public internet webhook hardening
- Telegram notifications
- Any live order execution path
- Any broker endpoint other than Alpaca paper

## 24/7 Webhook Operation (Paper Mode)

- Start receiver:
  - `scripts/run_webhook_receiver.sh`
- Ensure receiver is up (idempotent):
  - `scripts/ensure_webhook_receiver.sh`
- Health check:
  - `GET /health`

### Webhook Authentication
Set `WEBHOOK_SHARED_SECRET` in `.env` and include the secret in webhook payload:
```json
{
  "symbol": "AAPL",
  "side": "buy",
  "qty": 1,
  "timestamp": "2026-03-04T09:00:00Z",
  "secret": "<WEBHOOK_SHARED_SECRET>"
}
```

> TradingView cannot send custom headers, so payload-based secret is supported.

## Market Intel Auto-Dispatch (Paper)

Dispatch qualifying Market Intel signals to the local webhook:

```bash
cd /data/.openclaw/workspace/projects/autonomous-trading-bot
./scripts/dispatch_market_intel_signals.py
```

Default conservative rules (via `.env`):
- `AUTO_MIN_CONFIDENCE=STRONG BUY`
- `AUTO_MIN_REASONING_SCORE=80`
- `AUTO_BASE_QTY=1`
- `AUTO_MAX_QTY=1`
- `AUTO_MARKET_HOURS_ONLY=true` (US market session gate)

State/idempotency file:
- `data/state/auto_signal_dispatch.json`

This avoids duplicate dispatches for the same signal key.

### Fast Regime Mode (optional, enabled by default)
When macro stress is high, dispatch can switch to FAST mode:
- lower reasoning threshold (`AUTO_FAST_MIN_REASONING_SCORE`)
- modest size boost (`AUTO_FAST_QTY_MULTIPLIER`, still clamped by `AUTO_MAX_QTY`)

Activation conditions (from context snapshot):
- severity is high/critical, and
- geopolitical count >= `AUTO_FAST_GEO_THRESHOLD` OR
- high confidence signal count >= `AUTO_FAST_HIGH_CONF_THRESHOLD`

- Telegram mode indicator: sends a digest when dispatch mode switches (CONSERVATIVE ↔ FAST).

## Troubleshooting

### Webhook receiver stopped (status=0 errors in dispatch)
```bash
cd /data/.openclaw/workspace/projects/autonomous-trading-bot
scripts/run_webhook_receiver.sh
curl http://127.0.0.1:8000/health
```

### .env sourcing errors (e.g., "BUY: command not found")
Values with spaces must be quoted:
```
AUTO_MIN_CONFIDENCE="STRONG BUY"
```

### Webhook Watchdog (auto-restart)
Lightweight background process that restarts receiver if it dies:
```bash
./scripts/webhook_watchdog.sh &
```
Runs in background, checks every 60s, minimal overhead (no cron).
