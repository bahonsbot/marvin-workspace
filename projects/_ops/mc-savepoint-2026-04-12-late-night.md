# Mission Control Savepoint — 2026-04-12 Late Night

## What this savepoint is
This is the end-of-night handoff after the April 12 late-night session that started with a **VPS rollback** and then deliberately shifted into a **safe, narrow Chat-only structural refactor lane**.

This savepoint exists so the next session does **not** have to rediscover:
- why the rollback happened
- what the correct post-rollback truth baseline is
- why git history was explicitly treated as potentially untrustworthy until preview was rebuilt and verified
- how the Tasks board truth actually works right now
- why we intentionally avoided touching Home / Tasks / Agents after the rollback
- exactly which Chat refactor slices have already landed safely
- what proved safe, what failed transiently, and what should be done next

Read this together with:
- `memory/2026-04-12.md`
- `projects/_ops/mission-control-post-rollback-baseline-2026-04-12.md`
- `projects/_ops/tasks-truth-flow-map-2026-04-12.md`
- `projects/_ops/mission-control-live-readiness-plan-2026-04-11.md`
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`
- `projects/mission-control/components/chat/chat-rich-text.tsx`
- `projects/mission-control/components/chat/chat-ui-helpers.ts`
- `projects/mission-control/components/chat/chat-tool-groups.tsx`

---

## Executive summary
Tonight had one major strategic change and one major implementation lane.

### Strategic change
A **VPS rollback** had already been performed before this session because recent Mission Control changes had messed up:
- Home
- Tasks
- Agents

Philippe explicitly said:
- the rollback was done at a **clean and safe state**
- current git history might be corrupted/untrustworthy relative to the desired runtime baseline
- we must be careful what we change exactly from here

That means tonight’s first job was **not to build**.
It was to re-establish truth.

### Implementation lane
After verifying the current rolled-back workspace baseline in preview, we:
1. captured that baseline into git
2. documented the post-rollback state and Tasks truth flow
3. avoided touching Home / Tasks / Agents again
4. reopened work only in the **Chat** surface
5. executed three safe, narrow, behavior-preserving refactor slices in Chat, each with:
   - code extraction
   - build verification
   - preview restart
   - route check
   - commit

This was the correct move.

---

## 1. Rollback context and what it changed

## 1.1 Why the rollback mattered
Philippe reported that the previous Mission Control work had broken or degraded:
- Home
- Tasks
- Agents

Even though there had been prior implementation plans and git history, the new instruction was clear:

## Treat the rollback state as the new safe baseline
Do not assume pre-rollback git is the product truth.
Do not resume broad work as if nothing happened.

## 1.2 Immediate response
The correct response was:
- do **not** trust git first
- rebuild/restart preview from the current workspace as-is
- let Philippe verify the actual current app

That was done successfully.

Verified routes after preview rebuild/restart:
- `/general/home` → OK
- `/general/tasks` → OK
- `/general/agents` → OK

Philippe then confirmed:
- the current workspace status was still clean
- the rolled-back workspace baseline was working as it should

That confirmation became the real operational truth.

---

## 2. Git baseline reset — what happened and why

## 2.1 Why git needed to be overwritten carefully
Once Philippe confirmed the rolled-back workspace was the correct clean baseline, git needed to stop reflecting possibly bad later state.

But a full blind commit would have been wrong, because the repo also contained transient/runtime noise such as:
- preview pid/log churn
- trading/runtime data churn
- other generated state that should not define the canonical baseline

## 2.2 Curated baseline capture
A curated local commit was created from the current rolled-back workspace state:
- **Commit:** `4ddd4ed`
- **Message:** `Capture rolled-back workspace baseline`

Included in that baseline capture:
- `AUTONOMOUS.md`
- `projects/mission-control/components/pages/GeneralHomePage.tsx`
- `projects/mission-control/components/pages/MarketWatchRefreshButton.tsx`
- `projects/mission-control/data/autonomous-tasks.json`
- `projects/mission-control/scripts/custom_news_digest.py`
- `projects/mission-control/data/custom-news-briefings.json`

Deliberately excluded:
- `.preview-runtime` logs/pids
- trading/runtime churn files
- avatar deletions/additions

## 2.3 Remote overwrite
A first `git push --force-with-lease` correctly refused because remote had advanced.
That refusal was the safe behavior.

After refreshing remote state, the force-with-lease push succeeded.
Result:
- `origin/master` now matches the curated rolled-back workspace baseline

This matters a lot:

## Git and workspace were deliberately re-aligned to the verified safe runtime baseline
That was not an accident, and tomorrow’s agent should treat it as intentional.

---

## 3. Post-rollback documentation created tonight
Two important reference docs were created before further implementation:

### 3.1 Post-rollback baseline doc
- `projects/_ops/mission-control-post-rollback-baseline-2026-04-12.md`

Purpose:
- capture the verified safe baseline
- document the new product-safety posture after rollback
- prevent future sessions from blindly trusting pre-rollback assumptions

### 3.2 Tasks truth-flow map
- `projects/_ops/tasks-truth-flow-map-2026-04-12.md`

Purpose:
- map the real current Tasks read/write model
- clarify what is current-state authority vs. mirror vs. historical log
- explain `Pull from md` vs `Apply board truth`
- reduce the chance of another Tasks change accidentally mixing state-coordination work with UI work

These were committed as:
- **Commit:** `91bc090`
- **Message:** `Add post-rollback Mission Control baseline docs`

---

## 4. Tasks truth model — the important findings
Tonight produced a cleaner articulation of the Tasks board model than we had before.
This part is important enough to restate here even though the dedicated truth-flow doc exists.

## 4.1 There are three active state layers
### A. Structured current-state authority
File:
- `projects/mission-control/data/autonomous-tasks.json`

Role:
- this is the actual current-state source for the visible board lanes

### B. Legacy markdown mirror / import / reconciliation surface
File:
- `AUTONOMOUS.md`

Role:
- still active
- still parsed
- still used for imports and reconciliation
- not dead, but also not the ideal sole authority

### C. Historical completion log
File:
- `memory/tasks-log.md`

Role:
- append-only completion/audit history
- not a live board lane

## 4.2 UI semantics now clearly understood
### `Pull from md`
This means:
- import missing active legacy tasks from `AUTONOMOUS.md` into the structured store

### `Apply board truth`
This means:
- reconcile markdown sections in `AUTONOMOUS.md` from the structured store
- remove stale `Done Today` drift where possible

## 4.3 Why Tasks felt dangerous after rollback
Because rollback can restore:
- old structured store
- old markdown mirror
- old queue/history context

That means the Tasks page is not just a page.
It is a state-coordination surface.

## 4.4 Durable practical rule from tonight
For future Tasks work:
- do not mix UI refactor with sync-logic changes in one pass
- do not casually run import/reconcile actions without understanding both files
- treat Tasks as a state-model problem first, UI problem second

This rule should hold unless Philippe explicitly chooses to reopen Tasks stabilization work.

---

## 5. Why we chose Chat as the only safe implementation lane tonight
After the rollback, I recommended:
- **not** touching Home / Tasks / Agents immediately
- using Chat as the safest structural refactor lane, because Philippe had already said Chat still seemed fine

Philippe agreed and asked to proceed.

This produced the operating rule for tonight:

## Chat-only, structural only, one small slice at a time
No broad polish pass.
No visual redesign.
No multi-page work.
No shared-shell experiments.

That discipline is what made the night successful.

---

## 6. Chat refactor work completed tonight
Three clean, safe extraction slices landed.

## 6.1 Slice 1 — rich text and file-link helpers
### What was extracted
From:
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`

Into:
- `projects/mission-control/components/chat/chat-rich-text.tsx`

Now owned there:
- `monoFont`
- workspace path normalization
- workspace file-link detection
- file-link href building
- plain-text-with-file-links rendering
- inline rich-text rendering
- full rich-text block rendering

### Why this slice was chosen first
It was the smallest low-risk slice that meaningfully reduced the size of the monolith without touching the more sensitive runtime/session logic.

### Verification
- first build failed because two extracted helper imports became unused in the parent file
- that was fixed immediately by trimming the unused imports
- build then passed cleanly
- preview restarted cleanly
- `/general/chat` responded normally

### Commit
- **Commit:** `4ac9d7a6`
- **Message:** `Extract chat rich text helpers`

### Durable lesson
Even on "safe" helper extractions, expect one lint/type cleanup pass after moving code out.
The right pattern is:
- extract
- build
- clean unused symbols
- build again

---

## 6.2 Slice 2 — UI style helpers
### What was extracted
From `MissionControlChatSurface.tsx` into:
- `projects/mission-control/components/chat/chat-ui-helpers.ts`

Moved there:
- `pillStyle`
- `actionButtonStyle`
- `contextTone`
- `composerIconButtonStyle`

### Why this slice was next
It was another low-blast-radius extraction with minimal behavioral risk, and it made the parent chat file materially cleaner.

### Verification
- build passed cleanly
- preview restarted cleanly
- `/general/chat` remained healthy

### Commit
- **Commit:** `8230f1e4`
- **Message:** `Extract chat UI helpers`

### Important note
This was still not runtime-heavy work.
That was intentional.

---

## 6.3 Slice 3 — tool-group rendering
### What was extracted
From `MissionControlChatSurface.tsx` into:
- `projects/mission-control/components/chat/chat-tool-groups.tsx`

Moved there:
- `ToolGroupRow`
- `toolLabel`
- `toolPreview`
- `isLowSignalExecTool`
- `toolPhaseLabel`
- `ToolDetailBlock`
- `ToolGroupBlock`
- `formatEventTime`

### Why this was a bigger but still acceptable slice
This was the first extraction that touched a more interactive rendering cluster, but still stayed within display/rendering logic rather than runtime-control logic.

### Verification sequence and transient bug
The first build after extraction failed because:
- local `formatEventTime` still existed in `MissionControlChatSurface.tsx`
- after extraction, that created a duplicate-definition error

That duplicate was removed.
Then:
- build passed cleanly
- preview restarted cleanly
- `/general/chat` responded normally

### Commit
- **Commit:** `ec0065f0`
- **Message:** `Extract chat tool group rendering`

### Durable lesson
When extracting a cluster that includes a shared utility (like `formatEventTime`), remove the old local copy in the parent immediately or the build will fail with a duplicate-definition error.

---

## 7. What was learned tonight that we did not know clearly before
This section matters. These are the little truths tomorrow’s agent should already know.

## 7.1 Preview verification must beat git assumptions after rollback
Tonight proved a very important operational truth:

## If a rollback happened and the operator says current runtime is the clean safe state, verify the current preview first and treat that as truth before trusting historical git assumptions.

We did exactly that, and it prevented us from "fixing" the wrong thing.

## 7.2 The Tasks board is more fragile under rollback than Chat
Why:
- Tasks uses multiple persistence/mirror layers
- Chat was structurally large, but its current visible baseline was more straightforward to preserve

That means:
- Chat is safer for structural refactor work after rollback
- Tasks needs explicit state-truth handling first

## 7.3 Safe implementation rhythm for unstable periods actually worked
Tonight’s most successful working pattern was:
1. one tiny extraction only
2. no intended behavior change
3. build immediately
4. restart preview immediately
5. verify route immediately
6. commit immediately

This pattern should be reused tomorrow.

## 7.4 The non-blocking warning still exists
Builds are clean except for the existing warning:
- `components/agents/AgentSeatCard.tsx` still uses `<img>` and triggers Next.js `@next/next/no-img-element`

This warning is known, non-blocking, and unrelated to tonight’s Chat work.
Do not mistake it for tonight’s regression.

---

## 8. Current Mission Control state at handoff
As of this savepoint:

### Verified good tonight
- rollback baseline confirmed visually by Philippe
- current preview rebuilt from live workspace
- git aligned to that safe baseline
- Chat refactor lane reopened safely
- three extraction slices landed cleanly

### Explicitly avoided tonight
- Home changes
- Tasks behavior changes
- Agents changes
- shared shell changes
- runtime bridge logic changes
- broad Mission Control cleanup passes

### Why that restraint matters
Because tonight’s goal was not velocity.
It was to re-establish trust after rollback and keep building without re-breaking known sensitive areas.

---

## 9. Recommended next move tomorrow
Tomorrow should continue the same safe Chat-only structural lane before touching more sensitive areas.

## Best next slice
The next recommended extraction is:

### Message/event rendering cluster
Likely move out of `MissionControlChatSurface.tsx` into a new module, something like:
- `chat-message-blocks.tsx`

Candidate contents:
- `LiveMessageBlock`
- `LiveEventBlock`
- `shortKey`
- maybe clipboard helper if it stays local to message/event rendering
- maybe small icon cluster only if it naturally belongs there

## Why this should be next
Because it is the next meaningful structural chunk while still staying short of the more dangerous runtime/session-control logic.

## What should **not** be next yet
Avoid immediately extracting or rewriting:
- the runtime-control strip
- session switching / hydration logic
- send/abort wiring
- speech/attachment logic in a behavior-changing way

Those are valid future targets, but they are a risk step up.

---

## 10. If tomorrow’s agent reopens Tasks, do this first
If the next session decides to reopen Tasks anyway, the first move should **not** be implementation.
It should be a tiny controlled sync/truth test.

Suggested order:
1. create one test task
2. observe what changes in:
   - `projects/mission-control/data/autonomous-tasks.json`
   - `AUTONOMOUS.md`
   - board UI
3. test `Pull from md`
4. test `Apply board truth`
5. only then consider code changes

That will reveal the actual active sync semantics under the rollback baseline.

---

## 11. Important commits from tonight
In order:

- `4ddd4ed` — `Capture rolled-back workspace baseline`
- `91bc090` — `Add post-rollback Mission Control baseline docs`
- `4ac9d7a6` — `Extract chat rich text helpers`
- `8230f1e4` — `Extract chat UI helpers`
- `ec0065f0` — `Extract chat tool group rendering`

If tomorrow’s agent needs a quick mental model:
- first two commits = rollback recovery / truth re-establishment
- next three commits = safe Chat-only refactor slices

---

## 12. Final handoff sentence
Tomorrow’s agent should think:

## The rollback baseline is the truth, git was deliberately rewritten to match it, Tasks is state-sensitive, and Chat is the active safe refactor lane. Continue with another small verified Chat extraction, not a broad Mission Control pass.
