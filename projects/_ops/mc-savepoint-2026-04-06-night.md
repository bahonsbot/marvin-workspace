# Mission Control Savepoint — 2026-04-06 night

## Executive summary
This was the session where the **Mission Control Dev Team stopped being concept art**.

At the start of the afternoon, Sudo/dev-team behavior was still mostly:
- seat-flavored chat framing
- Marvin still doing the actual work underneath
- some UI truth improvements, but not enough to claim a real team workflow

By the end of the night, the system crossed a real threshold:
- **Chat seat selection is now first-class** for Marvin / Sudo / Vantage
- **Sudo has a real orchestration layer** with parent-run records and bounded decision modes
- **Sudo can delegate to FE / BE / QA child runs** with lane-specific model defaults
- **Marvin oversight / escalation boundaries exist explicitly** rather than as implied roleplay
- **the first true end-to-end Sudo execution succeeded in live use** on the Mission Control sidebar redesign
- the Sudo chat surface has already had its first restraint/polish pass and is now **clean enough for now**

This savepoint should be treated as the canonical handoff for resuming **Mission Control Dev Team / Chat / Sudo work** tomorrow.

The biggest conceptual change is simple:

> Mission Control is no longer just experimenting with internal seats.
> It now has the beginning of a **truthful lead-and-lanes operating model**:
> **Marvin supervises, Sudo leads, FE/BE/QA execute.**

That model is still young and needs more proving, but it is now real enough that further work should focus on:
- reliability
- ergonomics
- cleanup
- evolution of the team contract

not on pretending the feature exists when it does not.

---

## What changed conceptually today

### Morning assumption vs end-of-day reality
At the beginning of this session, the working assumption was still half transitional:
- Agents page had become much more operational on Apr 5
- Sudo/dev-team felt promising
- but the runtime truth was still muddy

The day clarified a stricter product line:

#### What was *not* good enough
- “Activate in Chat” that only prefilled a Sudo starter prompt
- Marvin wearing a Sudo mask
- lane cards that looked real but still depended on manual operator interpretation
- model switching done as chat theater
- Sudo UX that exposed too much orchestration/debug furniture at once

#### What the product now wants to be
- **Seat selection in Chat chrome**, not prompt-injection theater
- **Sudo as real dev-team lead route**, not just role text
- **explicit FE / BE / QA lanes** as execution primitives
- **Marvin as oversight/escalation layer**, not the disguised hidden actor on every normal dev step
- **model choice as part of run/session setup**, not a conversational afterthought
- **Sudo Chat UI as an operating surface**, not a debugging dashboard

That conceptual shift matters more than any one file change.

---

## Why the Nerve repo mattered, and what it did *not* solve
Philippe pointed to `/tmp/openclaw-nerve` before we built further. That was the right move.

### What Nerve gave us
Nerve validated that these things are real and worth copying:
- per-run `model` and `thinking`
- child-session tracking for task execution
- agent-specific workspace separation
- session-level model patching in some contexts

### What Nerve did *not* give us
It did **not** give the desired organizational hierarchy by itself:
- Marvin supervises
- Sudo manages the dev team
- FE / BE / QA execute via first-class lanes

So the right takeaway was:
- **borrow Nerve’s execution plumbing patterns**
- **build our own supervisory hierarchy on top**

That was the correct decision. The rest of the day followed from it.

---

## Mission Control work completed today, chronologically

## 1. Reorientation and latest-state review
Before building, Mission Control project state and relevant runbooks were re-read and the latest savepoints were used as the closing context:
- `projects/_ops/mc-savepoint-2026-04-05-night.md`
- `projects/_ops/mc-savepoint-2026-04-06-afternoon.md`

This confirmed the active frontier:
- tighten Agents/Marvin/Sudo realism
- then pressure-test the Sudo/dev-team path

That prevented reopening random old fronts.

---

## 2. Marvin oversight panel polish on Agents
### Problem
The Marvin right-side oversight block still read like a **full-height mini dashboard** and visually overpowered the rest of the seat card.

### Fix
`projects/mission-control/components/agents/AgentSeatCard.tsx`
- reduced height/weight
- tightened padding and card mass
- turned it into a more compact oversight block rather than a side-column dashboard

### Verification
- `npm run build` passed
- preview restarted cleanly

### Commit
- `bfc2a778` — `agents: compact marvin oversight panel`

This was a small but correct first move: less noise before adding more truth.

---

## 3. Codex model-guidance layer added properly
Philippe shared the OpenAI Codex Prompting Guide and asked whether it could become a local model-guidance doc like `gpt-5.4.md`.

### What was done
Created:
- `model-guidance/codex.md`

Updated:
- `AGENTS.md`

### Outcome
When the runtime switches to `openai-codex/gpt-5.3-codex` (`codex`), the workspace now has an explicit guidance layer telling it to:
- behave like the coding-specialist route
- favor autonomous implementation with verification
- keep user chatter light
- batch exploration intelligently
- prefer tool-first execution
- preserve frontend quality standards when relevant

### Why this mattered
This became part of the Dev Team foundation:
- Marvin / Sudo orchestration can stay on `codex5.4`
- execution lanes can use `codex`
- and `codex` now has workspace-specific guidance instead of generic behavior only

### Workspace commit
- `d7e5586` — `docs: add codex model guidance`

This should be remembered as an intentional runtime architecture move, not a side-note doc addition.

---

## 4. Phase 1 — truthful seat runtime defaults
### Problem
Sudo activation was still mostly prompt framing.

### Goal
Make seat activation carry **real runtime metadata** even before full delegation existed.

### What was added
In Mission Control seat definitions / chat activation metadata:
- runtime mode (`Direct control`, `Lead route`, `Seat mode`)
- default model
- default thinking
- supervisor label
- child-seat labels

### Chat changes
The seat-aware chat surface now knew, in principle:
- what Sudo is supposed to be
- what model/effort it wants
- which lanes belong under it

### Sudo’s new truthful posture
Sudo became:
- **lead route**
- Marvin-routed for now
- default model `codex5.4`
- default thinking `medium`
- intended child lanes: FE / BE / QA

### Runbook update
`docs/runbooks/mission-control-agents-operating-model.md` was updated to reflect this truthful runtime posture and the Codex guidance foundation.

### Verification / commits
- Mission Control repo: `406e49a5` — `agents: add phase1 seat runtime defaults`
- Workspace repo: `7c28cd4` — `docs: update mission control agents phase1 runtime brief`

### Important product conclusion after Phase 1
Philippe immediately called the bluff correctly:
> if Sudo is still just Marvin in a costume, that is not the workflow we actually want.

That was the right correction, and it pushed the build into real Phase 2/3 work instead of fake testing.

---

## 5. Phase 2 — real lane delegation plumbing
### Goal
Build the smallest honest vertical slice where Sudo can really send work to lanes.

### What landed
A Codex implementation pass added:
- `app/api/agents/sudo-delegations/route.ts`
- `scripts/run-sudo-delegation.mjs`
- `lib/agents/sudo-delegation.ts`
- `data/sudo-delegations.json`
- corresponding UI support in the chat surface

### Lane defaults
- Frontend Developer → `codex`
- Backend Developer → `codex`
- QA Engineer → `minimax2.7`

### What this meant
For the first time, the system had:
- real child lane runs
- explicit lane model defaults
- lane run tracking back into Mission Control

### What it still did *not* mean
Not yet:
- full autonomous Sudo leadership
- Sudo deciding and sequencing on its own
- a true natural workflow test

It was still operator-triggered lane delegation.

### Commit
- `ca86b95a` — `Add Sudo delegated lane runs`

This was the right intermediate step, but not the destination.

---

## 6. Seat selector cleanup — Sudo becomes native in Chat chrome
### Problem Philippe surfaced
The old “Activate in Chat” behavior still felt bolted on:
- it injected starter text into the composer
- it made Sudo feel like role-play instead of a real operating mode
- it competed with the rest of the chat surface

### Correct product move
Turn the old Session/Agent placeholder control into a **real Seat selector**.

### What changed
Mission Control Chat now has:
- a real seat dropdown for:
  - Marvin
  - Sudo
  - Vantage
- no automatic starter-text injection when seat changes
- a compact seat-aware treatment in top controls instead of the old large activation flow

### Commit
- `3ea91be0` — `Integrate chat seat selector`

This was a major product-shape improvement. It made Sudo feel like a system concept, not a prompt trick.

---

## 7. UI regressions from seat integration, and what was learned
Two visual regressions showed up immediately once Sudo became more native.

### Regression A — leftover seat panel shell
#### Symptom
When switching seats, especially Sudo → Marvin, part of the old seat UI shell lingered behind.

#### Fix
Removed the extra seat panel shell entirely and folded seat state into the existing top control row.

#### Commit
- `4bc857e4` — `chat: remove leftover seat panel shell`

### Regression B — Sudo panel felt like it was behind/inside the transcript
#### Symptom
Marvin → Sudo still looked wrong. The Sudo panel read like it was transparent and ghosting into the live runtime transcript.

#### Actual cause
This was less a pure z-index bug and more a **surface separation problem**:
- too-translucent panel
- too little spatial break from transcript
- page read as overlapping layers

#### Fix
- made the Sudo panel more opaque
- tightened border/shadow
- separated it more clearly from transcript

#### Commit
- `f5c7c0a3` — `chat: separate sudo panel from transcript`

### Durable UI lesson
Mission Control’s FLOATING visual language can make bugs feel like layering bugs when they are really:
- containment bugs
- card separation failures
- over-translucency
- competing surface hierarchy

Screenshots were especially effective in solving these. Keep using them.

---

## 8. Phase 3 — full Sudo workflow stack
This was the core of the day.

### Phase 3A — Sudo autonomous decision layer
#### Goal
Sudo should become a bounded lead that can choose what to do with a brief.

#### What landed
Decision modes:
- `direct_answer`
- `ask_question`
- `propose_alternative`
- `delegate`

Parent-run orchestration records were added.
The system could now show that Sudo first decides, then possibly launches child lanes.

#### Why this mattered
This finally introduced the **question-option Philippe explicitly asked for**.
Sudo no longer had to blindly execute when:
- the brief was unclear
- the tradeoff was meaningful
- there was a better alternative worth proposing first

#### Commit
- `799e3433` — `Implement Phase 3 Sudo orchestration`

### Phase 3B — better sequencing, execution-plan structure, final synthesis
#### Goal
Move beyond the first simple decision into something more team-lead-like.

#### What landed
- clearer lane sequencing
- richer execution-plan structure
- stronger final synthesis

This gave Sudo a better way to explain:
- lane order
- why this order
- expected outputs
- validation intent
- completion criteria
- final summary of what happened

#### Commit
- `139dd600` — `Implement Mission Control Phase 3B`

### Phase 3C — Marvin oversight / escalation / approval boundary
#### Goal
Finish the supervisory contract so Sudo knows when not to bluff.

#### What landed
Explicit boundary states for:
- blocker
- conflict
- approval-needed
- uncertainty / elevated risk

The system can now distinguish:
- informative oversight
- approval required
- Marvin review required

#### Commit
- `8ace132c` — `Implement Mission Control Phase 3C oversight`

### Why the stack matters
By the end of Phase 3, the architecture was:
- **3A** = Sudo decision layer
- **3B** = sequencing + plan + synthesis
- **3C** = oversight / escalation boundary

That was the first moment we could honestly say:
> yes, this is now worth real workflow testing.

---

## 9. First real workflow tests, and the bugs they exposed
Once the sidebar redesign task was used as a real Sudo test, several important failures showed up.

These are all worth remembering because they describe how fake autonomy leaks into a system if you are not strict.

### Bug 1 — Sudo seat submit path was still seat-blind
#### Symptom
A Sudo task request ended up replaying old Marvin-side content instead of creating a real Sudo run.

#### Root cause
The composer submit path still sent prompts directly into the live Marvin runtime, even when Sudo was selected.
The seat UI changed, but the actual send path did not.

#### Fix
With Sudo active, composer submit now routes into Sudo orchestration instead of straight into the normal live chat path.

#### Commit
- `2a0c4231` — `chat: route sudo seat submits to orchestration`

#### Durable lesson
A seat selector alone means nothing if the submit path is still seat-blind.

---

### Bug 2 — brittle `codex5.4` model acknowledgement gate
#### Symptom
Sudo orchestration blocked with:
- `model override was not acknowledged by runtime. Requested codex5.4.`

#### First assumption
It looked like a naming/alias matcher problem similar to past autonomous-task issues.
That was **partly true**, but not the whole truth.

#### First patch
The acknowledgement matcher was broadened and given a retry window.

#### Commit
- `c7fa75c5` — `sudo: harden model override acknowledgement`

#### But deeper investigation found the real problem
The orchestration runner was still trying to switch models by sending:
- `/model codex5.4`
into synthetic runner sessions.

That was the wrong primitive.
It worked like chat theater, not like reliable runtime setup.

#### Actual fix
Refactored Sudo orchestration and lane runs so model choice is prepared as part of **session setup**, not chatted in afterwards.

#### Commit
- `3672cad4` — `Refactor sudo model selection to session setup`

#### Durable lesson
For synthetic/autonomous execution, model selection must be part of run creation/session setup, not a conversational slash-command hack.

This is the same family of truth problem previously seen in Mission Control autonomous task execution.

---

### Bug 3 — Sudo returned valid decision JSON, but the runner parsed the wrong object
#### Symptom
Even after getting past model setup, Sudo failed with:
- `Sudo orchestration did not return a supported decision mode.`

#### Initial suspicion
Maybe Codex produced the wrong schema.

#### Actual root cause
The runner’s JSON extraction logic grabbed the **first `{...}` object** in the output stream, which could be the outer CLI wrapper rather than Sudo’s actual fenced decision payload.

#### Fix
Changed extraction to score multiple JSON candidates and prefer the one that actually looks like a Sudo decision:
- `mode`
- `lanePlan`
- `lanePlanSteps`
- `oversight`

#### Commit
- `3b9a76c3` — `sudo: prefer decision json payload over wrapper`

#### Durable lesson
When working with model/CLI wrappers, “first JSON object wins” is not safe enough. Rank candidates by task-specific schema likelihood.

---

## 10. First successful real Sudo build: sidebar redesign
### Task used for real validation
Philippe asked Sudo to improve the left sidebar using:
- `projects/mission-control/docs/sidebar-redesign-plan.md`

### Result
This eventually became the first **successful end-to-end Sudo build**.

### What Sudo did
- created a real orchestration run
- chose a **frontend-only lane plan**
- launched a real delegated FE child run
- completed it cleanly
- returned a believable successful summary

### Mission Control repo commit produced by the run
- `abbfb1b7` — `mission-control: implement collapsible lucide sidebar redesign`

### Files changed by Sudo/FE execution
- `components/shell/Sidebar.tsx`
- `components/shell/ShellContext.tsx`
- `components/shell/AppShell.tsx`
- `components/shell/AppShellClient.tsx`
- `components/shell/navigation.ts`
- `app/globals.css`
- `package.json`
- `package-lock.json`

### Outcome Philippe gave after preview restart
- visually very good
- functionality okay
- no complaints on the sidebar itself

This was a real milestone.
This was the first true proof that the Dev Team stack can execute a scoped implementation plan and land something good enough to keep.

---

## 11. Sudo Chat cleanup pass after first success
Once the architecture proved itself, the UX problem became obvious.
Sudo worked, but the Chat integration still felt cluttered and too debug-console-like.

### Philippe’s alignment with the critique
The following cleanup priorities were agreed:
1. compress the Sudo header hard
2. demote manual lane buttons
3. show only one active/current run by default
4. hide or demote internal IDs
5. collapse execution-plan detail by default after completion
6. demote historical failed runs

And Philippe added three practical requests:
- clear the composer after Sudo submit
- let old Sudo decisions be dismissed with an X
- add a lightweight “Review with Marvin” / handoff action when Sudo completes

### Cleanup pass result
Codex implemented the cleanup and committed:
- `eeebb017` — `Polish Sudo chat flow`

### Outcome after preview restart
Philippe judged it:
- **clean enough for now**
- much better than the previous version

That is the current posture.
Do not casually reopen Sudo Chat for broad redesign tomorrow. The next pass should be purposeful.

---

## 12. Agent Team status was clarified late in the evening
### Morning Meeting carryover question
A stale-info item had come up around:
- `projects/_ops/agent-team/`
- how TOOLS.md still framed it

### What was verified tonight
`projects/_ops/agent-team/` contains:
- prompts
- workflow docs
- handoff/reference assets
- a shell helper

It does **not** read like a live runnable package in the software/runtime sense.

### Correct interpretation
It is now:
- historical/governance/reference
- still containing reusable patterns/templates
- but largely superseded by the Dev Team / Sudo path

### Philippe’s direction
Retire it gracefully:
- preserve anything still worth porting
- archive/relabel the rest
- stop presenting it as a live path in core docs

That retirement pass has been conceptually queued, but not executed in this session.

---

## Commits from today’s Mission Control work
This is the easiest clean list for tomorrow-you.

### Mission Control nested repo commits
- `bfc2a778` — `agents: compact marvin oversight panel`
- `406e49a5` — `agents: add phase1 seat runtime defaults`
- `ca86b95a` — `Add Sudo delegated lane runs`
- `3ea91be0` — `Integrate chat seat selector`
- `4bc857e4` — `chat: remove leftover seat panel shell`
- `f5c7c0a3` — `chat: separate sudo panel from transcript`
- `799e3433` — `Implement Phase 3 Sudo orchestration`
- `139dd600` — `Implement Mission Control Phase 3B`
- `8ace132c` — `Implement Mission Control Phase 3C oversight`
- `2a0c4231` — `chat: route sudo seat submits to orchestration`
- `c7fa75c5` — `sudo: harden model override acknowledgement`
- `3b9a76c3` — `sudo: prefer decision json payload over wrapper`
- `3672cad4` — `Refactor sudo model selection to session setup`
- `abbfb1b7` — `mission-control: implement collapsible lucide sidebar redesign`
- `eeebb017` — `Polish Sudo chat flow`

### Workspace-level docs/guidance commits related to today
- `d7e5586` — `docs: add codex model guidance`
- `7c28cd4` — `docs: update mission control agents phase1 runtime brief`

---

## Current product truth at the end of the night

### Mission Control Chat / Dev Team posture
- Chat seat selector is now real for Marvin / Sudo / Vantage
- Sudo is a truthful lead route, not just a starter prompt
- FE / BE / QA lanes are real delegated child-run lanes
- Sudo has a bounded decision layer:
  - direct answer
  - ask question
  - propose alternative
  - delegate
- Sudo has stronger sequencing/synthesis than it started with
- Marvin oversight / escalation / approval boundary is explicit
- the first successful Sudo-led implementation has happened live
- Sudo Chat cleanup pass is good enough for now

### What is still *not* true
- Sudo is still not a fully separate persistent backend runtime in the purest sense
- the workflow is real, but still young and needs more testing on diverse task shapes
- the system still has debug/history clutter risks if allowed to accumulate forever

---

## Bugs solved today that tomorrow-you should not rediscover

1. **Seat-aware send path matters as much as seat-aware UI**
   - if Sudo seat submit goes to normal Marvin chat, the whole feature becomes fake

2. **Model setup must happen as part of session/run preparation**
   - not by chatting `/model ...` into synthetic sessions

3. **Wrapper JSON can be mistaken for real decision JSON**
   - use ranked extraction, not first-object parsing

4. **Too-translucent card stacks can feel like overlap/ghosting bugs**
   - especially on FLOATING surfaces

5. **Screenshot-led debugging works extremely well on Mission Control UI issues**
   - several of today’s fixes were much faster because Philippe supplied screenshots

6. **Once Sudo became real enough, the right next pass was restraint, not more features**
   - this mirrors a recurring Mission Control lesson: after substance lands, the next pass is usually editing

---

## Long-term objective after today
The long-term objective is clearer now.

Mission Control should become:
- a truthful operator shell
- with real internal leads and lanes where appropriate
- where each “agent”/seat is not just branding, but a meaningful operating context
- and where runtime truth, delegation truth, and UI truth stay aligned

For Dev Team specifically, the medium-term objective is:
- keep proving the Sudo workflow on real tasks
- harden it until it feels boringly reliable
- make Marvin/Sudo boundary clearer when needed
- keep the UI light enough that it remains usable as Chat, not a mission log wall

For older internal multi-agent ideas:
- fold useful patterns into the new Dev Team posture
- archive legacy framing that causes confusion

---

## Best next steps tomorrow
Priority order, unless Philippe changes direction:

### 1. Verify the Sudo cleanup pass in a few more real tasks
Use small to medium real implementation tasks and see:
- does Sudo choose the right lane?
- does it ask questions when it should?
- does it over-delegate or under-delegate?
- does Marvin review trigger only when it truly should?

### 2. Do the old Agent Team retirement pass
Goal:
- audit `projects/_ops/agent-team/`
- preserve useful prompt/contracts if still worth porting
- archive/relabel the rest
- update `TOOLS.md` and any other docs that still frame it as a live package

### 3. Keep Mission Control Chat cleanup restrained
Do not casually reopen broad visual redesign.
If reopened, prefer:
- operational cleanup
- better history handling
- better dismissal/archive affordances
- only small visual refinements

### 4. Keep note of one likely future need
If Sudo continues to prove useful, Mission Control may eventually want:
- richer handoff from Sudo completion into Marvin review
- better history retention/archiving of runs
- maybe clearer lane-specific output surfaces

But do **not** race there yet. First prove reliability through actual use.

---

## What tomorrow-you should not forget emotionally/operationally
A lot happened today, but the important tone is this:
- Philippe was right to push past fake Sudo activation
- the best progress came when the system was forced to be more truthful, not more theatrical
- several frustrating blockers were not “the model is dumb” problems but **plumbing-truth** problems
- once those were fixed, Sudo immediately produced one genuinely good piece of work

That means this path is worth continuing.
It also means future work should stay merciless about truth.

If something only *looks* like a team workflow but still secretly routes like a single-seat trick, it should be treated as incomplete.

That was the real lesson of the day.
