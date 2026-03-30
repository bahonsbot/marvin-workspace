# Mission Control Comprehensive Savepoint — 2026-03-31 Midnight

## Purpose
This is the canonical handoff for the late Mar 30 → early Mar 31 Mission Control session.

Read this before resuming Mission Control work.
It is intended to be detailed enough that a future agent can continue without Philippe having to re-explain:
- what changed today
- what changed conceptually
- what was implemented versus only planned
- what bugs/regressions were found and fixed
- what temporary compatibility compromises exist
- what the current next-safe steps are
- what long-term direction should still guide decisions

This savepoint covers **both**:
1. final Chat-page polish/fixes from earlier in the day
2. the first real implementation of the **Autonomous Hybrid Board v1** on the Tasks page

Read this after:
1. `projects/_ops/mission-control-comprehensive-savepoint-2026-03-29-afternoon.md`
2. `projects/_ops/mission-control-comprehensive-savepoint-2026-03-30-evening.md`
3. `docs/runbooks/mission-control-runtime-preview-runbook.md`
4. this file

---

## Executive Summary
Today split cleanly into **two Mission Control tracks**:

### Track A — Chat stabilization / polish
Chat moved from “good enough but still twitchy” to a much more settled operator surface.
The important outcomes were:
- real Stop button wiring
- bottom-follow behavior fixed into a hybrid model
- refresh/history regression fixed
- effort-label honesty partially restored
- markdown heading regression fixed
- smarter tool burst grouping added
- recent sessions dropdown became a real session switcher
- General utility pages were aligned visually with Chat and later had scrolling restored after an overflow regression

### Track B — Autonomous Hybrid Board v1 foundation + first workflow loop
Tasks moved from planning/spec land into real implementation.

By the end of the night, Mission Control now has:
- a **structured Autonomous task store**
- **legacy sync** with `AUTONOMOUS.md`
- import + manual-create API actions
- Autonomous board UI controls for **New task** and **Refresh import**
- a real **task drawer**
- a first real **Execute** path
- a first real **Review** path
- real **Approve / Reject** actions

This is **not full Nerve parity yet**, but it is no longer a concept-only system.
The first real Nerve-style loop now exists in Mission Control:
- create/import task
- execute task
- task moves into review
- approve or reject it

That is the major milestone from tonight.

---

## High-Level Product State At End Of Session

### Chat
Chat remains **done for now**, but with known follow-ups.
It should not be reopened casually for aesthetic tinkering.
Only reopen for:
- real bug fixes
- meaningful operator-flow improvements
- clearly requested polish

### Tasks / Autonomous
Autonomous is now the active build frontier.
Personal and Projects remain intentionally simple/manual.

The current posture is:
- backend foundations are now real
- first UI actions are live
- first workflow loop is real
- the next work is to make the workflow richer and more Nerve-complete without breaking the hybrid truth model

---

## Part I — Chat Track: What Changed Today

## 1. Context re-anchor before new work
Before touching Chat again, Marvin reloaded:
- recent Mission Control daily memory
- Mission Control preview/runtime runbooks
- current live runtime bridge code
- local Nerve repo architecture patterns
- the latest savepoint (`mission-control-comprehensive-savepoint-2026-03-29-afternoon.md` and later the evening savepoint)

Important durable posture reaffirmed:
- the latest savepoint is the **main wiring truth**
- live code is verification truth
- Nerve is an architecture/process reference, not styling truth

This should remain the reopen discipline for future Chat work.

---

## 2. Stop button: from placeholder to real runtime action

### What was found
The Stop button was still a placeholder.
It was rendered disabled and effectively lied about future intent.

### What changed
Stop was wired through the real Mission Control runtime bridge using:
- `chat.abort`

Supporting changes included:
- bridge capability model updated so stop support is truthful
- UI button enabled only when stop is actually possible
- stop no longer presented as decorative dead control

### Practical outcome
When a Mission Control response is actively running, Stop now actually stops it.
When there is nothing active, it remains disabled.

This was an important truth-over-polish fix.

Commit:
- `b14d7d0` — `feat: tighten chat layout and wire mission control stop`

---

## 3. Chat bottom focus / scroll behavior evolved twice

Philippe’s first request was simple:
- keep the page focused at the bottom of the chat section more reliably

### First implementation
A more aggressive bottom-anchor was added:
- transcript bottom anchoring on updates
- disabled scroll anchoring drift

This solved the “new messages nudge me upward” problem.

### New bug created
It introduced the opposite problem:
- if Philippe scrolled upward to read older messages,
- the page could yank him back down automatically

### Final hybrid model adopted
The behavior was changed to:
- auto-follow only when already near bottom
- if user is higher up, do **not** yank them back down
- if new content arrives while higher up, show:
  - `Jump to latest ↓`

This hybrid behavior was explicitly inspired by the original Gateway UI and is the correct final posture for now.

Commits involved:
- `b14d7d0`
- `6c38139` — `fix: restore chat refresh and scroll behavior`

---

## 4. Refresh/history regression fixed

### Symptom Philippe reported
Refreshing Chat could rewind visible history to much older persisted messages, sometimes all the way back to early-morning internal queue chatter.

### Root cause
Refresh rehydration logic was re-merging persisted transcript history over the already-visible live transcript state too aggressively.

### Fix
Hydration logic was changed so persisted history is only used when appropriate rather than constantly re-clobbering the live transcript.

### Practical outcome
Refresh should now preserve the visible current transcript much more reliably instead of collapsing backward into an older persisted slice.

Commit:
- `6c38139`

---

## 5. Effort/thinking honesty issue partially restored

### Regression noticed by Philippe
`EFFORT` resurfaced as:
- `Runtime-controlled`

This had explicitly been improved the day before.

### Root cause
The fallback path in thread/session modeling still allowed `Runtime-controlled` to reappear when the primary session selection or session summary lacked reliable `thinkingLevel` data.

### What changed
The readback logic was tightened to prefer:
1. main/direct session thinking level
2. another visible session with thinking level
3. only then a fallback label

### Current status
Better than before, but still **not the final perfect source-of-truth**.
This remains a valid reopen item if Philippe later sees more mismatches.

Commit:
- `6c38139`

---

## 6. Markdown heading regression fixed

### Symptom
Headings like:
- `#### 2`

started rendering as raw hashtags again.

### Root cause
Markdown heading parsing only handled `#` to `###` in the Mission Control transcript renderer.

### Fix
Heading parsing was extended back through level 6.

### Practical outcome
Heading rendering in transcript markdown is now back to expected behavior.

Commit:
- `6c38139`

---

## 7. Recent Sessions pill height refined

### Philippe observation
Even after flattening the control row, the `Recent Sessions` item was still visually taller than the neighboring pills because the little circled count badge introduced its own vertical bulk.

### Fix
The pill-style count badge was replaced with a plain bold number.

### Result
The `Recent Sessions` control now aligns better with Session/Agent, Model, Effort, etc.

Commit:
- `6c38139`

---

## 8. Smarter multi-tool burst grouping implemented

This came directly from Philippe’s observation plus the savepoint note.

### Problem
The tool lane could fragment into:
- `Used 1 tool`
- `Used 1 tool`
- `Used 1 tool`

for what was really one short working burst.

### First implementation
Tool grouping logic was changed from:
- one bubble per tool call id

to:
- one bubble per same-run burst within a short rolling window

Initial window:
- 4 seconds

### Philippe test result
A denser burst grouped nicely, but lighter bursts still felt too fragmented.

### Final tuning for now
The burst window was widened from:
- `4s` → `10s`

### Current posture
This is now **good enough for now**, but Philippe explicitly said it may be tweaked again later.

Commits:
- `980dc97` — `refine(chat): group nearby tool calls into bursts`
- `acb5534` — `tune(chat): widen tool burst grouping window`

---

## 9. General utility page title/header removal and scroll regression

Philippe wanted the same top-snug posture as Chat for:
- Tasks
- Agents
- Crons
- Memory
- Files

Home was explicitly excluded.

### What changed
The shared page scaffold was made header-optional.
Those General pages now hide their page title/underline and align their content near the top like Chat.

### Regression created
Removing the header wasn’t the real problem; the shell overflow behavior shared with Chat was.
Those pages accidentally inherited:
- `overflow: hidden`

which broke page scrolling.

### Fix
App shell behavior was split correctly:
- Chat keeps fixed non-scrolling shell behavior
- utility pages keep compact top alignment **and** normal scrolling

Commits:
- `9acc245` — `refine(general): remove page titles from utility pages`
- `4dc7430` — `fix(general): restore scroll on utility pages`

This is solved.

---

## 10. Recent Sessions dropdown became real session switcher

### Problem Philippe hit
On reload, Chat sometimes landed on the wrong target session, including a signal-review cron session, and only later self-corrected after page navigation.

### Requested escape hatch
Make the session entries in the `Recent Sessions` dropdown clickable so Philippe can force Chat back to the correct session himself.

### What changed
Recent session entries are now clickable.
Selecting one:
- switches the Chat target to that session
- closes the menu
- marks the current target as `Current`

### Current limitation
Philippe tested it and reported:
- it works as an escape hatch,
- but reconnect can still take nearly a minute before `Session Connected` returns.

### Durable follow-up added
A backlog item was added for future proper fixing:
- tighten recent-session switching so reconnect is faster and more reliable after manual session selection

This is now a known follow-up, not an unresolved mystery.

Commit:
- `1fccb45` — `fix(chat): make recent sessions switch target session`

---

## Part II — Tasks / Autonomous Track: Conceptual Shift

## 11. Big direction decision: Nerve-inspired Autonomous workflow, not full clone

Philippe wanted to revisit the Nerve task system because its execution/review loop felt materially stronger than the existing Mission Control Tasks behavior.

### What was re-observed from Nerve
After crawling the local Nerve repo again, the relevant truths were:
- Tasks board is not decorative
- `Execute` spawns a worker session
- run state is attached to task
- task moves to `Review` on success
- `Approve / Reject` are real workflow controls
- rejection loops feedback back into the task lifecycle

### Strategic decision made tonight
Do **not** turn the whole Mission Control Tasks page into Nerve.
Instead:
- keep `Personal` and `Projects` simple/manual for now
- evolve `Autonomous` only into a Nerve-inspired hybrid workflow board

### Chosen architecture direction
Option C / hybrid truth model was explicitly chosen:
- structured Mission Control workflow model for Autonomous
- explicit linkage back into the existing autonomy system

This was the crucial product/architecture choice of the second half of the session.

---

## 12. Manual vs generated task coexistence clarified

Philippe answered the open design questions.
Important locked-in decisions:
- manual Autonomous tasks should also be written into current autonomy files immediately
- so if they aren’t executed manually now, they can still be picked up later by autonomous flows
- generated tasks remain bounded
- old overall board cap can be removed, but suggestion flooding must still be prevented
- manual and generated tasks must coexist, with explicit provenance
- manual tasks default to `To Do`
- generated tasks remain editable
- approval is the meaningful completion moment
- completion announcements in Chat are desired later
- initial agent choices should stay operational, not identity-heavy:
  - Marvin
  - Builder
  - Reviewer
  - Content Creator (placeholder lane)

This heavily shaped the implementation contracts written later.

---

## 13. Planning spine produced before implementation

Before coding, a real planning/documentation spine was created.
These docs are now the canonical planning stack for Autonomous Hybrid Board v1:

1. Spec
- `projects/_ops/mission-control-autonomous-hybrid-board-v1-spec-2026-03-30.md`

2. Phase 0 truth audit
- `projects/_ops/mission-control-autonomous-hybrid-board-phase0-truth-audit-2026-03-30.md`

3. Structured task schema contract
- `projects/_ops/mc-auto-task-schema-2026-03-30.md`

4. Sync/storage contract
- `projects/_ops/mc-auto-sync-contract-2026-03-30.md`

### Important note on filenames
Philippe explicitly corrected Marvin on overly long filenames.
That preference was logged.
Later docs used shorter names.

This is a durable preference now:
- keep workspace doc filenames concise and human-manageable

---

## 14. Phase 0 truth audit findings

The audit established several critical truths:

### Current live/autonomy truths
- `AUTONOMOUS.md` remains the planning/executor compatibility truth
- `memory/executor-subagent-queue.json` is queue/delegation truth
- `memory/tasks-log.md` is durable completion truth
- Mission Control already had a board-specific split between Personal / Projects / Autonomous

### Cap finding
The current generator still uses a practical target count of:
- `NUM_TASKS = 5`

This was the old “cap” behavior Philippe had in mind.

### Executor truth
The current executor still depends heavily on markdown sections in `AUTONOMOUS.md`.
That means the new structured store cannot pretend the legacy autonomy layer is already replaced.

### Strategic conclusion
Mission Control Autonomous must use:
- structured workflow truth for UI behavior
- explicit linkage back into current autonomy truth

That validated the hybrid model.

Commit trail for planning docs:
- `2572921` — spec
- `d6d568b` — phase 0 audit
- `76ded1b` — schema contract
- `e69a8ec` — sync contract

---

## Part III — Tasks / Autonomous Implementation: What Is Real Now

## 15. Structured Autonomous task service added

First real backend slice:
- `projects/mission-control/lib/autonomous.ts`

### What it now contains
- task/run/feedback/artifact/link types
- structured store load/save
- structured store path:
  - `projects/mission-control/data/autonomous-tasks.json`
- legacy markdown reader/parser
- normalization helper for legacy task text
- import from legacy autonomy
- manual create with write-through into `AUTONOMOUS.md`
- completion helper for marking linked legacy task complete
- tasks-log append helper
- link sync check helper
- later additions for approve/reject + direct task updates

This file is now the main backend seam for Autonomous Hybrid Board v1.

Commit:
- `00077f7` — `feat(mission-control): add autonomous task store service`

---

## 16. Tasks adapter now routes through the structured store

Second backend slice:
Mission Control’s Tasks adapter was rewired so Autonomous data no longer comes only from the old simpler board path.

### Key compatibility compromise
Because the visible Tasks UI still had the older 3-column model, the adapter temporarily maps:
- `backlog + todo` → `To Do`
- `in-progress + review` (later) → middle lane
- `done` → `Done`

This was intentional.
It lets backend truth improve before the visible board catches up.

### Important meaning
This is a **truth upgrade first**, not yet the full five-column UI.

Commit:
- `da8f1a4` — `feat(mission-control): route tasks adapter through autonomous store`

---

## 17. Autonomous-specific API endpoints added

First action endpoints were created:

### Added routes
- `GET /api/tasks/autonomous`
- `POST /api/tasks/autonomous`
- `PUT /api/tasks/autonomous`
- `POST /api/tasks/autonomous/import`

### What they do
- load structured Autonomous tasks
- create manual Autonomous task
- immediately write it through into `AUTONOMOUS.md`
- refresh/import legacy tasks into structured store

This was the first real mutation layer.

Commit:
- `205e31f` — `feat(mission-control): add autonomous task actions api`

---

## 18. First visible Autonomous board controls added

First UI control layer on top of the backend landed in:
- `components/pages/TasksBoardSwitcher.tsx`

### Added to Autonomous board only
- `Refresh import`
- `New task`
- modal for:
  - title
  - optional description
  - priority
  - agent target

### What stayed intentionally unchanged
- Personal board remains simple/manual
- Projects board remains simple/manual
- no fake execute/review controls were added to those boards

Commit:
- `38f3b4b` — `feat(mission-control): add autonomous task controls`

---

## 19. First real Autonomous Execute path added

This was the first serious workflow milestone.

### New backend pieces
- `app/api/tasks/autonomous/[taskId]/route.ts`
- `app/api/tasks/autonomous/[taskId]/execute/route.ts`
- `projects/mission-control/scripts/run-autonomous-task.mjs`

### New task drawer
Autonomous task cards became clickable.
A drawer now shows:
- title
- status
- priority
- agent target
- source type
- description
- run status
- run summary/result area
- scope/context details when available

### Execute behavior
When Execute is clicked:
- task becomes `in-progress`
- run metadata is attached in the structured store
- background worker script launches
- worker runs task in a dedicated runtime session
- on success:
  - task moves to `review`
  - summary/result stored
- on failure:
  - task goes back to `todo`
  - failure note appended to feedback

### Honest caveat
This is a **real v1 execution path**, but not yet polished or agent-specific in the final sense.
Still missing at that point were:
- approve/reject
- dedicated review column
- chat announcement
- richer artifacts

Commit:
- `ca73ae8` — `feat(mission-control): add autonomous task drawer and execute flow`

---

## 20. First real Review loop added

Last slice of the night completed the first meaningful Nerve-style loop.

### Added routes
- `app/api/tasks/autonomous/[taskId]/approve/route.ts`
- `app/api/tasks/autonomous/[taskId]/reject/route.ts`

### Backend behavior
#### Approve
- task moves to `done`
- linked legacy autonomy task marked complete
- completion appended to `tasks-log.md`

#### Reject
- task moves back to `todo`
- rejection note appended to feedback
- task becomes ready for explicit re-execution later

### UI behavior
The Autonomous drawer now supports:
- `Approve`
- `Reject`
- rejection note input
- visible feedback history

### Compatibility compromise
Because the visible board still uses the older 3-column shape:
- `review` tasks are temporarily folded into the middle lane

This is intentional until the board itself is upgraded to true five visible columns.

### Outcome
The first real Mission Control Autonomous loop now exists:
- create/import
- execute
- review
- approve/reject

That is the most important product milestone from tonight.

Commit:
- `2e44a8b` — `feat(mission-control): add autonomous review actions`

---

## 21. Follow-up backlog item recorded during Tasks work

Philippe reported that the new recent-session switcher works but can take nearly a minute to reconnect.

This was turned into a real backlog item in `AUTONOMOUS.md` so it is not lost:
- tighten Chat recent-session switching so target changes reconnect faster and more reliably after manual session selection

This is important because it was a mid-session bug report and could easily vanish otherwise.

---

## Current Live Files Most Relevant To Tomorrow

### Chat
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`
- `projects/mission-control/hooks/useRuntimeBridge.ts`
- `projects/mission-control/lib/chat/thread-model.ts`
- `projects/mission-control/components/shell/AppShellClient.tsx`

### Tasks / Autonomous
- `projects/mission-control/lib/autonomous.ts`
- `projects/mission-control/lib/adapters/tasks.ts`
- `projects/mission-control/components/pages/TasksBoardSwitcher.tsx`
- `projects/mission-control/app/api/tasks/autonomous/route.ts`
- `projects/mission-control/app/api/tasks/autonomous/import/route.ts`
- `projects/mission-control/app/api/tasks/autonomous/[taskId]/route.ts`
- `projects/mission-control/app/api/tasks/autonomous/[taskId]/execute/route.ts`
- `projects/mission-control/app/api/tasks/autonomous/[taskId]/approve/route.ts`
- `projects/mission-control/app/api/tasks/autonomous/[taskId]/reject/route.ts`
- `projects/mission-control/scripts/run-autonomous-task.mjs`
- `projects/mission-control/data/autonomous-tasks.json`

### Legacy/autonomy truth still in play
- `AUTONOMOUS.md`
- `memory/executor-subagent-queue.json`
- `memory/tasks-log.md`

### Planning docs now relevant to the Tasks build
- `projects/_ops/mission-control-autonomous-hybrid-board-v1-spec-2026-03-30.md`
- `projects/_ops/mission-control-autonomous-hybrid-board-phase0-truth-audit-2026-03-30.md`
- `projects/_ops/mc-auto-task-schema-2026-03-30.md`
- `projects/_ops/mc-auto-sync-contract-2026-03-30.md`

---

## Commit Trail For This Session

### Chat / General shell / session fixes
- `b14d7d0` — `feat: tighten chat layout and wire mission control stop`
- `6c38139` — `fix: restore chat refresh and scroll behavior`
- `980dc97` — `refine(chat): group nearby tool calls into bursts`
- `acb5534` — `tune(chat): widen tool burst grouping window`
- `9acc245` — `refine(general): remove page titles from utility pages`
- `4dc7430` — `fix(general): restore scroll on utility pages`
- `1fccb45` — `fix(chat): make recent sessions switch target session`

### Tasks / Autonomous planning docs
- `2572921` — `docs: add autonomous hybrid board v1 spec`
- `d6d568b` — `docs: add autonomous hybrid board phase0 audit`
- `76ded1b` — `docs: add autonomous task schema contract`
- `e69a8ec` — `docs: add autonomous sync contract`

### Tasks / Autonomous implementation
- `00077f7` — `feat(mission-control): add autonomous task store service`
- `da8f1a4` — `feat(mission-control): route tasks adapter through autonomous store`
- `205e31f` — `feat(mission-control): add autonomous task actions api`
- `38f3b4b` — `feat(mission-control): add autonomous task controls`
- `ca73ae8` — `feat(mission-control): add autonomous task drawer and execute flow`
- `2e44a8b` — `feat(mission-control): add autonomous review actions`

---

## Current Known Bugs / Rough Edges At End Of Night

## Chat
1. **Recent-session switching reconnect lag**
   - escape hatch works
   - reconnect can still take too long
   - backlog item added

2. **Effort/thinking readback still not fully perfect**
   - current posture is better, not perfect

## Tasks / Autonomous
1. **No dedicated visible Review column yet**
   - review currently piggybacks on middle lane

2. **No Chat completion announcement yet for finished autonomous tasks**
   - desired by product direction
   - not yet wired

3. **Execution routing is still v1/simple**
   - agent targets exist
   - routing is not yet richly specialized

4. **Artifact handling is still minimal**
   - run summary/result exists
   - no polished artifact extraction/presentation flow yet

5. **Approve/reject exists, but board UI is still transitional**
   - first loop is real
   - board visuals still lag the intended full five-column model

---

## What Tomorrow-You Should Understand Immediately

### 1. Chat should not be the main build frontier tomorrow unless needed
Chat is in maintenance/polish mode.
Tasks/Autonomous is now the main frontier.

### 2. The Autonomous system is now real enough to build on
Do not restart from concept docs.
There is real code now.

### 3. The current Tasks UI is intentionally transitional
This is important.
The backend truth has advanced faster than the visible board.
That is not accidental.

Current state:
- structured store is real
- sync is real
- create/import is real
- drawer is real
- execute is real
- approve/reject is real
- visible board shape is still partially legacy

That is okay.

### 4. The next safe product move is obvious
The next safe high-value move is:

## upgrade the Autonomous board from transitional 3-column compatibility view into the true 5-column workflow surface

Meaning:
- Backlog
- To Do
- In Progress
- Review
- Done

That is the most product-leverage next step.

---

## Recommended Next Steps

### Immediate next implementation slice
1. give Autonomous its true 5 visible columns
2. stop folding `review` into middle lane
3. preserve Personal/Projects as their current simple 3-column/manual boards

### After that
4. add Chat completion announcement when task moves to Review
5. improve artifact/result rendering in task drawer
6. improve agent-target-specific execution routing
7. tighten session-switch reconnect behavior on Chat

### Do not do first tomorrow
- do not overcomplicate agent identities/personas yet
- do not try to replace the legacy autonomy layer entirely
- do not force Personal/Projects into executable workflow behavior

---

## Long-Term Direction (Still Valid)

Mission Control should continue toward:
- truthful runtime-backed operator surfaces
- board-specific behavior, not fake uniformity
- Nerve-inspired workflow mechanics where useful
- Marvin/OpenClaw-specific truth architecture where necessary
- no fake state, no fake execution, no fake review loop

### Chat long-term
- stable, truthful operator workspace
- calm transcript/process visibility
- clean session navigation
- reliable effort/runtime state readback

### Tasks long-term
- Autonomous becomes the true execution/review board
- Personal and Projects stay planning-friendly unless explicitly expanded later
- the hybrid truth model remains the core safety mechanism while legacy autonomy still matters

---

## Safe Re-entry Instructions For Future Agent

If resuming Mission Control tomorrow:
1. read this savepoint first
2. then read:
   - `projects/_ops/mission-control-comprehensive-savepoint-2026-03-30-evening.md`
   - `projects/_ops/mc-auto-task-schema-2026-03-30.md`
   - `projects/_ops/mc-auto-sync-contract-2026-03-30.md`
3. inspect live code files listed above
4. verify preview with full build + `scripts/preview-restart.sh`
5. treat the Tasks/Autonomous board as the active implementation frontier
6. do not casually reopen Chat for style work unless Philippe asks

---

## Final State At Session End
Philippe’s end-of-night posture was:
- very happy with the pace and quality of work
- liked the clean slice approach
- happy with the savepoint / continuity discipline
- wanted the review-loop slice finished before stopping

That slice is now done.

The session ends with Mission Control in a materially stronger place than it started:
- Chat is more stable and controllable
- Tasks has crossed from planning into real workflow implementation
- tomorrow’s work can start from concrete code and concrete docs, not from vague intention
