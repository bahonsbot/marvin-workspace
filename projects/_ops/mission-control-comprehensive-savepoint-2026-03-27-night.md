# Mission Control Comprehensive Save Point

Date: 2026-03-27 (after midnight, following the Mar 26 full-day rebuild/resume session)
Status: current continuity anchor
Owner: Marvin + Philippe
Purpose: capture the full Mission Control state after the rollback-to-snapshot recovery day and the extensive rebuild/polish cycle that followed, including what was recovered, what was materially changed, what conceptual/product decisions were made live, what must not be forgotten tomorrow, and what the likely next direction is.

---

## Read this first

This file is now the most recent and most complete Mission Control continuity anchor.
If resuming Mission Control work, treat this as the primary source of truth.

Read alongside:
- `projects/_ops/mission-control-comprehensive-savepoint-2026-03-26-midnight.md`
- `projects/_ops/mission-control-agents-build-brief-2026-03-26.md`
- `projects/_ops/mission-control-execution-spec-2026-03-25.md`
- `docs/runbooks/mission-control-agents-page-design-handoff.md`
- `docs/runbooks/mission-control-runtime-preview-runbook.md`
- `docs/runbooks/stitch-mcp-codex-github-pages-workflow.md`
- `projects/mission-control/docs/FLOATING-DESIGN-SYSTEM.md`
- `projects/mission-control/docs/FLOATING-HANDOFF.md`
- `memory/2026-03-26.md`
- `memory/2026-03-27.md`
- `MEMORY.md` (Mission Control Direction)

If older Mission Control assumptions conflict with this file, prefer this file.

---

# 1. Session framing and critical context

## 1.1 Snapshot rollback happened before today’s work
Philippe reported that the VPS had been rolled back to a snapshot from the previous night because multiple files appeared missing in the morning and recent Mission Control progress had been lost.

Important nuance:
- Philippe suspected MiniMax-M2.7 may have contributed to drift/misbehavior earlier, but explicitly did **not** want to over-assert blame without certainty.
- The practical result was a rollback to a cleaner baseline, then a careful re-anchoring effort.

This matters because:
- some Mission Control work from the past days was partially or fully absent at session start
- continuity had to be rebuilt from savepoints, runbooks, memory, and on-disk state
- this session was both a recovery session and a major forward-progress session

---

## 1.2 First operational check: nightly memory extraction
Before diving back into product work, Philippe asked whether nightly memory extraction had already run in the restored snapshot.

Answer confirmed:
- `memory/2026-03-26.md` existed
- it included the `01:00 — Nightly Memory Extraction` entry for source day `2026-03-25`
- re-extraction was **not** needed

This removed the immediate risk that yesterday’s continuity had been lost at the memory layer.

---

# 2. Re-anchoring process used today

Before resuming implementation, Mission Control continuity was rebuilt by re-reading:
- Mission Control project files
- Mission Control/Stitch runbooks
- recent daily memory
- `_ops` Mission Control planning/savepoint files
- the latest designated source-of-truth files for the Agents page

Philippe explicitly instructed that the read sequence should end on these three sources:
1. `projects/_ops/mission-control-comprehensive-savepoint-2026-03-26-midnight.md`
2. `projects/_ops/mission-control-agents-build-brief-2026-03-26.md`
3. `docs/runbooks/mission-control-agents-page-design-handoff.md`

This was done successfully.

Practical result:
- Marvin was re-anchored on the current Mission Control state without needing Philippe to re-explain everything from scratch
- the page maturity map, shell truth, Agents next-step direction, and Stitch hierarchy were reconstructed correctly before new edits began

---

# 3. Source-of-truth hierarchy reinforced today

A very important Mission Control implementation hierarchy was re-confirmed live.

## 3.1 Shell/chrome truth
The **Home page Stitch/MCP export** remains the shell truth for:
- left rail
- top bar
- bottom status strip baseline behavior/style
- overall spacing rhythm
- overall FLOATING composition language

When later Stitch pages conflict with Home in shell/chrome, **Home wins**.

---

## 3.2 Page-composition truth
The **Agents Stitch design** was treated as page-composition truth only, not shell truth.

That means it is valid for:
- roster composition
- card hierarchy rhythm
- section ordering
- visual emphasis

But **not** for:
- shell/nav inconsistencies
- changed top bars
- changed left menu structures
- drifted palette decisions that conflict with Home/Chat
- literal sample text like `Systems & Agents`

---

## 3.3 Design-system selection rule
Philippe clarified that Stitch can leak multiple design systems into exports.
When that happens:
- only use **Aura Concierge / Floating**
- ignore the others completely

This is a durable implementation rule.

---

# 4. Mission Control state after today’s work

Mission Control General is now in a substantially stronger place than it was at the start of the day.

## 4.1 General-page maturity after this session

### Home
- still the shell/chrome anchor
- still a hybrid page rather than the final last word
- lower-left utility widget was significantly reworked today
- still likely a future refinement target, but not the main blocker right now

### Chat
- remains structurally corrected and good enough for now
- later shell framing was harmonized to match the rest of General better
- greeting-led framing was removed so it aligns with the same title rhythm as other pages

### Tasks
- remained good enough for now
- received consistency/responsive cleanup during the broader sweep
- no structural reopening today

### Agents
- became the main focus of today’s deeper design/build work
- progressed from transitional roster page to a much more operational and identity-rich surface
- now likely needs **editing/restraint/reduction**, not another foundational rethink

### Crons
- received FLOATING consistency harmonization
- all groups now open collapsed by default
- judged good enough by Philippe after the pass

### Memory
- received FLOATING consistency harmonization
- grey-on-grey readability problem was addressed
- now visually aligned enough with the rest of General

### Files
- received FLOATING consistency harmonization
- now visually aligned enough with the rest of General

---

## 4.2 Overall General status after today
General now has:
- much stronger cross-page coherence
- more reliable shell rhythm
- better responsive behavior than before
- a clearer visual family across Home / Chat / Tasks / Agents / Crons / Memory / Files

Remaining likely next work:
- a calmer/editing-focused Agents refinement pass
- possibly another Home pass after that
- then a decision whether to deepen Agents functionality further or re-open Home polish

---

# 5. Exact work completed today

This section is intentionally detailed.

---

## 5.1 Agents page: design comparison and implementation planning
After re-anchoring, Philippe provided:
- Home page Stitch screenshot
- Agents page Stitch screenshot
- Home MCP export prompt
- Agents MCP export prompt

These were used to compare the current `GeneralAgentsPage.tsx` against:
- shell truth (Home)
- page-composition truth (Agents)
- the build brief
- the design handoff

Key conclusion from that comparison:
- the current page was **conceptually aligned but compositionally behind**
- it still felt too much like a dashboard/status page
- it needed to become a roster/workspace page
- but the underlying truth logic was worth preserving

A build plan was then produced and approved.

---

## 5.2 Agents page: first major redesign pass
Builder then implemented the first major Agents redesign pass.

High-level outcomes:
- roster-first composition
- live trio + planned agents presented together in a stronger FLOATING roster
- summary section refined
- quieter system agents kept clearly secondary
- Home shell truth preserved

This was the first pass that brought Agents into the right family, but it still needed iteration.

Key Builder commit:
- `2775ad41` — `feat: redesign agents roster page`

---

## 5.3 Agents page: iterative polish passes after live preview review
Philippe reviewed the preview and gave multiple rounds of precise design feedback.
Those rounds matter because the final result is cumulative.

### Round 1 fixes
Feedback included:
- horizontal expansion / responsive glitches in roster cards
- remove unnecessary `GENERAL ROSTER` explanatory copy
- simplify summary metrics
- give future agents temporary real names / roles
- revisit the lower-left clock/widget

Applied changes included:
- tighter roster behavior
- cleaner summary treatment
- future agents named as:
  - **Rafa** — Sportsbet Advisor
  - **Sloane** — Content Creator
  - **Pico** — Travel Planner
- first stronger clock treatment attempt

Commit:
- `d4956b30` — `refine: tighten agents roster layout`

### Round 2 fixes
Feedback included:
- center the roster/active/background summary block
- make clock treatment taller and more playful
- single-cell direction preferred

Applied changes:
- centered summary tiles
- taller single-cell clock treatment

Commit:
- `e98e0849` — `refine: center agents summary and restyle clock`

### Round 3 fixes
Feedback included:
- clock still not right
- remove inner ivory boxes
- make it feel more integrated into the widget

Applied changes:
- clock simplified into the main panel
- less boxed treatment

Commit:
- `76f9863d` — `refine: simplify sidebar clock treatment`

### Round 4 fixes
Feedback included:
- remove spaces around the colon
- tighten spacing further so it reads as one unit

Applied changes:
- tighter clock typography
- plain `17:24` style

Commit:
- `aed22476` — `refine: tighten sidebar clock spacing`

Important note:
- Philippe still was not fully satisfied with the widget/clock direction after these rounds
- later a weather-first reference card was supplied and the widget direction changed substantially again

---

## 5.4 Crons / Memory / Files FLOATING harmonization batch
Philippe asked whether Crons, Memory, and Files could be brought into the same FLOATING family as Chat, Tasks, and Agents without changing UX/functionality.

Builder executed a bounded harmonization pass.

Key outcomes:
- calmer editorial title treatment
- cleaner cream/ivory and glass-like surfaces
- reduced muddy grey styling
- improved spacing/breathing room
- Memory readability issue fixed
- same UX and functionality preserved

Commit:
- `e6c004b9` — `style: harmonize floating general pages`

Philippe liked the result.

---

## 5.5 Crons default collapsed + widget redesign pivot
Philippe then requested two more things:
1. Crons should open with Runner-backed (and effectively all groups) collapsed by default
2. lower-left widget needed a better design direction

Philippe supplied a visual reference via Telegram for the widget.

Key direction from that reference:
- one calm tile
- weather-first utility feel
- less mini-dashboard energy
- more atmospheric/floating feel
- possible floating shadow

Applied changes:
- Crons groups start collapsed by default
- widget reworked into a softer single floating tile
- more weather-first hierarchy
- stronger but elegant shadow

Commit:
- `2c3933c5` — `refine: collapse crons and restyle widget`

Philippe liked this substantially more.

---

## 5.6 General consistency + responsive cleanup pass
Philippe approved a bounded final General cleanup pass combining:
1. cross-page consistency sweep
2. responsive/narrow-width polish

Builder executed this pass across:
- Home
- Chat
- Tasks
- Agents
- Crons
- Memory
- Files

Key goal:
- tighten rough edges without reopening structure

Commit:
- `0fc003b1` — `polish: tighten general page consistency`

Result:
- General became more coherent as one family
- responsiveness improved
- hidden small mismatches were reduced

---

## 5.7 Shell framing pass: tabs, status strip, title/subtext pattern
Philippe then requested:
- move General/Trading tabs slightly right so they align better with page content
- center and humanize the bottom status strip
- remove raw host/container-ish primary emphasis
- replace page framing subtexts with quotes for Chat, Tasks, Agents, Crons, Memory, Files
- for Chat specifically, remove `Good evening, Philippe` and just use `Chat` + subtext like the other pages

A first codex invocation failed due to prompt parsing, then was rerun correctly.

Applied changes:
- tabs nudged right
- bottom status strip recentered and made friendlier
- quote-based page framing added across the target pages
- Chat title normalized to match the other pages
- preview scripts were also touched in this period to remove some old runtime-path assumptions

Commit:
- `8413f2b5` — `Polish general shell framing`

Important:
- Philippe later decided the repeated quotes were too much and asked for a calmer alternative

---

## 5.8 External preview breakage and fix
After the shell framing pass, Philippe hit a **502 Bad Gateway** on `preview.motiondisplay.cloud`.

Cause:
- the preview start script had been changed to bind the app to `127.0.0.1`
- that worked for local verification
- but it broke the external reverse-proxy path

Fix applied:
- restored preview bind to `0.0.0.0`
- restarted preview
- recommitted the script change

Commit:
- `41ef8b60` — `fix: restore external preview bind`

This is a very important operational lesson.

---

## 5.9 Quotes removed, centered underline added, status strip simplified further
Philippe then requested:
- remove the quote subtexts because they were too much when repeated across every page
- replace them with a thin centered underline/divider below the title
- simplify the bottom strip into:
  - VPS + status light
  - CPU + load bar
  - RAM + used/total + bar
  - Disk + percentage full + bar
  - Refreshed + timestamp

Applied changes:
- quote text removed from visible headers
- centered underline treatment added under page titles
- bottom strip converted into a cleaner metric-chip format with subtle bars

Commit:
- `e3c56357` — `Refine general headers and status strip`

Philippe liked this direction a lot more.

---

## 5.10 Bottom strip behavior change requested
Philippe then noted that the bottom strip looked neat but was in the way while browsing pages like Crons or Tasks.

Decision:
- do **not** do a separate rebuild just for this
- batch it into the next Agents pass

Requested behavior:
- strip should sit at page bottom
- not remain sticky while scrolling

This was later included in Agents Phase 2.

---

## 5.11 Agents Phase 2 planning
After the General cleanup work, Philippe asked what should come next for Agents deeper functionality.

Recommended direction:
- separate “pretty roster” from “actually useful control surface”
- focus on Marvin / Builder / Reviewer first as real live seats
- clarify states and actions
- improve avatars and identity
- uplift planned agents without pretending they are live
- include the bottom strip no-longer-sticky behavior change in the same cycle

Philippe approved doing A/B/C/D/E of the proposed Phase 2 plan now, leaving tomorrow’s future-agent deeper identity pass for later.

---

## 5.12 Agents Phase 2 implementation pass
Builder then executed Agents Phase 2.

Scope included:
A. live trio operational hierarchy
B. avatar system upgrade
C. truthful/useful actions
D. planned-agent identity uplift
E. bottom status strip no longer sticky

Key outcomes:
- Marvin / Builder / Reviewer now read much more like real operational seats
- single-letter badges were replaced by a proper FLOATING/Aura Concierge medallion/avatar system
- live trio got clearer runtime meaning and actions
- planned agents feel more intentional and less placeholder-like
- bottom strip now sits at page bottom instead of sticking while browsing

Commit:
- `3d5760c9` — `feat: refine agents operational roster`

Philippe’s reaction:
- a lot more is happening now
- this is **better in substance**, but “a bit too much” visually/information-wise
- tomorrow’s likely task is to keep the substance but reduce the noise

This is a key product judgment.

---

# 6. Current conceptual/product truth after today

This section matters as much as the code changes.

## 6.1 General is now coherent enough
By the end of this session:
- Chat is good enough for now
- Tasks is good enough for now
- Crons is good enough for now
- Memory is good enough for now
- Files is good enough for now
- Home is acceptable as shell truth, but still a possible future refinement target
- Agents has progressed materially, but now needs editing/reduction rather than more raw addition

This is a strong shift from the earlier state.

---

## 6.2 Agents has crossed from “too empty” to “too much”
This is a useful milestone.

The page is no longer suffering from being just a pretty but empty roster.
Now it risks the opposite problem:
- too much information
- too much motion/detail/structure
- too many visible layers competing at once

This means the next work should likely be:
- not another fundamental rebuild
- not adding still more features blindly
- but **editing, restraint, hierarchy tightening, and selective simplification**

That is the correct interpretation of Philippe’s feedback.

---

## 6.3 Avatar direction is now established
Philippe explicitly said the old single-letter avatars were sad and needed upgrading.
This was done.

Durable truth:
- agent identity should feel real and designed
- avatars should stay within FLOATING / Aura Concierge
- avoid cartoonish, glossy, gamer-style, or over-illustrated directions
- composed medallion/identity systems are the right family

Tomorrow’s future-agent deeper identity pass should build on this, not revert to generic badges.

---

## 6.4 Page framing direction changed again
Quotes across every page were a good experiment but too much as a repeated motif.

Current truth:
- page titles remain strong
- visible repeated quote subtexts are gone
- a thin centered underline/divider is now the calmer default framing gesture

This is likely the more durable choice.

---

## 6.5 Bottom strip direction is now mostly right
Current bottom strip truth:
- cleaner than the old verbose sentence form
- metrics expressed as VPS / CPU / RAM / Disk / Refreshed
- subtle bars fit the FLOATING shell
- no longer sticky while browsing

This seems broadly correct now.

---

# 7. Important implementation/operational lessons from today

## 7.1 External preview compatibility
Do **not** casually change preview bind host from `0.0.0.0` to `127.0.0.1`.

Why:
- `127.0.0.1` may be fine for local curl checks
- but it can break the external reverse-proxy path to `preview.motiondisplay.cloud`

Correct operational posture here:
- external preview compatibility matters
- local-only binds can be a trap in this environment

---

## 7.2 Builder sandbox still cannot be trusted for final preview verification
Repeated throughout the day:
- Builder sandbox often cannot bind/listen on port `3005` (`EPERM`)
- sometimes runtime helpers that touch certain paths are awkward in sandbox context
- direct preview verification still needs to be done from the main session

Durable execution rule:
- use Builder for implementation/build work
- use the main Marvin session for final preview restart/verification when needed

---

## 7.3 Mission Control page passes need tighter restraint after substance lands
Today reinforced another useful nuance:
- the early danger was empty/prettified pages
- the later danger became overfilled pages once operational substance was added

So the correct late-stage Mission Control refinement mode is:
- subtractive editing
- stronger hierarchy
- more breathing room
- preserving value while removing clutter

That is likely tomorrow’s Agents mode.

---

# 8. Current relevant commit chain

These are the most important commits from today’s Mission Control session.

Ordered roughly in sequence:
- `2775ad41` — `feat: redesign agents roster page`
- `d4956b30` — `refine: tighten agents roster layout`
- `e98e0849` — `refine: center agents summary and restyle clock`
- `76f9863d` — `refine: simplify sidebar clock treatment`
- `aed22476` — `refine: tighten sidebar clock spacing`
- `e6c004b9` — `style: harmonize floating general pages`
- `2c3933c5` — `refine: collapse crons and restyle widget`
- `0fc003b1` — `polish: tighten general page consistency`
- `8413f2b5` — `Polish general shell framing`
- `41ef8b60` — `fix: restore external preview bind`
- `e3c56357` — `Refine general headers and status strip`
- `3d5760c9` — `feat: refine agents operational roster`

The latest stable state includes all of the above.

---

# 9. What tomorrow-Marvin should do first

If resuming Mission Control tomorrow, the recommended first move is:

## 9.1 Re-anchor quickly
Read:
1. this savepoint
2. the Agents build brief
3. the Agents design handoff
4. the recent daily memory entry for tonight

That should be enough to avoid Philippe re-explaining the whole arc.

---

## 9.2 Treat Agents as an editing problem, not a blank-page problem
Do **not** come in tomorrow as if Agents still needs its first meaningful build.
That work has been done.

The likely correct brief tomorrow is closer to:
- keep the stronger substance
- reduce information overload
- reduce visible complexity
- clarify strongest actions
- simplify where multiple layers compete
- possibly fold in Philippe’s prep material for future agents once he shares it

---

## 9.3 Likely next Mission Control priorities
Most likely near-term order:
1. Agents refinement/editing pass
2. possibly another Home pass
3. then decide whether to deepen Agents functionality again or shift focus elsewhere

Crons should **not** be reopened casually.
Philippe explicitly said Crons is good enough.

---

# 10. Long-term Mission Control objectives still in force

Still true after today:
- Mission Control should remain a truthful companion shell around real OpenClaw/runtime/workspace state
- General should feel coherent, editorial, calm, and premium without becoming fake or overdesigned
- Trading remains a later deeper visual/product frontier after General stabilizes further
- Agents should eventually become a genuinely useful control surface, not just a roster
- future agents will later need their deeper identity pass using Philippe’s prep material
- Search remains capability, not a destination page
- no fake realtime, no fake embedded success, no fake runtime launches

---

# 11. Final resume summary for tomorrow-Marvin

If you only remember seven things, remember these:

1. There was a VPS snapshot rollback before today’s work.
2. Memory extraction had already survived in the snapshot; continuity was rebuilt from docs/savepoints/memory.
3. Home remains shell truth; Agents Stitch remains page-composition truth.
4. General is now broadly coherent across Home / Chat / Tasks / Agents / Crons / Memory / Files.
5. Agents is no longer too empty; it is now slightly too much, which is a much better problem.
6. The bottom strip is now broadly in the right direction and no longer sticky.
7. Tomorrow’s likely task is to edit/simplify Agents while preserving the stronger substance, and possibly begin using Philippe’s prep material for future-agent identity work.

And if you need one sentence:

> Today rebuilt Mission Control properly after the snapshot rollback, brought General into a much more coherent FLOATING state, pushed Agents into a real Phase 2 operational form, and left tomorrow with a clear next job: keep the new substance, cut the excess, and refine rather than rethink.
