# Cron Mixed Jobs Assessment

Date: 2026-03-16
Purpose: assess the remaining mixed jobs after deterministic migrations and decide whether they should move to the runner, stay model-backed, or wait for a stronger bridge.

## Remaining mixed jobs
- `signal-accuracy-review`
- `trading-daily-report`
- `pre-market-brief`

## 1) signal-accuracy-review

## Current shape
- Starts with deterministic queue inspection:
  - `cd /data/.openclaw/workspace/projects/market-intel && python3 src/accuracy_tracker.py --review`
- If pending count is zero, the task is mostly summary/reporting
- If pending signals exist, the task becomes genuinely reasoning-heavy because it requires signal verification judgment and structured evidence capture

## Assessment
This job is **split-brain**:
- deterministic precheck path
- reasoning-heavy review path

## Recommendation
Do **not** simply migrate the whole job to the runner as-is.

Better future design:
- script-first precheck path via runner
- conditional escalation to model-backed review only when there are pending signals worth evaluating

## Bridge-value
High

Why:
- many days may be no-op or summary-only
- a stronger bridge could avoid spending model/runtime overhead on empty days
- but the actual review step should remain model-capable

## 2) trading-daily-report

## Current shape
- Current cron payload runs:
  - `cd /data/.openclaw/workspace/projects/autonomous-trading-bot && set -a && . ./.env && set +a && python3 scripts/daily_report.py`
- `daily_report.py` prints a deterministic report to stdout
- The cron instruction then asks the model/runtime to send that output to Telegram

## Assessment
This job is **mostly deterministic**.
The only mixed part is delivery plumbing.

## Recommendation
This is a strong candidate for future migration, likely easier than `signal-accuracy-review` and `pre-market-brief`.

Possible design:
- runner executes `daily_report.py`
- result captured to details path or temporary artifact
- thin delivery layer sends the report without requiring a large model prompt

## Bridge-value
Medium-high

Why:
- the report generation itself is deterministic
- remaining complexity is mostly output routing, not reasoning

## 3) pre-market-brief

## Current shape
- Cron runs `projects/manual-trading-brief/src/brief_generator.py`
- The script itself:
  - fetches market data
  - analyzes catalysts from RSS/Reddit
  - generates the brief text
  - sends it to Telegram directly
- It returns success/failure based on actual delivery

## Assessment
This job is closer to deterministic/script-native than originally assumed.
However, it is more operationally sensitive than the earlier runner migrations because it bundles:
- data gathering
- brief generation
- direct Telegram delivery

It is not strongly model-dependent in the current implementation.

## Recommendation
This is a plausible future runner candidate, but not because it needs a split reasoning path.
It should be treated more like a script-native delivery job.

Main reason to delay:
- messaging side effects
- needs a careful delivery/alert semantics review

## Bridge-value
Medium

Why:
- current script already does the work directly
- migration value is runner consistency, logging, and future bridge readiness more than major token reduction

## Overall recommendation

### Best candidate among the remaining mixed jobs
1. `trading-daily-report`
2. `pre-market-brief`
3. `signal-accuracy-review` (but only with split-path design)

## Why this order
- `trading-daily-report` is mostly deterministic already
- `pre-market-brief` is script-native but has direct delivery side effects
- `signal-accuracy-review` has the highest architectural value for a stronger bridge, but needs the most design work because it truly splits into deterministic and reasoning-heavy phases

## External bridge implications
A stronger external bridge becomes more worth it if we want to solve `signal-accuracy-review` elegantly.

Why:
- deterministic precheck could run outside agentTurn
- only non-empty review days would escalate into model work
- that is the clearest remaining example where current cron architecture still wastes runtime on no-op days

For `trading-daily-report` and `pre-market-brief`, the bridge is useful but less critical, because the main work is already in scripts.
