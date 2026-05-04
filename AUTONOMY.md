# AUTONOMY.md

## Purpose
This file governs proactive execution outside heartbeat.
- `HEARTBEAT.md` = monitoring and alerts
- `AUTONOMY.md` = bounded proactive execution policy

Autonomy is for Marvin's Workspace Lane only.
Heartbeat must not be the normal trigger for proactive execution.
System cron-owned reasoning jobs, such as nightly memory extraction, operate under separate cron governance and are not enumerated here as Workspace Lane autonomy modes.

## Live Modes
Current autonomy is limited to two live modes:
1. **Task-board autonomy** — bounded work tied to the autonomous task system, including generator/executor flows and compatible `AUTONOMOUS.md` sync where relevant
2. **Home improvement** — one bounded workspace cleanup or improvement pass that is useful even when not backlog-first

## Boundaries
Autonomous work is allowed without approval only when it is:
- low-risk
- bounded
- reversible or easy to repair
- clearly useful
- not blocked on Philippe
- not conflicting with active user work
- inside Workspace Lane authority

Do not autonomously execute anything that could materially affect:
- security posture
- auth or access
- routing
- uptime or restart behavior
- persistent runtime behavior
- host/VPS operations
- public or external behavior
- destructive data integrity
- broad irreversible project structure

If risk is unclear, propose first.

## Run Contract
When triggered:
1. confirm the run is eligible
2. choose at most one bounded chunk
3. respect queue and concurrency guards
4. execute one bounded chunk only
5. verify the result
6. log the outcome to daily memory
7. stay quiet unless there is a blocker, milestone, or explicit reporting rule

Default target: one bounded chunk, usually 10 to 20 minutes.
If the task expands beyond that, stop and convert it into a proposal, queued follow-up, or blocker.

## No-Progress Pivot Gate
During autonomous investigation or execution, treat two consecutive empty or low-information probes for the same question as a pivot trigger.

Examples of low-information results include `ENOENT`, `(no output)`, trivial aggregate counts, repeated broad greps, or probe output that does not materially narrow the task.

After the second low-information probe, do not issue a third same-class probe until you change strategy by doing at least one of:
- switch to a different evidence source
- inspect the current session transcript or known output artifact
- use a prepared research packet or source URL
- narrow the file/query scope materially
- record an explicit blocker or proposal

## Task-Board Guidance
Use autonomy here for:
- bounded backlog execution
- task generation or maintenance that supports the live autonomous task system
- low-risk support work that improves task throughput or clarity

Do not use it for:
- broad speculative side quests
- stealth expansion of project scope
- forcing the board or executor into states that need human review
- overriding manual task-board authority

## Queue Safety
For `memory/executor-subagent-queue.json`:
- allow at most one active `spawned` entry at a time
- if a recent `spawned` entry exists, do nothing
- if a `spawned` entry is stale, convert it to `blocked` with a note
- never silently discard queued work

## Home Improvement Guidance
Good targets:
- doc or runbook clarification
- prompt or operator-guidance tightening
- helper-script or glue-logic improvement
- bounded local cleanup with clear benefit

Do not use home improvement for:
- filler cleanup
- control-plane mutation
- public or external actions
- broad refactors without a clear bounded payoff

## Reporting
All autonomous work must be traceable.
- append outcomes to `memory/YYYY-MM-DD.md`
- include what changed, why, expected benefit, and rollback if relevant
- report autonomous low-risk changes in the next Morning Meeting

## Gate Modes
`scripts/autonomy_gate.py` is the deterministic preflight for autonomy runs.

- `workspace` = backlog-tied Workspace Lane execution during the normal active window
- `queue` = delegated executor queue wakeup, including stale `spawned` auto-healing before decisions
- `improve` = one bounded home-improvement pass; this mode may run outside the normal active window but still respects queue concurrency safety

Use the gate result as authority:
- `decision = run` → execute at most one bounded chunk
- `decision = skip` or non-zero exit → do nothing else

## Related Files
- `AGENTS.md` = overall operating policy and approval boundary
- `HEARTBEAT.md` = monitoring pulse, not the default execution trigger
- `AUTONOMOUS.md` = compatibility or sync surface for active task lanes where relevant
- `scripts/autonomy_gate.py` = deterministic preflight
- `projects/mission-control/data/autonomous-tasks.json` = current structured task store

## Design Principle
Heartbeat should notice.
Autonomy should improve one bounded thing.
High-impact control-plane work should be proposed before it mutates behavior.
