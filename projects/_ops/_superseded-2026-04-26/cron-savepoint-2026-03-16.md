# Cron Save Point

Date: 2026-03-16
Purpose: record a stable pause point after migrating the obvious script-native jobs to the runner path, before deciding whether a stronger external bridge is worth building.

## Stable state reached

### Jobs now on runner path
- `data-manager`
- `entity-lifecycle-manager`
- `dependency-update-audit`
- `weekly-test-suite`
- `rss-feed-monitor`
- `rss-feed-monitor-weekend-light`
- `reddit-monitor`
- `reddit-monitor-weekend-light`
- `enrichment-ab-review`
- `auto-signal-dispatcher`
- `trading-daily-report`
- `pre-market-brief`

### Still model-backed by intent
- `nightly-memory-extraction`
- `platform-health-council`
- `nightly-security-review`
- `self-improvement`
- `daily-task-generator`

### Still not migrated because it is truly mixed
- `signal-accuracy-review`

## Meaning of this save point

This is the "obvious script-first cleanup complete" checkpoint.

At this point:
- deterministic jobs are centralized behind `scripts/cron_runner.py`
- logging and locking are standardized
- OpenClaw cron still launches agentTurn sessions, so overhead is reduced, not eliminated
- the next architectural step would be a stronger non-agentTurn bridge, but it is no longer urgent to prove the basic script-first concept

## Future decision boundary

If future review shows that the remaining agentTurn overhead is still too costly or operationally awkward, the next bridge decision should be justified primarily by:
- `signal-accuracy-review` split-path efficiency
- broader desire for host/external execution consistency

If not, this save point is a valid medium-term operating state.
