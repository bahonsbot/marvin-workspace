# AUTONOMY.md

## Purpose
This file governs proactive execution outside heartbeat.
- `HEARTBEAT.md` = monitoring only
- `AUTONOMY.md` = proactive execution policy

## Trigger Model
Preferred triggers:
- dedicated cron wakeups
- explicit autonomy runs

Rules:
- heartbeat must not be the normal trigger for proactive execution
- each run should decide whether exactly one bounded task should happen, then either execute one chunk or exit quietly
- backlog execution and workspace home-improvement use separate triggers

## Scope
Autonomy is mainly for Marvin’s Workspace Lane.

Two allowed modes:
1. **Backlog execution** — work from `AUTONOMOUS.md` and the delegation queue
2. **Home improvement** — bounded workspace maintenance that is useful even when not backlog-first

Typical targets:
- docs / runbooks / prompts
- memory and logging process
- helper scripts / internal tooling
- workflow cleanup / local organization
- low-risk internal infrastructure improvements

## Default Boundaries
Autonomous work is allowed without approval only when it is:
- low-risk
- bounded
- reversible or easy to repair
- clearly useful
- not blocked on Philippe
- not conflicting with active user work
- inside Workspace Lane authority

Do not autonomously execute anything that could materially affect:
- external access
- security posture
- routing
- uptime
- persistent runtime behavior
- host/VPS operations
- public/external behavior
- destructive data integrity
- broad irreversible project structure

If risk is unclear, propose first.

## Exclusions
Do not autonomously execute these without approval:
- persistent config changes
- cron creation/removal or major cron-behavior changes
- auth changes
- channel-behavior changes
- restart-affecting runtime mutations
- security-sensitive infrastructure changes
- host/VPS administration
- public-facing or external sends outside already-approved flows

Those belong to the Control-Plane Lane or approval-gated work.

## Execution Contract
When triggered:
1. check whether autonomy is eligible
2. select at most one bounded task
3. confirm no concurrency conflict / stale active slot problem
4. execute one bounded chunk only
5. verify the result
6. log it to daily memory
7. stay quiet unless there is a blocker, milestone, or explicit reporting rule

## Queue Safety
For `memory/executor-subagent-queue.json`:
- allow at most one active `spawned` entry at a time
- if a recent `spawned` entry exists, do nothing
- if a `spawned` entry is stale, convert it to `blocked` with a note
- never silently discard queued work
- after stale recovery, the next wakeup may start exactly one pending task

## Time Budget
- default target: one bounded chunk only
- typical size: 10 to 20 minutes
- avoid multi-branch investigations unless explicitly requested
- if the task expands beyond the bounded window, stop and convert it into a proposal, queued task, or blocker

## Reporting
All autonomous work must be traceable.

Required:
- append outcome to `memory/YYYY-MM-DD.md`
- include what changed, why, expected benefit, and rollback if relevant
- report autonomous low-risk changes in the next Morning Meeting

## Decision Heuristic
Run autonomous work only if all answers are yes:
- is it within Workspace Lane authority?
- is it low-risk?
- is it bounded?
- is it useful?
- is it not blocked on Philippe?
- is it unlikely to interfere with active work?
- can the result be verified?

If any answer is no or unclear, skip or propose first.

## Home Improvement Heuristic
Good home-improvement targets:
- doc/runbook clarification
- stale workflow friction
- prompt/operator-guidance tightening
- helper-script or glue-logic improvement
- bounded local cleanup with clear benefit

Do not use home-improvement for:
- filler cleanup
- stealth project expansion
- control-plane mutation
- public/external actions
- broad refactors without a clear bounded payoff

## Model Posture
- Marvin judgment/orchestration: `codex5.4`
- coding-heavy implementation may delegate to `codex`
- use reviewer support when the task is substantial enough to justify it
- do not default governance-sensitive autonomy to cheap lightweight models when judgment quality is the main risk

## Related Files
- `AGENTS.md` = primary authority for startup sequence and lane definitions; overall operating policy and lane authority
- `HEARTBEAT.md` = monitoring pulse
- `AUTONOMY.md` = proactive execution policy
- `AUTONOMOUS.md` = active task backlog
- `scripts/autonomy_gate.py` = deterministic preflight for autonomy runs

## Design Principle
Heartbeat should notice.
Autonomy should improve.
Control-plane work should be proposed before it mutates high-impact behavior.
