# Mission Control Savepoint — 2026-04-09 Evening

## Purpose
This is the end-of-day handoff savepoint for tomorrow-Marvin / any future agent resuming Mission Control work after the Apr 9 session.

Read this after:
1. `projects/_ops/mc-savepoint-2026-04-06-afternoon.md`
2. `projects/_ops/mc-savepoint-2026-04-06-night.md`
3. `projects/_ops/mc-savepoint-2026-04-07-evening.md`
4. `projects/_ops/mc-savepoint-2026-04-08-night.md`
5. `memory/2026-04-09.md`

This document is intentionally detailed. The goal is that Philippe should not need to re-explain Apr 9 Mission Control work to a future agent if that agent actually reads the savepoints, daily memory, and affected docs first.

---

## Executive summary
Apr 9 was a **Mission Control Agents page truth-and-restraint pass**, plus a **specialist-skill normalization pass**, plus a **direct-specialist chat identity pass**.

The most important durable outcomes are:

1. **The Agents page was materially simplified.**
   - old `.jpeg` avatars were replaced with the new `.png` avatars
   - Signals sections were removed
   - readiness pills were removed
   - dead placeholder action chips were removed
   - health labels were simplified into quiet status lights
   - the page is now much calmer and more editorial

2. **Agent summaries are now real and visible for the active seats.**
   - Marvin kept his custom summary
   - Sudo, Vantage, Johan, Milou, and Japin now each have a Philippe-approved short summary line
   - those summaries are now actually rendered in the card UI, not just stored in definitions

3. **The Content team seat model was replaced.**
   - the old 5-seat content structure is gone
   - Vantage’s team now uses 4 seats:
     - Content Manager
     - Senior Copywriter
     - Social Media & Community Manager
     - Performance, SEO & Analytics Lead
   - those roles were later tightened into shorter on-card labels
   - the `Seats` section is now collapsible and starts collapsed by default

4. **Agent skill visibility and source-of-truth were improved.**
   - Vantage’s explicit portfolio was expanded
   - Milou’s linked market-analysis skills were added explicitly
   - Johan / Milou / Japin specialist packs were normalized from uploaded extraction folders into proper workspace-local skills under `skills/`

5. **Mission Control chat is now more honest for direct specialists.**
   - Japin, Milou, and Johan bubbles no longer show `MARVIN`
   - they now show the correct specialist seat names in chat

6. **A real runtime bug was discovered and traced, but not patched from this session.**
   - Japin’s first-use `workspace-state.json` ENOENT error was traced to an OpenClaw temp-file collision bug in the installed runtime
   - the fix is known
   - this session could not patch it because `/usr/local/lib/node_modules/openclaw/dist/` is permission-blocked from inside this container session
   - Philippe later treated the issue as effectively resolved / deprioritized after other things came up

---

## The true current Mission Control posture after Apr 9

### 1. Agents page
Current truth:
- The Agents page is no longer trying to be a roster + runtime audit + documentation dump all at once.
- It is now closer to the right posture:
  - identity first
  - summary second
  - quiet status signaling
  - collapsible detail where appropriate
- The page should not be casually re-expanded with verbose Signals blocks, readiness pills, or placeholder UI noise.

### 2. Specialist skills
Current truth:
- Specialist packs are no longer only semi-hidden under `uploads/mission-control/...` as the practical source of truth.
- The preferred source of truth is now workspace-local skills under `skills/`.
- The upload copies still exist, but only as preserved extraction-source backups during migration/verification.

### 3. Direct specialist chat
Current truth:
- For direct specialist seats, the transcript UI no longer needs to pretend Marvin is speaking.
- Japin / Milou / Johan now have correct assistant labels in Mission Control chat.
- Sudo/Vantage direct-chat bubble naming was intentionally **not** added because Philippe uses them through the team panel, not as direct specialist seats.

### 4. Runtime bug state
Current truth:
- The `workspace-state.json` ENOENT error is not a Mission Control page bug.
- It is a runtime-side bug in OpenClaw’s temp-file naming for workspace state writes.
- The bug is understood well enough to patch later if needed.
- No runtime hotfix was actually applied during Apr 9 from this session.

---

## Chronological operational narrative

## 1. Mission Control re-entry was done properly before feature work
Philippe explicitly asked for a Mission Control refresh before resuming product work.

What was reviewed:
- `projects/mission-control/`
- relevant Mission Control runbooks
- recent daily memory
- latest savepoints in order:
  1. `projects/_ops/mc-savepoint-2026-04-06-afternoon.md`
  2. `projects/_ops/mc-savepoint-2026-04-06-night.md`
  3. `projects/_ops/mc-savepoint-2026-04-07-evening.md`
  4. `projects/_ops/mc-savepoint-2026-04-08-night.md`

Conclusion reached at re-entry:
- Home should not be casually reopened
- Japin is the benchmark specialist seat
- the next sensible Mission Control lane was either:
  - another page/feature with tight scope
  - or specialist-seat follow-through
- the `frontend-skill` should be kept in mind for UI-heavy refinement work

This re-entry mattered because it prevented random reopening drift and anchored the work in the accepted Apr 8 state.

---

## 2. Agents page avatar swap was completed first
Philippe wanted the current Agents page avatars swapped to a new set already uploaded in the same folder as before.

### What changed
References were updated from `.jpeg` to `.png` for:
- Marvin
- Sudo
- Vantage
- Johan
- Milou
- Japin

Important implementation detail:
- more than one avatar mapping path existed in the source
- both the page-level map and the card-level mapping had to be updated
- the relevant rendered mapping ended up in `projects/mission-control/components/agents/AgentSeatCard.tsx`

### Verification
- confirmed the `.png` files existed in `uploads/mission-control/avatars/`
- confirmed no remaining relevant `.jpeg` references in the live Agents rendering path

This was a clean warm-up change before the larger content-hierarchy pass.

---

## 3. Agents page content-hierarchy audit led to a restraint pass
Philippe asked for an audit because the page felt too text-heavy.

The correct diagnosis was:
- the page was over-explaining almost every card
- it felt like a mix of roster, runtime audit, explainer, and status board
- the biggest visible offender was the **Signals** layer

### Philippe’s specific direction
Philippe then gave sharper requirements:
- Marvin section did not need big surgery
- replace Marvin summary with:
  - `King of all lobsters and Philippe’s dedicated right-hand. Orchestrates, reviews, and monitors continuity across all levels.`
- remove `Signals` for all agents
- remove placeholder/dead cells like:
  - `Control UI unavailable`
  - `Internal seats only`
  - `Direct chat stages` / staged placeholder actions
- remove readiness pills like:
  - `Workspace ready`
  - `No direct chat`
- keep at least 30px of whitespace under titles
- simplify health into a status-light concept instead of verbose text if possible

### What changed technically
Main visible restraint changes in `projects/mission-control/components/agents/AgentSeatCard.tsx`:
- removed Signals blocks
- removed readiness pills
- filtered action buttons to only show genuinely live actions with real hrefs
- removed repeated seat-detail text in team member rows
- replaced Health text chips with small circular status lights using the existing state palette
- kept 30px breathing room under titles
- removed “No active issues” filler card for Marvin when there were no issues

### Durable truth established
For the Agents page:
- identity + summary + quiet status is the correct visible layer
- placeholder status prose and dead chips are noise, not truth
- Signals are not worth the visual weight they used to occupy

---

## 4. Agent summaries were added and corrected in two steps
Philippe liked the idea of short playful summaries similar to Marvin’s.

### Drafting phase
Proposed summary copy was written for:
- Sudo
- Vantage
- Johan
- Milou
- Japin

### Philippe-approved final copy
Final approved summaries became:

#### Sudo
`Dev lead that turns ideas into concrete builds. Scopes the work, splits the lanes, and keeps FE, BE, and QA from wandering off into chaos.`

#### Vantage
`Editorial strategist and content magician. Sees the angle, sprinkles on some creativity, and turns scattered ideas into clean content.`

#### Johan
`Sports betting analyst with no patience for hype. Weighs odds, pressure, and probability like a bookmaker with trust issues.`

#### Milou
`Trading advisor that beats Mr.Market. Reads reports, feeds on technical analysis, sees opportunities, and keeps emotional trades away.`

#### Japin
`Language tutor with a passion for teaching. Keeps lessons practical, memorable, and just uncomfortable enough to make you improve.`

### Important bug caught here
At first, only Marvin showed his summary correctly.
Reason:
- the control-card branch had been updated
- the team/specialist card branch had not

Fix:
- a second render-path patch added the summary line to the team/specialist branch too

### Durable truth established
When changing Mission Control card content, check **all render branches**, not just the control-seat branch.

---

## 5. Content team seat model was replaced and then tightened
Philippe wanted the Content team seats changed from the old five-seat model to a new four-seat model.

### Old structure removed
Removed:
- Signals Scout
- Keyword / Gap Analyst
- Editorial Strategist
- Writer / Draft Publisher
- GSC Performance Analyst

### New structure added
Added:
- Content Manager
- Senior Copywriter
- Social Media & Community Manager
- Performance, SEO & Analytics Lead

### Their intent
The new seats reflect a more realistic content/brand/social/search operating model:
- big-idea / brand / workflow lead
- copy execution
- social/community feedback loop
- search / ads / analytics owner

### Later tightening
The full role labels were a bit too long on-card, so they were shortened to:
- Content Manager → `Story and workflow`
- Senior Copywriter → `Copy and campaigns`
- Social Media & Community Manager → `Social and community`
- Performance, SEO & Analytics Lead → `SEO, ads, analytics`

### Seats section behavior change
The `Seats` section on team cards is now:
- collapsible
- collapsed by default on page load

This was the right call because it preserved the structure without forcing seat-level detail to dominate the card.

---

## 6. Skills / arsenal truth was audited before being shown in UI
Philippe wanted clarity on two questions:
1. do the agents already know what their jobs are from the start?
2. which skills are actually linked to them?

### Audit conclusion
The truthful answer reached was:
- they know role / posture / expected output / activation behavior from the start
- they do **not** all have equally mature independent execution models
- Sudo and Vantage had the clearest explicit skill manifests
- Johan / Milou / Japin had more provisional or local-pack-based skill posture
- Japin had the strongest specialist continuity maturity

### New documentation created
A dedicated runbook was added:
- `docs/runbooks/mission-control-agent-skill-matrix.md`

That matrix records:
- activation maturity
- task-framing maturity
- current skill arsenal
- current source-of-truth posture
- relative maturity across agents

This matters because the skill truth is now documented explicitly instead of living only in memory or scattered files.

---

## 7. Vantage and Milou skill portfolios were expanded deliberately
Philippe explicitly requested three changes:
1. Add `social-content`, `analytics-tracking`, and `humanizer` to Vantage
2. Audit specialist skill packs into a clean matrix
3. Add `stock-market-pro` and `us-stock-analysis` to Milou in addition to the trading pack

### Vantage final explicit portfolio
- `copywriting`
- `programmatic-seo`
- `seo-audit`
- `copy-editing`
- `social-content`
- `analytics-tracking`
- `humanizer`

### Milou final explicit posture
- local trading skill
- `stock-market-pro`
- `us-stock-analysis`

### Docs updated
- `agent-workspaces/content-seo-team-lead/SKILLS.md`
- `agent-workspaces/trading-advisor/SKILLS.md`
- `agent-workspaces/trading-advisor/WORKSPACE.md`
- `docs/runbooks/mission-control-agents-operating-model.md`
- `docs/runbooks/mission-control-agent-skill-matrix.md`

---

## 8. Specialist skill packs were normalized into proper workspace-local skills
This was one of the most important structural cleanups of the day.

### Why it mattered
Before Apr 9, specialist source-of-truth skill material effectively lived under:
- `uploads/mission-control/sportsbet-advisor/`
- `uploads/mission-control/trading/`
- `uploads/mission-control/language-learning/`

That was workable, but messy because those packs:
- were semi-hidden
- were not first-class workspace skills
- were harder to reason about later

### Philippe clarification
Philippe explained those files were not random manual drafts; they came from ClawHub, but were extracted from zip downloads because a previous live install/download flow had issues.

That mattered because it justified promoting them into proper local skills rather than treating them as ad hoc uploads.

### New local skills created
Under `skills/`:

#### Johan
- `skills/sportsbet-advisor/SKILL.md`
- `skills/sportsbet-advisor/scripts/scrape_sportsbet_upcoming.py`

#### Milou
- `skills/trading-advisor/SKILL.md`
- `skills/trading-advisor/references/getting-started.md`
- `skills/trading-advisor/references/legal.md`
- `skills/trading-advisor/references/memory-template.md`
- `skills/trading-advisor/references/platforms.md`
- `skills/trading-advisor/references/risk.md`
- `skills/trading-advisor/references/setup.md`
- `skills/trading-advisor/references/technical.md`

#### Japin
- `skills/language-learning/SKILL.md`

### Important posture
- upload copies were **not deleted**
- they were kept as preserved extraction-source backups during migration/verification
- but they are no longer the preferred source of truth

### Docs repointed
Updated:
- `agent-workspaces/sportsbet-advisor/SKILLS.md`
- `agent-workspaces/sportsbet-advisor/WORKSPACE.md`
- `agent-workspaces/sportsbet-advisor/MEMORY.md`
- `agent-workspaces/trading-advisor/SKILLS.md`
- `agent-workspaces/trading-advisor/WORKSPACE.md`
- `agent-workspaces/language-tutor/SKILLS.md`
- `agent-workspaces/language-tutor/WORKSPACE.md`
- `agent-workspaces/language-tutor/MEMORY.md`
- `docs/runbooks/mission-control-agents-operating-model.md`
- `docs/runbooks/mission-control-agent-skill-matrix.md`

### Durable truth established
The preferred source of truth for specialist skills is now:
- Johan → `skills/sportsbet-advisor/`
- Milou → `skills/trading-advisor/` + linked market-analysis skills
- Japin → `skills/language-learning/`

This is a genuine system-legibility improvement.

---

## 9. Skills were surfaced on the Agents page in a deliberately minimal way
After the skill audit and normalization, Philippe wanted the skills shown on the Agents page if it could be done subtly.

### Design choice
The chosen approach was:
- no badge grid
- no chunky chips
- no heavy container
- just a quiet inline skill list under the summary

### First version
A muted `Arsenal` label plus inline skills was added.

### Philippe feedback
It looked good, but Philippe preferred to remove the visible `Arsenal` label to keep the page cleaner.

### Final result
The UI now shows only the inline skill list, without the `Arsenal` label.

### Final visible mappings
- Sudo → `coding-agent · frontend-skill · github`
- Vantage → `copywriting · programmatic-seo · seo-audit · copy-editing · social-content · analytics-tracking · humanizer`
- Johan → `sportsbet-advisor`
- Milou → `trading-advisor · stock-market-pro · us-stock-analysis`
- Japin → `language-learning`
- Marvin intentionally has no explicit inline skill list

### Durable design truth
This was the correct restraint level.
If the skill row becomes louder than the summary, it is drifting.

---

## 10. Japin live test surfaced three useful chat/runtime issues
Philippe tested Japin directly for the first time and reported three observations:

1. first-use error:
   - `ENOENT: no such file or directory, rename '/data/.openclaw/workspace-language-tutor/.openclaw/workspace-state.json.tmp-...' -> '/data/.openclaw/workspace-language-tutor/.openclaw/workspace-state.json'`
2. composer send felt delayed
3. direct Japin messages still showed `MARVIN`

### 10A. Chat-bubble naming bug
This one was easy and concrete.

#### Root cause
`MissionControlChatSurface.tsx` was effectively hardcoding `Marvin` for assistant messages in the live message block.

#### Fix
Added seat-aware assistant labeling for the direct specialist seats only:
- `language-tutor` → `Japin`
- `trading-advisor` → `Milou`
- `sportsbet-advisor` → `Johan`
- fallback → `Marvin`

Per Philippe’s preference, no special direct-bubble handling was added for:
- Sudo
- Vantage

because those are used via the team panel rather than direct specialist chat.

### 10B. Composer-send delay
This was investigated conceptually.

#### Conclusion
This is mostly current architecture, not necessarily a bug.
The send flow currently waits on:
- session confirmation / existence
- runtime-bridge `chat.send` ack

That makes composer send feel slower than an optimistic local-first send.

#### Status
Not fixed on Apr 9.
It remains a future UX polish opportunity.

### 10C. `workspace-state.json` ENOENT error
This was traced carefully.

#### Important correction
At first glance it looked like a bad path-join bug.
Further inspection showed `/data/.openclaw/workspace-language-tutor` is a real specialist workspace root, so the path itself is not fake.

#### Actual root cause found
The OpenClaw installed runtime writes workspace onboarding state via a temp file named only with:
- `process.pid`
- `Date.now().toString(36)`

That means two writes in the same process in the same millisecond can collide on the same temp filename.
One rename wins, the other tries to rename a temp file that no longer exists, producing the ENOENT rename error Philippe saw.

#### Exact code locus found
Installed OpenClaw runtime file observed from this session:
- `/usr/local/lib/node_modules/openclaw/dist/workspace-Cn3fdLBW.js`

Relevant line pattern:
```js
const tmpPath = `${statePath}.tmp-${process.pid}-${Date.now().toString(36)}`;
```

#### Proposed fix
Add a random suffix to the temp filename, e.g.:
```js
const tmpPath = `${statePath}.tmp-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
```

#### What happened next
This session could not patch the installed runtime because the path is permission-blocked inside this container session.
Later, when Philippe tried a provided patch command from another terminal, path/indentation issues came up, then Docker context turned out to matter.
Before the container-targeted patch flow was completed, Philippe said other things came up and to consider it resolved for now.

### Durable truth established
- The Japin `workspace-state.json` issue is a **runtime OpenClaw temp-file collision bug**, not a Mission Control page bug.
- The fix is known, but Apr 9 did not actually apply it.

---

## 11. Docker/runtime patch attempt lesson
A small but useful operational lesson surfaced late in the day.

### What happened
A runtime patch command was prepared for the installed OpenClaw file path visible from this session.
When Philippe tried it elsewhere, problems surfaced:
- first: heredoc indentation issues
- then: file-not-found on the patch path
- then: the reminder that OpenClaw is running in Docker mattered

### Lesson
When preparing runtime patch instructions for OpenClaw here, do not assume:
- the same path will exist on the host terminal
- the user is running the command from inside the same filesystem namespace as this container session

For host-side runtime fixes in this environment, the safer sequence is:
1. identify the real container with `docker ps`
2. inspect the file path **inside the container**
3. patch inside the container if needed
4. restart the container/runtime

This is worth remembering for future OpenClaw runtime hotfixes.

---

## Preview / verification posture throughout Apr 9
Multiple preview rebuild/restart cycles were run during Agents page work.

Normal verification pattern remained:
- source edits
- `./scripts/preview-restart.sh`
- watch build completion
- confirm normal `307` redirect / healthy preview posture

Known recurring non-blocking warning remained:
- `AgentSeatCard.tsx` still uses `<img>` and triggers the standard Next.js image warning
- this was not the priority on Apr 9 and remains non-blocking

---

## The exact place to resume next time
If Mission Control work resumes after this savepoint, the clean next lanes are:

### Option A. Let the Agents page rest unless Philippe sees a specific issue
This is probably the smartest immediate move.
The page got several meaningful improvements today and is now in a much healthier state.
Do not casually reopen it just because it was active today.

### Option B. Improve direct specialist chat UX
The most concrete remaining chat polish item is:
- composer send still feels a bit slow because it waits on runtime/session ack flow

That is a real UX refinement opportunity if Philippe cares enough to reopen chat behavior.

### Option C. Apply the runtime hotfix later if the Japin ENOENT bug returns
The bug is understood.
If it resurfaces and Philippe wants it fixed for real:
- patch the OpenClaw installed runtime inside the actual Docker container
- use the random-suffix temp-file fix
- then restart the relevant container/runtime

### Option D. Expose more agent truth elsewhere in Mission Control
Possible future lane:
- show skill/source-of-truth posture in another part of the UI
- but do **not** bloat the Agents page back up to do it

### Strong recommendation
Tomorrow’s default should **not** be to keep adding detail to the Agents page unless Philippe asks.
The biggest danger now is backsliding into too much visible explanation.

---

## Commit / artifact index for Apr 9 Mission Control work

### Outer workspace repo
- `191d5b2` — `feat: refine Mission Control agents and specialist skills`
  - captures the major Agents-page, specialist-skill, and chat-label work from today

### Key files added/updated
#### Savepoints / memory
- `projects/_ops/mc-savepoint-2026-04-09-evening.md`
- `memory/2026-04-09.md`

#### Mission Control UI / logic
- `projects/mission-control/app/general/agents/page.tsx`
- `projects/mission-control/components/agents/AgentSeatCard.tsx`
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`
- `projects/mission-control/lib/agents/definitions.ts`
- `projects/mission-control/lib/adapters/agents.ts`

#### Agent workspace docs
- `agent-workspaces/content-seo-team-lead/SKILLS.md`
- `agent-workspaces/trading-advisor/SKILLS.md`
- `agent-workspaces/trading-advisor/WORKSPACE.md`
- `agent-workspaces/sportsbet-advisor/SKILLS.md`
- `agent-workspaces/sportsbet-advisor/WORKSPACE.md`
- `agent-workspaces/sportsbet-advisor/MEMORY.md`
- `agent-workspaces/language-tutor/SKILLS.md`
- `agent-workspaces/language-tutor/WORKSPACE.md`
- `agent-workspaces/language-tutor/MEMORY.md`

#### New local specialist skills
- `skills/sportsbet-advisor/SKILL.md`
- `skills/sportsbet-advisor/scripts/scrape_sportsbet_upcoming.py`
- `skills/trading-advisor/SKILL.md`
- `skills/trading-advisor/references/*`
- `skills/language-learning/SKILL.md`

#### Runbooks
- `docs/runbooks/mission-control-agents-operating-model.md`
- `docs/runbooks/mission-control-agent-skill-matrix.md`

---

## Final tomorrow-you note
Do not compress this day into “polished the Agents page a bit.”
That would lose too much.

The correct memory is:
- the Agents page stopped over-explaining itself
- the content team model became more realistic
- specialist skill sources were normalized into proper local skills
- agent skill truth is now better documented and lightly surfaced in UI
- direct specialist chats now show the right identity labels
- a real OpenClaw runtime temp-file collision bug was discovered and understood, but not patched from this session

Also remember these small but important details:
- Philippe liked the inline skill list, but **not** the visible `Arsenal` label
- the `Seats` section should stay collapsed by default
- Sudo/Vantage do **not** need direct-chat bubble renaming right now
- the biggest risk on the Agents page now is reintroducing clutter in the name of helpfulness
- for runtime hotfix instructions in this environment, remember Docker/container path reality before giving host-level patch commands

That ground is now mapped. Don’t make Philippe explain it again if you can avoid it.
