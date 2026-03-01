# Autonomous Trading Bot (Paper Mode Foundation)

This project is currently a **paper-trading safety foundation**.

## Current Status
- Paper mode scaffolding only
- Risk guards implemented (non-execution)
- Signal schema validation implemented (basic shape checks)
- Context adapter integrated (local Market Intel + optional News Reader artifacts)
- Deterministic context fusion rules applied before risk manager
- Dry-run CLI available for local simulation
- Deterministic paper simulation runner with JSON/JSONL replay + summary artifacts
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
├── data/
│   └── simulations/
│       └── sample_signals.jsonl
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

### 4) Run deterministic paper simulation replay (non-executing)
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
- Writes structured events to `logs/webhook_decisions.jsonl`
- Returns JSON response with `accepted`, `reasons`, `proposal`, and `decision_context`
- Never places orders, never calls external APIs

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
- Alpaca integration
- TradingView live webhook endpoint
- Telegram notifications
- Any live order execution path
