# Job Placement Decision Table

Use this runbook when deciding where a new recurring task should run.

## The Three Lanes

| Lane | Best for | Runtime | Typical trigger |
|---|---|---|---|
| Deterministic scheduler | Script-only work with no LLM reasoning | Host-side deterministic scheduler | Host scheduler / runner task |
| OpenClaw cron | Reasoning-backed analysis, review, synthesis, summarization, or judgment | Isolated `agentTurn` session | OpenClaw cron job |
| Main-session autonomy trigger | Bounded proactive workspace work governed by `AUTONOMY.md` | Main session | Cron wakeup + `autonomy_gate.py` |

## Fast Decision Table

| Question | If yes | If no |
|---|---|---|
| Can the job be done reliably without an LLM? | Prefer deterministic scheduler | Continue |
| Does the job require reasoning, judgment, synthesis, or writing quality? | Prefer OpenClaw cron | Continue |
| Is the task really “do one bounded proactive action” rather than “run a fixed recurring job”? | Prefer main-session autonomy trigger | Continue |
| Is the task security-sensitive, restart-affecting, routing-affecting, or otherwise control-plane significant? | Design/propose first, then get approval before changing runtime behavior | Continue with the appropriate lane |

## Lane Definitions

### 1) Deterministic Scheduler
Choose this when the job is:
- script-first
- repeatable
- low-variance
- not dependent on model judgment
- best served by low overhead and predictable execution

Typical examples:
- cleanup
- file rotation
- feed polling
- watchdogs
- ETL / transforms
- report generation from deterministic scripts
- health/status snapshots

Do **not** put a job here if success depends on nuanced interpretation or model-quality writing.

### 2) OpenClaw Cron
Choose this when the job needs:
- review or triage
- summarization
- reasoning over multiple signals
- judgment calls
- writing/operator-ready reporting
- classification where model quality matters

Typical examples:
- `nightly-memory-extraction`
- `nightly-security-review`
- `self-improvement`
- `platform-health-council`
- model-backed signal interpretation

Do **not** use this lane for pure script work just because it is easier to write a prompt than a script.

### 3) Main-Session Autonomy Trigger
Choose this when the task is governed proactive execution rather than a fixed recurring report.

Typical examples:
- process exactly one queued delegated task
- execute exactly one backlog item if allowed
- run one bounded workspace home-improvement pass

This lane should:
- wake the main session
- pass through `autonomy_gate.py`
- execute at most one bounded chunk
- follow `AUTONOMY.md`

## Anti-Patterns

Avoid these placements:

| Anti-pattern | Why it is wrong | Better lane |
|---|---|---|
| Pure cleanup job on OpenClaw cron | Wastes model/runtime overhead | Deterministic scheduler |
| Judgment-heavy review on deterministic scheduler | Script cannot reliably make the call | OpenClaw cron |
| Broad unbounded autonomous work via wakeup | Breaks bounded-governance rules | Main-session autonomy trigger with one-chunk limit |
| Control-plane mutation hidden inside autonomy | High-risk behavior should be approval-gated | Propose first |

## Approval Rule
Even when the lane choice is clear, these still need approval before mutation:
- new cron jobs
- removal of existing cron jobs
- meaningful cron behavior changes
- host/VPS behavior changes
- restart-affecting changes
- routing/model changes that materially affect runtime behavior

## Quick Heuristic
Use this order:
1. **script-only?** → deterministic scheduler
2. **needs model judgment?** → OpenClaw cron
3. **one bounded proactive action?** → main-session autonomy trigger
4. **high-impact control-plane change?** → propose first

## Related References
- `TOOLS.md` — operational notes + current scheduler split
- `AGENTS.md` — governance lanes and approval rules
- `AUTONOMY.md` — proactive execution policy
- `docs/runbooks/deterministic-scheduler-host-service.md` — deterministic scheduler runtime details
- `docs/runbooks/webhook-receiver-host-service.md` — webhook receiver host service runtime details
