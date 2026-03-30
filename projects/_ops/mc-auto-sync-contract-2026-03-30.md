# MC Autonomous Sync Contract — 2026-03-30

Status: approved planning contract
Scope: Autonomous board v1 only
Purpose: define storage location, import rules, write-through behavior, and dedup/link matching between Mission Control Autonomous tasks and the current autonomy system

## 1. Goal

Mission Control Autonomous needs a structured workflow store **without** becoming a disconnected second autonomy system.

This contract defines how the new structured Autonomous store coexists with:
- `AUTONOMOUS.md`
- `memory/executor-subagent-queue.json`
- `memory/tasks-log.md`
- current generator/executor flows

---

## 2. Storage decision

## Structured store location
Use a dedicated JSON store inside the Mission Control project:

- `projects/mission-control/data/autonomous-tasks.json`

## Why here
This is the right v1 location because:
- it is clearly Mission Control-owned
- it avoids pretending the markdown file is the only workflow backend
- it stays close to the Tasks page implementation
- it is easy to version, inspect, and migrate later

## v1 store envelope
The file should store:
- `tasks: MCAutoTask[]`
- `meta.schemaVersion`
- `meta.updatedAt`

Do not add a giant board-config layer yet.

---

## 3. Source-of-truth posture

## UI workflow truth
For Autonomous board UI behavior, the structured store is the **workflow truth**.

That means these state transitions happen there first:
- execute
- in-progress
- review
- approve
- reject
- run metadata
- feedback
- artifact references

## Legacy compatibility truth
The current autonomy system remains the compatibility layer for:
- generator output
- executor input
- later autonomous pickup if manual task is not run immediately

That means these legacy files remain operationally relevant:
- `AUTONOMOUS.md`
- `memory/executor-subagent-queue.json`
- `memory/tasks-log.md`

## Meaning
Structured store = Mission Control workflow truth
Legacy files = existing-system sync targets / compatibility truth

---

## 4. Read model

When Mission Control loads the Autonomous board, it should not blindly trust just one source.

### Board assembly rule
Board view should be assembled from:
1. structured Autonomous store
2. importable/generated items still visible in `AUTONOMOUS.md`
3. queue/task-log hints where needed for linkage or stale-state repair

### v1 practical interpretation
In v1, the safest path is:
- load structured store first
- import/link missing legacy tasks from `AUTONOMOUS.md`
- then render the board from the structured store model

This avoids the UI being a thin markdown parser forever.

---

## 5. Import rules from `AUTONOMOUS.md`

## Eligible sections
Import only from these sections:
- `## Open Backlog` → `backlog`
- `## In Progress` → `in-progress`
- `## Needs Input` → not first-class board column in v1; treat as linked metadata or exclude from visible board for now
- `## Done` / `## Done Today` → `done` only when linked tasks are missing from store and visibility is actually needed

## v1 recommendation
Primary import scope:
- `Open Backlog`
- `In Progress`

Optional import if useful later:
- `Done Today`

Do not overcomplicate the first import path.

## Import behavior
For each eligible legacy task line:
1. normalize task text
2. attempt to match existing structured task via `linkedAutonomyRef`
3. if match exists, update linkage/state if needed
4. if no match exists, create structured task with:
   - `sourceType = 'generated'`
   - `editable = true`
   - inferred status from section
   - default `agentTarget = 'marvin'`
   - attached `linkedAutonomyRef`

---

## 6. Manual task write-through

When operator manually creates an Autonomous task in Mission Control:

### Required behavior
1. create structured task in `autonomous-tasks.json`
2. immediately append/write corresponding task into `AUTONOMOUS.md`
3. attach `linkedAutonomyRef`
4. default status = `todo` in the structured model
5. map to legacy markdown section = `Open Backlog`

## Why `Open Backlog`
Because current executor still consumes `Open Backlog`, and Philippe wants manually added tasks to remain eligible for later autonomous execution if not manually executed now.

## Write-through rule
Manual write-through should happen during creation, not lazily later.

---

## 7. Dedup / link matching rules

Because `AUTONOMOUS.md` has no stable task IDs, v1 matching must be text-based.

## Normalization rule
Define a single normalization helper for legacy task matching:
- trim outer whitespace
- collapse repeated whitespace to single spaces
- compare case-insensitively
- preserve meaningful punctuation in stored display text

### Suggested normalized key
```ts
normalize(taskText) => taskText.trim().replace(/\s+/g, ' ').toLowerCase()
```

## v1 task linkage key
Use this tuple for matching:
- `sourceFile`
- `section`
- `taskTextNormalized`

## Dedup policy
A legacy task should not create a new structured task if an existing structured task already has:
- matching `linkedAutonomyRef.sourceFile`
- matching `linkedAutonomyRef.section`
- matching `linkedAutonomyRef.taskTextNormalized`

## Important note
This is good enough for v1, but not perfect.

If the same task text appears twice in the same section, ambiguity can happen.
That is acceptable for v1 as long as we document it and avoid pretending otherwise.

---

## 8. Section/status mapping

Use this mapping in v1:

| Legacy source | Structured status |
|---|---|
| `Open Backlog` | `backlog` |
| `In Progress` | `in-progress` |
| `Done` | `done` |
| `Done Today` | `done` |

## Special case: manual task default
Manual Mission Control-created tasks start as:
- structured status: `todo`
- legacy section: `Open Backlog`

This mismatch is intentional and acceptable.

### Why acceptable
Because:
- `todo` is the right richer UI state for operator-managed work
- `Open Backlog` is the closest compatible executor intake lane in the current legacy system

This should be treated as a compatibility mapping, not a conceptual contradiction.

---

## 9. Queue linkage

The structured task store should not treat queue entries as primary truth.

However, tasks may record queue linkage metadata when relevant.

## Queue-linked fields
Inside `linkedAutonomyRef`, allow:
- `queueLinked`
- `queueLabel`

## v1 usage
Use queue linkage only when a task is actually represented in `memory/executor-subagent-queue.json`.

Do not require queue linkage for manually executed direct-spawn tasks.

---

## 10. Completion linkage

## `tasks-log.md`
This remains the durable completion log.

The structured Autonomous task may record completion hints from it, but should not parse it as the primary live board backend.

## v1 rule
Use `tasks-log.md` for:
- completion observability
- legacy sync validation
- optional `completedInTasksLog` / `completedOutputPath` metadata

Do not use it as the source of current board state.

---

## 11. Approve sync rule

When operator clicks **Approve** on a linked task:
1. structured task moves `review` → `done`
2. linked legacy autonomy item is marked complete in the legacy layer
3. task completion remains visible in structured store
4. tasks-log durability remains intact

## Important meaning
Legacy/autonomy completion should happen on **Approve**, not merely on worker success.

This preserves the review model Philippe explicitly wants.

---

## 12. Reject sync rule

When operator clicks **Reject**:
1. structured task moves `review` → `todo`
2. feedback is appended
3. legacy task should remain active / not-completed
4. no auto-rerun

Reject is a UI/workflow state correction, not a legacy completion event.

---

## 13. Generator coexistence contract

The current generator still writes bounded suggestions into `AUTONOMOUS.md`.

## v1 coexistence rule
Generated tasks should continue to originate from the existing generator.
Mission Control should import/link them into the structured store instead of trying to replace the generator immediately.

## Required guardrails
- generator suggestions remain bounded
- imported generated tasks must dedup against already-linked structured tasks
- manual tasks must not be deleted or hidden by generator refreshes
- structured store must preserve `sourceType`

## Meaning
Generator remains the source of new generated work.
Mission Control becomes the richer workflow layer around it.

---

## 14. Sync direction summary

### Legacy → Structured
Used for:
- generated task import
- bootstrap/hydration
- recovering visible board state from existing autonomy system

### Structured → Legacy
Used for:
- manual task creation write-through
- approval-time completion sync
- any explicit state changes that must remain autonomy-compatible

### Not bidirectional magic
Do not try to make every single field fully round-trip in v1.

Only sync what matters operationally:
- presence
- active/completed state
- linkability

---

## 15. Failure / recovery posture

If structured store and legacy layer disagree:
- do not silently delete either side
- surface recoverable mismatch state
- prefer preserving structured task state while keeping linkage visible

## v1 recovery rule
If linked legacy task disappears unexpectedly:
- keep structured task
- mark it as missing legacy link on next sync pass
- allow operator review rather than destructive auto-healing

---

## 16. Minimal implementation API expectations

A new Mission Control autonomous task service should support at least:

- `loadStructuredTasks()`
- `saveStructuredTasks()`
- `importLegacyAutonomousTasks()`
- `createManualAutonomousTask()`
- `markLinkedLegacyTaskComplete()`
- `syncAutonomousTaskLinks()`
- `normalizeLegacyTaskText()`

These can evolve later, but this is the practical minimum for v1.

---

## 17. Recommended implementation sequence

1. create `autonomous-tasks.json` store loader/saver
2. implement legacy text normalization helper
3. implement import from `AUTONOMOUS.md`
4. implement manual create write-through
5. implement dedup/link matching
6. then wire the UI/workflow actions on top

This keeps the sync model stable before UI complexity is added.

---

## 18. Bottom line

The correct v1 posture is:
- structured store for Mission Control workflow behavior
- explicit, limited sync with current autonomy files
- bounded generated suggestions preserved
- manual tasks written through immediately
- approval as the moment linked legacy completion is recorded

That gives Mission Control a Nerve-style workflow without pretending the legacy autonomy system has already been replaced.
