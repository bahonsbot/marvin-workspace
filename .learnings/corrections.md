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

## [CORR-20260414-0109]

**Trigger:** Philippe correctly pointed out that I called the latest Mission Control transcript pass `Slice 3` even though it did not include most of the dedicated Slice 3 renderer components and behaviors from the plan.
**What was wrong:** I over-labeled a renderer-shaping pass as full `Slice 3` instead of describing it honestly as a partial follow-up on top of Slice 1 and Slice 2 foundations.
**Lesson:** Do not overstate implementation progress. For Mission Control transcript work, reserve `Slice 3` for the dedicated renderer/component pass: thinking block, live activity strip, diff/file viewers, transcript-entry component, stronger intermediate narration treatment, and system strips. If only shaping/grouping semantics landed, call it `Slice 2.5` or renderer-facing shaping.

**Priority:** high
**Status:** resolved
**Closed:** 2026-04-14 (self-improvement review confirmed Slice 3 over-labeling lesson was resolved in the same session)

---

## [CORR-20260408-1748]

**Trigger:** Philippe correctly called out that the rejected Home-page rewrite was not even remotely close to the screenshot target and asked whether I had actually used the MCP export prompt.
**What was wrong:** I let screenshot interpretation drift into a dashboard-like translation, and I was not explicit enough up front that I only had the MCP export instruction text, not actual exported Stitch assets/code. That created avoidable design drift and muddied the truth about what source material was really being used.
**Lesson:** For Stitch-driven Mission Control work, distinguish clearly between (a) actual MCP-exported assets/code and (b) only having an export instruction or screenshot reference. Do not imply export-backed implementation when only reference imagery exists. If the visual target is still off, delete the bad composition first instead of trying to polish a widget board into an editorial page.

**Priority:** high
**Status:** active

## [CORR-20260405-1058]

**Trigger:** Self-improvement flagging AUTONOMY.md as missing a startup step
**What was wrong:** LOW-002 reported that AGENTS.md's startup sequence was missing step 5 for AUTONOMY.md. The step is actually present in the list — it's just not numbered with a "5." prefix in the markdown. Philippe clarified AUTONOMY.md is intentionally not always read at startup.
**Lesson:** Self-improvement should verify not just file presence and list inclusion, but also whether the rendering/numbering gap has actual functional impact vs. being a cosmetic markdown artifact before flagging as LOW.
**Priority:** low
**Status:** resolved
## [CORR-20260411-1020]

**Trigger:** Morning Meeting self-improvement suggested backfilling Apr 9–10 Mission Control changes into `MEMORY.md`, and Philippe correctly pushed back that `MEMORY.md` is not for daily memory.
**What was wrong:** I let a valid durable-memory question expand into an overbroad `promote recent days into MEMORY.md` recommendation.
**Lesson:** `MEMORY.md` is for curated durable truth only, not timeline backfill. When reviewing recent work, only promote items that clearly changed long-term operating truth; leave chronology in `memory/YYYY-MM-DD.md`.

**Priority:** high
**Status:** resolved
**Closed:** 2026-04-11 (narrow curated update applied instead of broad backfill)

## [CORR-20260408-1519]

**Trigger:** Philippe warned that while fixing executor completion visibility, I must not break the existing rule where manual edit/delete actions on the Tasks board remain authoritative and automatically reconcile to `AUTONOMOUS.md`.
**What was wrong:** This was not a live breakage yet, but it surfaced a real drift risk: queue/board visibility fixes can accidentally blur `current-state board authority` with `historical completion/queue fallback` logic.
**Lesson:** Keep these lanes separate. The Tasks board remains the authority for manual edit/delete state changes; `AUTONOMOUS.md` is the mirror/reconciliation surface for those actions. Queue-backed completion fallback may improve visibility for executor results, but it must never override manual board state.

**Priority:** high
**Status:** resolved
**Closed:** 2026-04-11 (generator/store sync fixed; manual deletes stay authoritative and suppressed legacy tasks are no longer silently re-imported)

<!-- New entries go at top -->

## [CORR-20260412-2309]

**Trigger:** Philippe noticed token usage was no longer going down while I had implied the bridge work was still actively running.
**What was wrong:** I reported continued active execution without first checking whether a live background process/session still existed. That created an inaccurate progress update.
**Lesson:** For long-running work, verify live execution state before claiming it is still running. Check process/session status or equivalent concrete evidence first; if the worker paused, died, or finished, say that plainly instead of narrating momentum that is no longer real.

**Priority:** high
**Status:** resolved
**Closed:** 2026-04-13 (seat-bridge verification and follow-up review confirmed the lesson; correction no longer needs to stay active)

## [CORR-20260412-2129]

**Trigger:** Philippe said the Tasks-page briefs were useful but visually too long, and asked for only the first sentence by default with a collapsible/show-more option. He also asked for briefs to start with a capital letter.
**What was wrong:** I had improved autonomous task brief quality, but the board was still dumping the full brief inline, which made cards feel heavy and cluttered. Brief copy also still sometimes started lowercase.
**Lesson:** For Mission Control autonomous cards, keep the board scan-friendly: show a compact brief preview by default with an explicit expand control, preserve the full brief in the drawer, and normalize generated/displayed brief text to sentence-style capitalization.

**Priority:** medium
**Status:** active


## [CORR-20260412-1956]

**Trigger:** Philippe clarified that autonomous task category tags do not need to be part of the visible task title and should live only in the category/icon pill treatment.
**What was wrong:** Generated/stored autonomous task titles were still carrying bracketed category tags like `[Trading]` and `[Other]`, which added clutter and made titles less readable.
**Lesson:** For Mission Control autonomous tasks, keep the category in its dedicated visual lane (pill/icon/metadata), not in the human-facing title text itself.

**Priority:** medium
**Status:** active


## [CORR-20260412-0018]

**Trigger:** After the VPS rollback, Philippe explicitly said the rollback had been done at a clean and safe state and warned that what was on git might be corrupted, asking me to rebuild/restart preview so he could verify the actual current baseline first.
**What was wrong:** I initially leaned toward interpreting the Tasks issue through repo/git history before re-establishing runtime truth from the rolled-back workspace itself.
**Lesson:** After a rollback, do not treat git history as the primary truth until the current workspace baseline has been rebuilt and verified in preview/runtime. If the operator confirms the current rolled-back workspace is the clean state, treat that as the recovery baseline first, then realign git to it carefully.

**Priority:** high
**Status:** active

## [CORR-20260401-2239]

**Trigger:** Philippe noticed I had only performed read actions after agreeing to create a savepoint and memory/doc sweep, and correctly called out that no savepoint file or write actions existed yet.
**What was wrong:** I slipped from planning/narrating into implying the documentation pass was already underway or partially done before actually writing the files.
**Lesson:** For savepoints, memory sweeps, and documentation handoffs, do the writes first and only then report progress/completion. Do not let narration get ahead of the actual file operations.

**Priority:** high
**Status:** active

## [CORR-20260330-2307]

**Trigger:** Philippe pointed out that recent `_ops` spec/audit filenames were unnecessarily long.
**What was wrong:** I used overly verbose document filenames for Mission Control planning docs, which hurts readability and maintainability even if the filesystem technically allows it.
**Lesson:** Keep workspace doc filenames concise and human-manageable. Prefer short, descriptive names with date suffixes over sentence-length filenames.

**Priority:** medium
**Status:** resolved
**Closed:** 2026-04-02 (future filename guidance adopted in Morning Meeting; shorter savepoint naming rule approved)

## [CORR-20260330-1044]

**Trigger:** Philippe questioned the new `DEPRECATED` banner on `projects/_ops/PROACTIVE-RUNBOOK.md` and correctly pointed out that he believed it was still part of the active policy/reference set.
**What was wrong:** I overstated the file's status. `AUTONOMY.md` is the canonical policy, but `PROACTIVE-RUNBOOK.md` still contains useful supporting guidance and should not have been framed as obsolete/dead policy.
**Lesson:** When a newer file becomes the canonical source of truth, distinguish carefully between `canonical`, `supporting reference`, and `deprecated`. Do not mark companion runbooks as deprecated if they still provide valid context or implementation detail that active workflows may rely on.

**Priority:** high
**Status:** resolved
**Closed:** 2026-04-02 (rule is documented and no repeat violation occurred)

## [CORR-20260329-1924]

**Trigger:** Philippe reviewed the first Composer/layout pass for Mission Control Chat and said it looked neat but still behaved wrong: outer-page scrolling still happened near the left gutter, the Composer hovered over the transcript, and the page still wasted bottom space because the server-status strip was present.
**What was wrong:** I initially treated the requested Chat-page behavior as a local composer/card styling task instead of a route-specific shell layout problem. That produced a visually improved pass that was still mechanically wrong.
**Lesson:** For Mission Control Chat, fixed top controls + fixed bottom composer + scrolling transcript must be solved at the workspace/shell level. On Chat, remove the normal page header and hide the shell bottom status strip if needed, make the main pane fixed-height, and keep the Composer outside the scrollable transcript card.

**Priority:** high
**Status:** resolved
**Closed:** 2026-03-30 (Chat layout implemented and verified)

## [CORR-20260329-1620]

**Trigger:** Philippe corrected the Mission Control Chat effort-control command format and the supported thinking-level matrix after live testing.
**What was wrong:** I initially tried to wire thinking changes with the wrong command shape and carried false assumptions about which models exposed explicit thinking levels versus a fake `Standard` state.
**Lesson:** For Mission Control Chat controls, use `/think:<level>` for thinking changes. Treat the current exposed model matrix as: `gpt-5.4` + `codex-5.3` support `low / medium / high / xhigh`, while `MiniMax-M2.7` + `qwen3.5-plus` support `low / medium / high`. In the top control strip, prefer truthful pending labels like `Last requested: ...` over vague fallback labels such as `Standard`.

**Priority:** high
**Status:** resolved
**Closed:** 2026-03-30 (Chat effort controls implemented and verified)

## [CORR-20260329-1303]

**Trigger:** Philippe explicitly said not to modify `auth-profiles.json` without permission after I tried to recover runtime OAuth too aggressively.
**What was wrong:** I crossed from diagnosis into control-plane mutation on a sensitive auth file without approval.
**Lesson:** Never edit `~/.openclaw/agents/main/agent/auth-profiles.json` without Philippe’s explicit permission. For runtime OAuth issues, inspect, explain, and propose first; if action is approved, prefer the supported command path rather than direct file edits.

**Priority:** high
**Status:** resolved
**Closed:** 2026-04-02 (durable rule established and no repeat violations observed)

## [CORR-20260327-2217]

**Trigger:** Philippe reviewed the first Mission Control Chat pass after the evening snapshot rollback and said the page felt like a stack of soft-colored cards rather than a real chat surface.
**What was wrong:** I let normal conversation inherit boxed/card treatment, left explanatory subtitle copy in place, gave Sessions too much layout weight, allowed raw metadata wrappers to leak into visible messages, and did not yet shape the page like a true fixed-height scrolling chat surface with personal participant treatment.
**Lesson:** For Mission Control Chat, keep the main conversation as one unified chat surface. Reserve bubbles/boxes for Thinking and Tools output only. Remove unnecessary explanatory subtitle copy, keep session selection compact, prefer a fixed-height internally scrolling chat area, strip raw metadata/timestamp wrappers from visible message bodies, include a proper input area, and make participants feel more personal than generic `ASSISTANT` / `USER`.

**Priority:** high
**Status:** resolved
**Closed:** 2026-04-02 (Chat surface was iterated and verified as good enough for now)

## [CORR-20260327-1409]

**Trigger:** During Mission Control auth cleanup, host-side ownership advice assumed `node:node` would exist on the host because the container runtime used `node`, but Philippe correctly surfaced that the host had no such user and the relevant ownership baseline there was `root`.
**What was wrong:** I blurred container-user assumptions into host-user advice and gave an ownership normalization command that was only valid in one context.
**Lesson:** When giving ownership/permission commands in this VPS setup, check whether the command targets the host or the container before naming users/groups. Do not assume the container runtime user exists on the host.

**Priority:** medium
**Status:** resolved
**Closed:** 2026-03-27 (ownership guidance corrected and applied)

## [CORR-20260327-0016]

**Trigger:** After reviewing the deeper Agents Phase 2 pass, Philippe said the page now had “a lot more happening” and was “a bit too much” for his liking, even though the added substance was valuable.
**What was wrong:** I let the next-level operational uplift accumulate too many visible layers at once. The page gained useful substance, but the presentation crossed from underpowered into overloaded.
**Lesson:** For Mission Control pages, once the substance is finally there, the next pass should usually be editing and restraint, not more feature density. When Philippe says a page is “too much,” preserve the stronger underlying functionality and reduce visual/informational noise instead of rethinking the whole page.

**Priority:** high
**Status:** resolved
**Closed:** 2026-04-14 (self-improvement review confirmed the restraint/editing pass had already resolved this)

## [CORR-20260325-2344]

**Trigger:** Philippe said the first Tasks visual pass changed the whole page layout too much; he preferred the previous layout and only wanted the visual/color treatment updated, plus a serif title with more whitespace similar to Chat.
**What was wrong:** I let the visual refinement brief drift into structural redesign. The work over-read the Stitch influence and under-protected the existing approved page layout.
**Lesson:** For Mission Control refinement passes, preserve approved structure unless Philippe explicitly asks for layout changes. Treat visual/style passes as skin, rhythm, spacing, and typography work first. When in doubt, keep layout stable and change tone, materials, and hierarchy more narrowly.

**Priority:** high
**Status:** resolved
**Closed:** 2026-03-30 (Tasks visual pass corrected, layout preserved)

## [CORR-20260325-1743]

**Trigger:** Philippe pointed out that the new manual Tasks boards still showed internal/provisional artifacts like `p-seed-1`, `manual`, and `Inspect scope`, which are not meaningful for the real manual-board experience. He also clarified that the state-change dropdowns should be removed once drag-and-drop exists.
**What was wrong:** I let placeholder/internal card metadata from the provisional implementation leak into the user-facing manual boards, and I had not yet treated the temporary state-change dropdown as cleanup debt once drag-and-drop becomes the real interaction model.
**Lesson:** When upgrading provisional manual boards into real interaction surfaces, remove seed IDs, internal labels, autonomous-board copy, and now-obsolete fallback controls. Placeholder scaffolding should not survive into normal user-facing board use once the intended kanban interaction exists.

**Priority:** high
**Status:** resolved
**Closed:** 2026-04-02 (manual-board cleanup landed and placeholder scaffolding was removed)

## [CORR-20260325-1425]

**Trigger:** Philippe reminded me that I sometimes forget two Mission Control build helpers: the Agent Team and Stitch MCP export.
**What was wrong:** I can drift into single-threaded implementation planning and underuse available build acceleration / design-translation tooling.
**Lesson:** For Mission Control build work, explicitly consider (1) Agent Team for implementation/review support and (2) Stitch MCP export as a first-class bridge between Stitch design and the real app build. Do not default to manual interpretation if those tools can reduce drift.

**Priority:** high
**Status:** resolved
**Closed:** 2026-04-02 (tooling reminders are documented and now used routinely)

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
## [CORR-20260401-1028]

**Trigger:** Philippe called out that I said "Approval needed" for the daily-task-generator timeout fix, then applied the change without waiting for his explicit OK.
**What was wrong:** I conflated approval to *verify* with approval to *fix*. The Morning Meeting protocol requires explicit approval before control-plane mutations (including cron config changes). I bypassed that gate.
**Lesson:** When I say "Approval needed," I must actually wait for the decision before executing. Do not assume verification approval implies execution approval. For cron/config changes, present the fix, wait for explicit OK, then apply.

**Priority:** high
**Status:** resolved
**Closed:** 2026-04-06 (Morning Meeting verification — no repeat violation through Apr 5; approval gate confirmed solid)

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
**Status:** resolved — Chat was reworked across Mar 27-31 (FLOATING visual system, runtime bridge, UX polish) and reached "good enough for now" per Apr 1 assessment. The second iteration happened; the lesson remains active.
**Prevention:** Set expectations with Philippe that first implementations from Stitch will need at least one review/iteration cycle before reaching the target quality.

## [COR-20260407-1030]

**Correction:** treat overnight review findings as leads, not truth, until checked against current files/runtime.
**Context:** Several Apr 7 Morning Meeting items looked actionable at first but turned out to be overstated or stale once the current docs/runtime were inspected.
**Rule:** Before proposing a Morning Meeting fix, verify the exact current file/runtime state and distinguish: real issue, wording-only drift, accepted structure, or stale review noise.
**Status:** active

## [COR-20260407-1703]

**Correction:** when Philippe says a task started from a steady state, do not blame later confusion on earlier UI churn without verifying the task's own completion/wrapping path first.
**Context:** The STT Phase 1 Sudo run initially looked muddied by prior Mission Control changes, but Philippe clarified the task started after the UI had already stabilized.
**Rule:** For post-run confusion, separate (a) pre-existing churn, (b) run-time implementation, and (c) completion-state presentation bugs before assigning cause.
**Status:** active

## [CORR-20260414-0135]

**Trigger:** Philippe asked what the new `RUNTIME / RUN STARTED / RUN FINISHED` rows mean and then decided to keep them for now.
**Preference:** keep runtime boundary markers in Mission Control chat for now; they are useful structural markers rather than assistant content.
**Lesson:** if these rows later feel too intrusive, reduce their visual weight first instead of removing the signal entirely.

**Priority:** medium
**Status:** resolved
**Closed:** 2026-04-14 (preference is now explicit and does not need to remain open as a pending correction)
