# Mission Control Comprehensive Savepoint — 2026-03-29 Afternoon

## Purpose
This savepoint is the canonical handoff for the Mar 29 afternoon Mission Control work session.

Use this document as the first re-entry point before resuming Chat-page work.
It is intended to be complete enough that a future agent does **not** need Philippe to restate what happened, what was learned, what failed, what was fixed, what is currently true, and what the next safe steps are.

This savepoint should be read **after**:
1. `projects/_ops/mission-control-comprehensive-savepoint-2026-03-28-night.md`
2. `docs/runbooks/mission-control-runtime-preview-runbook.md`
3. this file

---

## Executive Summary
The top section of the Mission Control **Chat** page was substantially refined and is now in a strong “good enough for now” state.

The major accomplishments from this session were:
- the page-title treatment for Chat / Tasks / Agents / Crons / Memory / Files was redesigned into a more FLOATING-consistent, centered system-label treatment with whitespace and underline
- the Chat top control strip was reorganized into a cleaner two-row layout
- model switching was made real and stable
- effort/thinking switching was made real and stable
- reset was upgraded from a page reload shortcut into a real control action that resets model + thinking
- the preview/runtime stack was repeatedly debugged and stabilized using the correct runbook paths
- the top-strip status logic was iteratively hardened until it behaved acceptably under model + thinking transitions

The biggest conceptual shift from this session was:

> The top control strip should not pretend it knows runtime truth unless it actually has confirmed readback.

That led to a much sharper state model:
- write path can be optimistic
- readback path must be honest
- stale auto-refresh must not trample pending control state

By the end of the session, Philippe confirmed that the top section behaved as intended.

---

## What Was In Scope This Session
The active focus was the **top section of the Mission Control Chat page**, specifically:
- title treatment
- status/control rows
- WS/session indicators
- model dropdown
- effort dropdown
- reset behavior
- preview/runtime stability while iterating on the above

This was explicitly **before moving on to the section below the top controls**.

The work was done against the existing Mission Control truth established on Mar 28:
- same-origin runtime bridge remains the correct architecture
- Chat remains a real runtime-backed surface, not a fake embedded shell
- Nerve remains a systems-reference repo, not a design source of truth
- FLOATING remains the visual/design truth

---

## Files That Mattered Most In This Session

### Primary implementation files
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`
- `projects/mission-control/components/chat/MissionControlChatRuntime.tsx`
- `projects/mission-control/hooks/useRuntimeBridge.ts`
- `projects/mission-control/components/shared/PageScaffold.tsx`
- `projects/mission-control/lib/adapters/orchestrator.ts`
- `projects/mission-control/lib/chat/thread-model.ts`
- `projects/mission-control/lib/types/contracts.ts`

### Primary operational references
- `projects/_ops/mission-control-comprehensive-savepoint-2026-03-28-night.md`
- `docs/runbooks/mission-control-runtime-preview-runbook.md`

### Important contextual references
- `projects/_ops/mission-control-chat-implementation-brief-2026-03-28.md`
- `projects/_ops/mission-control-chat-phase1-execution-spec-2026-03-28.md`
- `docs/runbooks/mission-control-adaptation-runbook-2026-03-27.md`
- `docs/runbooks/stitch-mcp-codex-github-pages-workflow.md`
- local Nerve repo crawl from `/tmp/openclaw-nerve`

---

## High-Level Outcome

### Top strip status
The top strip is now close to “completed for now”.

#### Completed in a meaningful sense
- centered FLOATING page-title treatment for six General pages
- cleaner Chat control structure
- WS/session status moved into the top row
- status-details dropdown added
- model switching live
- effort switching live
- reset behavior live
- preview stack repeatedly stabilized and brought back to a healthy runbook-driven state

#### Deliberately not completed yet
- real agent switching remains placeholder-only
- top-strip state is much better, but should still be treated as an actively maintained interaction surface rather than fully frozen forever

The safe current product interpretation is:

> The top section is now strong enough to move on from, with the understanding that agent switching remains placeholder-only and future runtime/status infrastructure could improve it further.

---

## Detailed Narrative Of The Session

## 1. Startup / Re-anchoring work
The session reopened Mission Control after the Mar 28 breakthrough day.
The key instruction from Philippe was to avoid drifting into stale context and to treat the latest savepoint as the main source of truth.

Work done:
- re-read recent daily memory
- re-crawled the Mission Control repo
- re-read the latest Mission Control savepoint
- re-read the Mission Control preview/runtime runbooks
- re-inspected the live chat/runtime bridge code
- re-crawled the Nerve repo to re-orient around reusable architecture patterns without inheriting Nerve styling

### Important Nerve conclusion
Nerve should be treated as a **systems reference** only.
Reusable pieces from Nerve:
- websocket/proxy handshake patterns
- grouped tool rendering
- diff/file artifact display patterns
- event normalization ideas

Not to borrow from Nerve:
- shell style
- visual hierarchy
- overall aesthetic

FLOATING remains the design truth.

---

## 2. Title treatment redesign
Philippe asked for Chat / Tasks / Agents / Crons / Memory / Files titles to move away from the previous treatment and toward a shell-consistent, system-label look.

### Requested direction
- all caps
- medium grey
- more letter spacing
- closer to system-label typography
- later refinement: centered, more whitespace, thin underline, FLOATING spacing

### Implementation path
A new `system` title variant was added to `PageScaffold.tsx` and used across:
- `GeneralChatPage.tsx`
- `GeneralTasksPage.tsx`
- `GeneralAgentsPage.tsx`
- `GeneralCronsPage.tsx`
- `GeneralMemoryPage.tsx`
- `GeneralFilesPage.tsx`

### Final state
This evolved beyond the first pass into:
- centered title
- more whitespace above/below
- thin centered underline
- calmer, FLOATING-aligned rhythm

Philippe later explicitly approved this direction as looking neat and took it off the list.

### Durable conclusion
This title treatment is now the baseline for the six relevant pages.
Home is excluded.

---

## 3. Chat top-row structural redesign
Philippe wanted the top of Chat drastically simplified.

### Original problem
The top area contained too many pills and too much runtime-bridge noise.
Specifically, it included elements like:
- MARVIN
- RUNTIME REACHABLE
- BRIDGE READY
- a dedicated Runtime bridge posture section
- additional pills and descriptors that felt too operational/noisy

### Requested structure
Top row left:
- WS OPEN
- SESSION CONNECTED
- status icon opening a floating status panel

Top row right:
- Refresh
- Stop
- Context meter

Second row:
- Session / Agent
- Model
- Effort
- Reset
- Recent Sessions

### Final structural result
The top area was refactored into exactly that basic two-row shape.
The older Runtime bridge posture block was removed.

### Important UX detail
The status icon dropdown now acts as the place for:
- websocket status text
- session detail text
- refresh failures / bridge errors
- last event/session detail snippets

This meaningfully reduced visible noise while keeping the detail accessible.

---

## 4. Refresh behavior rethought
Originally, the bridge polling auto-refreshed continuously.
Philippe questioned whether removing auto-refresh entirely would break live chat updates.

### Important distinction established
There are two update paths:
1. websocket live event stream
2. summary snapshot refresh

Removing summary polling does **not** kill live chat events.
Live chat still comes via WS.

### Revised rule implemented
- remove constant background snapshot polling
- keep manual Refresh button
- trigger refresh after each completed chat run (success/error/abort)

### Why this matters
Philippe’s real use case was cross-device visibility, especially messages arriving via other channels like Telegram.
So the desired behavior was:
- no noisy auto-poll loop
- but still refresh after actual conversation completion

This was implemented in `useRuntimeBridge.ts`.

---

## 5. Preview/server breakages and runtime lessons
Several preview failures occurred during the UI work.
These are important because they were not random; they exposed recurring operational patterns.

### Failure mode A: split-brain preview stack
There were cases where:
- proxy and WS sidecar were up
- internal Next server on 3007 was down
- result: proxy error saying it could not reach Next

This exactly matched the split-brain risk already warned about in prior savepoints.

### Correct response
Use the Mission Control preview scripts and runbook:
- `scripts/preview-stop.sh`
- `scripts/preview-build.sh`
- `scripts/preview-start.sh`
- or `scripts/preview-restart.sh`

Do not rely on ad-hoc `npm start` / orphaned process management when the preview stack has gone split-brain.

### Failure mode B: port collision / stale processes
At multiple points, helper scripts hit `EADDRINUSE` on:
- 3005
- 3006
- 3007

This produced mismatched old runtime + new assets and caused browser-side exceptions or inconsistent behavior.

### Durable operational lesson
After meaningful UI/control changes, do **not** assume preview restart succeeded just because a helper exited.
Always verify:
- Next server alive
- proxy alive
- WS sidecar alive
- `/general/chat` returns 200

### Failure mode C: client-side exception caused by control wiring
A browser crash occurred after the first attempt to wire live dropdown controls.
The root cause was not the title pass.
It came from the new interactive control wiring in `MissionControlChatSurface.tsx`.

The resolution path was:
- back out risky live control wiring
- restore stable top strip
- reintroduce controls in smaller steps

That incremental recovery strategy was the correct call.

---

## 6. Safe incremental control wiring strategy
After the browser crash, the top strip controls were reintroduced in stages.

### Stage 1: harmless dropdown shells only
- Agent / Model / Effort dropdowns rendered as UI only
- no runtime mutation attached
- used to confirm layout and browser stability

### Stage 2: model switching only
Model switching became live via the already-trusted path:
- send slash-style commands through `live.sendPrompt(...)`

Mapped controls:
- `gpt-5.4` → `/model codex5.4`
- `codex-5.3` → `/model codex`
- `minimax-2.7` → `/model minimax2.7`
- `qwen3.5-plus` → `/model qwenplus`

This held up under testing and was accepted.

### Stage 3: effort switching
Effort was then wired after an important user correction.

#### User correction
The command format is not `/level <x>`.
It should be `/think:<x>`.

Correct effort commands:
- `/think:low`
- `/think:medium`
- `/think:high`
- `/think:xhigh`

That correction is important and should be remembered.

### Stage 4: reset behavior
Reset evolved from a reload fallback into a real runtime control action.
Eventually it was made to do:
1. `/model minimax2.7`
2. short wait
3. `/think:low`

This was necessary because resetting only the model left thinking stale.

---

## 7. Evolving understanding of thinking-level support across models
One of the most important product-truth clarifications from this session:

### Current exposed models and thinking support
- `gpt-5.4` / codex5.4 → `low / medium / high / xhigh`
- `codex-5.3` / codex → `low / medium / high / xhigh`
- `MiniMax-M2.7` → `low / medium / high`
- `qwen3.5-plus` → `low / medium / high`

### Earlier false assumption that was corrected
At one point, the UI treated MiniMax and/or other models as effectively `Standard` locked.
That was wrong.
This was corrected after live testing.

### Final direction
Remove fake Standard-lock behavior.
All exposed models should surface explicit thinking levels.
The only difference is whether `xhigh` is available.

---

## 8. The big truthfulness problem: write path vs readback path
This was the deepest conceptual problem solved during the session.

### Initial problem
The control UI could **write** model/thinking changes fast, but it could not reliably show the true post-change state.

Examples seen in practice:
- `xhigh` on GPT-5.4 normalized to `high` when moving to MiniMax
- Mission Control still displayed `xhigh`
- auto-refresh sometimes showed stale previous model/effort
- manual refresh sometimes corrected it
- other times confirmation arrived only on a later refresh

### Key conceptual rule established
The honest state model should be:
- **exact value** only when confirmed by trustworthy runtime readback
- **Last requested: ...** after a control action but before confirmation
- **Runtime-controlled** only when runtime owns the state but exact value cannot be proven

Later, Philippe pushed for an even tighter UX simplification:
- for the top strip, prefer `Last requested: ...` over vague fallback labels
- remove `Standard`
- minimize or eliminate `Runtime-controlled` in that strip where possible

This became the final direction.

---

## 9. Real readback path discovery
This was the critical technical breakthrough that made the top strip more truthful.

### Discovery
`openclaw status --json` already exposes the needed session data, including:
- model
- `thinkingLevel`

The problem was not absence of data.
The problem was that Mission Control’s adapter/surface pipeline was **throwing it away** or not using it properly.

### Fix
The adapter/surface path was updated so that:
- recent session entries can carry `thinkingLevel`
- thread/chat summary can expose that as `effortLabel`
- the chat surface can use confirmed runtime thinking data when it arrives

### Files involved
- `lib/types/contracts.ts`
- `lib/adapters/orchestrator.ts`
- `lib/chat/thread-model.ts`

This is a durable architecture improvement, not just a one-off UI tweak.

---

## 10. Remaining tricky bug: stale auto-refresh trampling pending state
Even after adding real readback, one especially annoying pattern remained.

### Observed pattern
When changing both:
- model
- and thinking

then the UI would often:
1. show correct pending state first
2. receive a stale/intermediate auto-refresh summary
3. wrongly overwrite the pending state with old/stale values
4. later manual refresh would show the correct final answer

### Important diagnosis
This was not random.
It meant:
- write path was fine
- readback source was mostly fine
- **auto-refresh was trusting stale intermediate summaries too early**

### Fix: confirmation gate
A confirmation gate was added for:
- pending model
- pending effort

Rule:
- do not clear pending state until confirmed runtime readback matches the requested target
- stale auto-refresh must not overwrite pending model/effort prematurely

This was one of the key final hardening steps.

---

## 11. Final simplification of top-strip effort behavior
The very last conceptual simplification came from Philippe’s suggestion:

### Philippe’s suggestion
If Reset explicitly asks for `low`, then just keep showing:
- `Last requested: low`

instead of falling back to vague labels.

### Why this was right
For this control strip:
- explicit requests are more useful than vague placeholders
- `Standard` is muddy and misleading
- `Runtime-controlled` is honest but less exact/useful than a clear pending request label

### Resulting rule
The final top-strip effort display order became:
1. `Last requested: ...` if pending/requested exists
2. confirmed exact effort if readback has arrived
3. fallback to `Last requested: low` instead of `Standard` in reset/defaultish situations

This made the strip more stable and more legible.

---

## 12. What Philippe explicitly validated during the session
Important user validations from the live testing loop:

### Approved / accepted
- title treatment now looks neat and is off the list
- top section overall is in the right direction
- model switching worked across exposed models
- effort switching worked once corrected to `/think:<level>`
- reset behavior eventually reached acceptable behavior
- final top-strip behavior after the last fixes seemed to work as intended

### Important user findings that drove fixes
- codex CLI auth is separate from runtime auth
- runtime OAuth should use `openclaw models auth login --provider openai-codex --set-default`
- `xhigh` normalization on model switch exposed false assumptions in the UI
- MiniMax and Qwen support low/medium/high, not just fake Standard
- reset initially failed to reset thinking level
- auto-refresh was the source of stale-state corruption after model+effort changes
- manual refresh often showed the correct value sooner than auto-refresh, revealing where the timing bug lived

---

## 13. OAuth/auth findings from this session
This was not strictly a Mission Control UI change, but it mattered operationally during the same session.

### Important distinction
There are two separate auth stores:
- Codex CLI auth: `~/.codex/auth.json`
- OpenClaw runtime auth: `~/.openclaw/agents/main/agent/auth-profiles.json`

Refreshing one does not refresh the other.

### Runtime OAuth refresh command discovered
The correct command for runtime OpenAI Codex OAuth is:

```bash
openclaw models auth login --provider openai-codex --set-default
```

### Why it mattered
A `refresh_token_reused` error in logs caused fallback to qwen at one point.
Manual runtime OAuth refresh fixed that.

### Important process lesson
Do **not** edit `auth-profiles.json` without Philippe’s permission.
A mistaken direct edit/clear attempt happened during the session and had to be reverted immediately after Philippe objected.
This is a durable boundary rule.

---

## 14. Current top-strip truth model
As of the end of this session, the intended truth contract for the top strip is:

### Model card
- show requested target while pending
- show exact model once confirmed by runtime readback
- do not snap back to stale previous model due to intermediate auto-refresh

### Effort card
- prefer `Last requested: ...` during pending state
- replace with exact confirmed effort when readback lands
- do not use fake `Standard`
- minimize vague fallback behavior in this strip

### Agent card
- currently stable visual placeholder with Marvin + planned seats
- real agent switching is **not** implemented yet

### Status detail
- WS/session details remain available via the status icon dropdown

---

## 15. What is actually done vs not done

## Done enough / completed for now
- title treatment for the six General pages
- Chat top section basic structure
- cleaner top-row WS/session presentation
- status icon details dropdown
- model dropdown live
- effort dropdown live
- reset behavior live
- top-strip stability significantly improved
- preview/runbook discipline reaffirmed

## Not done yet / explicitly still future work
- real agent switching backend path
- explicit pending/confirmed visual affordances beyond label text alone
- deeper status-synchronization polish if future testing still finds edge cases
- the next section of the Chat page below the controls

---

## 16. Recommended next step after this savepoint
Assuming the top section is accepted as done-for-now, the next work should move **down the page**.

Recommended immediate next focus:
- the section below the top controls on the Chat page

Recommended posture when resuming:
- do **not** casually reopen the title/top-strip architecture unless Philippe reports a concrete issue
- keep the top strip in maintenance mode, not redesign mode
- preserve the current truth model and cautious runtime-control posture

---

## 17. Operational/testing checklist for future Mission Control continuation
Before resuming tomorrow or later:
1. read the Mar 28 savepoint
2. read this savepoint
3. verify preview stack via runbook
4. confirm `/general/chat` returns 200
5. if touching controls again, test these flows explicitly:
   - model-only switch
   - effort-only switch
   - model + effort switch
   - reset from qwen-high
   - reset from gpt-5.4-xhigh
6. if UI appears stale, distinguish:
   - stale preview stack
   - stale summary readback
   - stale pending-state logic

---

## 18. Durable lessons from today’s Mission Control work

### Design / product lessons
- FLOATING title treatment benefits from more whitespace than first instinct suggests
- Nerve is reference architecture, not reference aesthetic
- control strips should minimize visible noise while keeping detail one click away
- top-strip truthfulness matters more than making state look “finished” too early

### Runtime / engineering lessons
- preview stack failures are often split-brain or port-collision failures, not app-code failures
- reintroducing risky UI behavior in smaller safe steps is better than trying to wire everything at once
- auto-refresh can be more dangerous than helpful if it is allowed to clobber pending state with stale summaries
- `openclaw status --json` is a real source of structured runtime truth for recent sessions, including `thinkingLevel`

### Human/process lessons
- when Philippe says something feels off, the phrasing usually pinpoints the real bug class very accurately
- when a UI section is almost right, the correct move is often careful truth-model cleanup, not more features
- for auth/control-plane sensitive files, inspect and explain first; do not mutate without permission

---

## 19. Files most likely to change next time
If resuming the next Chat-page section, the most likely files to touch are:
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`
- possibly `projects/mission-control/components/chat/MissionControlChatRuntime.tsx`
- possibly new/adjacent chat subcomponents if the section below gets split out

If top-strip truth issues resurface, revisit:
- `projects/mission-control/hooks/useRuntimeBridge.ts`
- `projects/mission-control/lib/adapters/orchestrator.ts`
- `projects/mission-control/lib/chat/thread-model.ts`
- `projects/mission-control/lib/types/contracts.ts`

---

## 20. Bottom line
The afternoon session materially improved Mission Control Chat.

The title treatment is now right.
The top strip is far cleaner.
The controls are real.
The preview/runtime process is better understood.
The truth model for model/effort state is much better than it was at the start of the session.

The final important takeaway is:

> The top section should now be treated as “completed for now,” unless Philippe finds a specific remaining defect.

The right next move is to continue downward into the next Chat-page section, not to keep polishing the top strip forever.
