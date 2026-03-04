# Foundation Status (Paper-Only)

## Implemented
- Backlog with prioritized P1/P2 tasks (`TASKS.md`)
- Safe project scaffold (`README.md`, `.env.example`, `config/settings.example.yaml`, `src/`, `scripts/`, `logs/`)
- Risk guards in `src/risk_manager.py`:
  - kill switch
  - daily loss cap
  - max position size
  - max open positions
- Minimal payload validator in `src/signal_validator.py`
- Dry-run simulation command in `scripts/dry_run.py`
- Unit tests for validator and risk decision logic in `tests/`
- Local paper-only webhook receiver in `src/webhook_receiver.py`:
  - `POST /webhook`
  - validates payload via `signal_validator`
  - reads local context artifacts via `context_adapter`
  - applies deterministic fusion modifiers via `signal_fusion`
  - adjusts proposed `qty` in paper simulation only
  - evaluates adjusted decision via `risk_manager`
  - default mode remains dry-run (`PAPER_EXECUTE=false`)
  - optional execution mode (`PAPER_EXECUTE=true`) routes through orchestrator + Alpaca paper adapter
  - logs structured events to `logs/webhook_decisions.jsonl`
  - returns JSON `accepted/denied` response with reasons + context modifiers + execution status
- Alpaca paper adapter in `src/broker_adapter_alpaca.py`:
  - methods: `submit_order`, `cancel_order`, `get_order`, `list_positions`
  - hard-fails on non-paper endpoint and any live mode attempt
- Execution orchestrator in `src/execution_orchestrator.py`:
  - accepts validated signal + context + risk decision
  - denied path logs decision and never executes
  - accepted path builds deterministic order intent and submits via adapter
  - deterministic idempotency key suppression using `data/state/idempotency.json`
- Unit tests for context adapter, fusion rules, and webhook context application
- Deterministic paper-only simulation runner in `src/simulation_runner.py` + `scripts/run_simulation.py`
  - Accepts `JSON` / `JSONL` input signal lists
  - Replays full paper decision pipeline (`validate -> context fusion -> risk checks`)
  - Writes artifacts:
    - `data/simulations/latest_run.json`
    - `data/simulations/latest_run.csv`
    - `data/simulations/summary.json`
- Concise summary generator in `src/simulation_report.py` with:
  - counts (`total`, `accepted`, `denied`)
  - denial reason breakdown
  - average size multiplier
  - average confidence adjustment
  - top context warnings encountered
- Added simulation-specific tests in `tests/test_simulation_runner.py` and `tests/test_simulation_report.py`

## Context Layer Details (Paper-Only)
- Context source files:
  - `projects/market-intel/data/signals_enriched_shadow.json`
  - `projects/market-intel/data/tracked_signals.json`
  - `projects/market-intel/data/signal_ab_comparison.json`
  - Optional `projects/market-intel-news-reader/data/*`
- Fusion output fields:
  - `confidence_adjustment`
  - `size_multiplier`
  - `block_reason` (when severe conflict)
- Example log/result fields:
  - `result.context.summary.risk_bias`
  - `result.context.summary.severity`
  - `result.proposal.raw_qty`
  - `result.proposal.adjusted_qty`
  - `result.proposal.size_multiplier`
  - `result.decision_context.confidence_adjustment`
  - `result.decision_context.block_reason`

### Current Limitations
- Missing or stale context files degrade to neutral behavior (graceful fallback)
- Rule set is deterministic and static (no adaptive weighting)
- News Reader artifact formats are loosely detected, best-effort only
- Context is portfolio-level and not symbol-sensitive yet

## Not Implemented (By Design)
- Live trading execution
- Any broker integrations beyond Alpaca paper
- External API calls in tests
- Automatic secret provisioning (env vars required for integration tests)

## Run/Test Commands
- Run tests:
  - `python3 -m unittest discover -s tests -v`
- Optional paper execution integration test prerequisites:
  - `PAPER_EXECUTE=true`
  - `ALPACA_API_KEY` and `ALPACA_API_SECRET` set in local environment (paper account only)
  - `ALPACA_BASE_URL=https://paper-api.alpaca.markets`
  - If keys are not set yet, no action is needed until integration-test step.
- Run local webhook server:
  - `python3 -m src.webhook_receiver`
- Send sample request:
  - `curl -X POST http://127.0.0.1:8000/webhook -H "Content-Type: application/json" -d '{"symbol":"AAPL","side":"buy","qty":1,"timestamp":"2026-03-01T12:00:00Z"}'`
- Run paper-only simulation replay:
  - `python3 scripts/run_simulation.py --input data/simulations/sample_signals.jsonl --output-dir data/simulations`
  - This is non-executing and never places live orders

## Next Suggested Steps
1. Expand sample replay sets to cover edge-case strategy regimes.
2. Add historical trend comparison across multiple daily `summary.json` artifacts.

## Manual Approval Flow (Current Implementation)
- The system operates in **dry-run mode by default** (`PAPER_EXECUTE=false`)
- To enable execution, `PAPER_EXECUTE=true` must be explicitly set
- Each execution request is logged with full decision context
- No automatic trade execution without explicit configuration change
