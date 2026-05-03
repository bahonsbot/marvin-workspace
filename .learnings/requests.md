# Feature Requests Log

Capabilities the user wanted but don't exist.

## Format
## [FEAT-YYYYMMDD-HHMM]

**Requested:** [what user wanted]
**Why needed:** [user's context]
**Complexity:** simple | medium | complex

**Priority:** low | medium | high
**Status:** pending | implemented | wont_fix

---

## [REQ-20260420-1410]

**Request:** Before resetting or starting a fresh session after a meaningful work block, write a concise daily-memory and learnings save so continuation can resume cleanly later.
**What triggered it:** After Morning Meeting closeout and doc fixes, Philippe asked for a savepoint before continuing in a fresh session.
**Outcome:** Added a Morning Meeting savepoint to `memory/2026-04-20.md` and recorded this continuation preference in `.learnings/requests.md`.
**Status:** implemented

## Recent Requests

## [REQ-20260424-1058]

**Request:** Before ending a meaningful work block, save the day cleanly into canonical daily memory and structured learnings so the next session can restart from one clean source of truth.
**What triggered it:** After finishing the Apr 24 Morning Meeting, cleanup, and memory consolidation, Philippe asked to save everything neatly into daily memory, learnings, and core docs if needed before starting fresh later.
**Outcome:** Implemented by appending the Morning Meeting wrap-up and next-session restart truth to `memory/2026-04-24.md`, and recording the non-canonical memory-sidecar cleanup lesson in `.learnings/errors.md`.
**Status:** implemented

## [REQ-20260423-1341]

**Request:** Before ending a meaningful session, save everything done into daily memory and add learnings if needed so the next session can start cleanly.
**What triggered it:** After the daily-task-generator investigation, fix, cleanup, and Morning Meeting work were complete, Philippe asked to neatly organize the session state for a fresh future session.
**Outcome:** Implemented by appending a full session wrap-up to `memory/2026-04-23.md` and recording the new generator failure mode/fix in `.learnings/errors.md`.
**Status:** implemented

## [REQ-20260422-0048]

**Request:** After producing planning docs, also create a comprehensive "tomorrow-you" savepoint plus daily memory and learnings cleanup so a future agent can resume without Philippe re-explaining the architecture, findings, created docs, or next work.
**What triggered it:** After the Mission Control live-rollout architecture pass, Philippe explicitly asked for a configuration-oriented cutover doc, then asked for a highly detailed savepoint and a clean office handoff into daily memory and learnings.
**Outcome:** Implemented by creating a dedicated savepoint doc under `projects/_ops/`, extending the daily memory with the full rollout/planning carry-forward, and recording the new correction/error entries from the day's work.
**Status:** implemented


## [FEAT-20260330-1710]

**Requested:** when Mission Control Chat is reopened later for polish, group nearby sequential tool actions into smarter multi-tool burst bubbles instead of many tiny `TOOLS / Used 1 tool` bubbles, and refine Composer action hierarchy so Send reads more clearly as primary while secondary icons stay quieter.
**Why needed:** Philippe likes the new tool lane and Composer direction, but the current tool grouping can fragment the transcript and the Composer button row still feels a bit too equal-weight.
**Complexity:** medium

**Priority:** medium
**Status:** pending / later


## [FEAT-20260329-1741]

**Requested:** investigate and, if possible, restore/clarify prior behavior where Telegram direct messages to Marvin and Gateway UI / Mission Control chat behaved like one continuing conversation/model context rather than clearly separate runtime session lanes.
**Why needed:** the current split makes image-sharing and cross-surface collaboration much more confusing; Philippe expects to continue one conversation with the same Marvin even when moving between Telegram and Gateway/webchat.
**Complexity:** medium-high

**Priority:** medium
**Status:** pending / later


## [FEAT-20260325-1743]

**Requested:** add click-and-drag movement for manual Tasks boards so Personal and Projects cards can be moved between columns by dragging, not only by explicit controls
**Why needed:** Philippe expects kanban-style manual boards to support direct drag interaction as a normal board affordance; the current manual-board baseline works but still feels slightly too structured/form-like without drag movement
**Complexity:** medium

**Priority:** medium
**Status:** implemented on 2026-03-25/26 — manual Personal and Projects boards now support drag-and-drop column movement via `components/pages/TasksBoardSwitcher.tsx`

## [FEAT-20260323-1741]

**Requested:** when Mission Control later gets a Trading module, add a visible real-time research widget that shows interesting current candidates based on recent signals
**Why needed:** Philippe wants the market-intel / equity-bot / futures-bot truth layers stabilized first, then surfaced in Mission Control as a useful research-first panel instead of speculative UI. The widget should help surface strongest recent candidates, pair-trade research ideas, and value-chain signals without digging through raw files.
**Complexity:** medium

**Priority:** medium
**Status:** pending / later


## [FEAT-20260318-1813]

**Requested:** when individual agents later get their own identity/soul, add a way to activate them manually from the Agents page and talk to them in a chat surface, likely via the Chat/Orchestrator page with a link from the agent card when active.
**Why needed:** supports a more personal multi-agent system where agents are not just status cards but callable collaborators.
**Complexity:** medium-high

**Priority:** medium
**Status:** pending / later


## [FEAT-20260318-1456]

**Requested:** add an explicit Mission Control operational note/runbook covering host vs container boundary, which commands must run inside the container, preview routing truth, stale `.next` / build-output recovery, and how to verify the app process serving `preview.motiondisplay.cloud`
**Why needed:** today’s Mission Control verification exposed recurring confusion around host-side paths versus the container-visible runtime/build path
**Complexity:** simple

**Priority:** medium
**Status:** implemented


## [FEAT-20260318-0039]

**Requested:** add a thin bottom Mission Control status strip with real machine/runtime metrics like CPU, RAM, Disk, and Uptime
**Why needed:** Philippe wants the shell to feel more like a real operator desktop/control center, similar to the dashboard screenshot reference, without resorting to fake decorative widgets
**Complexity:** medium

**Priority:** high
**Status:** implemented

## [FEAT-20260317-1737]

**Requested:** preserve a detailed record of the OpenClaw HTTPS/proxy attempt, rollback steps, and unresolved constraints so future retries can resume from known facts instead of rediscovering the same path
**Why needed:** the Hostinger/OpenClaw/Mission Control update-prep path involved several real-world findings, a live rollback, and two intentionally skipped optional cleanup steps that should not be forgotten later
**Complexity:** simple

**Priority:** medium
**Status:** implemented — appended the full attempt/rollback summary to `memory/2026-03-17.md`

## [FEAT-20260317-1246]

**Requested:** Send a `🚀 Task started` notification to Telegram `goal-tasks` when `autonomous-task-executor` begins work and lands in `in_progress`
**Why needed:** Silence on `in_progress` made it unclear whether the executor actually ran, even when daily tasks were generated and execution had started
**Complexity:** simple

**Priority:** medium
**Status:** implemented — updated the `autonomous-task-executor` cron instructions so `in_progress` now sends `🚀 Task started` with task title and output path


## [FEAT-20260312-0400]

**Requested:** Session-end reminder to log to .learnings/
**Why needed:** Detection triggers existed in AGENTS.md but were never used — lessons captured in daily notes but not in structured .learnings/ system
**Complexity:** simple

**Priority:** high
**Status:** implemented — added reminder to AGENTS.md
## [FEAT-20260323-2235]

**Requested:** expand the future Mission Control trading/Market Intel surface so it not only shows interesting companies surfaced by recent signals, but also supports manually adding candidates to watch based on Philippe's own insight or outside media, with that manual-watch layer affecting Market Intel and/or the equity-bot research path rather than living as UI-only state.
**Why needed:** Philippe wants the trading surface to work as a research-first idea radar: the system should surface names worth looking into, and Philippe should be able to say "keep an eye on this one" and have that flow into the broader trading-research stack.
**Complexity:** medium-high

**Priority:** high
**Status:** partially implemented — Research Radar direction and manual-watch file-backed intake/write flow now exist in Mission Control; downstream influence on Market Intel/equity-bot research logic still needs follow-through

## [FEAT-20260323-2245]

**Requested:** for the future Mission Control trading/dashboard direction, support a regularly refreshed market-context layer using free/open-access data where viable, especially index snapshots and commodities snapshots, and only pursue winners/losers if the scope can be kept honest and source quality is good enough without paid vendor subscriptions.
**Why needed:** Philippe wants parts of the visual market overview style from reference dashboards, but only if the data can be sourced honestly without subscription-heavy infrastructure. The feature should stay snapshot/research-first rather than pretending to be an institutional realtime terminal.
**Complexity:** medium

**Priority:** medium-high
**Status:** partially implemented — index snapshot wiring exists and the Market Context block is live; commodities/source quality and a stronger context/polish pass are still needed; winners/losers remains intentionally deferred

## [REQ-20260324-1545]

**Request:** Philippe asked for a Stitch → MCP → Codex → GitHub Pages runbook to be documented properly at `docs/runbooks/` after completing the first full end-to-end design-to-deploy pass.
**What triggered it:** The process involved multiple steps, several failures, and non-obvious solutions that would be forgotten without documentation.
**Outcome:** Created `docs/runbooks/stitch-mcp-codex-github-pages-workflow.md` covering: Stitch API key setup, Codex MCP config, building with Codex (including Vite base path), GitHub repo + Pages setup, and troubleshooting.
**Status:** implemented

## [REQ-20260324-1545b]

**Request:** Add learnings to `.learnings/` folder for everything that went wrong during the build/deploy process.
**Outcome:** Added entries to `corrections.md`, `errors.md`, and `requests.md` covering: duplicate imports, GitHub Pages 404, npm rate limits, Vite base path, Material Symbols CDN failure.
**Status:** implemented


## [REQ-20260324-1722]

**Request:** Philippe asked to document everything learned from the Stitch design token translation gap and the visual fixes applied to the Atelier Bot dashboard.
**What was documented:**
  - Updated `docs/runbooks/stitch-mcp-codex-github-pages-workflow.md` with a mandatory design token extraction step (Step 0)
  - Added canonical color palette, effect tokens, and icon mapping reference to the runbook
  - Added guidance on Material Symbols vs Lucide tradeoffs
  - Added guidance on extracting CSS from Stitch HTML `<style>` blocks
  - Added errors to `.learnings/errors.md` covering: color fidelity loss, icon mismatches, Tailwind opacity notation failures, glass panel interpretation differences, Design System screen MCP API limitation
**Status:** implemented


## IEX RSS feed article extraction + translation fix — 2026-04-21 00:30 GMT+8

**Request:** Fix IEX news items in Mission Control Custom News showing generic site tagline instead of real article content, and ensure extracted IEX article text is translated to English like all other sources.

**What was done:**

1. **Root cause (tagline showing):** IEX RSS feed returns a generic tagline as the `description` field for all items. The existing `try_fetch_article_snippet()` fallback was defeated by the IEX page structure — after HTML parsing, the entire nav/branding block + credit line appeared as one line with no sentence-ending periods, so sentence-splitting produced a single giant non-matching block.

2. **Fix in `try_fetch_article_snippet()`:** Strip the IEX nav/branding header and attribution lines *before* sentence splitting, not after:
   - `re.sub(r"^IEX\.nl\s+\|[^C]*Columns\s+", "", text)` — removes `IEX.nl | Beurs - Beleggen - ... - Columns`
   - `re.sub(r"^Beeld:\s*", "", text)` — removes `Beeld: Reuters`
   - `re.sub(r"^Door\s+[^\n]+\n?", "", text)` — removes `Door Utkarsh Shetti 20 april (Reuters)`
   - Then split sentences, skip first sentence if it starts with `Door` (credit-line pattern)

3. **Root cause (Dutch text):** `try_fetch_article_snippet()` extracted Dutch article content but returned it raw. All other news sources translate summaries via `Translator.to_english()`.

4. **Fix in `compact_sentences()`:** When returning a snippet from `try_fetch_article_snippet()`, pass it through `Translator().to_english()` first.

**Status:** implemented — all 24 IEX items now show English article content.

**Lesson:** When scraping IEX article pages, strip page-structure artifacts (nav/branding headers, photo credits, bylines) *before* sentence splitting, not after. The IEX page concatenates these into a single text node without sentence boundaries, so naive sentence-splitting produces one giant "sentence" that fails the meaningful-length filter.

## [REQ-20260427-2302]

**Request:** After finishing a meaningful Mission Control audit/promotion session, save the work into the canonical daily memory and structured learnings before starting a new session.
**What triggered it:** After approving the Skills/Crons/Memory/Files mobile promotion from Lab to Dashboard, Philippe asked to save everything done in the session to daily memory and learnings so the next session starts clean.
**Outcome:** Added the Dashboard promotion closeout to `memory/2026-04-27.md` and recorded reusable lessons about post-restart route sweeps and route-specific mobile shell classes in `.learnings/`.
**Status:** implemented

## [REQ-20260428-1929]

**Request:** Before pausing a major BOILER ROOM / Mission Control Lab work block, save a comprehensive continuation package: daily memory, structured learnings, and a detailed future-agent savepoint addendum next to the implementation plan.
**What triggered it:** Philippe had to leave for dinner after the Lab ticker mobile pass and wanted future continuation to preserve all details, bugs solved, decisions, next steps, and implementation context so he does not need to re-explain.
**Outcome:** Implemented by appending to `memory/2026-04-28.md`, adding structured entries to `.learnings/corrections.md` and `.learnings/errors.md`, and creating `projects/mission-control-lab/docs/trading-section-lab-savepoint-addendum-2026-04-28.md`.
**Status:** implemented

## [REQ-20260502-2356]

**Request:** Continue building the Lab Trading Watchlist page tomorrow from the completed Convex-backed Watchlist foundation.
**What triggered it:** Philippe called the evening Watchlist session complete and asked to save the daily memory/learnings with clear next goals for the Watchlist page.
**Next goals:** item-level editing for priority/alert/watch note; provider metadata enrichment/backfill for added symbols; ticker-page add-to-watchlist picker; then list-level polish such as pinned/default list behavior, descriptions, sorting, and better multi-list empty states. Portfolio should wait until Watchlist persistence patterns are stable.
**Status:** pending / tomorrow

## 2026-05-03 — Lab Trading follow-ups for tomorrow
- Continue `IREN.US` cleanup beyond the emergency guard: find a proper company summary/logo/source path for IREN Limited / Iris Energy, avoiding fake data and avoiding irrelevant Wikipedia matches.
- Revisit the Watchlist page News element and make it product-real: provider-backed if possible, otherwise honest empty state without fabricated headlines.
