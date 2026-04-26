# Cron Wave 1 Migration Brief

Date: 2026-03-16
Depends on:
- `projects/_ops/cron-script-first-migration-plan-2026-03-16.md`
- `projects/_ops/cron-runner-spec-2026-03-16.md`
- implemented scaffold in `scripts/cron_runner.py`

## Purpose

Define the first controlled migration from prompt-based cron wrappers to the script-first runner for the safest deterministic jobs.

## Wave 1 Jobs

1. `data-manager`
2. `entity-lifecycle-manager`
3. `dependency-update-audit`
4. `weekly-test-suite`

## Migration Goal

For each Wave 1 job, replace the current agentTurn payload body with a minimal runner invocation:

```bash
cd /data/.openclaw/workspace && python3 scripts/cron_runner.py --task <task-name>
```

The cron job itself remains in OpenClaw for now.
This phase does **not** move anything to host cron/systemd.

## Why Wave 1 Is Safe

- low market sensitivity
- bounded behavior
- existing scripts/checks already exist
- success/failure is easy to verify
- rollback is straightforward

## Per-Job Mapping

### 1) data-manager

Current behavior:
- large inline Python blob inside cron payload

Target behavior:
- `python3 scripts/cron_runner.py --task data-manager`

Verification:
- runner log row appended
- prune/rotation behavior preserved
- no unexpected file deletions outside current scope

Rollback:
- restore current inline Python cron payload

### 2) entity-lifecycle-manager

Current behavior:
- direct `python3 scripts/lifecycle_entities.py` command wrapped in agentTurn

Target behavior:
- `python3 scripts/cron_runner.py --task entity-lifecycle-manager`

Verification:
- runner log row appended
- lifecycle script still updates entities correctly

Rollback:
- restore direct script command in cron payload

### 3) dependency-update-audit

Current behavior:
- multi-command prompt-based check sequence
- writes `memory/health-council/dependency-audit-YYYY-MM-DD.md`

Target behavior:
- `python3 scripts/cron_runner.py --task dependency-update-audit`

Verification:
- report path still generated
- read-only behavior preserved
- no install/upgrade side effects

Rollback:
- restore original multi-command payload

### 4) weekly-test-suite

Current behavior:
- multi-command test flow
- stays silent on success
- alerts on failure

Target behavior:
- `python3 scripts/cron_runner.py --task weekly-test-suite`

Verification:
- tests run for both bot projects
- report path still generated
- success remains quiet
- failure semantics preserved

Rollback:
- restore original multi-command payload

## Proposed Cron Payload Style

Keep payloads thin and standardized.

Suggested message template:

```text
Run only this command and nothing else:

cd /data/.openclaw/workspace && python3 scripts/cron_runner.py --task <task-name>

Reply with NO_REPLY.
```

Notes:
- still uses OpenClaw cron scheduling
- drastically reduces per-job prompt complexity
- centralizes execution logic in the runner

## Verification After Migration

For each migrated job, verify:

1. cron payload updated correctly
2. manual forced run succeeds
3. `memory/cron-run-log.jsonl` receives expected row
4. expected output/report artifacts still exist
5. no unexpected notification behavior changed

## Rollout Order

Recommended order:
1. `entity-lifecycle-manager`
2. `dependency-update-audit`
3. `data-manager`
4. `weekly-test-suite`

Reason:
- easiest direct-script equivalence first
- read-only audit next
- broader cleanup logic third
- multi-project test flow last

## Risk Note: PID Locking

Original scaffold risk:
- PID-file reuse could theoretically cause a stale lock to be treated as active briefly

Current status:
- improved in scaffold by storing both `pid` and `/proc/<pid>/stat` start ticks (`pid_start_ticks`)
- this materially reduces false-active lock risk without adding major complexity

Conclusion:
- risk is now low enough to proceed with Wave 1
- no further locking redesign required before migration

## Approval Boundary

This brief still does not mutate live cron jobs by itself.
Actual Wave 1 cron job updates should be approved and then applied as a controlled batch or one-by-one.
