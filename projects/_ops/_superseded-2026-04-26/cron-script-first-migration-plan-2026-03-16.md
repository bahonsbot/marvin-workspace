# Cron Script-First Migration Plan

Date: 2026-03-16
Owner: Marvin
Status: planning only, no control-plane mutations proposed in this document

## Executive Summary

OpenClaw cron currently wakes isolated agentTurn sessions for a number of jobs that are primarily deterministic script execution. This is functionally workable but architecturally inefficient: an LLM is being used as a scheduler shim.

The right goal is not to eliminate model use everywhere. The right goal is to separate:

- **script-first deterministic operations**
- **mixed jobs that can be script-led with optional reasoning/summary**
- **genuinely reasoning-native jobs that should remain model-backed**

Recommended path:

1. Build a minimal workspace-local **script-first cron runner layer**
2. Migrate the safest deterministic jobs first
3. Keep model-backed jobs where actual judgment still matters
4. Consider a host-side scheduler bridge later only if the workspace-layer migration proves worthwhile

## Problem Statement

Current limitation:
- In this OpenClaw build, cron payloads are effectively `systemEvent` or `agentTurn`
- There is no native shell/script payload type for cron jobs

Current consequence:
- many deterministic jobs still pay model wakeup cost just to run a Python script
- failure modes are partly model/runtime-driven even when the underlying script itself is fine
- prompt-based command wrappers are fragile compared to direct script execution

## Design Goal

Create a missing execution layer that follows this rule:

> **Script-first unless reasoning is explicitly required.**

This layer should:
- run deterministic jobs directly
- centralize locks / logging / result summaries
- preserve observability
- make future migrations incremental and reversible

## Current Job Classification

### Bucket A — Deterministic, strong candidates for script-first migration

These currently look like LLM-triggered wrappers around existing deterministic scripts/checks.

1. `rss-feed-monitor`
2. `rss-feed-monitor-weekend-light`
3. `reddit-monitor`
4. `reddit-monitor-weekend-light`
5. `auto-signal-dispatcher`
6. `data-manager`
7. `entity-lifecycle-manager`
8. `dependency-update-audit`
9. `weekly-test-suite`
10. `enrichment-ab-review`

Expected value of migration:
- direct token reduction
- fewer prompt-wrapper failures
- clearer execution logs

### Bucket B — Mixed, likely script-led with thin summary or conditional escalation

These have deterministic cores but may still benefit from summary or review logic.

1. `signal-accuracy-review`
   - deterministic when only reporting pending/verified state
   - reasoning-needed only when actual review work is performed
2. `trading-daily-report`
   - likely script-capable if existing script already produces operator-grade output
3. `pre-market-brief`
   - may remain reasoning-backed unless simplified

### Bucket C — Keep model-backed for now

These are genuinely reasoning-heavy or governance-sensitive.

1. `nightly-memory-extraction`
2. `platform-health-council`
3. `nightly-security-review`
4. `self-improvement`
5. `daily-task-generator`

## Recommended Architecture

## Phase 1 target: workspace-local runner layer

Build a small internal execution framework inside the workspace.

Suggested files:
- `scripts/cron_runner.py`
- `scripts/cron_runner_tasks.py` or `scripts/cron_tasks/`
- `memory/cron-run-log.jsonl`
- optional per-task lock files in `memory/locks/` or `/tmp/openclaw/`

### Responsibilities

The runner should provide:
- task registry / routing
- direct script execution
- file lock / overlap prevention
- timeout handling
- exit-code normalization
- structured logging
- small summary output for notification/reporting layers
- optional `reasoning_required` result for mixed jobs

### Task contract

Each task entry should define something like:
- `name`
- `kind` = `script_only | script_plus_summary | reasoning_required`
- `cwd`
- `command`
- `timeout_seconds`
- `lock_name`
- `notify_on` = `never | failure | always | state_change`
- `artifact_paths`

### Standard result shape

Each run should produce a structured result such as:

```json
{
  "task": "rss-feed-monitor",
  "status": "ok|warn|error|skipped",
  "reasoning_required": false,
  "summary": "RSS monitor completed successfully",
  "details_path": null,
  "started_at": "...",
  "finished_at": "...",
  "duration_ms": 1234
}
```

## Migration Strategy

### Wave 1 — lowest-risk, bounded, verification-friendly

Start here:
1. `data-manager`
2. `entity-lifecycle-manager`
3. `dependency-update-audit`
4. `weekly-test-suite`

Why first:
- low market sensitivity
- bounded blast radius
- easy success/failure verification
- good test case for runner quality

### Wave 2 — frequent deterministic ops

Then migrate:
1. `rss-feed-monitor`
2. `rss-feed-monitor-weekend-light`
3. `reddit-monitor`
4. `reddit-monitor-weekend-light`
5. `auto-signal-dispatcher`
6. `enrichment-ab-review`

Why second:
- larger token-saving potential
- frequent runs
- clear script-only behavior

### Wave 3 — mixed jobs with conditional model path

Evaluate and split if worthwhile:
1. `signal-accuracy-review`
2. `trading-daily-report`
3. `pre-market-brief`

Preferred approach:
- deterministic precheck or report generation runs script-first
- if the task requires interpretation/review, escalate intentionally
- avoid paying model cost for no-op / summary-only days

## Implementation Options

### Option B1 — keep OpenClaw cron, minimize prompt work

OpenClaw cron continues to wake on schedule, but calls a single internal runner entry point instead of embedding task-specific instructions in every job.

Example shape:
- cron wakes agentTurn once
- agentTurn runs `python3 scripts/cron_runner.py --task rss-feed-monitor`
- runner executes direct script, logs result, exits

Benefit:
- smaller prompts
- centralized logic
- easy migration path

Limitation:
- still pays some model wakeup cost

### Option B2 — host-side bridge later

Once runner behavior is validated, move some deterministic jobs to host cron/systemd to invoke the runner directly.

Benefit:
- maximum savings
- best execution fidelity

Risk:
- crosses control-plane / host boundary
- needs explicit approval and careful ops handling

## Verification Plan

Each migrated job should be verified in four layers:

1. **Direct command success**
   - task executes correctly via the runner
2. **Artifact/result verification**
   - expected files/logs/results are updated correctly
3. **No-overlap behavior**
   - lock prevents duplicate concurrent execution
4. **Notification behavior**
   - only intended summary/alert behavior occurs

### Success criteria for a migrated job

- runner executes the existing task successfully
- no reduction in operational visibility
- no increase in missed runs or silent failures
- at least equal or better reliability than prompt-based path
- rollback is trivial

## Rollback Plan

Rollback must stay simple for each migration wave:

1. disable or revert only the specific migrated task mapping
2. restore prior cron prompt behavior for that task
3. keep the runner framework in place if other tasks still use it

Do **not** do a big-bang rollback of everything unless the framework itself is fundamentally broken.

## Delegation Plan

Recommended use of sub-agents / agent team:

### Builder / sub-agent tasks
- implement runner scaffold
- add task registry
- add structured logging and lock handling
- migrate one wave at a time

### Reviewer / sub-agent tasks
- verify no accidental control-plane mutations
- verify task semantics are unchanged
- verify logs, exit behavior, and rollback clarity

### Agent-team sweet spot
Use Builder + Reviewer for:
- runner scaffold
- migration of Wave 1
- migration of Wave 2 if Wave 1 succeeds cleanly

## Key Risks

1. **Framework sprawl**
   - mitigation: keep runner narrow and task-registry driven
2. **Silent failure risk**
   - mitigation: structured logs, explicit status codes, per-task verification
3. **Shadow scheduler complexity**
   - mitigation: one runner, clear ownership, no ad hoc duplication
4. **Control-plane bleed**
   - mitigation: keep this planning/implementation inside workspace lane until explicit cron mutation approval

## Recommended Next Steps

1. Write the minimal runner spec
2. Build the runner scaffold in the workspace
3. Pilot Wave 1 on the four safest jobs
4. Measure reliability and operator experience
5. Decide whether Wave 2 should proceed
6. Revisit host-side bridge only after workspace-layer proof

## My Recommendation

Proceed with:
- **workspace-local runner first**
- **Wave 1 deterministic pilot first**
- **agent-team implementation + review for the runner scaffold**

This is the smallest credible path that respects the current platform while actually reducing future token waste and prompt fragility.
