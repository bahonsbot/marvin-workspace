# Proactive Execution Workflow

## 1) Task Selection

Pick exactly one task that is:
- actionable now
- bounded to one short work chunk (10-20 min)
- highest practical priority

Skip tasks that are ambiguous, blocked, or require external approvals.

## 2) Pre-Flight Check

Before acting:
- Confirm no policy conflict
- Confirm no destructive/public side effect
- Confirm required files/paths exist

If uncertain, ask user first.

## 3) Focused Execution Chunk

Do one smallest useful slice:
- implement one fix
- draft one section
- run one diagnostic
- clean one well-scoped issue

Avoid scope creep.

## 4) Verify Before Marking Done

Never claim completion without verification.
Examples:
- code changed -> run targeted check/test
- docs updated -> confirm paths/commands are valid
- config edit -> validate syntax and expected behavior

## 5) Update State

Update one or more of:
- `projects/<project>/TASKS.md`
- `memory/proactive-queue.json`
- today's `memory/YYYY-MM-DD.md`

Use a compact record:
- task
- action
- result
- next step
- blocker (if any)

## 6) Notify or Stay Quiet

Notify user only for:
- milestone complete
- blocker requiring decision
- significant risk/opportunity

Otherwise, stay quiet and continue next heartbeat.

## 7) Weekly Self-Optimization Review

Scan last 7 days:
- memory notes
- recent commits
- recurring failures/friction

Produce exactly 3 proposals:
1. reliability improvement
2. speed/efficiency improvement
3. quality/communication improvement

For each include:
- expected upside
- risk
- rollback

Do not auto-apply non-trivial changes without approval.
