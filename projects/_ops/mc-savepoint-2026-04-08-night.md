# Mission Control Savepoint — 2026-04-08 Night

## Purpose
This is the end-of-day handoff savepoint for tomorrow-Marvin / any future agent resuming Mission Control work after the Apr 8 session.

Read this after:
1. `projects/_ops/mc-savepoint-2026-04-06-afternoon.md`
2. `projects/_ops/mc-savepoint-2026-04-06-night.md`
3. `projects/_ops/mc-savepoint-2026-04-07-evening.md`
4. `memory/2026-04-08.md`

This document is intentionally detailed. The goal is that Philippe should not need to re-explain today’s Mission Control work to a future agent if that agent actually reads the savepoints and daily memory first.

---

## Executive summary
Apr 8 was a **specialist-seats + Home-page truth pass** day for Mission Control.

The most important durable outcomes are:

1. **Japin is now the first real standalone specialist seat** in Mission Control.
   - He is no longer Marvin roleplay.
   - He routes to a distinct real session: `agent:language-tutor:main`.
   - He has specialist-scoped continuity/memory scaffolding.
   - He is now the benchmark implementation for future standalone specialist seats.

2. **Japin’s memory structure is now materially real**.
   - active continuity anchor
   - learner profile
   - recurring corrections
   - lesson-history convention
   - explicit post-lesson update discipline

3. **A Japin memory-extraction cron was considered and explicitly rejected for now**.
   - Correct current posture: session-end / lesson-end manual update loop first.
   - If automation is later needed, it should be narrow and specialist-specific, not a copy of Marvin’s broad nightly extractor.

4. **Mission Control Home was reopened hard and repeatedly refined until it stopped feeling like a widget board**.
   - The initial Sudo-delivered Home implementation was technically valid but compositionally wrong.
   - A first rewrite pass was also rejected.
   - The correct version only arrived after Philippe’s very explicit visual critique and multiple targeted follow-up passes.

5. **The final accepted Home posture is now much clearer**:
   - editorial front door, not dashboard
   - large serif greeting
   - compact weather/quote support card
   - Market Watch as a real RSS headline reader
   - slimmer Current Tracks block
   - fixed bottom VPS/status strip
   - no Daily Pulse
   - no quick-access grid
   - no fake summary widgets

6. **Heartbeat/trading-bot alert logic produced a false positive and was corrected at the policy level**.
   - The receiver health endpoint was actually healthy.
   - The repeated warning came from brittle process-name logic.
   - Heartbeat guidance was updated to prefer endpoint truth over watchdog/process presence.

---

## The true current Mission Control posture after Apr 8

### 1. Specialist seats
Current truth:
- **Vantage is still not a standalone specialist**. She remains a team-lead / orchestration seat like Sudo.
- The first real standalone specialist is now **Japin** (`language-tutor`).
- The direction is still: one real specialist first, prove the pattern, then expand.

### 2. Home page
Current truth:
- Home was the main active Mission Control build frontier for most of the afternoon/evening.
- The work should **not** be summarized as “polished the old Home.”
- The accurate summary is: **Home composition was fought back from dashboard drift into the FLOATING editorial lane**.

### 3. Preview/runtime
Current truth:
- Multiple preview rebuild/restart cycles were run throughout the Home work.
- Preview remained operational after each accepted pass.
- Normal verification pattern stayed:
  - `npm run lint`
  - `npm run build`
  - `./scripts/preview-restart.sh`
  - local health check / redirect confirmation

---

## Chronological operational narrative

## 1. Mission Control re-entry was done properly before feature work
Philippe asked for a Mission Control re-entry pass before resuming work.

What was inspected:
- `projects/mission-control/`
- Mission Control runbooks in `docs/runbooks/`
- recent daily memory
- latest savepoints in order:
  1. `projects/_ops/mc-savepoint-2026-04-06-afternoon.md`
  2. `projects/_ops/mc-savepoint-2026-04-06-night.md`
  3. `projects/_ops/mc-savepoint-2026-04-07-evening.md`

Conclusion reached at re-entry:
- strongest active Mission Control fronts were:
  - Sudo / Dev Team realism
  - autonomous task truthfulness
  - STT / local Whisper groundwork
  - specialist-seat planning
  - Skills-page durability
- the clearest next feature target from the savepoints was:
  - **standalone specialist seats**
  - one real specialist first
  - not Vantage
  - specialist-scoped memory required

This re-entry mattered because it prevented random reopening drift and anchored the work in the already-established direction.

---

## 2. Japin became the first real standalone specialist seat
Philippe explicitly wanted to continue with specialist seats and pointed to:
- `projects/mission-control/docs/standalone-specialist-seats-implementation-plan.md`

The chosen first seat was:
- **Japin** / `language-tutor`

Why Japin was the right first specialist:
- tutoring continuity is naturally easy to test
- fake memory would be obvious quickly
- specialist memory matters here in a way that exposes weak seat theater fast
- the seat already had a workspace baseline suitable for extension

### What changed technically
Main Mission Control repo changes:
- Japin moved from Marvin-routed behavior to **direct** specialist routing
- real session target became:
  - `agent:language-tutor:main`
- chat/runtime session switching was hardened so non-main sessions can be created/resumed cleanly
- direct specialist routing labels were made honest in UI copy
- Sudo-specific orchestration chrome was kept out of the specialist path

Important code areas touched in this phase:
- `projects/mission-control/lib/agents/definitions.ts`
- `projects/mission-control/lib/agents/chat-activation.ts`
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`
- `projects/mission-control/hooks/useRuntimeBridge.ts`
- `projects/mission-control/lib/adapters/agents.ts`

### Mission Control repo commit
- `aa6a4df7` — `feat(chat): make Japin a real direct specialist seat`

### Verification
- `npm run lint`
- `npm run build`
- both passed aside from the known unrelated `AgentSeatCard.tsx` `<img>` warning

### Durable truth established
A standalone specialist seat in Mission Control must mean:
- real distinct session/runtime target
- isolated transcript from Marvin/Sudo
- specialist-scoped memory/continuity
- honest routing labels
- no orchestration chrome leakage from lead/team seats

---

## 3. Japin memory hardening made the seat materially usable
After the direct-seat work landed, Philippe asked to continue by making Japin’s memory actually useful for repeated lessons.

This work happened mostly outside the nested Mission Control repo, in the specialist workspace:
- `agent-workspaces/language-tutor/`

### Memory structure added or hardened
Added/updated:
- `agent-workspaces/language-tutor/memory/continuity.md`
- `agent-workspaces/language-tutor/memory/learner-profile.md`
- `agent-workspaces/language-tutor/.learnings/corrections.md`
- `agent-workspaces/language-tutor/memory/lessons/README.md`
- `agent-workspaces/language-tutor/MEMORY.md`
- `agent-workspaces/language-tutor/WORKSPACE.md`
- `agent-workspaces/language-tutor/memory/README.md`

### What each lane now means
- `memory/continuity.md`
  - live handoff file
  - current state
  - next lesson start
  - what should carry forward
- `memory/learner-profile.md`
  - stable learner baseline
  - level
  - strengths/weaknesses
  - preferences / constraints
- `.learnings/corrections.md`
  - repeated mistakes / patterns worth drilling
- `memory/lessons/`
  - lesson-history lane with naming convention/template

### Mission Control guidance tightened too
In `projects/mission-control/lib/agents/definitions.ts`, Japin’s activation guidance was updated so the seat explicitly reads:
- `memory/continuity.md`
- `memory/learner-profile.md`
- `.learnings/corrections.md`

This is important because the seat should not pretend memory exists magically; the runtime guidance has to point toward the real memory files.

### Explicit post-lesson update rule
Philippe later asked whether Japin was already clearly aware of the desired update protocol.

Answer reached:
- **mostly yes**, but one piece was too implied
- specifically, `learner-profile.md when needed` needed to be stated more explicitly

Follow-up fix:
- `agent-workspaces/language-tutor/memory/continuity.md` was updated so post-session discipline explicitly includes:
  1. update current active state
  2. update `memory/learner-profile.md` when baseline/level/preferences/constraints materially changed
  3. update `.learnings/corrections.md` for repeated patterns
  4. create/update a lesson note for substantial sessions
- `projects/mission-control/lib/agents/definitions.ts` was tightened to reflect the same discipline in seat-facing copy

Mission Control repo commit for that guidance tightening:
- `a758a99e` — `Clarify Japin post-lesson memory guidance`

### Durable truth established
Japin is now the **pattern seat** for future specialist continuity:
- direct runtime seat
- specialist workspace
- explicit memory map
- explicit post-lesson update discipline

---

## 4. Japin automation question resolved: no cron yet
Philippe asked whether Japin should get a memory-extraction cron similar to Marvin’s.

### Recommendation given
- **No, not yet**.

### Why this was the right answer
- Japin is still a new seat with low traffic
- the normal session/lesson loop should be proven first
- tutoring memory is more delicate than general ops memory
- a broad nightly extractor would likely flatten nuance too early

### Correct future direction if automation is later needed
If later justified, build a **narrow specialist-specific post-lesson extractor**, not a clone of Marvin’s nightly memory extractor.

Scope of such a future extractor should be limited to:
- learner progress
- recurring corrections
- next lesson focus
- lesson note/log creation

Not broad cross-workspace memory writes.

This is a durable product/architecture decision, not just a temporary preference.

---

## 5. Sudo Home page work was reviewed and kept only as a starting point
Philippe then asked to review a completed Sudo run for the Home page based on:
- `projects/mission-control/docs/home-page-redesign-plan.md`

### Initial review result
The Sudo-delivered Home page was:
- technically real
- valid enough to keep as work done
- but compositionally off-target

It was wrapped in the nested repo as:
- `9be32c54` — `feat(home): implement redesigned Mission Control landing page`

A preview rebuild/restart was also done so Philippe could inspect it.

### What immediately became clear after review
Philippe disliked the direction.
The correct diagnosis was:
- the Home page was not “buggy” so much as **compositionally wrong**
- it still felt like a dashboard made of widgets rather than the FLOATING editorial front door he wanted

This distinction matters because the wrong response would have been incremental polishing.
The right response was to rewrite the composition target.

---

## 6. Stitch / screenshot interpretation failed once and that failure matters
Philippe then gave a stronger visual correction, including:
- direct critique of the bad Home result
- a screenshot reference: `uploads/mission-control/Screenshot-03-24.jpg`
- an MCP export instruction block for the Stitch Home screen
- explicit warning to use only Aura Concierge / Floating if Stitch exports multiple systems
- explicit warning not to let Stitch change approved Mission Control colors

### Important mistake made here
At this point, a key clarification had to be made:
- **actual MCP-exported assets/code were not available**
- only the export instruction text existed
- the bad first rewrite had not used exported Stitch output, only the screenshot + interpreted brief

That matters because a future agent should not later claim “the Home was built from the MCP export” unless the actual export artifacts are present.

### Durable lesson here
There is a difference between:
- working from a screenshot + interpretation
and
- working from actual MCP-exported assets/code

That difference should be stated honestly.

---

## 7. Home v2 rewrite brief was created to reset the target
Because the first direction was wrong, a new explicit rewrite brief was created:
- `projects/mission-control/docs/home-page-redesign-v2-brief.md`

Purpose of the brief:
- stop incremental widget-polish drift
- redefine Home as an editorial front door
- explicitly remove dashboard-board habits

Key instructions locked in that brief:
- no big quick-access grid
- no dedicated Recent Activity section
- no widget-board composition
- one compact support card instead of the 3-card strip
- one stronger central logic block rather than parallel utility panels
- one dark anchor card
- one lower trajectory/track section
- one Home-only bottom status strip

This brief was necessary to reset the target before further implementation.

---

## 8. First Home rewrite still failed and should not be mistaken for success
A first rewrite pass after the new brief was completed and committed, but Philippe rejected it again.

That pass was committed as:
- `b0da1599`

### Why it still failed
Philippe’s critique was correct:
- still not remotely close to the screenshot compositionally
- too much duplicated meaning in different coatings
- not enough whitespace/elegance
- too much dashboard energy survived

This is important because tomorrow-Marvin should not read the git log and assume every Home commit was an accepted step forward. Several Home commits are **historical stepping stones**, not approved final posture.

### Specific user corrections from this rejection
Philippe explicitly said to remove:
- `MISSION CONTROL` title
- `ADAPTER-BACKED` pill
- focus-line subtext under the hero
- support-card text section next to weather
- the whole `DAILY PULSE` section

And explicitly improve:
- serif elegance of the hero
- weather + quote composition
- Current Tracks spacing/density
- Market Watch into a real news reader from RSS data
- bottom bar into something closer to the old server status strip

This critique was the real turning point that forced the correct Home shape.

---

## 9. Correct Home composition only arrived after the hard reset
A fresh pass was then launched from the real open point, explicitly rejecting the prior failed shape.

### The accepted base composition became:
- large serif greeting
- compact weather + quote support card
- dark Current Tracks / Forward Path card
- Market Watch as a real RSS-derived headline reader
- fixed bottom status strip
- no Daily Pulse
- no title/pill/subtext/support filler
- no large quick-access grid

That successful reset landed as:
- `8896ea9a`

### Data source chosen for Market Watch
Initial Home headline sourcing used local workspace data from:
- primary: `projects/market-intel/data/news_alerts.json`
- fallback: `projects/market-intel/data/rss_alerts.json`

Important nuance discovered later:
- raw path priority alone was not enough because one source could be stale while the other was fresher or empty
- this led to another refinement pass for freshness logic

---

## 10. Home refinement pass 2 solved spacing, freshness logic, and bottom strip truth
After Philippe said the Home was “starting to look good,” a final-looking but still not final refinement pass happened.

That pass landed as:
- `666229fcfb3df69d6bd18a56270db2deeda23c23`

### What it changed
- increased hero/section breathing room
- lower layout became:
  - Market Watch left ~2/3
  - Current Tracks right ~1/3
- Current Tracks kept only:
  - Workspace reliability
  - Autonomous lane
- daily quote rotation was added as deterministic once-per-day logic
- Market Watch freshness logic was improved to choose the freshest valid usable local source, not blindly prefer one path
- bottom strip switched to real system metrics like:
  - RAM used %
  - disk used %
  - load average
  - uptime
  - RSS updated time
- bottom strip became fixed to bottom

### Durable technical truths established here
- greeting already auto-adjusted by Ho Chi Minh time and was kept
- quote was **not** rotating before this pass; now it is
- Market Watch source selection needed freshness-aware logic, not hardcoded path preference
- a bottom strip with real VPS metrics is valid and desired for Home

---

## 11. Final accepted Home polish happened as a string of small, real follow-up passes
After the main refinement landed, Philippe asked for small additional tweaks. These were real and worth preserving because they define the accepted final shape.

### 11A. Home spacing/status-strip/sidebar cleanup
Committed as:
- `ba6f1614` — `refine home spacing and status strip`

What changed:
- more space between Market Watch and Current Tracks zone
- removed visible `RSS source: ...` text from Market Watch UI
- centered bottom strip text
- added soft green status dot to the left of `VPS`
- sidebar weather/time widget was removed, with intent to keep date only

### 11B. Final polish pass
Committed as:
- `2780736b` — `Polish home: market refresh, slimmer tracks card, restore sidebar date`

What changed:
- added a real **Market Watch refresh button**
  - implemented honestly using local route refresh, not fake action
- renamed section title:
  - `CURRENT TRACKS / FORWARD PATH` -> `CURRENT TRACKS`
- Current Tracks panel slimmed down to feel more in the weather/quote card lane
- sidebar date restoration attempted without reviving the full old ambient widget

### 11C. Sidebar date visibility + Market Watch width tweak
Committed as:
- `00c1db4b` — `Tweak home spacing and restore sidebar date visibility`

What changed:
- date visibility was increased because it was still effectively missing
- Market Watch was cropped back ~30px on the right so it stopped stealing reclaimed space from Current Tracks

### 11D. Collapsed-sidebar date truncation bug fix
Committed as:
- `41009bbe` — `Fix collapsed sidebar date truncation`

What changed:
- when the left sidebar is collapsed, the date now uses a compact shorter format instead of clipping/truncating awkwardly

### Final accepted Home posture tonight
As of the end of Apr 8, the accepted Home shape is:
- large serif greeting with proper whitespace
- right-side weather + daily quote card
- left-side Market Watch with multiple local RSS-derived headlines and a refresh button
- slimmer right-side Current Tracks card, aligned more cleanly
- fixed bottom VPS/status strip with real metrics and centered content
- sidebar date restored in expanded and compact form
- no Daily Pulse
- no generic widget-board feel
- no fake utility clutter

This is the Home baseline for future work.

---

## 12. Heartbeat/trading-bot alerting produced a false positive and was corrected
During the evening, repeated alert text kept surfacing:
- `Trading bot health check still needs attention: webhook/watchdog appears offline and http://127.0.0.1:8000/health did not respond.`

This was investigated directly.

### What was actually true
Direct checks showed the bot health endpoints were fine:
- `http://127.0.0.1:8000/health` -> OK
- `http://127.0.0.1:8000/health/auth` -> OK

So the repeated warning was **false positive noise**, not a live bot outage.

### Root cause
Heartbeat logic relied too much on raw process-name/watchdog presence.
That is brittle because a watchdog/process naming assumption can fail even while the receiver endpoint itself is healthy.

### What was changed
- `HEARTBEAT.md` was updated so trading-bot heartbeat checks prefer endpoint truth (`/health` and `/health/auth`) over process-name presence
- a reusable error entry was added to `.learnings/errors.md`

Outer workspace commit:
- `3d9ec93` — `Fix trading bot heartbeat false positive guidance`

### Durable lesson
For the trading bot, **endpoint truth beats process-name inference**.
Do not page Philippe with a bot-down alert if `/health` is green.

---

## Accepted design/product lessons from today

## Home page lessons
1. **Home is not a dashboard board.**
   If it starts looking like a grid of utility cards, the composition is drifting.

2. **Delete first, then recompose.**
   The turning point came only when title/pill/subtext/support filler/Daily Pulse were explicitly removed.

3. **Stitch screenshot is composition truth, not content truth.**
   Use it for hierarchy, rhythm, whitespace, and asymmetry. Do not translate it into “same amount of widgets with softer CSS.”

4. **If actual MCP export artifacts are not present, say so.**
   Do not imply a page came from the export if only the export instruction text exists.

5. **Market Watch works better as a reader than as a metric.**
   Multiple headlines from real local RSS-derived data were the correct lane.

6. **Bottom strips must feel infrastructural, not decorative.**
   The accepted strip uses real VPS/system data and behaves like an ambient server bar.

## Specialist-seat lessons
1. **The first real standalone specialist should be the one where continuity is easiest to test.**
   Japin was ideal for this.

2. **Specialist memory must be structurally real before the seat feels real.**
   The seat/runtime wiring alone is not enough.

3. **Do not automate specialist memory too early.**
   Session-end/manual update loops should be proven before cron extraction is considered.

---

## The exact place to resume tomorrow

If Mission Control work resumes tomorrow, the most likely clean next lanes are:

### Option A. Pause and use Home as-is for a day
This is probably the smartest immediate move.
The page finally reached “good enough to live with” after many iterations.
Another reopen tomorrow should happen only if Philippe sees a specific real issue, not because Home is still emotionally sticky from the earlier bad versions.

### Option B. Continue specialist-seat rollout
If Philippe wants another active build lane:
- continue from Japin’s pattern
- but only after deciding which second specialist is worth real direct-seat treatment
- keep Vantage out of the standalone-specialist lane

### Option C. Mission Control shell/runtime hygiene
Potential later cleanup lanes:
- unify/status-strip semantics across Home and shell if Philippe wants that
- revisit live refresh freshness behavior if Market Watch still feels behind in practice
- improve date/sidebar handling only if another concrete bug appears

### Strong recommendation
Tomorrow’s default should **not** be “reopen Home again by default.”
Home consumed many iterations and is now in an acceptable state. Reopen only on specific critique.
The more promising next feature lane is likely specialist expansion or another Mission Control page.

---

## Commit / artifact index for Apr 8 Mission Control work

### Mission Control nested repo
- `9be32c54` — `feat(home): implement redesigned Mission Control landing page` *(kept as real work, but compositionally superseded)*
- `aa6a4df7` — `feat(chat): make Japin a real direct specialist seat`
- `a758a99e` — `Clarify Japin post-lesson memory guidance`
- `b0da1599` — Home v2 rewrite pass *(historical, but effectively rejected / superseded)*
- `8896ea9a` — Home composition reset after hard critique
- `666229fcfb3df69d6bd18a56270db2deeda23c23` — Home refinement pass 2 (spacing, quote rotation, freshness logic, bottom VPS strip)
- `ba6f1614` — `refine home spacing and status strip`
- `2780736b` — `Polish home: market refresh, slimmer tracks card, restore sidebar date`
- `00c1db4b` — `Tweak home spacing and restore sidebar date visibility`
- `41009bbe` — `Fix collapsed sidebar date truncation`

### Workspace / outer repo
- `3d9ec93` — `Fix trading bot heartbeat false positive guidance`

### Key files added/updated outside nested repo
- `agent-workspaces/language-tutor/memory/continuity.md`
- `agent-workspaces/language-tutor/memory/learner-profile.md`
- `agent-workspaces/language-tutor/.learnings/corrections.md`
- `agent-workspaces/language-tutor/memory/lessons/README.md`
- `agent-workspaces/language-tutor/MEMORY.md`
- `agent-workspaces/language-tutor/WORKSPACE.md`
- `agent-workspaces/language-tutor/memory/README.md`
- `projects/mission-control/docs/home-page-redesign-v2-brief.md`

---

## Final tomorrow-you note
Do not compress this day into “built Japin and polished Home.”
That would lose too much.

The correct memory is:
- specialist-seat architecture became real for the first time
- Japin became the first honest standalone specialist implementation
- Home required multiple failed interpretations before it finally aligned with Philippe’s actual visual target
- one repeated trading-bot alert was false and the monitoring guidance had to be corrected

If you reopen this work later, use the accepted final posture above and do not casually resurrect the rejected Home patterns:
- no Daily Pulse
- no quick-access grid
- no title/pill/subtext clutter
- no dashboard-card mosaic
- no fake Market Watch source explanation in the UI

That ground has already been fought over.
