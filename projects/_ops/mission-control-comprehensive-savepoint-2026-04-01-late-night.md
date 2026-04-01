# Mission Control Comprehensive Savepoint — 2026-04-01 Late Night

## What this savepoint is
This is the end-of-day handoff after the major April 1 Mission Control Tasks stabilization push.

This savepoint exists so tomorrow’s agent does **not** have to rediscover:
- what was broken in the Tasks system
- which fixes were structural versus cosmetic
- what still matters conceptually
- what is now "good enough for now"
- what should be left alone unless there is a concrete reason to reopen it
- what the next big build focus is

This savepoint should be read together with:
- `MEMORY.md`
- `memory/2026-04-01.md`
- `projects/_ops/mission-control-comprehensive-savepoint-2026-04-01-night.md`
- the newer April 1 workspace commits listed below

---

## Executive summary
Today was largely a **Tasks page stabilization and completion day**.

The Tasks page started the day with a real underlying board/workflow, but the autonomous task lifecycle was still unreliable in several ways:
- queue history, `AUTONOMOUS.md`, and the structured task store could disagree and overwrite each other
- rejected tasks could bounce back to `Review`
- direct Execute runs could be overwritten by stale queue history
- deleted tasks could resurface
- review/result summaries could degrade into raw runner JSON or transcript sludge
- artifact links could point to bootstrap files like `AGENTS.md`
- sync drift could stay noisy from stale `Done Today` residue
- the shell and Tasks page still had some leftover chrome clutter
- task completion events were not yet properly surfaced in Chat/toasts/sound
- there was no model override field for autonomous tasks

By end of day, the Tasks page is now materially more trustworthy and more product-like.

### End-of-day posture
The following are now true:
- autonomous Tasks board is much more stable across execute / review / reject / reload
- structured task state is treated as the current-state authority
- `AUTONOMOUS.md` is treated more like a legacy mirror/sync surface, not equal authority
- deleted and rejected tasks are much harder to resurrect accidentally
- direct Mission Control runs are less likely to be overwritten by stale queue history
- review summaries and artifact links are far cleaner
- metadata-only runs no longer pretend they produced real output
- Tasks page can live-refresh autonomous state while tasks are running
- completing autonomous tasks now triggers:
  - top-right FLOATING toast
  - subtle sound cue
  - Chat activity-line message
- autonomous tasks now support separate `Agent` and `Model` fields
- Model can stay on `Agent default`, but the actual default model is now shown contextually in the UI
- shell bottom status strip is disabled for now
- Tasks board chrome is lighter and cleaner
- Sync Drift now has a real cleanup action

The page is now in a **good enough for now** state.
Not perfect, but no longer fundamentally slippery.

---

## Biggest conceptual shift today
The most important thing learned today was that the Tasks bugs were **not** primarily button bugs.
They were **state-authority bugs**.

The real disease was multi-source drift:
- `projects/mission-control/data/autonomous-tasks.json`
- `AUTONOMOUS.md`
- `memory/executor-subagent-queue.json`
- direct run state
- stale queue history
- preview/UI hydration

All of those could influence the visible board in ways that were not clearly ordered.

The core conceptual correction was:

### Current-state truth rule
- **Structured task store** = current-state authority
- `AUTONOMOUS.md` = legacy mirror/sync surface
- queue history = supporting execution history, not allowed to casually override newer direct actions
- autonomous task transitions must be single-writer and orchestration-owned

This is the main reason the page became more stable.

---

## What got fixed today

## 1. Queue / AUTONOMOUS / board lifecycle instability
Main bug cluster:
- completed queue records could re-promote rejected tasks back into `Review`
- stale legacy entries could win on reload
- rejected tasks could drift into `Backlog` or `Review`
- direct Execute runs could appear to complete instantly because stale queue-linked state overrode them
- deleted tasks could resurface from import behavior

### Fixes applied
- added stronger precedence rules so stale completed queue records do not override newer direct runs or rejections
- added/support hardened legacy sync states including `Review` and `Needs Input`
- improved rejected-task behavior so reject returns a task to a rerunnable state cleanly
- tightened import logic to prefer the best/current legacy entry rather than stale duplicates
- added suppression behavior so deleted legacy tasks do not simply come back on import
- introduced stronger run-attempt / state reconciliation so old execution traces cannot casually win over newer actions

### Important practical rule now
If a task is rejected back to a rerunnable lane with feedback, old queue history should not be able to silently shove it back into `Review` unless there is a real new run.

---

## 2. Reject / retry loop became real instead of fake
Originally, reject/retry behavior was half-present but unreliable.

### Before
- task could appear rejected but still inherit stale run state
- old artifacts could linger
- retry could behave like a fake fresh execute or instantly jump lanes
- feedback note visibility was poor

### After
- rejected task can move back into a rerunnable state cleanly
- latest feedback is visible on card + inspector
- retry execution is feedback-aware
- direct execute clears old queue linkage/artifact carryover more aggressively
- retry runs are labeled more truthfully in status summaries

### Important nuance learned today
“Rejected” is not just a column change.
It is a full workflow state reset with retained guidance.
That means:
- keep the task
- keep the meaningful operator feedback
- clear stale execution carryover
- require explicit Execute again

---

## 3. Review / result normalization was heavily cleaned up
Another major category of bugs was not lifecycle but **presentation truth**.

Examples that happened today:
- review summary became raw runner JSON
- proof block showed markdown/transcript sludge
- fake artifact pill linked to `AGENTS.md`
- metadata-only runs looked like real successful deliverables
- toast/system notifications could surface noisy raw envelope content

### Fixes applied
- bootstrap files like `AGENTS.md`, `SOUL.md`, `TOOLS.md`, etc. are no longer treated as real artifacts
- metadata-only runs now avoid fake output pills
- summary extraction now prefers real human completion summaries or sensible fallbacks
- result/proof selection is less willing to surface raw runner envelope blobs
- toast summary path was tightened too, not just the inspector/task card path
- if there is no meaningful real output, the UI should avoid pretending there is one

### Important conceptual shift
The operator-facing headline should **never** be raw execution envelope content.
Raw output belongs in expandable proof/debug areas, not as the main visible run status.

---

## 4. Task runner boundary hardening
A particularly nasty bug today was that an executing autonomous task could act as if it were allowed to mutate task-system state.
That created Review ↔ Done flapping and contradictory task states.

### Fixes applied
- stronger boundary between executing task work and orchestrator-owned task state
- runner tamper detection/restoration around managed task-state files
- stronger expectation that only the orchestration/API layer decides lane transitions

### Durable rule
Task execution sessions should not own:
- `AUTONOMOUS.md`
- `projects/mission-control/data/autonomous-tasks.json`
- queue state files
- any other orchestrator-owned lifecycle file

The executor may produce outputs. It should not decide final board state by mutating system files directly.

---

## 5. Live autonomous board updates
The page now uses the pragmatic live-update approach that was discussed earlier:
- poll only while autonomous tasks are actually running
- stop polling when nothing is active

That means a task should now be able to visibly move from:
- `In Progress` → `Review`
without requiring a manual page reload.

This was implemented as the practical near-term answer instead of websocket/event-stream architecture for the whole page.

This was the right choice for now.

---

## 6. Lifecycle notifications (Batch A)
This was a major quality-of-life addition and it worked well in testing.

### Implemented
When an autonomous task finishes production work and moves to `Review`, Mission Control now emits a shared lifecycle event that powers:
- a top-right FLOATING shell toast
- a subtle sound cue
- a Chat activity line

### Agreed Chat text
`Autonomous task finished and moved to Review: [title]`

### Important UX choice
This event is shown in Chat as a **system/activity line**, not as a normal Marvin conversational message.
That keeps operations updates from muddying the actual conversation.

### Notes
- the toast/sound/chat triad worked in live testing
- the remaining rough edge was summary normalization, which was cleaned up afterward

---

## 7. Model override field for autonomous tasks (Batch B)
Today also added a real `Model` field to autonomous tasks.

### Result
Autonomous tasks now support:
- `Agent`
- `Model`

as separate concepts.

### Current behavior
- `Model` can be left as `Agent default`
- when explicitly set, the model override is passed into execution
- chosen model shows in task metadata
- the create/edit/reload/execute flow preserves the field

### UI refinement added afterward
The `Agent default` label is contextual now:
- Marvin → `Agent default (gpt-5.4)`
- Builder → `Agent default (codex)`
- Reviewer → `Agent default (qwenplus)`

This is small but important, because it reduces ambiguity once multiple agents with different defaults exist.

---

## 8. Shell/tasks chrome cleanup
The page also got calmer and more usable as a workspace.

### Done today
- removed the whole bottom server status bar for now
  - concept not deleted forever, just disabled because it stole space and occasionally broke layouts
- removed extra board-view titling text from Tasks boards
- widened Personal and Projects boards so their 3 lanes fill space more like a real board, instead of feeling boxed into a 5-lane shell
- added real `Clean up` action next to Sync Drift info
- cleaned stale `Done Today` residue from `AUTONOMOUS.md` so drift is quieter and more truthful

### Important note
The bottom status strip is intentionally **disabled, not conceptually abandoned**.
If reopened later, it should probably return in a more restrained and less layout-breaking form.

---

## 9. Modal close bug fix
Philippe found a subtle but annoying UX bug:
- if text selection started inside the task card/modal
- and the mouse was released outside while still dragging/selecting
- the modal could close unexpectedly and lose the in-progress setup work

### Fix
Modal closing is now gated more carefully so it only closes when the interaction genuinely begins and ends on the backdrop, rather than during the drag-select edge case.

This is a small fix, but a very good example of a real UX-paper-cut that would have kept irritating future use.

---

## Important live-tested outcomes from today

## Things that now feel materially better
- autonomous task lifecycle trustworthiness
- reject / retry loop clarity
- review/result readability
- no more obvious fake artifact pills from bootstrap files
- live board updates while running
- completion events/awareness without staring at Tasks page
- task setup flexibility via model overrides
- Tasks page overall clutter level

## Things that were explicitly verified live
- toast + sound + Chat activity line all worked
- artifact filtering stopped linking random bootstrap files in later tests
- summary cleanliness improved significantly in final tests
- contextual default model labels looked good

---

## Still-open caveats / posture notes
This page is much stronger, but not absolutely immune to future drift.

### Remaining posture
- the system is now far more stable, but still built atop legacy sync with `AUTONOMOUS.md`
- that means future work should continue respecting the “structured store is authority” rule
- if new bugs appear, first suspect:
  - legacy sync edge cases
  - stale run/result reuse
  - hydration paths using older normalized data
  - too-eager parsing of raw outputs

### What not to casually reopen
Do **not** casually reopen the whole Tasks page for broad redesign.
That would be a mistake right now.

If Tasks is revisited later, it should be for:
- concrete bugs
- small quality-of-life polish
- deliberate workflow extensions

not broad visual churn.

---

## Current product stance for Tasks page
The right phrase now is:

### Tasks page = good enough for now
Meaning:
- the page is now genuinely useful as an operator surface
- the main lifecycle model is behaving much more honestly
- we should not keep stirring it just because more ideas are always possible

Future small fixes are fine.
But the main build focus should move elsewhere.

---

## Next big thing
The next major build focus should be:

## Agents page redo
Philippe explicitly said that after today’s Tasks progress, tomorrow’s big thing should be the redo of the Agents page, plus any small fixes discovered along the way.

### Meaning for tomorrow
Tomorrow’s agent should:
1. treat Tasks as the stabilized baseline
2. only fix small issues if they appear during use
3. move main design/implementation attention to Agents page redesign/rebuild

---

## Mission Control conceptual posture after today
By end of day, the shape of Mission Control is clearer:

- Chat: truthful operator workspace with real runtime bridge and activity signals
- Tasks: now a credible operational board with autonomous lifecycle, notifications, live updates, and retry/review flow
- Agents: next page that still needs larger redesign / stronger product identity

The system is increasingly becoming an honest companion shell around real runtime/workspace truth, rather than a visually dressed-up prototype.

That matters.

---

## Commits made today (workspace repo)
These are the notable April 1 workspace commits related to the Tasks push:

- `32b96bd` — fix autonomous reject rerun flow
- `b33a9a7` — chore add needs input lane back to autonomy
- `f4c6e24` — fix autonomous reload lane drift
- `e45729f` — fix queue precedence after reject
- `7f9eb8a` — add feedback-aware autonomous retries
- `c789d89` — fix execute path queue override
- `baf4b47` — fix retry feedback selection
- `dcb1f0d` — stabilize mission control autonomous task lifecycle
- `a1f8b95` — harden mission control task-runner boundaries
- `cb8a907` — tighten mission control artifact links
- `900bd6c` — normalize metadata-only task review results
- `f201060` — refine mission control tasks chrome
- `e732b8a` — add mission control task lifecycle notifications
- `57ea74b` — polish mission control task summaries
- `24880f4` — add mission control task model overrides
- `e908e4a` — polish task model labels and modal close behavior

There were also nested Mission Control repo commits during the day. The outer-workspace commits above are the reliable “live in workspace” reference layer.

---

## Nested repo / wrap lesson
A repeated operational wrinkle today:
- a codex/coding pass could finish and commit cleanly **inside the Mission Control repo**
- but the **outer workspace** could still show modified Mission Control files
- which meant the feature was not yet fully wrapped into the main workspace flow from Marvin’s perspective

### Practical lesson
Do not tell Philippe a Mission Control feature is fully live just because the nested Mission Control repo finished its pass.
Still do the outer-workspace wrap + preview restart + light verification step.

This happened repeatedly enough today that it deserves to be remembered.

---

## Specific bugs solved today that tomorrow’s agent should not rediscover
- rejected tasks bouncing back to `Review` from stale queue completions
- deleted tasks resurfacing from import
- direct execute appearing to finish instantly because stale queue state overwrote it
- runner touching task-system files and causing Review/Done flapping
- review summaries showing raw JSON blobs
- fake output pills linking to bootstrap files
- stale `Done Today` drift noise
- lack of live updates while task runs
- no event notification when task reaches `Review`
- no model override field
- modal closing during text-selection drag-release edge case

---

## Tomorrow-first recommendations
If tomorrow’s agent starts on Mission Control:

### First read
- this file
- `memory/2026-04-01.md`
- updated `MEMORY.md` Mission Control section
- updated `TOOLS.md` Mission Control notes

### Then do
- quick live scan of Tasks only to confirm no obvious regressions
- do **not** reopen Tasks broadly if it still looks stable
- move to Agents page redo as main workstream

### If small Tasks bugs show up tomorrow
Fix them surgically.
Do not turn that into another all-day Tasks spiral unless the page truly regresses.

---

## Final judgment
Today was a high-value day.

The Tasks page moved from:
- real but slippery

to:
- real, substantially more coherent, and usable enough to trust as part of Mission Control’s operational core.

That is a meaningful product step, not just cleanup.
