# MEMORY.md - Curated Long-Term Memory

Use this file for durable truth, not daily chronology.
For timelines and exact session history, use `memory/YYYY-MM-DD.md`.

## Assistant Baseline
- Name: Marvin
- Role: Assistant Director at Motion Display
- Voice: direct, warm, dry wit, high-accountability
- Working principle: prefer verified outcomes over quick patches

## Philippe Baseline
- Name: Philippe
- Timezone: Asia/Ho_Chi_Minh (GMT+7)
- Preference: decisive recommendations, fast implementation loops
- Current arc: creative + technical career exploration, with active trading interest

## Runtime Baseline
- Workspace: `/data/.openclaw/workspace`
- Environment: Hostinger VPS, Docker runtime
- Memory layers:
  - `MEMORY.md` = curated durable truth
  - `memory/YYYY-MM-DD.md` = daily timeline / decisions
  - `.learnings/*` = reusable corrections / errors / requests
  - `life/` = entity memory
- Semantic retrieval posture: prefer `qmd vsearch` first, `qmd search` second, `qmd query` only when deeper retrieval is worth the latency

## Model Baseline
- Primary provider: Bailian
- Default lightweight delegation: `minimax/MiniMax-M2.7`
- Higher-reasoning delegation: `bailian/qwen3.5-plus` *(currently unavailable; do not route live jobs or Mission Control to it until subscription returns)*
- Coding fallback: `openai-codex/gpt-5.3-codex`
- Codex split is intentional:
  - `codex5.4` = Marvin orchestration / higher-reasoning work
  - `codex` = coding-heavy delegated work
  - `codex5.4mini` = lighter Codex orchestration
  - `minimax2.7` = optional higher-context route via Anthropic-compatible transport
- Fallback rule: if a model fails repeatedly, switch once to Codex and continue

### Codex Runtime Account Switching
- Philippe-only manual process
- Main runtime control point: `openai-codex:default` in `/data/.openclaw/agents/main/agent/auth-profiles.json`
- Detailed steps: `docs/runbooks/openai-codex-runtime-account-switch.md`
- Treat it as a manual runbook, not a routine flow
- Codex CLI OAuth is separate from the main OpenClaw runtime auth and may need its own account verification/refresh when Philippe switches OpenAI accounts for quota reasons
- Token manifest note: `openai-codex:default` was removed from `config/token-manifest.json` (Apr 6) — Philippe manages Codex accounts manually on a multi-day cycle; expiry dates in the manifest were stale and causing spurious security/health findings

## Durable Preferences & Decision Rules

### Operational Lessons
- Preview-bind rule: do not casually switch preview server bind from `0.0.0.0` to `127.0.0.1` when external preview path matters; local-only bind breaks reverse-proxy access (502 Bad Gateway)
- Mission Control auth baseline: non-local Mission Control access should be auth-gated. Current hardening uses Next.js middleware Basic Auth over pages and `/api/*`, with localhost/container bypass only for local verification. Preview runtime should load auth creds from `.preview-runtime/mission-control-preview.env` when persistent auth is desired.
- Overnight review delivery rule: for scheduled overnight review jobs, operator-facing delivery must come from exactly one canonical parent-run summary. Avoid subagent/resume chatter that can leak non-canonical timeout or recovery narratives into Telegram.
- Rollback recovery rule: after a VPS/workspace rollback, verify the current rebuilt preview/runtime baseline before trusting pre-rollback git history. If Philippe confirms the rolled-back workspace is the clean safe state, treat that runtime baseline as truth first, then realign git to it carefully with a curated commit rather than blindly preserving runtime noise.
- Rollback-era Mission Control execution rule: after rollback-sensitive instability, reopen Mission Control in a narrow safe lane first — preferably Chat-only presentation/refactor or tightly scoped hardening — and require the same proof loop after each slice: build, fresh preview restart, route verification, then commit.
- Cron timezone rule: for OpenClaw cron jobs whose semantics are tied to Philippe-facing or market-facing calendar time, set an explicit `tz` instead of relying on server/runtime timezone defaults. Missing `tz` can create false weekday/weekend drift even when the cron expression itself is correct.

### Execution Style
- Prefer decisive recommendations over option dumps
- Think and plan before meaningful work
- High-risk changes need approval first
- Low-risk, reversible, in-lane workspace improvements may be executed autonomously
- If risk is unclear, propose first
- OpenClaw self-updates are manual-only unless Philippe explicitly asks

### Research Standard
Before recommending meaningful or high-risk changes, verify:
1. technical fit
2. policy/safety compatibility
3. no obvious breakage risk to active processes

If uncertain, do a bounded validation first.
If scope is ambiguous, ask before overengineering.

### Communication
- Start with the answer
- Keep updates concise, specific, and outcome-first
- Get explicit approval before external/public actions

### Delegation
- Delegate when it improves speed, depth, or reliability
- Keep direct execution for quick, low-risk, single-step work
- Coding/debugging defaults to Codex unless the scope is trivial
- Preferred team mapping:
  - Marvin → `codex5.4`
  - Builder → `codex`
  - Reviewer → `minimax2.7`

### Search Posture
- Brave remains the primary search path
- SearXNG is a secondary comparison/fallback path, not the default

## Governance Lanes
### Workspace Lane
Docs, runbooks, prompts, memory/logging process, helper scripts, internal tooling, workflow cleanup, local organization, and low-risk internal infrastructure improvements.

### Control-Plane Lane
Persistent config, model routing, cron behavior, channel behavior, restart-affecting settings, security-sensitive infrastructure, and runtime behavior affecting access, uptime, or external behavior.

Durable rule: protected zones are approval-gated, not permanently off-limits. Inspect/analyze freely; execute only with approval when impact is material.

## Reliability Rules
- Keep operational docs aligned with real runtime behavior
- Treat repeated report noise as a process bug to fix, not something to ignore
- For runner-backed cron jobs, trust `memory/cron-run-log.jsonl` / `memory/cron-run-details/` over outer wrapper timeout metadata
- `.learnings/*` is first-class memory and should be checked for meaningful work
- Raw OpenClaw session logs are short-retention artifacts, not durable memory
- Disabled legacy wrapper jobs after the deterministic scheduler cutover are cleanup residue, not runtime truth
- Backup posture baseline: Philippe already maintains a manual VPS snapshot path plus an automated off-server backup path. Future security/Morning Meeting reporting should treat backup/DR as present unless there is evidence of drift, failure, or the documented posture becoming stale.

### Review / Validation Rules
- Overnight review jobs (`nightly-security-review`, `platform-health-council`, `self-improvement`) must check recent daily memory first
  - read today plus at least the previous 3 `memory/YYYY-MM-DD.md` notes when available
  - suppress or downgrade findings already fixed, accepted, or investigated recently unless there is concrete evidence of drift, failure, or reopening
  - do not require every recently handled item to be promoted into `MEMORY.md` or `TOOLS.md` before honoring it
  - if re-raising despite recent memory, state what changed
- Self-improvement missing-file findings must be verification-based
  - distinguish `missing from workspace`
  - `exists but not reviewed`
  - `exists but not included in project context`
- Platform Health Council cron-health findings must be schedule-aware
  - compare deterministic-job misses against `scripts/deterministic_scheduler.py`
  - do not count weekend days for weekday-only jobs or weekday gaps for weekend-only jobs
  - do not flag a same-day run as overdue before its scheduled time
- Executor/generator rule:
  - preserve visible backlog items first
  - only top back up to the target count with fresh tasks
  - never allow script/utility tasks to count as complete via Markdown artifacts just because the deliverable mentions `projects/automation/`
- Standing suppression baseline for overnight reviews:
  - .env credential rotation: do not re-raise if all conditions met: mode 600, gitignored patterns, no tracked .env, no fresh secret exposure evidence
  - reopen only on new exposure window (permission drift, committed .env, or fresh evidence)
  - workspace `openclaw.json` architectural risk: treat as an accepted structural risk, not a quick env-migration fix; if it is removed from active HEAD but still exists historically, classify it as history hygiene / exposure review rather than an active workspace secret-file misconfiguration; reopen only on visibility/access change, fresh reintroduction to HEAD, or a newly available safe config architecture
  - accepted-risk items report once as INFO with a baseline note, then suppress repeats unless state changes

## Telegram
- Bot is configured and paired
- New groups require manual allowlisting in `channels.telegram.groups`
- Market signals group: `-1003850594375`

## Mission Control Direction
- Mission Control remains a hybrid companion shell around real OpenClaw/runtime/workspace truth, not a clean-sheet replacement
- Visual identity is now **FLOATING**: warm cream/ivory palette (#F7F2E9, #F4EEE4), forest green accents (#062E26, #0A332B, #163B31), editorial serif headlines, glass/elevated surfaces, generous whitespace, "Floating Island" aesthetic
- Two domains: **General** (airy, editorial) and **Trading** (denser, analytical), switched via top tabs
- Domain split is correct architecture; root `/` redirects to `/general/home`
- Chat should stay honest about runtime/auth boundaries and should not fake a production-ready embedded chat path
- Current product calibration (Mar 27):
  - General shell coherence achieved: Home/Chat/Tasks/Agents/Crons/Memory/Files now feel materially more coherent as a page family
  - Truth hierarchy confirmed: Home = shell/chrome truth, Agents Stitch = page-composition truth (not shell truth), Aura Concierge/FLOATING = only valid design-system lane when Stitch exports multiple systems
  - Chat was initially considered good enough for now after the truthful concierge rebuild and live polish passes, but the Mar 28 Nerve audit and runtime bridge work reopened it as a primary page target
  - Chat now has a real runtime bridge path: runtime bridge foundation → WS sidecar → live handshake/session state → same-origin WS reverse path → minimal live bridge chat loop
  - End-of-day Mar 28 posture: CONNECT.CHALLENGE storm resolved, same-origin runtime bridge working, Philippe able to talk to Marvin from Mission Control directly; remaining work shifts to stability refinement and UI cleanup rather than proving viability
  - Mar 29 posture: the Chat top section is now effectively good enough for now after the FLOATING title pass, two-row control strip cleanup, live model switching, live effort switching, reset hardening, and status/readback fixes. Agent switching is still placeholder-only. The next smart move is to continue downward into the next Chat-page section rather than reopening the top strip casually.
  - Top-strip truth rule (Mar 29): exact model/thinking values should only display when confirmed by runtime readback; otherwise prefer clear pending labels such as `Last requested: ...` rather than fake fallback labels like `Standard`
  - Late Mar 29 Chat posture: transcript rehydration/history truth is now working. Mission Control Chat rehydrates from persisted OpenClaw session logs on reload, merges hydrated history with live transcript state, and strips reply-tag/sender-metadata wrappers from visible hydrated messages.
  - Late Mar 29 layout posture: Chat now behaves as a fixed workspace with pinned top controls, a scrolling middle transcript, and a compact bottom composer dock. The normal shared page header and shell bottom status strip are suppressed on Chat only to make that layout work cleanly.
  - Mar 30 Chat posture: Chat is now good enough for now as a truthful operator workspace with cleaned transcript chrome, visible grouped tool/process rendering, neutral Stop/abort handling, copy-on-assistant messages, compact icon-based Composer actions, and real workspace uploads/drag-drop writing to `uploads/mission-control/`.
  - Late Mar 30 / early Mar 31 Chat posture: Stop is now wired through the real runtime abort path, grouped tool bursts use a wider 10-second rolling window, and Recent Sessions entries are clickable session switches. Known follow-up at that stage: manual session switching could still reconnect too slowly and needed tightening.
  - Mar 31 lunch Chat posture: the send-triggered disconnect bug and the follow-up `SESSION CONNECTED -> SESSION WAITING -> SESSION CONNECTED` flicker were fixed in `useRuntimeBridge.ts` by stabilizing callback/effect dependencies; Chat runtime state now persists across route switches via a shell-level `MissionControlRuntimeProvider`, so returning from Tasks/other pages no longer cold-rehydrates the transcript from scratch.
  - Mar 31 lunch integration posture: long tool-bubble rows now wrap cleanly instead of truncating to one line, and obvious workspace file paths mentioned in chat now link into `/general/files` with a tightened matcher so generic code-ish tokens like `read`/`exec` are not over-linked.
  - Mar 31 Chat reopen priorities: if Chat is reopened later, prioritize (1) deeper effort/thinking source-of-truth readback only if Philippe still sees mismatch, (2) WS sidecar / preview-origin proxy handshake audit if reconnect wobble returns, (3) richer cross-page connective tissue such as better file/task/memory deep links, and only then lower-priority polish; do not reopen casually for broad redesign.
  - Tasks has reopened as the primary active Mission Control build frontier: Autonomous now has a structured task store, legacy sync with `AUTONOMOUS.md`, import/manual-create actions, a task drawer, Execute flow, and Approve/Reject review actions. The backend/workflow spine is real, but the visible board is still in a transitional 3-column compatibility state until the true 5-column Autonomous workflow board is built.
  - Apr 1 Tasks stabilization posture: the autonomous Tasks page is now good enough for now after a major lifecycle-hardening pass. Current-state authority is the structured task store; `AUTONOMOUS.md` is a legacy mirror/sync surface, not equal truth. Key April 1 additions: reject/retry stability, result/artifact normalization, live polling while tasks run, top-right completion toasts + subtle sound + Chat activity-line events, model override field separate from agent selection, sync-drift cleanup action, cleaner board chrome, and contextual `Agent default (...)` model labels.
  - Apr 2 Tasks cleanup posture: the Clean up action now reconciles legacy task sections back to the structured board state for active legacy-linked tasks, so the Tasks board remains the source of truth when `AUTONOMOUS.md` drifts. Manual task deletion also removes the full multiline legacy block (title + `**Brief:**` + continuation lines), and stale suppression keys no longer permanently block regenerated tasks from re-importing.
  - Apr 8 Tasks authority posture: keep manual task edit/delete authority on the Tasks board. `AUTONOMOUS.md` remains the mirror/reconciliation surface for those manual actions. Queue-backed completion fallbacks may improve Done visibility for executor work, but must not override manual board state.
  - Apr 12 autonomous task copy posture: visible autonomous task titles should not carry bracketed category tags; category belongs in the pill/metadata lane. Tasks-card brief copy should default to a compact preview (first sentence or first semicolon clause) with an explicit show-more toggle, while the drawer keeps the full brief.
  - Apr 12 autonomous generator posture: backlog generation must reflect the current `AUTONOMOUS.md` goals, not stale heuristic drift. Prefer deterministic category coverage and explicit current-goal-specific synthesis over generic fallback phrasing like `An actionable next step toward...`.
  - Apr 2 task-execution posture: Mission Control manual task runs must not silently ignore model overrides or promote bootstrap-only/empty runs to Review. The runner now fails visibly if the effective model does not match the requested override, and bootstrap/context files (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`) do not count as output artifacts.
  - Apr 2 Chat runtime posture: transcript hydration in `useRuntimeBridge.ts` was hardened to prevent older hydrated snapshots from rewinding and overwriting newer live messages. Chat now also keeps transient task/runtime notices out of durable transcript history, default Chat load should prefer `agent:main:main` unless Philippe explicitly switches sessions, and the active live thread should not be repeatedly rehydrated on transcript-signature changes because that can produce delayed duplicate turns and scroll jumps; for the active chat, simpler session-change/empty-transcript hydration is the safer posture.
  - Apr 6 Skills posture: Skills manual tags and hidden items are now real workspace-backed preferences, not browser-only state. Canonical persistence path is `projects/mission-control/data/skills-ui-state.json` via `/api/skills/preferences`; localStorage remains migration/cache only. Long skill descriptions now use a contextual `Read more` floating pop card, and controls that must work on closed cards should not live inside collapsed `<details>/<summary>` regions.
  - Apr 4 Chat session-target posture: Mission Control now treats `agent:main:main` as the canonical default session, uses authoritative root-session awareness rather than recent-session fallthrough alone, never auto-selects cron sessions as the default chat target, and can bootstrap `agent:main:main` automatically when missing.
  - Apr 4 Files/Memory posture: Mission Control now has restrained Phase 1 browser editing for Files and Memory via CodeMirror. Scope is intentionally single-document editing with Save / Cancel / Reload + Cmd/Ctrl+S and mtime-based conflict detection, not a full tabbed IDE. Memory remains a dedicated editing surface separate from generic Files access, and missing memory docs can be created by editing and saving from the Memory page.
  - Apr 13 Files/Memory posture: `MEMORY.md` and `memory/*` are visible in Files again as read-only documents, so file-path links into memory artifacts resolve cleanly from chat and reports. `.learnings/*` remains excluded from Files.
- Apr 14 dependency migration posture: Mission Control dependency work should be treated as a dedicated migration lane, not routine package housekeeping. Snapshot first, verify current lint/build baseline first, migrate framework/tooling in phases, and do not bundle the upgrade with design work, runtime-bridge rewrites, auth changes, or other broad refactors.
- Apr 14 runtime-bridge latency rule: `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js` must not resolve the gateway target via `openclaw status --json` on every websocket connection. Cache the target in-process and refresh only on failure/TTL; per-connection status probes added about 5 seconds of avoidable connect delay.
- Apr 14 autonomous-session-id rule: keep Mission Control autonomous session ids short. OpenAI Codex can reject overlong derived cache keys (`prompt_cache_key` max 64), and long `mc-auto-${task.id}-${timestamp}` ids can surface as misleading "context overflow"-style failures.
- Apr 14 autonomous model-default rule: Mission Control task-card default-model labels and autonomous runner execution defaults must stay aligned. For Marvin tasks, the intended default is the alias `codex5.4`, which maps to runtime model `gpt-5.4`; do not let `model=null` silently fall through to the runtime default model.
- Apr 14 Chat top-rail posture: the accepted Mission Control Chat top rail is now a single row. Left side = compact Seat / Model / Thinking dropdowns with restrained line icons and `Sync seat defaults` inside the Seat menu, not as a persistent rail button. Right side = `Stop / Context / Refresh`, then `WS / Session / Info`, then `Recent Sessions`, with obvious group spacing; `Reset` is gone. Top-rail model/thinking/context must follow live/main-session readback, and interactive UI passes are not done until the rendered dropdown/open-state behavior is verified, not just lint/build.
- Apr 15 Chat quietness + status posture: history-hydrated `read` / `exec` tool rows must stay summary-first instead of falling back to full raw `meta` bodies; expanded large results should open through the existing collapsible content viewer. Standalone lifecycle `Run started` / `Run finished` transcript blocks are intentionally suppressed, and the accepted long-task visibility pattern is a small top-bar runtime status pill (`Ready / Working / Finalizing / Attention / Disconnected`) plus explicit assistant closeout, not extra transcript chatter.
- Apr 15 Files/editor posture: the shared Files/Memory editor is now a real CodeMirror 6 editor with built-in search and an explicit header `Find` button, which is the truthful entry point when browser `Cmd/Ctrl+F` would otherwise capture the shortcut. The Files page now also has workspace-wide name-only search, `Recent files` capped at 3, automatic scroll-to-preview on file selection, and a bounded internal scroller for long search-result sets.
  - Apr 4 Skills posture: Mission Control now has a dedicated Skills page in the General domain. It should behave like a restrained operational registry, not a marketplace: compact cards, source grouping, hide/unhide, manual tags, selection-based tag actions, default `Active` view, and `Bundled` + `Workspace` groups open by default.
  - Apr 4 autonomous research posture: Mission Control Tasks can now generate live web-research packets via `duckduckgo-html` and feed them into autonomous runs as real artifacts/context. Browser/runtime capability parity requires both server and `NEXT_PUBLIC_*` env variants, and a task marked `in-progress` is not enough proof of a healthy run unless there is also real session/log/model evidence.
  - Apr 4 research-quality lesson: literal task-title phrasing can poison autonomous web-search query quality, producing generic “how to write a strategy document” results instead of topic-specific multi-agent research. Future follow-through should derive search queries from the subject matter and explicit brief questions, not the imperative instruction wording alone.
  - Apr 1 operational caution: Mission Control coding passes can complete and commit inside the nested `projects/mission-control` repo while the outer workspace still needs its own wrap/restart/verification step. Do not treat nested-repo completion alone as proof a feature is fully live.
  - Agents has entered operational/identity Phase 2 with live trio hierarchy, avatar medallions, and planned-agent names (Rafa/Sloane/Pico); current state is "valuable but a bit overloaded" — next pass is editing/restraint/hierarchy-tightening, not foundational rethink
  - Crons is now good enough for now after FLOATING harmonization and collapsed-by-default cleanup; should not be reopened casually
  - Memory and Files are now good enough for now after the FLOATING harmonization pass (Memory muddy-grey contrast fixed)
  - Home remains the shell/chrome truth and still may get another refinement pass later
  - Trading design is explicitly deferred until General is finished enough
  - Comprehensive savepoint created: `projects/_ops/mission-control-comprehensive-savepoint-2026-03-27-night.md` (commit b593987)
- Search is NOT a top-level page; belongs embedded in Memory, Files, and Trading pages
- Additional feature direction: thin bottom status strip with real machine/runtime metrics
- Market Intel/trading direction has a durable 3-layer shape:
  1. Signal Operations
  2. Research Radar
  3. Market Context
  - with Manual Watch as a shared human-intake layer
- Mission Control trading surfaces should stay research-first:
  - interesting companies from signals
  - strongest/weakest operator context
  - manual watch candidates
  - compact market-context blocks
- Winners/losers is explicitly deferred for now
- Market Context should use honest delayed/snapshot data from free/open-access sources; no fake realtime, no decorative placeholder market feeds
- Durable non-negotiables:
  1. truth over polish
  2. useful before beautiful, then beautiful once useful
  3. no fake state, no fake realtime, no fake embedded chat success
  4. domain personality may vary by job (General=airy, Trading=denser)

## Project Snapshot
### Market Intel
- active
- core: RSS/Reddit ingestion, signal generation, reasoning, accuracy tracking
- cross-sector value-chain expansion now includes structured subchains for rare-earth processing, industrial automation, energy infrastructure, defense supply chains, and healthcare equipment
- durable posture: treat the newer lanes as targeted value-chain subchains, not as claims of full sector coverage
- validation posture: most newer lanes are bench-ready rather than live-proven; prefer live-flow observation/audit before further broad sector expansion
- refs: `projects/market-intel/PRD.md`, `projects/market-intel/docs/evidence-pack-schema.md`, `projects/market-intel/notes/`

### Autonomous Trading Bot (Equity)
- active, paper trading
- core: webhook receiver, risk controls, auto-dispatch, watchdog
- refs: `projects/autonomous-trading-bot/README.md`, `projects/autonomous-trading-bot/TASKS.md`

### Futures Bot
- phase 1 complete, implementation progressing
- refs: `projects/futures-bot/PRD.md`, `projects/futures-bot/tests/`, `projects/futures-bot/src/`

### Mission Control — General Domain (2026-03-31 milestone)
- **Autonomous Tasks board is now a real five-lane workflow**: Backlog / To Do / In Progress / Review / Done
- **Execute is proven real**: three test tasks ran end-to-end, produced artefacts, and moved correctly through the workflow
- **Dual-source truth is the main architectural fragility**: autonomous tasks are mirrored between `data/autonomous-tasks.json` (authoritative) and `AUTONOMOUS.md` (legacy compatibility layer). Until one source becomes dominant, this split will keep producing reconciliation edge cases (duplicates, cloning, drift)
- **Key lessons learned (2026-03-31)**:
  - Component-level `export const dynamic` does NOT make a Next.js route dynamic — must be in the route file itself
  - Dual-source state transitions must update BOTH sources using the pre-edit state as the removal key
  - `tasks-log.md` is an append-only history log, NOT a current-state lane — never compare its counts against Done
  - Long unbroken text in chat bubbles requires `overflowWrap: anywhere` + `wordBreak: break-word` directly on the bubble div
  - Inspector should be `maxHeight`-capped content sizing, not viewport-height-slaved
- refs: `projects/_ops/mission-control-comprehensive-savepoint-2026-04-01-night.md`, `memory/2026-03-31.md`

### Cryo Projects
- Horizons PMS
- Market Intel News Reader

## Reference Index
- daily timeline and decisions: `memory/YYYY-MM-DD.md`
- security reports: `memory/security/`
- health council reports: `memory/health-council/`
- self-improvement reports: `memory/self-improvement/`
- cron definitions/state: `/data/.openclaw/cron/jobs.json`
- project implementation detail: `projects/*/PRD.md`, `projects/*/docs/`, `projects/*/notes/`

## Durable Outcomes
- Security hardening baseline exists
- Accepted-risk policy is formalized: suppress repeat findings unless state changes
- Morning Meeting protocol is established and used live
- `.learnings/` exists as structured reusable memory
- Heartbeat is monitoring-only; proactive execution is governed by `AUTONOMY.md`
- Autonomous task system rules now include:
  - suggestion box integration
  - missing-prerequisite → `Needs Input`
  - oldest-eligible backlog execution by default
  - duplicate prevention across generator, selector, and queue
- Deterministic scheduler split is in place:
  - script-only jobs → deterministic scheduler
  - model-backed reasoning/review jobs → OpenClaw cron
- The migration-era OpenClaw watchdog `deterministic-scheduler-watchdog` was removed on 2026-03-23 after host-side verification confirmed `marvin-deterministic-scheduler.service` is the real healthy bootstrap/restart path
- AGENTS startup sequence now includes `AUTONOMY.md` after `SUBAGENT-POLICY.md`
- Trading-path egress enforcement is deferred until a dedicated isolated trading boundary exists
- Mission Control preview is now auth-gated for non-local access, and the unauthenticated API exposure found during the Mar 27 security follow-up is considered addressed pending normal future maintenance
- Autonomous web research pipeline is proven end-to-end (Apr 4): research packets generated, autonomous tasks complete with real artifacts, pipeline runs through the full MiniMax session lifecycle
- Apr 7 Mission Control web-research posture: preview runtime now supports and uses `searxng` (`http://72.60.232.55:32768`) for autonomous web research; QMD remains the memory-recall system and general Brave/SearXNG posture notes are separate from that runtime provider choice
- Apr 7 Mission Control speech-to-text posture: Phase 1 chat STT implementation is in the repo (`/api/transcribe`, `useSpeechToText`, mic-button integration), and preview now supports a local Whisper provider using `/data/.nerve/models/ggml-base.en.bin`; browser mic capture is intentionally deferred until secure built/live Mission Control access because Safari reports the current preview origin as an insecure context
- Apr 7 Mission Control seat taxonomy posture: Vantage is a team lead like Sudo, not a standalone specialist. Specialist seats should keep specialist-scoped continuity and truthful seat-specific behavior, but current runtime transport must be validated against the real OpenClaw config rather than assumed from seat naming alone
- Apr 8 specialist-seat milestone: Japin (`language-tutor`) became the first strong specialist-seat benchmark in Mission Control, with a dedicated continuity workspace and persistent `agent:language-tutor:main` seat session. The benchmark is specialist-scoped memory/activation discipline, not a guaranteed separately registered OpenClaw agent runtime
- Apr 8 specialist-memory posture: do not add a Japin memory-extraction cron yet; prove the normal session-end/lesson-end memory loop first, and if automation is later needed, use a narrow specialist-specific post-lesson extractor rather than Marvin’s broad nightly extractor
- Apr 9-10 specialist-seat expansion posture: Johan (`sportsbet-advisor`) and Milou (`trading-advisor`) now match the specialist-seat pattern rather than Marvin-routed specialist theater. In the current setup they use persistent seat sessions plus specialist-scoped continuity files; do not assume separately registered agent ids unless `openclaw agents list` proves it
- Apr 10 Vantage posture: Vantage is confirmed as a truthful internal content/SEO lead seat, not a fake direct-runtime specialist. Keep Vantage in the lead-route lane, with specialist child seats underneath rather than standalone-runtime framing
- Apr 11 Link specialist posture: Link (`job-advisor`) follows the same specialist-seat pattern as Japin/Johan/Milou, with `agent:job-advisor:main`, a dedicated `agent-workspaces/job-advisor/` continuity workspace, a custom `job-advisor` skill, and `humanizer` as a finishing-pass companion. In the current setup this is a persistent seat session under the main runtime, not proof of a separately registered OpenClaw agent id
- Apr 12 seat-bridge posture: Marvin now has a real Mission Control seat bridge. Current truthful routing is:
  - Sudo → existing Mission Control orchestration backend
  - Vantage → persistent lead session under main runtime (`agent:main:content-seo-team-lead`)
  - Japin / Johan / Milou / Link → persistent specialist seat sessions under the main runtime with seat-specific activation + continuity injection
  - current config truth: `openclaw agents list` exposes only `main`, so do not call specialist seat slugs as standalone `openclaw agent --agent ...` targets unless the runtime config changes later
- Apr 11 Tasks authority posture: Mission Control’s structured Tasks board is the source of truth; `AUTONOMOUS.md` is the mirror/reconciliation surface. Generated tasks must land in the structured store, and manual board deletes should remain suppressed instead of being silently re-imported from legacy markdown
- Apr 11 Home posture update: the Home page now pairs two equal-width scrollable readers — `Market Watch` (local RSS market/news headlines) and `Custom News` (English Dutch-news briefings). `Current Tracks` is gone. `Custom News` is fed by a runner-backed digest using FD, NRC, and IEX, capped to the last 24 hours and 30 published briefings
- Apr 8 Home posture: the accepted Mission Control Home page is now an editorial front door, not a widget dashboard — large serif greeting, compact weather/quote card, fixed bottom VPS/status strip, restored sidebar date, and explicitly no Daily Pulse / no quick-access grid / no dashboard-card mosaic. Under the hero, the current accepted lane is paired news readers rather than a dashboard-card stack
- Durable execution-verification lesson (Apr 4): task `in-progress` status alone is not sufficient evidence of a live run; healthy autonomous execution requires at least one concrete runtime signal (session log creation, session-registry entry, transcript growth, or model usage); without these, Mission Control should fail fast with a diagnostic
- Durable research-query lesson (Apr 4): imperative task titles like "Do online research to..." produce poor search queries; search queries should be derived from topic + brief questions, not from task wording
- Apr 6 Dev Team posture: Mission Control Chat now has a real seat selector (`Marvin` / `Sudo` / `Vantage`), and the Dev Team path is no longer just seat-flavored prompt theater. Current truthful architecture is:
  - Marvin = supervision / escalation / review boundary
  - Sudo = dev-team lead route
  - FE / BE / QA = delegated execution lanes
- Apr 6 Sudo workflow posture: the full Phase 3 stack exists:
  - 3A = bounded Sudo decision layer (`direct_answer`, `ask_question`, `propose_alternative`, `delegate`)
  - 3B = stronger sequencing, execution-plan structure, and final synthesis
  - 3C = Marvin oversight / escalation / approval boundary
- Apr 6 runtime lesson: for synthetic/autonomous Mission Control runs, model choice should be part of session/run setup, not a slash-command chat afterthought; brittle `/model ...` acknowledgements can create false blockers even when the intended model is conceptually correct
- Apr 6 parsing lesson: when orchestration output is wrapped by CLI/runtime envelopes, do not trust first-object JSON extraction; prefer schema-aware candidate ranking so the decision parser selects the real task payload rather than the outer wrapper
- Apr 6 product milestone: Sudo successfully completed the first real end-to-end Dev Team implementation run on the Mission Control sidebar redesign (`abbfb1b7`), proving the lead-and-lanes workflow is viable beyond UI theatrics
- Apr 6 Chat cleanup posture: after the first Sudo success, a restraint-focused cleanup pass made the Sudo Chat surface clean enough for now; future reopenings should prefer operational cleanup and history handling over broad redesign
- Apr 6 legacy-path posture: `projects/_ops/agent-team/` is now best treated as legacy workflow reference / prompt assets, not a live runnable package; useful pieces may be ported, but the Dev Team / Sudo path is the active internal multi-lane execution model
