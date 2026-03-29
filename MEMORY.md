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
- Higher-reasoning delegation: `bailian/qwen3.5-plus`
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

## Durable Preferences & Decision Rules

### Operational Lessons
- Preview-bind rule: do not casually switch preview server bind from `0.0.0.0` to `127.0.0.1` when external preview path matters; local-only bind breaks reverse-proxy access (502 Bad Gateway)
- Mission Control auth baseline: non-local Mission Control access should be auth-gated. Current hardening uses Next.js middleware Basic Auth over pages and `/api/*`, with localhost/container bypass only for local verification. Preview runtime should load auth creds from `.preview-runtime/mission-control-preview.env` when persistent auth is desired.
- Overnight review delivery rule: for scheduled overnight review jobs, operator-facing delivery must come from exactly one canonical parent-run summary. Avoid subagent/resume chatter that can leak non-canonical timeout or recovery narratives into Telegram.

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
  - Reviewer → `qwenplus`

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
  - Tasks is now good enough for now as a three-board workspace (Personal / Projects / Autonomous) with manual-board drag-and-drop, add/edit/delete, and lighter FLOATING refinement
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
