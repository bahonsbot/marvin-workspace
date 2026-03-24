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
- UX and usefulness come before polish, but the intended visual target is calm premium dark operator desktop, with restrained Apple-lab energy
- Home may include ambient orientation elements like time/weather/quote if they do not weaken the core operational layout
- Chat/Orchestrator should stay honest about runtime/auth boundaries and should not fake a production-ready embedded chat path
- Current product calibration:
  - promising and on the right track
  - not yet premium enough
  - `Sessions` is the strongest current module
  - `Tasks` still needs the strongest kanban-first discipline
- Current roadmap truth:
  1. Memory
  2. Files
  3. Search
  4. basic Settings / Status
  5. finish Chat live/embed path
  6. deepen Logs / Activity / Agents / Cron
  7. domain modules
  8. final Home refinement
- Search split decision:
  - Memory = memory browsing/search
  - Files = non-memory browsing/preview and later file search
  - standalone Search page is transitional and should disappear once file search is embedded in Files
- Additional feature direction: thin bottom status strip with real machine/runtime metrics
- Market Intel/trading direction now has a durable 3-layer shape:
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
- Market Context should use honest delayed/snapshot data from free/open-access sources where viable; no fake realtime, no decorative placeholder market feeds

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
