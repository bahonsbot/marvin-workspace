# Tasks Truth Flow Map — 2026-04-12

## Purpose
Map the active Tasks board truth flow in Mission Control after the rollback, so future work can distinguish:
- current-state authority
- legacy mirror/reconciliation
- historical completion log
- UI/API read paths

## Short version
The Tasks UI is built on a **structured JSON store**.
`AUTONOMOUS.md` is still active, but acts as a **legacy mirror / import / reconciliation surface**, not the ideal primary authority.
`memory/tasks-log.md` is a **historical append-only completion log**, not a live board lane.

## Source-of-truth layers

### 1. Structured current-state authority
File:
- `projects/mission-control/data/autonomous-tasks.json`

Loader:
- `projects/mission-control/lib/autonomous.ts`
- `loadStructuredTasks()`

Behavior:
- reads the JSON store
- normalizes tasks into `MCAutoTaskStore`
- persists via `saveStructuredTasks()`
- contains task status, version, run state, artifacts, feedback, and suppressed legacy delete keys

This is the most important current-state layer.

### 2. Legacy markdown mirror / import surface
File:
- `AUTONOMOUS.md`

Reader/parser:
- `readAutonomousMarkdown()`
- `parseLegacyAutonomousTasks()`

Behavior:
- parses legacy sections like:
  - `## Open Backlog`
  - `## In Progress`
  - `## Needs Input`
  - `## Review`
  - `## Done`
  - `## Done Today`
- still used for import, reconciliation, and linked legacy task movement

Important nuance:
- `AUTONOMOUS.md` is not dead
- but it should not be treated casually as the only board truth

### 3. Historical completion log
File:
- `memory/tasks-log.md`

Behavior:
- append-only history via `appendCompletionToTasksLog()`
- completion evidence / audit trail
- not a current board lane

The adapter explicitly avoids treating a high historical completion count as active sync drift.

## API read path

### Board API
Route:
- `projects/mission-control/app/api/tasks/board/route.ts`

Calls:
- `getTaskBoard()` from `lib/adapters/tasks.ts`

`getTaskBoard()`:
- calls `loadTaskSources()`
- reads structured store, AUTONOMOUS markdown, and tasks-log metadata
- converts structured tasks into board columns
- returns the 5-lane board:
  - backlog
  - todo
  - inprogress
  - review
  - done

Meaning:
- the visible Tasks board is primarily rendered from the structured store
- AUTONOMOUS counts/context are used for comparison and source context, not as a raw direct render of board lanes

## Sync-status path

### Sync status API
Route:
- `projects/mission-control/app/api/tasks/sync-status/route.ts`

GET:
- `getTaskSyncStatus()`

POST:
- `cleanupTaskSyncDrift()` then `getTaskSyncStatus()`

#### `getTaskSyncStatus()`
Compares:
- structured counts
- AUTONOMOUS section counts
- board lane counts

Important rule in code:
> "The board remains the source of truth."

Drift examples it checks:
- backlog mismatch vs `AUTONOMOUS.md`
- in-progress mismatch
- review mismatch
- done count lower than live `Done Today`

#### `cleanupTaskSyncDrift()`
Writes back toward markdown alignment by:
- removing stale `Done Today` entries from `AUTONOMOUS.md`
- replacing `Open Backlog`, `In Progress`, `Review`, and `Needs Input` markdown sections from the structured store

Meaning:
- the **Apply board truth** action is a markdown reconciliation action
- it pushes structured-board state back into `AUTONOMOUS.md`

## Import path

### Import API
Route:
- `projects/mission-control/app/api/tasks/autonomous/import/route.ts`

Calls:
- `importLegacyAutonomousTasks()`

Behavior:
- reads structured store
- reads `AUTONOMOUS.md`
- parses active legacy sections
- seeds/imports missing legacy tasks into the structured store
- respects `suppressedLegacyTaskKeys`
- also refreshes queue-backed task state if queue entries still match active run identity

Meaning:
- the **Pull from md** action is an import/seed path from markdown into the structured store
- it should be used carefully, because it can re-seed legacy tasks that exist in markdown but not in the structured store, unless suppression rules block them

## UI controls and what they really do
In `components/pages/TasksBoardSwitcher.tsx`:

### `Pull from md`
Calls:
- `POST /api/tasks/autonomous/import`

Actual meaning:
- import missing active legacy tasks from `AUTONOMOUS.md` into the structured store

### `Apply board truth`
Calls:
- `POST /api/tasks/sync-status`

Actual meaning:
- reconcile `AUTONOMOUS.md` sections from the structured store
- remove stale `Done Today` drift where possible

## Why rollback can make Tasks feel "older"
A rollback can restore older versions of:
- `projects/mission-control/data/autonomous-tasks.json`
- `AUTONOMOUS.md`
- queue/history files

Because the system has more than one state surface, the board can feel historically rewound even if the UI code itself is fine.

The most likely failure modes after rollback are:
1. old structured store restored
2. old AUTONOMOUS mirror restored
3. import/cleanup actions run against older content and reinforce that older baseline
4. historical queue or completion context re-applies stale status transitions

## Active safety guidance
Before changing Tasks behavior again:
1. inspect both:
   - `projects/mission-control/data/autonomous-tasks.json`
   - `AUTONOMOUS.md`
2. decide which layer is intended to be authoritative for the current recovery step
3. avoid mixing:
   - UI refactor
   - state-model changes
   - sync semantics changes
   in one pass
4. verify `Pull from md` and `Apply board truth` using known small test cases, not broad assumptions

## Practical conclusion
Current architecture is workable, but fragile under rollback because it still bridges:
- structured board truth
- legacy markdown mirror/import
- append-only completion history

For future work, Tasks should be treated as a **state-coordination problem first**, and a UI problem second.
