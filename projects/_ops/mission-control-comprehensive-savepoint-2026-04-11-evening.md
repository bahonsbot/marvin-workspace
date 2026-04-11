# Mission Control Comprehensive Savepoint — 2026-04-11 Evening

## What this savepoint is
This is the end-of-session handoff after a long April 11 Mission Control day that mixed:
- Morning Meeting + operational cleanup
- Tasks authority / sync bug fixing
- Home-page micro-polish
- specialist-seat expansion for Link
- custom skill authoring for Link
- ClawHub troubleshooting
- humanizer skill refresh against the updated Wikipedia guide
- Home-page Custom News implementation with a new runner-backed cron and Dutch news digest pipeline

This savepoint exists so the next session does **not** have to rediscover:
- why Tasks sync was broken and how the board-vs-markdown truth model was hardened
- Link’s current real posture, including seat runtime, workspace, skill stack, and avatar state
- what changed in `humanizer`, and what was intentionally *not* copied from Wikipedia’s wiki-specific AI-writing forensics
- how the Home page shifted from `Current Tracks` to paired news readers
- how `Custom News` works end-to-end
- why Volkskrant was dropped and why IEX replaced it
- what still looks finished versus what is still a reasonable future refinement target

Read this together with:
- `MEMORY.md`
- `memory/2026-04-11.md`
- `TOOLS.md`
- `projects/mission-control/components/pages/GeneralHomePage.tsx`
- `projects/mission-control/lib/adapters/home.ts`
- `projects/mission-control/scripts/custom_news_digest.py`
- `scripts/cron_tasks/custom_news_feed_monitor.py`
- `projects/mission-control/lib/agents/definitions.ts`
- `agent-workspaces/job-advisor/*`
- `skills/job-advisor/SKILL.md`
- `skills/humanizer/SKILL.md`

---

## Executive summary
Today produced five meaningful Mission Control outcomes:

1. **Tasks truth got fixed properly**
   - daily-generated tasks now hit the structured store instead of only `AUTONOMOUS.md`
   - sync semantics are clearer in the UI
   - manual deletes stay suppressed instead of silently returning from legacy markdown

2. **The shell and Home page got a small but real polish pass**
   - `Mission Control` shell label is now `Marvin’s Room`
   - Home quote is now deterministic daily famous quotes with author attribution
   - agent-card green health lights were brightened

3. **Link became a real specialist seat**
   - direct specialist runtime
   - dedicated workspace + memory structure
   - custom `job-advisor` skill built in-workspace
   - `humanizer` added as a companion finishing-pass skill
   - avatar wired

4. **`humanizer` was updated against the current Wikipedia source**
   - general prose signs were refreshed
   - wiki-specific artifact detection was explicitly *not* over-applied to normal writing
   - schema validation cleaned up

5. **Home page Custom News became real**
   - `Current Tracks` removed
   - Home now has paired, equal-width, vertically scrollable readers
   - new runner-backed `custom-news-feed-monitor` added
   - English briefings generated from Dutch sources using priority + relevance rules
   - Volkskrant failed due to DPG consent/WAF restrictions and was replaced with IEX

The biggest product truth after this session is:

## Mission Control Home is now a two-reader editorial surface, not a mixed widget/news grab bag
The current accepted posture is:
- hero greeting + weather/quote card on top
- two equal-width readers below:
  - `Market Watch`
  - `Custom News`
- both vertically scrollable
- both capped to 30 items
- no resurrection of `Current Tracks` unless Philippe explicitly reopens that direction

---

## 1. Morning Meeting and operational hygiene

### 1.1 Security review
Nightly security review had no new actionable item.
Accepted-risk items remained stable; no changes were approved or needed.

### 1.2 Platform Health Council
A real but low-risk issue existed:
- webhook receiver health was OK
- watchdog was not running

Philippe approved restart.
Result:
- watchdog restarted successfully
- `/health` and `/health/auth` both returned OK afterward

### 1.3 Self-improvement finding was narrowed
A self-improvement recommendation initially drifted into “promote Apr 9–10 work into `MEMORY.md`”.
Philippe correctly pushed back.

The important correction is:
- `MEMORY.md` is for **durable curated truth**
- daily chronology belongs in `memory/YYYY-MM-DD.md`

A narrow curated update *was* later approved, but only for true operating truths.
That distinction matters and should not be lost.

### 1.4 Workspace home-improvement pass
The approved bounded workspace-lane improvement was:
- documenting `scripts/index_memory_health.sh`

This was intentionally small:
- usage
- purpose
- when to run it
- related files

No behavior change, just helper-script clarity.

---

## 2. Tasks authority / sync bug — what was broken and what was fixed

## 2.1 The bug
The architecture already intended:
- structured Tasks board = truth
- `AUTONOMOUS.md` = mirror/reconciliation layer

But the implementation still had a mismatch:
- `daily-task-generator.py` wrote new backlog tasks only into `AUTONOMOUS.md`
- cleanup/sync rewrote markdown *from the structured board*

So new generated tasks could appear in markdown, then vanish when sync ran because the board didn’t know about them yet.

That meant the system was conceptually correct but operationally dishonest.

## 2.2 The fix
The fix was applied across the real paths:
- `scripts/daily-task-generator.py`
- `projects/mission-control/lib/autonomous.ts`
- `projects/mission-control/lib/adapters/tasks.ts`
- `projects/mission-control/components/pages/TasksBoardSwitcher.tsx`

### Actual new behavior
- generated backlog items now land in the structured store as part of generation
- legacy-import suppression is respected
- manually deleted legacy tasks do not silently re-import during normal sync flow
- UI semantics are clearer:
  - `Pull from md`
  - `Apply board truth`

## 2.3 Durable lesson
Any future work on Tasks should preserve this rule:

## Structured board truth first, markdown mirror second
If a change creates new task state, it should hit the structured store before or alongside legacy markdown.
Never again let `AUTONOMOUS.md` become the only place where new valid tasks temporarily exist.

---

## 3. Home micro-polish before the bigger Home move
Before the Custom News work, there was a smaller Home/shell polish pass.

### What changed
- top-left shell label: `Mission Control` → `Marvin’s Room`
- daily quote block now uses real famous quotes + author attribution
- agent health green was brightened for active/ready/quiet states

### Why it matters
This was not just cosmetic fiddling.
It clarified the Home shell voice and stopped the quote block from feeling placeholder-ish.
The label change is intentionally just the visible shell label, not a documentation rename.

---

## 4. Link specialist seat — final posture after today

Link was created today as a new specialist seat following the Japin/Johan/Milou direct-specialist pattern.

## 4.1 Runtime / seat posture
- seat label: `Link`
- role: `Job Advisor`
- session target: `agent:job-advisor:main`
- default model: `codex5.4`
- default thinking: `medium`
- routing: direct specialist runtime

## 4.2 Workspace created
Path:
- `agent-workspaces/job-advisor/`

Key files:
- `WORKSPACE.md`
- `SOUL.md`
- `MEMORY.md`
- `SKILLS.md`
- `memory/continuity.md`
- `memory/candidate-profile.md`
- `memory/applications/README.md`
- `.learnings/corrections.md`
- `artifacts/README.md`

This mirrors the existing specialist-seat discipline:
- reusable workflow in the skill
- continuity and candidate truth in the seat workspace

## 4.3 Avatar / visible identity
- Link avatar wired to `/uploads/mission-control/avatars/Link.png`
- Link summary on Agents page now reads:
  - “Recruitment expert with a bag full of ATS-safe resumes and tailored cover letters, who will find and get you the best possible jobs.”

## 4.4 Current responsibility scope
Link is currently positioned for:
- ATS-safe resumes / CVs
- tailored cover letters
- honest role-specific application positioning
- application review and ATS/polish passes

Explicitly **not** implemented yet:
- open-position crawling
- broader job-market automation
- anything that pretends to know candidate evidence that is not actually logged

---

## 5. Link custom skill — what was built and why

## 5.1 Why not install one third-party skill blindly
A quick ClawHub crawl compared:
- `resume-assistant`
- `resume-cv-builder`
- `resume-builder-ai`
- `resume-optimizer`

The conclusion was:
- `resume-optimizer` = best workflow base
- `resume-assistant` = best modularity/scoring donor
- `resume-builder-ai` = too app-like / local-state-heavy for Link’s architecture
- `resume-cv-builder` = useful but thinner

So the chosen path was:

## Build a custom in-workspace Link skill
not “install a generic resume app skill and hope it fits”.

## 5.2 Skill built
Path:
- `skills/job-advisor/`

Files:
- `SKILL.md`
- `references/resume-workflow.md`
- `references/cover-letter-workflow.md`
- `references/ats-review-checklist.md`

Packaged artifact:
- `dist/job-advisor.skill`

Validation:
- validated successfully with the skill-creator validator
- packaged successfully

## 5.3 Architectural rule
The important architectural decision is:
- the skill owns reusable workflow
- the workspace owns seat continuity and candidate memory

Do **not** let Link drift toward a separate app-style local datastore model.
That was specifically avoided.

## 5.4 Later hardening
Link’s seat prompt/workspace posture was strengthened after the skill existed:
- activation prompt now explicitly says to read `skills/job-advisor/SKILL.md` first
- `SKILLS.md` added to starter files
- provisional wording removed from seat docs

That means Link is now genuinely **skill-first**, not just “resume helper with some docs nearby”.

---

## 6. Humanizer refresh — what was updated and what was intentionally ignored

## 6.1 Source checked
The current `humanizer` skill was reviewed against the updated Wikipedia page:
- `Wikipedia:Signs of AI writing`

## 6.2 What changed in the local skill
Useful new general-prose updates were added, including:
- stronger caveats: signs are **signs**, not proof
- better boundary between prose editing and wiki-specific artifact forensics
- expanded over-attribution / media-coverage / notability section
- added title-case heading pattern
- added phrasal-template / placeholder-text pattern
- added Markdown / formatting leakage pattern

## 6.3 What was intentionally *not* copied
The Wikipedia page now includes more site-specific forensic tells, such as:
- broken citation markup
- fake templates
- category weirdness
- wiki-heading / comment artifacts

These were **not** imported wholesale into `humanizer` because that would make it worse for normal writing.

### Durable lesson
When a source guide expands, do not confuse “broader source material” with “everything belongs in the local skill”.
We kept the generally useful prose-editing signals and left the wiki-only forensics out.

## 6.4 Schema cleanup
The nonstandard `version` frontmatter field was removed so the skill validates cleanly.

## 6.5 Link toolkit addition
After the refresh, `humanizer` was added to Link’s toolkit as a companion finishing pass.
The intended order is:
1. `job-advisor`
2. `humanizer`

That is important. ATS/role-fit first, human-sounding polish second.

---

## 7. ClawHub troubleshooting — what happened and what to remember

## 7.1 The symptom
ClawHub had shown `Rate limit exceeded` again, which looked suspicious because usage had been light.

## 7.2 What was found
Local config had a stale registry override:
- `/data/.config/clawhub/config.json`
- pointing at `https://clawhub.ai`

The CLI itself is current and supports:
- `search`
- `explore`
- `inspect`

## 7.3 What was done
The stale registry override was cleared so ClawHub falls back to current default behavior.
After that:
- `clawhub search resume` worked
- `clawhub inspect ...` worked

### Important nuance
The registry can still rate-limit on bursty requests.
So the real lesson is:
- capability is fine
- config drift was contributing noise
- the service can still be touchy on burst access

This should not be misremembered as “ClawHub was fundamentally broken”.

---

## 8. Home page Custom News — the new big feature

This was the last large feature block of the day.

## 8.1 UI change
The Home page previously had:
- `Market Watch`
- `CURRENT TRACKS`

It now has:
- `Market Watch`
- `Custom News`

### Layout posture
- equal-width columns
- both vertically scrollable
- both capped at 30 items
- `Custom News` uses a distinct softer purple/indigo lane, not the old dark green of `CURRENT TRACKS`

Files involved:
- `projects/mission-control/components/pages/GeneralHomePage.tsx`
- `projects/mission-control/app/globals.css`

## 8.2 Data pipeline
A new runner-backed task was added:
- `custom-news-feed-monitor`

Scheduler cadence:
- `:20` and `:50` daily

Key files:
- `scripts/cron_runner_tasks.py`
- `scripts/deterministic_scheduler.py`
- `projects/mission-control/lib/adapters/cron.ts`

## 8.3 Briefing logic
A new digest pipeline now generates Home-ready English briefings:
- `projects/mission-control/scripts/custom_news_digest.py`
- wrapper task: `scripts/cron_tasks/custom_news_feed_monitor.py`
- output file: `projects/mission-control/data/custom-news-briefings.json`

### Required briefing rules implemented
- only items from the last 24 hours
- English output only
- priority ranking on relevance:
  1. Technology & AI
  2. Dutch economic events
  3. Dutch entrepreneurship & startups
  4. Dutch & global political decisions with real-world consequences
  5. strong opinion pieces with real perspective
- deprioritize celebrity / soft features / weather / sports / local crime unless larger significance
- dedupe overlapping stories
- higher-ranked source sets the primary framing
- per item output:
  - custom headline
  - sources
  - what happened
  - why it matters
  - differing views only if applicable
  - links

## 8.4 Source evolution during implementation
Original desired source order:
1. FD
2. NRC
3. Volkskrant

### What went wrong
Volkskrant did not fail because of a parser typo.
It failed because:
- feed request redirected into DPG Media consent flow
- then hit access denied / WAF behavior
- returned HTML/403 instead of XML

That is a publisher-side access problem from this environment.

### Final operational replacement
Volkskrant was replaced with:
- IEX via rss.app
- `https://rss.app/feeds/NV6eLUUDbfKCeMbI.xml`

Final source order now:
1. FD
2. NRC
3. IEX

This turned out to be a better fit anyway, because Philippe wanted a more Dutch stock-focused source than Volkskrant.

## 8.5 Verification state
Verified during implementation:
- Python compile checks passed
- direct feed-monitor run succeeded
- runner task registration succeeded
- digest wrote 30 items
- Mission Control build succeeded
- preview restart completed successfully

---

## 9. Current accepted Home posture after tonight

This should be treated as the current accepted product state unless Philippe reopens it.

### Hero
Keep:
- big greeting
- weather/quote card
- deterministic daily famous quotes + author
- no redesign needed there right now

### Lower section
Keep:
- two-reader layout
- `Market Watch`
- `Custom News`
- scrollable lists
- 30-item cap

### Removed
- `Current Tracks`

If reopened later, likely tweak directions are:
- visual polish of `Custom News`
- source tuning
- item-ranking calibration
- maybe richer reader controls

But the structural direction itself is now clear.

---

## 10. Files / artifacts / code paths touched today

### Mission Control app / adapters
- `projects/mission-control/components/shell/TopTabBar.tsx`
- `projects/mission-control/components/agents/AgentSeatCard.tsx`
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`
- `projects/mission-control/components/pages/GeneralHomePage.tsx`
- `projects/mission-control/lib/agents/definitions.ts`
- `projects/mission-control/lib/agents/chat-activation.ts`
- `projects/mission-control/lib/adapters/home.ts`
- `projects/mission-control/lib/adapters/cron.ts`
- `projects/mission-control/lib/types/contracts.ts`
- `projects/mission-control/app/globals.css`

### Task / scheduler / cron paths
- `scripts/daily-task-generator.py`
- `projects/mission-control/lib/autonomous.ts`
- `projects/mission-control/lib/adapters/tasks.ts`
- `projects/mission-control/components/pages/TasksBoardSwitcher.tsx`
- `scripts/cron_runner_tasks.py`
- `scripts/deterministic_scheduler.py`
- `scripts/cron_tasks/custom_news_feed_monitor.py`
- `projects/mission-control/scripts/custom_news_digest.py`

### Specialist / skill paths
- `agent-workspaces/job-advisor/*`
- `skills/job-advisor/*`
- `skills/humanizer/SKILL.md`

### Data files of interest
- `projects/mission-control/data/custom-news-briefings.json`
- `projects/mission-control/data/autonomous-tasks.json`

---

## 11. Known caveats / things not to misread tomorrow

1. **Link exists and is real**
   - do not treat her as still provisional in the old sense
   - she has a real seat, real workspace, real skill, and an avatar

2. **The Home lower section is no longer “Market Watch + Current Tracks”**
   - if someone speaks as if `Current Tracks` still exists, they are working from stale context

3. **Volkskrant was not dropped casually**
   - it failed due to publisher-side consent/WAF restrictions from this environment
   - this was a real operational block, not arbitrary preference

4. **Custom News currently depends on generated digest output file**
   - the Home adapter expects `projects/mission-control/data/custom-news-briefings.json`
   - if the reader looks empty later, check the runner task and that file first

5. **Some runtime/generated files remain naturally noisy in git status**
   - do not confuse preview pid/log churn or market-intel state churn with this savepoint’s core product work

---

## 12. Smart next steps (if reopened later)

In priority order:

1. **Observe Custom News in normal use first**
   - check story quality
   - check whether ranking/briefing feels too generic or too repetitive
   - tune only after real usage

2. **Optional polish for Custom News**
   - source badges
   - better visual separation of item sections
   - maybe a subtle refresh affordance matching Market Watch

3. **Link workflow real-world test**
   - run a true resume / cover-letter session through Link
   - update `job-advisor` skill based on actual drafting friction

4. **Potential future Dutch-source tuning**
   - if another strong Dutch source becomes desirable, compare it against IEX on actual briefing quality, not just brand preference

5. **Do not reopen solved Tasks truth semantics casually**
   - only revisit if there is fresh evidence of board/markdown drift

---

## Bottom line
At the end of Apr 11, Mission Control is materially better in three ways:
- **truer**: Tasks and specialist-seat architecture match the intended truth model better
- **more personal**: `Marvin’s Room`, better quotes, Link as a real specialist seat
- **more useful daily**: Home now has a real Dutch/English Custom News surface instead of an underpowered `Current Tracks` block

The two most important durable truths to preserve are:
1. **Link is now a real direct specialist with a custom skill, not a placeholder seat**
2. **Home’s lower section is now a paired editorial news surface, with `Custom News` powered by a runner-backed Dutch-news digest using FD + NRC + IEX**
