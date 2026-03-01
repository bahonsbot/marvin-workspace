# Proactive Execution Runbook

## Purpose

Enable autonomous progress on open projects without replacing existing memory/framework conventions.

## Architecture

- Strategy memory: `MEMORY.md`
- Daily execution log: `memory/YYYY-MM-DD.md`
- Project backlog: `projects/*/TASKS.md`
- Optional queue: `memory/proactive-queue.json`
- Behavior rules: `skills/proactive-execution/SKILL.md`

## Recommended Task File Format (`TASKS.md`)

```markdown
# TASKS

## Todo
- [ ] P1 Short task title (owner: Marvin, est: 20m)
- [ ] P2 Another task (depends: X)

## In Progress
- [ ] Current task title

## Blocked
- [ ] Task title — blocked by: decision/access/info

## Done
- [x] Completed task title (date)
```

## Heartbeat Integration (manual)

During heartbeat checks:
1. Run proactive task selection.
2. Execute one short chunk.
3. Log outcome.
4. Only message user for milestone/blocker.

## Message Style

Use concise two-part updates:
- completion summary
- next action or blocker question

## Escalation Rules

Escalate when:
- decision required
- access missing
- risk of incorrect direction

Include recommendation, not just problem.

## Change Management

- Non-trivial automation/process changes require approval first.
- Commit all workspace changes with clear messages.
- Keep noise low, impact high.
