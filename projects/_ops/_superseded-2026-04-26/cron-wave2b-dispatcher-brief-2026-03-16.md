# Cron Wave 2B Dispatcher Brief

Date: 2026-03-16
Depends on:
- `projects/_ops/cron-script-first-migration-plan-2026-03-16.md`
- `projects/_ops/cron-runner-spec-2026-03-16.md`
- validated Wave 1 and Wave 2A runner migrations

## Purpose

Evaluate and define a controlled migration path for `auto-signal-dispatcher` as a standalone Wave 2B item.

This job is still deterministic, but it is more operationally sensitive than earlier migrations because it can lead to live-ish paper trading dispatch behavior through the webhook receiver.

## Current State

Current cron payload already runs a direct script command:

```bash
cd /data/.openclaw/workspace/projects/autonomous-trading-bot && python3 scripts/dispatch_market_intel_signals.py --quiet
```

So this job is already thinner than many pre-migration jobs were.

## Why It Was Held Back

Not because it is non-deterministic.
Because it is **execution-adjacent**:
- it checks market hours
- it validates webhook health
- it reads bot/runtime state
- it can dispatch orders through the webhook path
- it writes dispatch state under `projects/autonomous-trading-bot/data/state/auto_signal_dispatch.json`
- it can trigger Telegram notifications

A migration mistake here is more meaningful than a mistake in RSS monitoring or data cleanup.

## Key Observation

The main remaining inefficiency is not large prompt complexity.
The current prompt is already thin.

The value of migrating this job to the runner would be:
- central logging consistency
- lock handling consistency
- standardized execution envelope
- future non-agentTurn migration readiness

The value is **less about huge prompt savings** and **more about operational consistency**.

## Recommendation

Treat `auto-signal-dispatcher` as an optional singleton migration, not a bulk follow-up.

Proceed only if we want:
1. unified runner logging / locking for dispatch
2. a cleaner path toward future external scheduler bridging
3. consistent execution contracts across all deterministic jobs

## Proposed Runner Task

Add one runner task only:
- `auto-signal-dispatcher`

Target command:

```bash
cd /data/.openclaw/workspace/projects/autonomous-trading-bot && python3 scripts/dispatch_market_intel_signals.py --quiet
```

Recommended runner metadata:
- `kind: script_only`
- `timeout_seconds: 180`
- `lock_name: auto-signal-dispatcher`
- `notify_policy: failure`
- artifact/state refs:
  - `projects/autonomous-trading-bot/data/state/auto_signal_dispatch.json`

## Preconditions Before Migration

Verify these explicitly before mutating the cron job:

1. Webhook health path is healthy:
   - `/health/auth` reachable and returns 200 under current config
2. Dispatch script still behaves fail-closed:
   - outside market hours -> skip
   - unhealthy webhook -> non-zero exit
   - missing secret -> non-zero exit
3. Dispatch state path is stable:
   - `projects/autonomous-trading-bot/data/state/auto_signal_dispatch.json`
4. No duplicate-run risk:
   - locking should be active because overlapping dispatch attempts would be bad hygiene

## Verification Plan

Before cron mutation:
1. add runner registry entry
2. directly run through runner in a controlled way
3. verify runner log row
4. verify dispatch state file behavior
5. verify no duplicate-run overlap

After cron mutation:
1. force-run cron once
2. confirm runner log row exists
3. confirm script output/exit semantics unchanged
4. confirm dispatch state file is updated normally
5. confirm no duplicate notifications or duplicated state writes

## Risk Classification

Risk: medium

Why not high:
- no direct strategy logic change proposed
- underlying script stays the same
- dispatch path already exists and is already used

Why not low:
- execution-adjacent behavior
- webhook and state path involvement
- duplicate-run mistakes matter more here

## Rollback

Per-job rollback is simple:
1. restore original cron payload
2. keep runner task entry if harmless
3. do not bundle rollback with unrelated jobs

## My Recommendation

Proceed only if Philippe wants consistency enough to justify touching an execution-adjacent job.

If the primary goal is token savings alone, this job is lower priority than earlier migrations because its prompt was already thin.

If the goal is **execution framework consistency**, then this is the right next singleton migration after Wave 2A.
