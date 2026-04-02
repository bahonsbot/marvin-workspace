# Mission Control Comprehensive Savepoint — 2026-04-02 Night

## What this savepoint is
This is the end-of-day handoff after the April 2 Mission Control follow-up session.

This savepoint exists so tomorrow’s agent does **not** have to rediscover:
- which April 1 breakthroughs remained solid and which edges reopened on April 2
- what was fixed in Tasks, Chat, and the sidebar weather widget
- what looked promising but turned out to be the wrong direction
- what Philippe reviewed live and what he explicitly preferred
- what tonight’s late regression hunt actually proved
- which next steps are smart versus which would be reopening solved areas casually

This savepoint should be read together with:
- `MEMORY.md`
- `memory/2026-04-02.md`
- `projects/_ops/mission-control-comprehensive-savepoint-2026-04-01-late-night.md`
- `projects/mission-control/docs/weather-widget-implementation-plan.md`

---

## Executive summary
Today was a **Mission Control follow-up and refinement day**, not a clean-sheet build day.

The biggest outcomes:
- **Tasks page got more trustworthy again** through cleanup and execution hardening
- **the weather/time widget became real** rather than remaining a generated plan
- **Mission Control Chat hit a nasty duplication regression**, then was likely fixed by simplifying active-session transcript hydration
- we ended the day with a stronger sense of where Mission Control should stay restrained, where it can be expressive, and where cleverness in state/hydration is more dangerous than helpful

### End-of-day posture
At the end of today, these statements are the ones to trust:
- Tasks remains **good enough for now** and should not be reopened broadly
- the **weather orb** is now a live sidebar element worth observing in real usage rather than redesigning immediately
- Chat’s late-night duplication bug is **very likely caused by repeated active-session transcript rehydration**, and the newest fix is to stop doing that for the active thread
- the next major page frontier is **still the Agents page**, unless the chat duplication bug reappears in normal use

### Most important conceptual shift today
The key lesson from tonight’s Chat debugging is this:

## Active live chat should prefer live runtime truth over repeated history cleverness
Mission Control Chat already has:
- a live WS runtime bridge
- a current session target
- local live transcript state

That means transcript hydration should mainly serve:
- initial load
- reload recovery
- session switching

It should **not** behave like a continuous reconciliation engine for the active thread.
That over-cleverness appears to create more problems than it solves:
- delayed duplicate turns
- repeated duplicate accumulation
- transcript scroll jumps
- hard-to-debug merge behavior

This is a durable lesson.

---

## 1. Tasks follow-up posture at start of day
April 1 had already moved the Tasks board into a strong "good enough for now" state, but today surfaced a few real follow-up gaps.

### What remained conceptually true from April 1
- structured task store = current-state authority
- `AUTONOMOUS.md` = legacy mirror/sync surface
- stale queue history must not casually override newer direct actions
- review/result presentation must stay truthful and artifact-aware
- bootstrap/context files are not valid deliverables

That baseline held.

### Why Tasks was reopened at all
Not because the board concept was wrong.
It was reopened because real usage exposed a few operational leaks:
- generated tasks could still get crowded out or imported badly
- legacy sync still had cleanup edge cases
- manual execution still had a model-truth problem
- review gating still needed stronger artifact discipline

So the day’s Tasks work was **stabilization and hygiene**, not redesign.

---

## 2. Tasks fixes and clarifications made today

## 2.1 daily-task-generator backlog dropout bug
A real routing/priority bug existed in `scripts/daily-task-generator.py`.

### Root cause
`update_autonomous_file()` prepended:
- `suggestion_tasks`
- then `existing_backlog_tasks`
- before `new_tasks`

Since the file was capped to `NUM_TASKS=5`, generated tasks could be silently dropped whenever older or suggestion tasks filled the quota first.

### Fix
Priority was reversed so the function now favors:
1. new generated tasks
2. existing backlog tasks
3. suggestion tasks

### Why this matters
Without this fix, the generator could appear to succeed while silently producing no visible new backlog work.
That is exactly the kind of fake-success behavior Mission Control should avoid.

### Durable lesson
When a generator has a hard visible-cap quota, **newly generated items must get first claim** unless there is an explicit preservation reason otherwise.

---

## 2.2 generated-task structure cleanup
Generated/autonomous task formatting was tightened so the structured board gets better source material.

### Improvements
- suggestion parsing now handles `--title` / `--description`
- generated tasks now emit `**Brief:**`
- Mission Control legacy import now extracts `Brief` into structured task descriptions
- generated task titles are now shorter summaries instead of copying the first clause of the Brief verbatim

### Why this matters
Mission Control is much more trustworthy when the structured task board feels authored, not scraped.
This change reduces garbage titles and makes generator output more usable without manual cleanup.

---

## 2.3 sync cleanup hardening
The Tasks board cleanup flow got more authoritative.

### New behavior
- `Clean up` now reconciles `AUTONOMOUS.md` back toward the structured board state for active legacy-linked sections
- sync drift now detects mismatch in either direction, not just one simplified pattern
- manual deletion and cleanup both remove full legacy task blocks, not just the title line
- stale suppression keys no longer permanently block regenerated tasks from being re-imported

### Why this matters
This continues the April 1 direction:
- structured store = current truth
- legacy markdown = compatibility layer

The board should no longer feel like it can be quietly overruled by stale markdown leftovers.

---

## 2.4 manual execution model-truth bug
A real false-success path existed in Mission Control task execution.

### Symptom
A manual task configured for `qwenplus` could actually run on MiniMax because the runner’s model-switch message path was not reliably honored.

### Why this was dangerous
The UI/operator would think:
- model override worked
- run completed successfully
- review state was trustworthy

But the task might have executed under the wrong model entirely.

### Fix
The runner now validates the **effective model** from run metadata and fails visibly if it does not match the requested override.

### Durable lesson
For model-sensitive task execution, the requested model is not enough. Mission Control should verify the **effective runtime model**, not just assume the switch command worked.

---

## 2.5 review gating hardening
Review state got stricter and more honest.

### Tightened rules
Bootstrap/context root files no longer count as deliverable artifacts:
- `AGENTS.md`
- `SOUL.md`
- `TOOLS.md`
- `IDENTITY.md`
- `USER.md`
- `HEARTBEAT.md`
- `BOOTSTRAP.md`
- `MEMORY.md`

### Result
- bootstrap-only runs can no longer land in `Review`
- metadata-only runs cannot pretend they produced meaningful work
- review artifacts are now more trustworthy

### Durable rule
A run should only reach `Review` if it produced **real work output**, not just bootstrap read noise or context artifacts.

---

## 3. Weather widget: from plan to live implementation
Before today, the sidebar weather/time widget mostly existed as an implementation plan.
Today, it became real.

Reference plan:
- `projects/mission-control/docs/weather-widget-implementation-plan.md`

### What happened
Philippe explicitly asked not just to discuss the plan, but to turn it into reality.
That led to several live iterations in `projects/mission-control/components/shell/Sidebar.tsx`.

### Iteration sequence

#### Pass 1: compact orb skeleton
- replaced the larger card with a compact orb treatment
- stacked time + temp inside the orb
- moved condition/date beneath it
- added time-of-day palette shifts

### Why it failed aesthetically
It was structurally correct, but too safe.
Philippe correctly called it out as lacking wow-factor and reading more like a neat thermometer/badge than a real ambient widget.

---

#### Pass 2: stronger halo / glass / pulse treatment
- added visible halo/glow around the orb
- layered internal glass treatment
- shimmer/pulse behavior became visible
- condition strip became more designed

### Why it still wasn’t enough
Still too polite.
It read like a fancy decorative orb, not a small atmospheric scene.

---

#### Pass 3: day/night sky orb
The visual direction changed from “styled object” to “tiny sky scene.”

### Added
- starry night states
- moon / sun treatment
- stronger time-of-day color narrative
- horizon layer inside the orb

### Why this mattered
This was the first version that actually started to feel like a widget with mood instead of a stylized status badge.

---

#### Pass 4: premium weather-reactive orb
Philippe’s review pushed it toward the final kept direction.

### User feedback that mattered
- the orb shell should **not float**
- only the interior scene should move subtly
- the moon was too large and intersected the time
- the location label `Hoi An, Vietnam` was redundant and should be removed
- weather/date support text needed to be dark and readable again
- the orb should feel more premium
- the interior should react to **actual weather**, not just day/night

### Final kept direction
- still orb shell, still premium and compact
- bottom strip beneath the orb kept, because Philippe liked it
- orb remains still; interior scene moves subtly
- day/night sky scene remains the main visual language
- actual weather now influences scene overlays:
  - cloud/overcast = cloud layers
  - rain/drizzle/showers = subtle rain streaks
  - fog = haze
  - thunder = darker scene / reduced star clarity
  - clear weather = cleaner sky treatment

### Why this is the right current posture
It is now **worth observing in real usage** instead of immediately redesigning again.
The right next move is to watch it across real time/weather changes, not churn it further tonight.

### Commits from this pass
Notable workspace commits:
- `272e84e` — first orb conversion
- `c5d838e` — richer ambient motion
- `8759ae9` — day/night sky orb
- `f10812d` — weather-reactive and still orb

### Durable design lesson
For Mission Control micro-UI pieces, safe tasteful polish is often not enough.
If Philippe asks for presence/wow-factor, the better move is often to:
- simplify the shell
- make the inner scene more expressive
- let the visual logic tell a tiny story
rather than just add more neutral glass and gradients.

---

## 4. Nerve and front-end-skill posture
Today’s earlier research pass also re-established an important UI/implementation framing:
- Nerve is useful as a **reference architecture and interaction source**
- it is **not** the visual design lane to clone
- FLOATING remains the primary Mission Control identity lane, but certain components are allowed to stand out more when they serve the product well

The weather orb is a good example of the correct interpretation:
- do not slavishly obey a single muted brand lane
- do not become Nerve dark-mode either
- allow richer, more expressive objects when the surface calls for it

Also re-confirmed:
- the workspace has a `frontend-skill`, and UI-heavy work should use its posture intentionally
- the skill’s real value is not “make it flashy,” but “compose tastefully, with hierarchy and image-led restraint where appropriate”

---

## 5. Chat duplication regression: what happened tonight
This became the biggest technical problem of the evening.

### Reported behavior
Philippe noticed that:
- user messages duplicated a few seconds after sending
- assistant messages duplicated too
- the duplicate user copy initially included Control UI wrapper material like `Sender (untrusted metadata)` and nearby system execution lines
- in worse states, older messages could accumulate into **many copies**
- the transcript sometimes scrolled upward by itself

This was not a cosmetic bug.
It directly attacked Mission Control’s trustworthiness as a real chat surface.

---

## 5.1 early hypotheses and patches
The first phase of debugging focused on likely immediate causes.

### A. Hydrated/live dedupe mismatch
Hypothesis:
- live assistant message had a `runId`
- hydrated session-log copy didn’t
- dedupe treated them as different

### Patches attempted
- looser merge dedupe in `useRuntimeBridge.ts`
- same-role/same-body dedupe within a short timestamp window
- main-session key normalization (`agent:main:main` vs null-ish session keys)

### Result
Helpful in theory, but not the real root cause.

---

### B. Wrapper/system metadata replay
Hypothesis:
- hydrated session logs were replaying raw inbound Control UI wrappers
- that produced a second “system-ish” copy of the user message

### Patches attempted
- strengthened `sanitizeTranscriptBody()` in `app/api/runtime-bridge/route.ts`
- stripped all leading `System:` lines
- stripped `Sender (untrusted metadata)` blocks
- tolerated leading whitespace before metadata/timestamp removal

### Result
This fixed one layer of the problem:
- the ugly wrapper/system replay disappeared

But the clean duplicate copies still survived.

### Important lesson from this sub-step
This was still worth doing.
Even though it didn’t solve clone accumulation, it improved transcript hygiene and should stay.

---

## 5.2 the crucial clue
Two observations changed the diagnosis:

### Clue 1
Duplicates were not always just “double once.”
Sometimes older turns accumulated into many copies.

### Clue 2
The transcript occasionally scrolled upward by itself.

### Why these clues matter
That combination strongly points to:
- repeated message-list rebuilding / re-merging
- not a single one-time duplicate insert

In other words, the issue was likely **repeated active-session transcript rehydration**, not just bad dedupe keys.

---

## 5.3 the debugging dead end
A fair amount of time was spent trying to instrument the merge/render path more deeply.
That included:
- browser console warnings
- temporary client-side duplicate instrumentation
- a temporary plan to expose debug state directly in the UI

### What went wrong here
- Safari console visibility wasn’t reliable enough for the test loop
- preview ran production, so a `NODE_ENV !== 'production'` guard hid the debug strip
- the instrumentation path added noise without giving a clean decisive read quickly enough

### Important operational lesson
When a bug is clearly a regression in a narrow area and you already have known-good savepoints/commits, do **not** spend unlimited time building increasingly elaborate instrumentation if a simpler regression rollback/hunt is cheaper.

This matters for future agents.
Tonight’s correct move was eventually to stop probing and compare against known-good chat posture.

---

## 5.4 likely root cause and final fix
The likely regression source was the newer “smart” active-session transcript hydration behavior.

### Specifically
The active thread was being rehydrated again when transcript signatures changed, even though:
- the live WebSocket bridge was already active
- the current thread already had meaningful local live state

That meant the active thread could get history re-applied repeatedly while you were already in the conversation.

### Why that is dangerous
Repeated history merge into the active live thread can cause:
- clean duplicate turns
- duplicate accumulation over time
- DOM reshuffling / scroll jumps
- hard-to-reason-about interactions between WS live state and transcript history

### Final fix applied
Hydration was simplified back toward the older stable posture:
- hydrate when the session changes
- hydrate when there is no meaningful transcript yet
- otherwise rely on live bridge updates for the active conversation

### Commit
- `e162301` — `fix(mission-control): stop repeated transcript rehydration for active chat`

### Why this is currently the best explanation
Immediately after this change, Philippe tested with multiple short messages and reported:
- **no revenge of the clones**

That is not perfect proof, but it is a strong live signal that this was the right regression class.

---

## 5.5 what should stay from tonight’s chat fixes
Even though some experiments were removed, a few outcomes should remain conceptually important:

### Keep
- transcript sanitization should remain strong and strip Control UI wrapper noise from hydrated history
- active chat should default toward `agent:main:main`
- transient activity/runtime notices should stay out of durable transcript rows
- active-session hydration should stay simple, conservative, and low-frequency

### Do not casually restore
- aggressive signature-based active-thread rehydration
- repeated active transcript history merges while live WS state is already present
- debug scaffolding added only for tonight’s chase

---

## 6. Mission Control conceptual posture at end of today

## 6.1 Tasks
Tasks remains **good enough for now**.
It is okay to fix clear bugs, but it should not become the main build frontier again without a concrete reason.

## 6.2 Chat
Chat is still fundamentally a real operator surface, but today proved it is also the most state-sensitive area.
It should be treated with restraint.

### Durable Chat rule now
When touching Chat state/hydration/runtime behavior:
- prefer simpler truth-preserving mechanics
- distrust clever merge logic unless it solves a clearly verified real problem
- verify changes under real live messaging, not just static reasoning

## 6.3 Agents page
Agents is still the next major intentional page frontier.
That direction did not change today.

### Current Agents posture
- Phase 2 substance exists
- trio hierarchy / agent identities exist
- current problem is overload, not absence
- next pass should be editing/restraint/hierarchy tightening, not concept reset

## 6.4 Mission Control overall
Mission Control continues to clarify itself as:
- a truthful runtime/workspace companion shell
- not a fantasy app layer
- not a fake embedded chat toy
- not a design experiment detached from underlying operational truth

That direction is holding.

---

## 7. Important little details discovered today
These are the kinds of things that are easy to lose unless they are written down explicitly.

### 7.1 nested repo / outer repo discipline still matters
Mission Control work can be committed inside the nested `projects/mission-control` repo while the outer workspace still needs:
- wrap commit
- preview rebuild/restart
- real verification

This remains a real operational rule.

### 7.2 weather widget review process matters
Philippe’s live review clarified that for small UI objects:
- bottom informational strip can be the quiet support layer
- the visual hero can be much more expressive than the rest of FLOATING if it earns it
- motion should often live inside a stable frame, not in the whole object moving

### 7.3 savepoint and docs need to stay reality-first
Tonight reinforced a prior correction too:
- do the actual file writes before talking as if the handoff work is already underway
- savepoint narration should not run ahead of the repo state

### 7.4 active-session hydration is a protected area now
This is probably the single most important low-level implementation lesson from tonight.
The active thread should not be treated as just another persisted-history merge target.

---

## 8. Commits from today relevant to Mission Control
Not all of these remain conceptually “keepers” as final solutions, but they are part of the day’s real chain and useful for future archaeology.

### Weather orb / sidebar
- `272e84e` — `feat(mission-control): turn sidebar weather widget into floating orb`
- `c5d838e` — `refactor(mission-control): add richer ambient weather orb motion`
- `8759ae9` — `feat(mission-control): turn ambient widget into day-night sky orb`
- `f10812d` — `refactor(mission-control): make ambient orb weather-reactive and still`

### Chat duplication chase
- `f272df0` — `fix(mission-control): dedupe hydrated chat replay after live send`
- `560bca0` — `fix(mission-control): strip control-ui system wrappers from hydrated chat`
- `ac7782d` — `fix(mission-control): fully strip control-ui wrapper from hydrated messages`
- `50f7398` — `fix(mission-control): normalize main session key during chat dedupe`
- `20359be` — `chore(mission-control): add temporary chat duplication instrumentation`
- `a8b6025` — `chore(mission-control): surface hydrate debug state in chat ui`
- `e162301` — `fix(mission-control): stop repeated transcript rehydration for active chat`

### Tasks / execution / hygiene from earlier today
See `memory/2026-04-02.md` for the full chronology.

---

## 9. What tomorrow’s agent should assume is true

### Safe assumptions
- The weather orb is now live and worth observing before redesigning
- The next major page target is still Agents unless Chat duplication reappears
- Tasks is not the main frontier anymore
- The active-session rehydration simplification is the current best fix for the cloning bug

### Unsafe assumptions
- Do not assume every chat hydration hardening step from earlier Apr 2 was a pure improvement
- Do not assume more dedupe cleverness is the right next move if duplication reappears
- Do not assume the weather orb should be pushed further visually without first observing real time/weather transitions

---

## 10. Tomorrow-first recommendations

## If Chat behaves normally tomorrow
Do this:
1. confirm duplication remains gone through normal use and maybe one reload
2. if still clean, treat the bug as fixed and leave Chat alone
3. move to Agents page work as the main frontier

## If Chat duplication returns
Do this in order:
1. treat `e162301` as the last good conceptual fix
2. inspect any new hydration logic added after that
3. avoid rebuilding a large debug apparatus first
4. compare the active-thread hydration path directly against the older simple behavior
5. prefer regression rollback over clever merge expansion

## For the weather widget
Do not redesign immediately.
Observe:
- morning/day/night transitions
- rainy/cloudy behavior
- whether text readability holds across states
- whether the premium feel survives novelty fade

Only then decide whether the next pass should be:
- subtler
- more dramatic
- more refined typographically
- more weather-specific

## For Agents
The likely right next move remains:
- reduce overload
- preserve substance
- improve hierarchy and restraint
- avoid broad foundation churn

---

## 11. Long-term objectives still in force
These did not materially change today, but they should be restated so tomorrow’s agent keeps the right compass.

### Mission Control General Domain
Goal:
- a truthful daily operational cockpit for Philippe
- not a decorative prototype
- not a fake control room

### Chat
Goal:
- stable real runtime workspace
- human, personal, direct
- no fake embedded-chat claims
- no transport junk leaking into visible transcript

### Tasks
Goal:
- credible operator board with trustworthy lifecycle state
- eventually less dual-source fragility, but without rashly deleting compatibility layers today

### Agents
Goal:
- distinct, useful agent roster with personality and operational clarity
- restrained, not overloaded

### Design direction
Goal:
- FLOATING remains the core lane
- but individual surfaces/components are allowed to become more expressive if they earn it and improve the product

---

## 12. Final judgment
Today was not as cleanly triumphant as April 1, but it was still high-value.

Why:
- real Tasks hardening continued
- a planned widget became a live, reviewed feature
- a serious Chat regression was likely traced back to the right architectural cause
- the team learned an important systems lesson: **for active live chat, simpler hydration rules beat clever continual merge logic**

That is exactly the kind of lesson a future agent should inherit instead of rediscovering the hard way.
