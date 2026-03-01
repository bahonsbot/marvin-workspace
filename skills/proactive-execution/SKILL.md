---
name: proactive-execution
description: Proactive project execution loop that works from existing workspace task backlogs during heartbeats, logs progress to current memory files, escalates blockers for human input, and runs periodic self-optimization reviews. Use when the user wants autonomous progress on open projects without replacing existing memory/task systems.
---

# Proactive Execution

Use this skill to make steady progress between prompts while staying compatible with this workspace's existing memory and heartbeat setup.

## Core Rules

1. Do not replace existing systems (MEMORY.md, daily notes, HEARTBEAT.md, project docs).
2. Work in small, safe increments (10-20 minutes per cycle).
3. Report only meaningful updates (milestone, blocker, decision needed).
4. Ask before destructive changes or external/public actions.

## Sources of Work

Use these in order:
1. `memory/proactive-queue.json` (if present)
2. `projects/*/TASKS.md` (project backlogs)
3. Open items explicitly listed in latest daily memory note

If sources conflict, prefer explicit user direction, then queue priority, then project deadlines.

## Heartbeat Loop

Follow detailed procedure in `references/workflow.md`.

Short version:
1. Select one eligible task.
2. Decide execution mode:
   - Discovery-only checks can run directly.
   - Execution, investigation, coding, or multi-step work must use sub-agents per `SUBAGENT-POLICY.md`.
3. Announce every sub-agent spawn to the user (mandatory).
4. Verify result.
5. Log concise outcome.
6. Decide: continue later, mark blocked, or mark complete.

## Logging

- Append execution notes to today's `memory/YYYY-MM-DD.md`.
- Keep durable patterns/decisions in `MEMORY.md`.
- Keep task-level state in project `TASKS.md` or `memory/proactive-queue.json`.

## Blocker Escalation

Escalate only when required input is needed:
- Missing requirement or priority conflict
- Credentials/access missing
- Tradeoff requires human decision

Escalation format:
- What is blocked
- Why
- Two suggested options
- Recommended option

## Self-Optimization Cadence

Once per week:
1. Review last 7 days of memory notes + recent commits.
2. Identify 3 improvements (reliability, speed, quality).
3. Propose changes with risk + rollback.
4. Wait for approval before applying non-trivial changes.

## Output Discipline

Default silence during routine execution.
Message user when:
- Meaningful milestone completed
- Blocked and need decision
- Important risk discovered

Proactive Telegram routing:
- Send proactive updates to Telegram group `-1003742262384` (`proactive-execution`) when cross-channel messaging is needed.
- Keep update format concise: completion summary + next action/blocker.

Do not spam incremental percentages.
