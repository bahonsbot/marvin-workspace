# Corrections Log

User corrections and feedback. Log when user explicitly corrects you.

## Format
## [CORR-YYYYMMDD-HHMM]

**Trigger:** "No, that's not right...", "Actually...", "You're wrong about...", etc.
**What was wrong:** [brief description]
**Lesson:** [what to remember going forward]

**Priority:** low | medium | high
**Status:** pending | promoted | resolved | wont_fix

---

## Recent Corrections
<!-- New entries go at top -->

## [CORR-20260327-1409]

**Trigger:** During Mission Control auth cleanup, host-side ownership advice assumed `node:node` would exist on the host because the container runtime used `node`, but Philippe correctly surfaced that the host had no such user and the relevant ownership baseline there was `root`.
**What was wrong:** I blurred container-user assumptions into host-user advice and gave an ownership normalization command that was only valid in one context.
**Lesson:** When giving ownership/permission commands in this VPS setup, check whether the command targets the host or the container before naming users/groups. Do not assume the container runtime user exists on the host.

**Priority:** medium
**Status:** active

## [CORR-20260327-0016]

**Trigger:** After reviewing the deeper Agents Phase 2 pass, Philippe said the page now had “a lot more happening” and was “a bit too much” for his liking, even though the added substance was valuable.
**What was wrong:** I let the next-level operational uplift accumulate too many visible layers at once. The page gained useful substance, but the presentation crossed from underpowered into overloaded.
**Lesson:** For Mission Control pages, once the substance is finally there, the next pass should usually be editing and restraint, not more feature density. When Philippe says a page is “too much,” preserve the stronger underlying functionality and reduce visual/informational noise instead of rethinking the whole page.

**Priority:** high
**Status:** active

## [CORR-20260325-2344]

**Trigger:** Philippe said the first Tasks visual pass changed the whole page layout too much; he preferred the previous layout and only wanted the visual/color treatment updated, plus a serif title with more whitespace similar to Chat.
**What was wrong:** I let the visual refinement brief drift into structural redesign. The work over-read the Stitch influence and under-protected the existing approved page layout.
**Lesson:** For Mission Control refinement passes, preserve approved structure unless Philippe explicitly asks for layout changes. Treat visual/style passes as skin, rhythm, spacing, and typography work first. When in doubt, keep layout stable and change tone, materials, and hierarchy more narrowly.

**Priority:** high
**Status:** active

## [CORR-20260325-1743]

**Trigger:** Philippe pointed out that the new manual Tasks boards still showed internal/provisional artifacts like `p-seed-1`, `manual`, and `Inspect scope`, which are not meaningful for the real manual-board experience. He also clarified that the state-change dropdowns should be removed once drag-and-drop exists.
**What was wrong:** I let placeholder/internal card metadata from the provisional implementation leak into the user-facing manual boards, and I had not yet treated the temporary state-change dropdown as cleanup debt once drag-and-drop becomes the real interaction model.
**Lesson:** When upgrading provisional manual boards into real interaction surfaces, remove seed IDs, internal labels, autonomous-board copy, and now-obsolete fallback controls. Placeholder scaffolding should not survive into normal user-facing board use once the intended kanban interaction exists.

**Priority:** high
**Status:** active

## [CORR-20260325-1425]

**Trigger:** Philippe reminded me that I sometimes forget two Mission Control build helpers: the Agent Team and Stitch MCP export.
**What was wrong:** I can drift into single-threaded implementation planning and underuse available build acceleration / design-translation tooling.
**Lesson:** For Mission Control build work, explicitly consider (1) Agent Team for implementation/review support and (2) Stitch MCP export as a first-class bridge between Stitch design and the real app build. Do not default to manual interpretation if those tools can reduce drift.

**Priority:** high
**Status:** active

## [CORR-20260325-1332]

**Trigger:** Philippe clarified that the old `85/15` memory rule was meant to preserve Marvin's growth through interaction and feedback, not to enforce a fake precision ratio.
**What was wrong:** I treated identity continuity as a context-balance percentage problem instead of a promotion-and-memory-structure problem.
**Lesson:** Model identity should grow through repeated interaction, explicit feedback, durable preferences, and lessons from real work. Keep stable core traits in `SOUL.md` / `IDENTITY.md`, explicit behavior shaping in `.learnings/corrections.md`, and only durable relationship or working-style changes in `MEMORY.md`. Do not create a separate identity log or let passing impressions clutter core files.

**Priority:** high
**Status:** resolved


## [CORR-20260324-1311]

**Trigger:** Philippe pointed out that I kept typing `120s` in chat while discussing a cron timeout that was supposed to be `1200s`.
**What was wrong:** I applied the right live config value but echoed the wrong number in user-facing updates, which is especially dangerous when discussing timeout/config changes.
**Lesson:** After approval-gated config or cron changes, quote the exact live value from the returned tool state before replying. Do not trust memory for numeric settings.

**Priority:** high
**Status:** resolved

## [CORR-20260324-1201]

**Trigger:** Philippe corrected my instinct to over-promote resolved review decisions into `MEMORY.md` / `TOOLS.md` and asked that nightly reviews check recent daily memory instead.
**What was wrong:** I treated lean durable docs as the main suppression layer for recently handled issues, which caused repeat overnight findings when the real source of truth was recent daily memory.
**Lesson:** For overnight review jobs, use recent daily memory as the first suppression layer for already fixed, accepted, or recently investigated issues. Keep `MEMORY.md` and `TOOLS.md` lean; only promote genuinely durable baselines there.

**Priority:** high
**Status:** resolved

## [CORR-20260324-1157]

**Trigger:** Philippe corrected repeated Morning Meeting/security-review backup findings and clarified that a manual snapshot path and automated off-server backup already exist.
**What was wrong:** I kept treating backup/disaster-recovery as missing because the posture was not captured in durable memory or TOOLS.md, so reviews kept resurfacing the same false gap.
**Lesson:** Treat backup posture as an explicit operational baseline. For future security or Morning Meeting review, do not flag backup/DR as missing unless there is concrete evidence of drift, failure, stale documentation, or a newly discovered coverage gap.

**Priority:** high
**Status:** resolved


## [CORR-20260323-1708]

**Trigger:** Philippe corrected my typo: "tagger," not "tager."
**What was wrong:** I misspelled a core implementation term while discussing the Market Intel value-chain tagging work.
**Lesson:** Slow down on repeated technical nouns during iterative implementation updates; when a term is central to the work, keep the spelling exact and consistent.

**Priority:** low
**Status:** resolved


## [CORR-20260319-2022]

**Trigger:** Philippe clarified that when timing is roughly comparable, he prefers better semantic recall results over plain keyword/BM25 speed.
**What was wrong:** I was still leaning too conservatively toward `qmd search` as the default recall path after the CPU-mode QMD hardening, even after evidence showed `qmd vsearch` had become fast enough and better in quality.
**Lesson:** On this VPS, prefer `qmd vsearch` first for memory recall when timing is in the same ballpark, use `qmd search` as the fallback exact-match lane, and reserve `qmd query` for deeper slower lookups.

**Priority:** medium
**Status:** resolved

## [CORR-20260318-2259]

**Trigger:** Philippe's live Mission Control Chat review kept pushing the layout away from explanatory scaffolding and width-heavy side panels.
**What was wrong:** I initially let Chat accumulate too many framing panels and too much side-column weight, including a global right inspector, a standalone active-agent sidebar, and multiple explainer blocks in the center. That made Chat feel like a dashboard about chat instead of a place to continue chat.
**Lesson:** For Mission Control Chat, center-column dominance matters more than extra context furniture. Prefer fewer panels, merge side details into the Agent Rail when possible, remove self-explaining copy aggressively once the structure is clear, and design for laptop-width comfort before adding optional inspectors.

**Priority:** high
**Status:** resolved

## [CORR-20260318-1709]

**Trigger:** Philippe reviewed the live Mission Control preview and clarified several direction corrections.
**What was wrong:** I kept some UI choices too utilitarian or too data-heavy. Specifically: the bottom strip used a raw host identifier that is technically correct but not meaningful; the Tasks header copy was too explanatory; task lane tags need more visual personality; and the Sessions page drifted too close to an OpenClaw-style sessions dump instead of a more personal, agent-squad style surface.
**Lesson:** For Mission Control, prefer meaningful operator signals over raw identifiers, keep explanatory copy minimal on visual surfaces, give task categories more personality, and treat the Sessions page as an agent roster/system cast rather than a cron-heavy session ledger.

**Priority:** high
**Status:** resolved


## [CORR-20260318-1321]

**Trigger:** User pointed out repeated filename typo drift between `TOOLS.md` and incorrect variants in chat.
**What was wrong:** I kept alternating between the correct `TOOLS.md` filename and typo variants during Morning Meeting replies.
**Lesson:** When referencing core workspace files, visually verify the exact filename before sending. Do not rely on muscle memory during long review sessions.

**Priority:** medium
**Status:** resolved


## [CORR-20260318-1217]

**Trigger:** User corrected filename/typo sloppiness in Morning Meeting replies.
**What was wrong:** I introduced avoidable typos in core doc references, including `TOOLS.md` and the correct runbook filename `docs/runbooks/morning-meeting-decision-template.md`.
**Lesson:** Slow down on filenames and core workspace docs. Verify exact names before sending, especially during Morning Meeting summaries.

**Priority:** medium
**Status:** resolved

## [CORR-20260318-0040]

**Trigger:** Philippe clarified that the current Mission Control UI is "on the right track" but not yet "premium enough," and highlighted the current strongest/weakest modules after live preview.
**What was learned:** For Mission Control reviews, the right calibration is promising/coherent/improving, not premium-finished. `Sessions` is currently the strongest page; `Tasks` is the biggest current mismatch because it still needs a more kanban-first mental model.
**Lesson:** When assessing Mission Control progress, describe the UI as directionally strong but still below the intended premium standard, protect what already works on `Sessions`, and prioritize `Tasks` as the next major correction instead of over-polishing already-stronger modules.

**Priority:** high
**Status:** resolved

## [CORR-20260318-0041]

**Trigger:** Philippe's live Mission Control preview feedback emphasized that the real open question on Orchestrator is where the actual runtime conversation/chat surface should live inside Mission Control.
**What was learned:** The Orchestrator problem is no longer just a polish issue. The next major question is the product/architecture decision about chat placement, and superficial UI improvement should not pretend that answer already exists.
**Lesson:** For Mission Control Orchestrator work, do not fake an embedded chat outcome. Treat chat placement as a deliberate later decision after Tasks/Sessions/system-strip work, and keep the current bridge/framing honest in the meantime.

**Priority:** high
**Status:** resolved

## [CORR-20260317-1843]

**Trigger:** Philippe wants SearXNG considered moving forward, but only as an optional comparison path first, not as a Brave replacement.
**What was learned:** For search-provider experiments in this workspace, slower is acceptable if search quality or source diversity improves, but the default provider should not be changed before a real comparison on Philippe's actual query mix.
**Lesson:** When testing alternative search providers, keep the current provider as default, run a structured comparison first, and only promote the alternative if it shows repeatable wins on real queries rather than anecdotal novelty.

**Priority:** medium
**Status:** resolved


## [CORR-20260317-1203]

**Trigger:** Self-Improvement MEDIUM-001 - recent reusable lessons were left in daily notes instead of being promoted into `.learnings/`
**What was learned:** Duplicate prevention in autonomous execution works best as a layered pattern: generator dedupe first, selector-time prune second, queue-time suppression and recovery last.
**Lesson:** When hardening autonomous task systems against duplicate work, add the cheapest guard at the earliest decision point, then reinforce it downstream so the system still self-heals if upstream state drifts.

**Priority:** medium
**Status:** resolved

## [CORR-20260317-1204]

**Trigger:** Self-Improvement MEDIUM-001 - recent reusable lessons were left in daily notes instead of being promoted into `.learnings/`
**What was learned:** Publish/sync flows are more reliable when they rebase before push and use an explicit source-of-truth conflict policy for generated artifacts.
**Lesson:** For git-backed publish scripts, prefer `git pull --rebase` before push, and for generated truth artifacts like `board.json`, resolve conflicts with an explicit rule instead of ad-hoc manual handling.

**Priority:** medium
**Status:** resolved

## [CORR-20260317-1205]

**Trigger:** Self-Improvement MEDIUM-001 - recent reusable lessons were left in daily notes instead of being promoted into `.learnings/`
**What was learned:** Human review workflows need a canonical structured store plus a human-readable audit trail, and the writing path should be enforced with a helper when consistency matters.
**Lesson:** For review pipelines that feed later learning, use a two-artifact contract: machine-readable canonical state for downstream consumers, plus dated markdown for auditability. Provide a helper script for writing the canonical state instead of trusting models to remember storage rules.

**Priority:** medium
**Status:** resolved

## [CORR-20260317-1206]

**Trigger:** Self-Improvement MEDIUM-001 - recent reusable lessons were left in daily notes instead of being promoted into `.learnings/`
**What was learned:** Cron migrations are safer when sequenced from deterministic jobs to mixed/reasoning jobs, with lock hardening and same-day direct verification before relying on scheduler truth.
**Lesson:** For cron architecture changes, migrate deterministic jobs first, harden overlap/lock behavior before rollout, and verify each migrated task directly the same day before trusting scheduled status signals.

**Priority:** medium
**Status:** resolved

## [CORR-20260316-1844]

**Trigger:** "Also keep the current environment we're running it in into account, the docker-based VPS via SSH that's running 24/7. Ideally I want to keep it local, but if we have to deploy parts online that can be considered - if kept safe and secure."
**What was learned:** For Mission Control, Philippe prefers a local-first architecture that respects the current Docker-based VPS + SSH + 24/7 environment. Internet exposure is acceptable only if justified and secured properly.
**Lesson:** Dashboard architecture and deployment recommendations should assume Docker-based VPS hosting, local-first access, and security-conscious optional remote exposure.

**Priority:** high
**Status:** resolved

## [CORR-20260316-1837]

**Trigger:** "I really don't mind if it turns out to be something that looks it came straight from the Apple design labs. And I do secretly fancy the 'date/time/weather widget' and/or a quote of the day, if it doesn't break the UX."
**What was learned:** Philippe prefers premium, polished UX for the dashboard/Mission Control project, not just functional operator aesthetics. Ambient touches like date/time/weather and maybe quote-of-the-day are welcome if they improve atmosphere without harming clarity.
**Lesson:** For the dashboard project, optimize for truthful operator UX first, but allow a distinctly premium, Apple-lab-level visual polish and carefully chosen ambient widgets.

**Priority:** medium
**Status:** resolved

## [CORR-20260316-1416]

**Trigger:** "You can remove 'safety/reliability fixes' from your exception list, because we would already tackle those early anyway."
**What was wrong:** I included safety/reliability fixes as a special backlog-age override exception, but Philippe wants those handled through normal prioritization, not as an extra selector bypass.
**Lesson:** For backlog selection, default to oldest eligible To Do item. Exception list should stay narrow: blocker-removal, time-sensitive work, and prerequisites that unlock multiple other tasks. Do not include safety/reliability fixes as a separate exception class.

**Priority:** high
**Status:** resolved

## [CORR-20260316-1340]

**Trigger:** "Please make sure this reporting is part of the Morning Meeting from now on. I thought that was already discussed last night, but perhaps it got lost during the memory processing."
**What was wrong:** Morning Meeting did not proactively include the workspace home-improvement report, even though Philippe expected autonomous maintenance work from that day to be surfaced there.
**Lesson:** Morning Meeting should explicitly include any autonomous workspace home-improvement work from that day, with what changed, why, expected benefit, and rollback.

**Priority:** high
**Status:** resolved

## [CORR-20260315-1307]

**Trigger:** Morning Meeting protocol - I jumped to Self-Improvement without completing all Security Review findings
**What was wrong:** I presented Security Review HIGHs, then moved to Self-Improvement without going through MEDIUM and LOW findings. Philippe correctly caught this.
**Lesson:** Always complete ALL severity levels (HIGH → MEDIUM → LOW) in a report before moving to the next report category. The Morning Meeting protocol requires finishing each full report before proceeding.

**Priority:** medium
**Status:** resolved

## [CORR-20260312-2321]

**Trigger:** "if there is a 'good' option and a 'best' option when making a decision, generally go for the best option"
**What was clarified:** When presenting or choosing between a merely good option and a clearly better one, prefer the best option by default unless risk/cost/complexity makes that unreasonable or Philippe explicitly asks for the smaller/safer route
**Lesson:** Bias decisions toward the strongest architecture or solution, not just the adequate one, when the tradeoff is justified

**Priority:** high
**Status:** resolved

## [CORR-20260312-1442]

**Trigger:** "I actually do like the surprise MVPs, but perhaps not in the creative category..." and clarification that the first two trading goals are project-improvement goals while business analysis is a separate learning skill
**What was wrong:** I disabled surprise MVPs too broadly and was still blending trading-system improvement goals with business-analysis learning goals
**Lesson:** Allow surprise MVPs when they create useful systems or project improvements, but avoid creative-output surprise MVPs; split trading into project-improvement tracks (bots) versus staged learning tracks (business analysis)

**Priority:** high
**Status:** resolved

## [CORR-20260312-1425]

**Trigger:** "make sure to interpret the 'Learn Python programming' goal as a language skill approach, similarly as you would learn Japanese"
**What was wrong:** I was still treating Python mostly as artifact production instead of staged language learning: basics first, reading/comprehension first, then guided practice, then gradual progression
**Lesson:** Treat Python as a progressive language-learning track like Japanese: foundations, comprehension, guided exercises, then practical application only when matched to current level

**Priority:** high
**Status:** resolved

## [CORR-20260312-1356]

**Trigger:** "upon switching to the codex5.4 model, did you read its relevant prompting guidelines? I told you before"
**What was wrong:** After model switch to codex5.4, I did not reload `model-guidance/gpt-5.4.md` before continuing
**Lesson:** On every codex5.4 model switch, immediately read and apply `model-guidance/gpt-5.4.md` before answering further

**Priority:** high
**Status:** resolved

## [CORR-20260312-1300]

**Trigger:** "I told you before that we want to go through them one by one, step by step"
**What was wrong:** Morning Meeting — presented security findings in batch instead of one at a time
**Lesson:** Always present findings one at a time, wait for decision before proceeding to next

**Priority:** high
**Status:** resolved
## [COR-20260324-0005]

**Correction:** when using a builder/reviewer split, do not surface reviewer commentary before the builder result exists unless Philippe explicitly wants interim process notes
**Context:** during Mission Control work, Marvin reported reviewer feedback before the builder pass had landed, which Philippe correctly called out as the wrong order for useful progress reporting
**Rule:** prefer this flow for delegated implementation work: builder completes → reviewer validates built result → Marvin reports the combined outcome. If running them in parallel, keep internal review notes internal until the build exists.

**Status:** active

## [COR-20260323-2255]

**Correction:** when useful, make deliberate use of the agent team instead of trying to do everything solo
**Context:** Philippe reminded Marvin during Mission Control work that delegation should be used where it improves speed, depth, or validation quality
**Rule:** for heavier implementation/audit passes, especially multi-part Mission Control work, consider splitting builder/reviewer work via the agent team rather than defaulting to single-thread execution

**Status:** active

## [CORR-20260324-1539]

**Trigger:** Philippe pointed out that I documented a workflow but missed documenting my own mistakes and operational learnings from the process.
**What was wrong:** I was going to continue fixing bugs without first capturing the lessons from what went wrong during the build/deploy.
**Lesson:** When Philippe asks to document everything, that includes what failed, what was learned, and the corrections made along the way — not just the happy path.

**Priority:** high
**Status:** resolved


## [CORR-20260324-1700]

**Trigger:** Philippe pointed out that I documented the Stitch→Codex workflow but missed documenting the systematic visual translation failures that occurred during the Atelier Bot dashboard build.
**What was wrong:** I was treating each visual bug as an isolated fix rather than recognizing the root cause — Codex's inability to extract design tokens from Stitch HTML.
**Lesson:** When a workflow systematically produces the same class of bug across many components (in this case: colors, borders, backgrounds, bar charts all wrong), the right response is to identify and fix the root cause at the source, not patch individual components. The fix belongs in the design token extraction step before Codex is spawned, not in individual component files after.
**Status:** resolved — added design token extraction as mandatory Step 0 in the runbook


## [CORR-20260325-0015]

**Trigger:** Philippe reviewed the implemented Chat redesign (commit 43805ba) and said "not close to how I want it to be yet, but it's a start."
**What this means:** The Stitch → Codex implementation captured the structural elements (bubbles, composer, greeting, layout) but didn't hit the right visual quality bar. Needs iteration.
**Lesson:** First-pass Stitch implementations should be treated as structural proof-of-concept, not final visual quality. Budget for at least one iteration round before declaring a page "done." When Philippe says "it's a start," that means the gap between the Stitch concept and the implementation is still significant.
**Status:** open — Chat needs a second design iteration pass
**Prevention:** Set expectations with Philippe that first implementations from Stitch will need at least one review/iteration cycle before reaching the target quality.
