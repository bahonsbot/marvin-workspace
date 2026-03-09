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

---

## Autonomous Task System

### Overview

Two-script system for goal-driven autonomous work:

1. **daily-task-generator.py** (08:00 ICT)
   - Reads goals from `AUTONOMOUS.md`
   - Synthesizes 4-5 actionable tasks with deliverable + success criteria
   - Deduplicates against recent tasks in `memory/tasks-log.md`
   - Updates Open Backlog in `AUTONOMOUS.md`

2. **autonomous-task-executor.py** (09:00 ICT)
   - Reads Open Backlog + In Progress from `AUTONOMOUS.md`
   - Selects highest-value task via scoring heuristic
   - Executes one bounded internal work chunk
   - Logs to `memory/tasks-log.md` (completed) and `memory/executor-log.md`

### Safety Constraints

- **NEVER** performs external/public actions (no Telegram, email, social)
- Only internal workspace actions (file creation, analysis notes)
- Idempotent-ish per run to avoid duplicate spam

### Task Format

Tasks in Open Backlog follow:
```
[category] action; deliverable; scope; success: criterion
```

Example:
```
[Career] Complete a 30-minute practice session on Blender; one new technique demonstration; focusing on modeling; success: has practiced for 30min with output file
```

### Logs

- `memory/tasks-log.md` - Completed tasks (✅ prefix)
- `memory/executor-log.md` - Executor run history
- `AUTONOMOUS.md` - Open Backlog and In Progress sections

---

## Hybrid Skill Assessment

### Overview

A dual-mode assessment system that evaluates skill progression:

1. **Test Mode** (Python, Japanese)
   - Objective checks with predefined test tasks
   - Scoring against dimension-based rubrics
   - Automatic evaluation based on existing artifacts

2. **Challenge Mode** (Blender, After Effects, Unreal)
   - Challenge briefs with constraints and deliverables
   - Heuristic evaluation of completion evidence
   - Artifact-based scoring

### Components

- `scripts/skill-level-check.py` - Assessment runner
  - `--skill <name>`: Assess single skill
  - `--all`: Assess all active skills
- `config/skill-profile.json` - Skill levels and constraints
- `memory/skill-assessments/latest.json` - Latest scores per skill

### Task Generation Integration

The daily-task-generator can optionally bias toward weakest dimensions:
```bash
TASK_ASSESSMENT_BIAS=true python3 scripts/daily-task-generator.py
```

When enabled, task descriptions include focus areas based on lowest-scoring rubric dimensions.
