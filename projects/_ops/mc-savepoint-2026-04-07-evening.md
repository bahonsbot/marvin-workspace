# Mission Control Savepoint — 2026-04-07 Evening

## Purpose
This is the handoff savepoint for later-today Marvin / any future agent resuming Mission Control work after the Apr 7 evening break.

Read this after the Apr 6 savepoints and recent daily memory if Mission Control work is reopened.

---

## Executive summary
Apr 7 was a large Mission Control reliability + truthfulness day.

The most important outcomes:

1. **Morning Meeting cleanup** produced several low-risk doc/process fixes and one meaningful runtime change:
   - Mission Control autonomous web research now supports and uses **SearXNG** in preview runtime
   - current endpoint: `http://72.60.232.55:32768`

2. **Sudo / Dev Team workflow got materially more truthful and more stable**:
   - plan-only autonomous tasks are now hardened against accidental implementation
   - MiniMax autonomous runs now start with `thinking=high`
   - Sudo cards are summary-first and artifact-aware
   - redundant Sudo orchestration chrome was removed
   - the Sudo panel now features the **newest orchestration first**, fixing the bug where a newer completed run could appear to “snap back” to an older `Philippe needed` waiting state

3. **Mission Control speech-to-text (STT) Phase 1 is now materially implemented**:
   - `app/api/transcribe/route.ts`
   - `lib/transcribe.ts`
   - `components/chat/useSpeechToText.ts`
   - mic button wiring in `components/chat/MissionControlChatSurface.tsx`

4. **Mission Control now supports local Whisper transcription**:
   - provider = `local` or `openai`
   - preview is configured for `local`
   - whisper model downloaded to `/data/.nerve/models/ggml-base.en.bin`
   - local path is build-verified and route-verified

5. **STT browser testing is currently blocked by secure-context rules, not backend failure**:
   - Safari on the current preview access path reports:
     - `Microphone capture requires a secure browser context. Open Mission Control over HTTPS or a trusted local origin.`
   - this is now understood and intentionally deferred until the built/live Mission Control lane

6. **Standalone Specialist seats now have a real implementation plan**:
   - direct seat-selectable specialists
   - existing agent workspaces/skills reused
   - specialist-scoped memory required
   - Japin specifically called out as a lesson-memory benchmark
   - Vantage is explicitly **not** a standalone specialist; she is a team lead like Sudo and is deferred for later redesign

7. **Latest Sudo run review (Chat top-section collapse)** landed cleanly and was wrapped:
   - kept as a valid implementation
   - additional requested UI polish included
   - Chat top-section collapse is now in a good enough wrapped state

---

## What changed today — chronological operational narrative

## 1. Workspace home-improvement pass (morning)
A bounded workspace-lane improvement was executed:
- cleaned up `docs/runbooks/trading-path-container-cutover.md`

What changed:
- turned it from a mixed historical narrative into a cleaner operational runbook
- added quick rollback at top
- clarified preflight / shadow validation / cutover checklist / notes

Why it matters:
- easier to scan during actual ops
- less ambiguity around expected validation state

---

## 2. Morning Meeting: review findings were investigated instead of blindly accepted
Important durable lesson from the morning:
- several overnight report findings looked actionable at first
- after inspection, multiple were overstated or stale

This led to a correction that should stay active:
- **treat overnight review findings as leads, not truth, until verified against current runtime/files**

Actual accepted Morning Meeting fixes:
- `AGENTS.md` queue-safety wording aligned with `AUTONOMY.md`
- missing `scripts/cron_tasks/enrichment_ab_review.py` entry added to `TOOLS.md`
- AGENTS/AUTONOMY hierarchy clarified in `AUTONOMY.md`
- search-system scope clarifier added to `TOOLS.md`

Meaningful Morning Meeting runtime change:
- Mission Control autonomous web research switched from `duckduckgo-html` to **`searxng`**
- preview env updated
- provider support added in code
- verified end-to-end

Important nuance:
- the original `nightly-memory-extraction` “prompt misconfiguration” finding was downgraded
- actual issue was intermittent model path drift, not a broken saved prompt
- prompt was hardened and then manually re-run successfully on GPT-5.4

---

## 3. Trading-path side investigation resolved a false Alpaca-auth alarm
A reported Alpaca 401 on paper-trading looked like auth failure, but investigation proved:
- paper credentials were valid
- the failing path was the **signal accuracy report script**
- it was not loading the bot project `.env`

Fix:
- `projects/autonomous-trading-bot/scripts/signal_accuracy_report.py`
  now loads minimal Alpaca/PAPER env from project `.env`

Outcome:
- false `POSITION_FETCH_FAILED` flags gone
- reports for `2026-03-13` and `2026-04-07` now show `positions.health = ok`

Durable lesson:
- standalone report/maintenance scripts must load required env explicitly, not assume parent runtime exported it

---

## 4. Futures bot Review-lane cleanup
The Review-lane task `Futures bot improvement` was inspected and normalized.

Truth discovered:
- the task produced real work
- but the board representation was weak/misleading
- real artifacts existed, but Mission Control under-reported them
- task overshot the ask: it implemented the improvement instead of only producing the requested plan

Cleanup performed:
- artifacts attached in `projects/mission-control/data/autonomous-tasks.json`
- result rewritten to reflect real truth
- explicit review note added
- moved from Review to Done with the right nuance preserved

This matters because it established the review standard:
- keep useful work
- record when a task solved the wrong shape of problem
- don’t reject real work just because the framing was off

---

## 5. Mission Control autonomous task runner hardening
Two concrete guardrails were added to:
- `projects/mission-control/scripts/run-autonomous-task.mjs`

### 5A. Planning-only tasks must not silently implement
New behavior:
- if a task is clearly asking for a plan/proposal/spec, the runner marks it planning-only
- prompt explicitly forbids implementation
- runner snapshots repo state before execution
- non-markdown execution artifacts / code changes are rejected and rolled back for planning-only runs

This directly addresses Philippe’s stated preference:
- when he asks for a plan, he does **not** want the change already applied

### 5B. MiniMax runs now start with `thinking=high`
New behavior:
- if the effective autonomous task model resolves to `minimax2.7`, the runner now starts that run with `thinking=high`
- this is set at initial execution time, not via later chat messages

This prevents the same class of setup mismatch seen previously where MiniMax route quality depended on late follow-up commands

---

## 6. Sudo verification work — speech-to-text plan request
Philippe manually sent Sudo a plan-style brief for Mission Control speech-to-text.

Original Sudo behavior:
- lane choice was good
- no over-delegation
- strategic recommendation was good
- but it stopped at a recommendation summary instead of creating the requested plan artifact

Follow-up done by Marvin:
- wrote the actual plan file:
  - `projects/mission-control/docs/speech-to-text-implementation-plan.md`

Takeaway:
- Sudo preserved the plan-only boundary correctly
- but deliverable completeness was weak until Marvin created the actual file

This became the first strong prompt to improve Sudo card rendering:
- the UI was dumping too much long-form answer text into the top surface
- no visible artifact made the run look like a huge essay blob

---

## 7. Sudo card and orchestration UI cleanup
A major Mission Control Chat refinement happened here.

### 7A. Sudo run cards became summary-first and artifact-aware
Main changes:
- top of card now shows concise synthesis/summary first
- long answer/original brief moved into collapsed section
- deliverable block added for artifact-backed runs
- speech-to-text plan file attached to the completed Sudo run so the new UI had a real object to show

### 7B. Redundant Sudo orchestration chrome removed
Removed:
- explanatory runtime text
- `Let Sudo handle this` button
- manual-lanes section from the top of the Sudo team panel

Why:
- clutter
- duplication
- not helpful for the normal direct-chat Sudo workflow

### 7C. More deduping
Completed runs now hide a lot of redundant prompt/rationale noise and avoid empty execution-summary boxes for direct-answer cases.

### 7D. Scrollability fix
Later, after another user screenshot review:
- the Sudo orchestration section was made scrollable
- this fixed the issue where multiple open dropdowns/details trapped the page and made content unreadable

### 7E. Heading cleanup
Also removed the redundant visible `Sudo decisions` heading inside the Sudo team section

Net result:
- much calmer Sudo review surface
- more artifact-led
- much less repeated prose

---

## 8. Speech-to-text Phase 1 implementation became real
Philippe then told Sudo to continue from the STT plan and actually build Phase 1.

Important correction to earlier reasoning:
- Philippe later clarified that this task began after the Sudo UI was already in a steady state
- so if the resulting run felt muddled, the blame belonged to **this run’s own truth surface**, not earlier UI churn

### What the Dev Team actually did
The orchestration used the full Dev Team path:
- backend → frontend → QA

Real implementation landed:
- `projects/mission-control/app/api/transcribe/route.ts`
- `projects/mission-control/lib/transcribe.ts`
- `projects/mission-control/components/chat/useSpeechToText.ts`
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx` mic-button integration

### What Marvin had to stabilize
The run had done real work, but the final representation was weak.
Cleanup/stabilization pass:
- confirmed real code landed
- wrapped frontend implementation cleanly
- documented missing env in `.preview-runtime/mission-control-preview.env.example`
- rewrote the Sudo orchestration record to point to actual Phase 1 artifacts and runtime requirement

At that point STT Phase 1 became a coherent implementation slice rather than a vague orchestration blob.

---

## 9. Ported Nerve-style local Whisper into Mission Control
Philippe asked what Nerve uses and preferred the self-hosted no-key path.

Investigation of `/tmp/openclaw-nerve` showed:
- Nerve supports both OpenAI and local Whisper
- local path uses `@fugood/whisper.node`
- ffmpeg converts audio
- provider switch uses env

Mission Control originally supported only OpenAI.

Port performed:
- `projects/mission-control/lib/transcribe.ts`
  now supports:
  - `openai`
  - `local`
- installed packages:
  - `@fugood/whisper.node`
  - `@fugood/node-whisper-linux-x64`
- configured Next to treat whisper packages as server-side externals
- preview env switched to:
  - `MISSION_CONTROL_TRANSCRIBE_PROVIDER=local`
  - `MISSION_CONTROL_WHISPER_MODEL=base.en`
  - `MISSION_CONTROL_WHISPER_MODEL_DIR=/data/.nerve/models`
- downloaded whisper model:
  - `/data/.nerve/models/ggml-base.en.bin`
- added docs:
  - `projects/mission-control/docs/local-whisper-stt-notes.md`

### Verification details
- build passed after fixing native-package externalization
- preview restarted cleanly
- `/api/transcribe` route responded through the local path
- sine-wave smoke test returned empty transcript, which is healthy/expected for non-speech input
- crucially, no API-key/config/auth failure remained

So the backend/local STT path is now genuinely alive.

---

## 10. Browser voice-input diagnostics proved the blocker is secure context, not backend
After enabling mic permission in Safari, Philippe still saw:
- `Voice input is not available in this browser.`

Investigation found the old frontend check was too vague:
- it only tested `MediaRecorder` + `getUserMedia`
- it did not distinguish secure-context failure vs API absence vs permission denial

Patch added:
- more precise browser diagnostics in `useSpeechToText.ts`
- UI now distinguishes:
  - insecure context
  - missing `getUserMedia`
  - missing `MediaRecorder`
  - permission denial later in flow

Resulting real message in Safari:
- `Microphone capture requires a secure browser context. Open Mission Control over HTTPS or a trusted local origin.`

Meaning:
- backend/local Whisper is **not** the blocker
- Safari permission is **not** the blocker
- incognito/private mode may still matter, but the direct blocker is secure origin policy

Decision taken:
- **postpone live browser mic capture polish until Mission Control is accessed via proper built/live HTTPS lane**
- do not keep spending time on preview-only origin plumbing right now

This lines up with:
- `projects/_ops/mission-control-dev-sandbox-lane-plan-2026-03-31.md`

Current STT status therefore is:
- backend/local path implemented and healthy
- frontend path implemented
- browser live use deferred pending secure built/live lane

---

## 11. Critical Sudo state bug fixed: older waiting run hijacked newer completed run
Philippe reported the exact problem:
- a run asked `Philippe needed` with options
- he answered it
- Sudo ran the Dev Team sequence
- but after all steps finished, the panel seemed to return to the original `Philippe needed` state instead of staying complete

Investigation found the real bug:
- the Sudo panel featured **any active run first**
- so an older waiting run could reclaim the top slot after a newer run finished

Fix:
- Mission Control now sorts orchestrations by recency
  - `updatedAt`
  - fallback `completedAt`
  - fallback `requestedAt`
- newest run is always featured first
- older runs remain in History

This directly solved the “snapped back to old Philippe-needed state” bug.

This is important:
- the earlier Sudo weirdness was not only about presentation
- there was a real featured-run selection bug
- that specific cause is now fixed

---

## 12. Latest Sudo test run: Chat top-section collapse
Philippe gave Sudo another real task:
- improve the top-section of the Chat page following:
  - `projects/mission-control/docs/chat-collapsible-top-section-plan.md`

Outcome:
- lanes chosen correctly:
  - Frontend Developer -> QA Engineer
- real frontend diff landed in `MissionControlChatSurface.tsx`
- run was coherent enough to keep without rescue-heavy rewriting

Wrapped result:
- artifact attached
- synthesis summary improved
- changes/findings normalized
- at the same time Philippe requested two extra fixes:
  - remove `Sudo decisions` label in team section
  - make Sudo orchestration section scrollable
- these were included in the same wrap pass

Net result:
- this Sudo run is a good proof point that the Sudo system is landing more cleanly now

---

## 13. Standalone Specialist seats plan created
Philippe asked for implementation guidance on direct specialist seats and added two important corrections:

### Correction A
Vantage is **not** a standalone specialist.
She is a **team lead** like Sudo, but her team setup may change, so active Vantage work should be deferred.

### Correction B
Existing agent workspaces and related skills already exist.
So the feature should not create agents from scratch.
It should wire Mission Control to those existing real agents/workspaces.

Plan written:
- `projects/mission-control/docs/standalone-specialist-seats-implementation-plan.md`

Important plan positions:
- seat taxonomy:
  - Marvin = core
  - Sudo/Vantage = team leads
  - Johan/Milou/Japin/etc. = standalone specialists
- specialists should be direct chat seats in the selector
- no Sudo-like side section for specialists
- must be real agents, not Marvin wearing masks
- must have memory/continuity
- Japin specifically needs lesson-memory continuity and recurring corrections/progression support

This is the main forward-looking Mission Control feature plan from the end of Apr 7.

---

## Current Mission Control repo state at this savepoint
### Recent important Mission Control commits from today
Key commits in `projects/mission-control` include:
- `a10b3df1` — `feat: add searxng web research provider`
- `1dcf3fd3` — `fix: harden planning-only autonomous runs`
- `98899a2a` — `docs: add speech-to-text implementation plan`
- `98ddaea8` — `feat: tighten sudo result cards`
- `eda74628` — `refactor: trim sudo orchestration chrome`
- `30eb157e` — `feat: land phase-1 chat speech-to-text`
- `0ae80509` — `feat: add local whisper transcription support`
- `e22a04e6` — `improve: explain voice input compatibility failures`
- `f3b9aa60` — `fix: feature newest sudo run first`
- `d8683531` — `feat: wrap chat top-section collapse polish`
- `355ff066` — `docs: add standalone specialist seats plan`

### Important non-Mission-Control commits elsewhere today
Workspace/docs/ATB:
- queue-safety wording alignment
- tools/docs clarifications
- ATB signal accuracy env fix
- review/memory learnings capture

---

## Known-open issues / deferred items

## A. Live browser mic capture remains deferred
Not a code failure now. It is an environment/security-context issue.

Current blocker:
- preview access path is not a secure enough browser context for Safari mic capture

Do **not** waste time rediscovering this from scratch later.
The next real STT-browser step should happen only when testing under the proper built/live Mission Control lane over secure origin.

### If reopened later, do this in order:
1. use proper built/live HTTPS Mission Control access path
2. verify Safari secure context
3. test mic capture with local Whisper backend
4. then polish UX if needed

## B. Sudo completion normalization is improved but still worth watching
The biggest known bug was fixed:
- older waiting run no longer hijacks newer completed run

However, future work should still keep improving normalized completion truth:
- clean `summary`
- real `artifacts[]`
- explicit `unresolvedIssues[]`
- explicit next-step truth

This is **less urgent now**, but still a valid reliability lane if Sudo weirdness reappears.

## C. Vantage/team-lead architecture is deferred
Do not accidentally implement Vantage as a standalone specialist.
She belongs in the team-lead lane, later, after team-setup decisions are clearer.

---

## What to do next when Mission Control resumes
Recommended priority order:

## 1. Start from the Standalone Specialist seats plan
Main next feature target:
- implement direct real specialist seats in the selector using existing agent workspaces
- do **not** start with Vantage
- one real specialist first
- specialist-scoped memory is required, not optional

### Strong first candidate
- **Japin**
  - because lesson continuity is clear and memory requirements are obvious/testable

## 2. Keep STT browser testing deferred until live lane
Do not reopen preview-only secure-context wrestling unless Philippe explicitly wants that detour.

## 3. Use Sudo again, but now watch these exact acceptance points
When Sudo is tested on future tasks, check:
- newest run stays featured
- artifacts are attached or follow-up wrap is minimal
- summary is concise and truthful
- no stale `Philippe needed` run steals focus

## 4. If reliability work is preferred before new features
Then the next reliability task should be:
- strengthen Sudo final-state schema normalization so every completed run ends artifact-first and summary-clean

---

## Concrete truths later agents should not forget
- Mission Control autonomous web research now uses **SearXNG** in preview
- STT backend/local Whisper path is real and healthy
- browser mic issue is secure-context/HTTPS, not backend failure
- Vantage is a **team lead**, not a standalone specialist
- specialist rollout should reuse existing agent workspaces and skills
- specialists must have their own memory/continuity
- Japin should be treated as the clearest benchmark for lesson-memory continuity
- the Sudo “snap back to older Philippe-needed state” bug was caused by featured-run selection logic and was fixed by recency-first selection
- latest Chat top-section collapse run is a valid keep-and-wrap success, not another muddled rescue

---

## Suggested re-entry checklist for the next session
1. Read this savepoint
2. Read `memory/2026-04-07.md`
3. Read `projects/mission-control/docs/standalone-specialist-seats-implementation-plan.md`
4. Check current `projects/mission-control` git status
5. If building further, start from the specialist-seat plan unless Philippe redirects

---

## Final posture at break
Mission Control is in a materially better state than this morning:
- Sudo surface cleaner
- Sudo state bug fixed
- STT architecture real
- local Whisper path real
- secure-context blocker understood and intentionally deferred
- next major feature direction documented cleanly

This is a good stopping point.
