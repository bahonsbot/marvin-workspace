# Mission Control Autonomous Hybrid Board v1 — Phase 0 Truth Audit

Date: 2026-03-30
Status: completed audit
Scope: current Autonomous board truth, cap logic, generator path, executor path, sync implications

## 1. Audit Goal

Identify the current truth sources and control points that affect the Mission Control Autonomous board before implementing the Autonomous Hybrid Board v1.

This audit focuses on:
- current board truth
- suggestion/cap logic
- executor assumptions
- queue linkage
- Mission Control adapter behavior
- hybrid-model integration risks

---

## 2. Current Truth Sources

## 2.1 Primary user-facing autonomous truth today

The current autonomous workflow is primarily driven by:
- `AUTONOMOUS.md`
- especially:
  - `## Open Backlog`
  - `## In Progress`
  - `## Needs Input`
  - `## Done` / `## Done Today` where relevant

This file is currently the main planning/state document for proactive autonomous work.

## 2.2 Queue truth

Delegated execution queue state lives in:
- `memory/executor-subagent-queue.json`

This file tracks:
- queued delegated tasks
- spawned task state
- completed/blocked queue entries
- execution mode (`subagent` vs `agent_team`)
- output paths and notes

Important: queue truth is **not** the same thing as board truth.

## 2.3 Completion truth

Completed work history is appended to:
- `memory/tasks-log.md`

This is a durable completion log, not a live kanban state store.

## 2.4 Mission Control Tasks UI truth today

Mission Control currently reads Tasks data through its own adapter layer:
- `projects/mission-control/lib/adapters/tasks.ts`
- `projects/mission-control/app/api/tasks/board/route.ts`
- `projects/mission-control/app/api/tasks/sync-status/route.ts`

Current board architecture is already split by board type:
- Personal = manual board
- Projects = manual board
- Autonomous = adapted from existing autonomous sources

This supports the planned direction: Autonomous can evolve differently without forcing the same semantics onto the other boards.

---

## 3. Current Cap / Suggestion Logic

## 3.1 Old effective cap found

The current task generator still enforces a top-up target of **5 tasks**:
- `scripts/daily-task-generator.py`
- `NUM_TASKS = 5`

This is the old practical cap behavior.

## 3.2 How the cap currently works

The generator:
- preserves existing visible work first
- reads current Open Backlog tasks from `AUTONOMOUS.md`
- optionally includes active suggestion tasks from `memory/task-suggestions.json`
- only tops back up until `NUM_TASKS`

Key logic in `update_autonomous_file()`:
- preserve current backlog items
- then add fresh generated tasks until total reaches `NUM_TASKS`
- do not silently shrink backlog if it already exceeds the target

So the current system is not a hard board cap in every context, but it *does* still use a generator-driven target count of 5.

## 3.3 Important implication

The old problem Philippe described is real and traceable:
- multiple suggested tasks can exist
- but executor usually processes only one task per run
- the system was designed around a bounded suggestion pool, not a richer multi-stage executable workflow board

## 3.4 Conclusion on cap posture

For Autonomous Hybrid Board v1:
- remove the old overall board-cap assumption
- keep **generator intake bounded**
- do not allow generator spam or duplicate suggestions

This matches Philippe’s updated decision.

---

## 4. Current Generator Path

## 4.1 Generator source

The daily generator is:
- `scripts/daily-task-generator.py`

## 4.2 Generator inputs

It reads from:
- `AUTONOMOUS.md` Goals section
- `memory/tasks-log.md`
- `memory/task-suggestions.json`
- `config/skill-profile.json`
- optional skill assessment files

## 4.3 Generator output behavior

It writes new/generated tasks into:
- `AUTONOMOUS.md` → `## Open Backlog`

It may also sync/publish to:
- `projects/autonomous-kanban/public/board.json`

This is a legacy/simple kanban snapshot path, not a full Nerve-style workflow backend.

## 4.4 Generator design assumption today

The generator assumes:
- Open Backlog is the visible intake lane
- bounded suggestion volume is desirable
- preserving visible backlog matters more than replacing it wholesale

This is compatible with the new hybrid plan, but only if generated suggestions remain a bounded subset rather than the entire board truth.

---

## 5. Current Executor Path

## 5.1 Main executor

The proactive executor is:
- `scripts/autonomous-task-executor.py`

## 5.2 Executor inputs

It reads:
- `AUTONOMOUS.md`
- specifically `Open Backlog` and `In Progress`

## 5.3 Executor selection model today

The executor:
- selects exactly one eligible task per run
- prefers oldest eligible task by default unless narrow override conditions apply
- can prune already-satisfied tasks
- can queue delegated work
- can move items among:
  - Open Backlog
  - In Progress
  - Needs Input
  - Done Today / Done-style sections via sync logic

## 5.4 Delegation linkage

For subagent/agent-team work, executor writes queue entries into:
- `memory/executor-subagent-queue.json`

This means the queue is already a viable execution side-channel, but not the only autonomous truth.

## 5.5 Important executor assumption

Current executor behavior is strongly coupled to markdown sections in `AUTONOMOUS.md`.

That means a future structured Autonomous board cannot simply ignore `AUTONOMOUS.md` yet unless the executor is redesigned too.

This validates the hybrid-model recommendation.

---

## 6. Mission Control Tasks Page Reality Today

## 6.1 Board split already exists conceptually

Mission Control already treats boards differently.
This is good news.

The current page architecture does **not** require Personal/Projects/Autonomous to share one identical backend model.

## 6.2 Autonomous is not yet a true workflow board

Current Autonomous board behavior is still closer to:
- adapted backlog/status view
- limited execution-facing semantics
- not a full run/review state machine

So the Nerve-inspired workflow would be a genuine capability upgrade, not a small UI tweak.

---

## 7. Key Integration Constraints

## 7.1 Constraint: avoid split-brain truth

If a new structured Autonomous task store is introduced without linkage, we will have:
- Mission Control board truth
- `AUTONOMOUS.md` truth
- queue truth
- tasks-log truth

That would drift quickly.

### Required mitigation
Each Autonomous task in the new model must support explicit linkage to the existing autonomy layer.

## 7.2 Constraint: manual tasks must remain autonomy-eligible

Philippe explicitly wants manual Autonomous tasks to also write into the current autonomy files immediately.

This is required so:
- manual tasks can still be executed later by autonomous triggers if not manually executed now

## 7.3 Constraint: generated suggestions must remain bounded

Removing the old board cap must **not** mean unlimited generator growth.

Bound the generator, not the whole board.

## 7.4 Constraint: approval semantics matter

Philippe wants approval to be the meaningful completion moment.

Therefore:
- run completion alone is not enough
- linked autonomy task should be marked complete on Approve, not merely when worker finishes

---

## 8. What Can Be Reused From Nerve Safely

These Nerve concepts can be borrowed directly or near-directly:
- five-stage Autonomous workflow
- task detail drawer semantics
- run metadata attached to task
- Execute → In Progress
- success → Review
- Approve → Done
- Reject → To Do with feedback

These should be reused rather than reinvented.

---

## 9. What Must Be Adapted For Mission Control

These parts cannot be copied naively from Nerve:

### 9.1 Persistence model
Nerve’s standalone kanban store cannot replace current Marvin autonomy truth by itself.

### 9.2 Completion semantics
Mission Control must preserve:
- existing autonomy linkage
- tasks-log durability
- queue integration
- approval-based completion semantics

### 9.3 Generator coexistence
Generated tasks and manual tasks must coexist on the same Autonomous board without duplication or suggestion floods.

---

## 10. Recommended v1 Truth Posture

## Recommendation
Use a new structured Mission Control Autonomous task model/store as the workflow truth **for the UI**, while preserving explicit sync linkage into the current autonomy system.

In practical terms:
- Mission Control Autonomous board = structured workflow layer
- `AUTONOMOUS.md` = existing autonomy compatibility layer
- queue = execution/delegation state channel
- `tasks-log.md` = durable completion log

This is the cleanest version of Option C.

---

## 11. Immediate Implementation Consequences

Before coding the workflow UI, implementation needs to define:
- where the new structured Autonomous store lives
- what the task-link reference into current autonomy files looks like
- how manual task creation writes into existing autonomy files
- how generated tasks are imported into the new board model without duplication
- how Approve marks linked legacy/autonomy state complete

---

## 12. Audit Summary

### Confirmed findings
- current practical generator target count is **5**, via `daily-task-generator.py`
- current autonomous execution still depends on `AUTONOMOUS.md` markdown sections
- delegated execution queue is already real and separate in `memory/executor-subagent-queue.json`
- completion truth already exists in `memory/tasks-log.md`
- Mission Control board architecture already supports board-specific behavior differences
- old board-cap posture should be replaced with **bounded generated suggestions**, not a hard whole-board cap

### Main risk
The main implementation risk is not UI complexity. It is truth drift between:
- new structured board state
- legacy autonomy markdown state
- queue state
- completion log state

### Main implementation requirement
Every Autonomous task in the new workflow must have explicit provenance and explicit linkage back to the current autonomy system.

---

## 13. Recommended Next Step

Proceed to implementation planning with this order:
1. define structured Autonomous task schema
2. define linked legacy/autonomy reference shape
3. define generated-task import rules
4. define manual-task write-through behavior
5. only then build the Nerve-style Execute / Review UI flow

This prevents Mission Control from accidentally becoming a second, disconnected autonomous system.
