# MEMORY.md - Curated Long-Term Memory

## Assistant Baseline
- Name: Marvin
- Role: Assistant Director at Motion Display
- Voice: direct, warm, dry wit, high-accountability
- Working principle: prioritize verified outcomes over quick patches

## Philippe Baseline
- Name: Philippe
- Timezone: Asia/Ho_Chi_Minh (GMT+7)
- Operating preference: decisive recommendations, fast implementation loops
- Context: creative + technical career exploration, active trading interest

## Runtime Baseline
- Workspace: `/data/.openclaw/workspace`
- Environment: Hostinger VPS, Docker runtime
- Memory system:
  - `MEMORY.md` (curated long-term)
  - `memory/YYYY-MM-DD.md` (daily timeline)
  - `life/` knowledge graph (entity memory)
- Semantic retrieval: `qmd` is the memory search layer across daily notes + MEMORY + life graph

## Model Baseline
- Primary provider: Bailian
- Lightweight delegation: `bailian/MiniMax-M2.5`
- Higher-reasoning delegation: `bailian/qwen3.5-plus`
- Coding/deep technical fallback: `openai-codex/gpt-5.3-codex`
- **Note:** We use both Codex versions intentionally:
  - `codex5.4` (gpt-5.4): Marvin orchestration, high-reasoning tasks
  - `codex` (gpt-5.3-codex): Coding-specific work
- Fallback protocol: if a model errors repeatedly, switch once to Codex and proceed

## Preferences & Decision Rules

### Execution Style
- Prefer decisive recommendations over open-ended option dumps.
- For non-trivial changes: propose plan first, then execute after approval.
- Prioritize verified fixes over temporary patches.

### Research Standard
- Before proposing non-trivial solutions, verify:
  1) technical fit,
  2) policy/safety compatibility,
  3) no breakage risk to active processes.
- If uncertain, run a bounded validation before recommending rollout.
- If scope is ambiguous, ask clarifying questions first to avoid overengineering.

### Delegation
- Delegate when it improves speed, depth, or reliability.
- Keep direct execution for quick, low-risk, single-step work.
- Coding/debugging defaults to Codex unless scope is trivial.
- Preferred small-team model mapping:
  - Marvin/orchestrator → `codex5.4`
  - Builder → `codex`
  - Reviewer → `qwenplus`
- Preferred explanation style: clear, honest, and structured.
- Preferred agent-team implementation style: hybrid v1 = Marvin holds memory/continuity, Builder and Reviewer use stable shared role templates in delegated task-scoped sessions.

### Communication
- Start with the answer.
- Keep updates concise, specific, and outcome-first.
- For external/public actions, get explicit approval first.

### Risk Handling
- Accepted-risk items stay suppressed unless state changes.
- Re-open accepted risks only on measurable drift (permissions, tracking exposure, new leak evidence).

### Reliability Habits
- Document lessons after incidents/fixes.
- Keep operational docs aligned with real runtime behavior.
- Treat repeated report noise as a process bug to fix, not to ignore.

### Telegram
- Bot: Configured and working
- Paired for direct command delivery
- **Group allowlist:** New Telegram groups need to be added manually to `channels.telegram.groups` in openclaw.json
- **Adding new groups:** When Philippe adds the bot to a new group, the bot won't see messages until:
  1. Group Privacy is turned OFF in BotFather (done once)
  2. Group ID is added to allowlist (manual step)
- **Future improvement:** Could implement `/allow` command to auto-add current group, but manual add works fine for now
- **Market signals group:** -1003850594375 (created Feb 28)

## Project Snapshot (Current)

### Market Intel
- Status: active
- Core: RSS/Reddit ingestion, signal generation, reasoning, accuracy tracking
- Key refs:
  - `projects/market-intel/PRD.md`
  - `projects/market-intel/docs/evidence-pack-schema.md`
  - `projects/market-intel/notes/`

### Autonomous Trading Bot (Equity)
- Status: active (paper trading)
- Core: webhook receiver, risk controls, auto-dispatch, watchdog
- Key refs:
  - `projects/autonomous-trading-bot/README.md`
  - `projects/autonomous-trading-bot/TASKS.md`
  - `projects/autonomous-trading-bot/logs/`

### Futures Bot
- Status: Phase 1 complete, implementation progressing
- Core: webhook + risk/execution foundation
- Key refs:
  - `projects/futures-bot/PRD.md`
  - `projects/futures-bot/tests/`
  - `projects/futures-bot/src/`

### Horizons PMS
- Status: retired (cryo)
- Core: PRD and schema foundation prepared
- Key refs:
  - `projects-cryo/horizons-pms/PRD.md`
  - `projects-cryo/horizons-pms/db/`
  - `projects-cryo/horizons-pms/sql/`

### Market Intel News Reader
- Status: retired (cryo)
- Core: PWA news reader prototype
- Key refs:
  - `projects-cryo/market-intel-news-reader/`

## Reference Index (When You Need Detail)
- Daily timeline and decisions: `memory/YYYY-MM-DD.md`
- Security reports and findings: `memory/security/`
- Health council reports: `memory/health-council/`
- Self-improvement reports: `memory/self-improvement/`
- Cron definitions/runtime state: `/data/.openclaw/cron/jobs.json`
- Project-specific implementation details: `projects/*/PRD.md`, `projects/*/docs/`, `projects/*/notes/`
- Change history and exact diffs: git log in `/data/.openclaw/workspace`

## Durable Outcomes (Historical Summary)
- Security hardening baseline established (auth, rate limits, replay protection, permission controls).
- Accepted-risk policy formalized: suppress repeat alerts unless measurable state changes.
- Morning Meeting protocol established and validated in live operations.
- Cron context-sharing stabilized with script-managed `CronContext` updates.
- Automated quality guardrail added: weekly regression test cron.
- Documentation architecture standardized and executed in full core-file cleanup (Mar 8 PM):
  - removed obsolete bootstrap templates (`BOOTSTRAP.md`, `BOOT.md`)
  - `AGENTS.md` = policy
  - `TOOLS.md` = operational runbook
  - `MEMORY.md` = curated durable memory
  - `memory/YYYY-MM-DD.md` = timeline/history
- Goal-Driven Autonomous Tasks workflow established (Mar 8) and upgraded (Mar 9 night):
  - canonical planner file: `AUTONOMOUS.md`
  - append-only completion log: `memory/tasks-log.md`
  - race-condition rule enforced: sub-agents append ✅ lines to tasks-log only, never edit `AUTONOMOUS.md`
  - daily generator cron at 08:00 ICT (`daily-task-generator`)
  - executor cron at 09:00 ICT (`autonomous-task-executor`) for bounded autonomous task execution
  - task format upgraded to: `Task | Why | Proof | Unlocks`
  - skill-aware gating added via `config/skill-profile.json` (Python + Japanese novice-aware)
  - hybrid weekly assessment added (`skill-level-check`, Sunday 07:00 ICT):
    - test mode: Python/Japanese
    - challenge mode: Blender/After Effects/Unreal
  - Kanban sync hardened:
    - static board fallback (`public/board.json`)
    - auto-sync + auto-publish after generation
    - GitHub Pages workflow deployment mode corrected
  - Kanban UI: `https://bahonsbot.github.io/marvin-workspace/autonomous-kanban/`
- Market Intel signal review marathon completed (Mar 9 late session):
  - pending queue reduced from 20 to 0 with evidence-rich one-by-one review
  - final tracker snapshot: Verified 20, Pending 0, weighted accuracy 82.5%
  - duplicate-cluster handling applied where appropriate
  - durable reasoning lesson: stagflation regime repeatedly invalidated expected treasury safety-bid in credit-stress signals
- Morning Meeting hardening batch completed (Mar 10):
  - accepted-risk decisions recorded for scanner-overclassified Telegram token path finding, manual-backup policy finding, and cron isolation posture
  - autonomous-trading-bot security upgrades applied:
    - broker-backed symbol validation before execution path
    - allowlist-based Alpaca error redaction (safe fields only)
    - robust cron env export for trading-daily-report (`set -a && . ./.env && set +a`)
    - health endpoint rate limiting added
    - idempotency lock file permission hardening (`0600`)
    - payload-based webhook secret auth removed (header-based auth only)
  - market-intel cron context hardening applied:
    - write permissions enforced (`cron-context.json` as `0600`)
    - schema validation on load with fail-safe reset for invalid/corrupt shapes
  - audit logging upgraded:
    - structured JSONL security log added (`logs/security-actions.jsonl`)
    - sensitive-file snapshot/drift detector added (`scripts/audit-sensitive-snapshot.sh`)
  - core docs updated to index `AUTONOMOUS.md` in AGENTS.md and TOOLS.md
- Self-improving workflow implemented (Mar 11 evening):
  - `.learnings/` directory with structured logging: corrections.md, errors.md, requests.md
  - Detection triggers added to AGENTS.md (corrections, errors, preferences, patterns)
  - Self-reflection prompts added (post-task evaluation format)
  - Pre-task memory check added (qmd search before non-trivial work)
  - Tiered lifecycle for life/ entities: `scripts/lifecycle_entities.py` (HOT 0-30d, WARM 30-90d, COLD 90+d)
  - Weekly cron added (Sun 5 AM) to demote/archive old entities
  - Memory extraction cron moved from 23:00 → 01:00 (avoid active sessions)
- Autonomous Kanban interpretation/quality hardening completed (Mar 12 afternoon):
  - delegation queue messaging clarified so queue-empty updates no longer imply the whole board is empty
  - goal wording tightened to prefer Philippe-owned practice over agent-made filler artifacts
  - case studies blocked by default unless explicitly requested
  - surprise MVPs restored only for useful tool/system/project-improvement lanes, not creative portfolio-faking output
  - Python explicitly treated as staged language learning (fundamentals → reading/comprehension → guided practice → practical scripts)
  - trading goals split into bot/system-improvement work versus staged business-analysis learning
  - prerequisite gate added: tasks missing key human input move to `Needs Input` instead of `In Progress`
  - `autonomous-task-executor` notification path moved to main-session messaging for deterministic Telegram `goal-tasks` prompts on `completed` and `needs_input`
  - social/content tasks now require concrete source work before generation
  - live Done column cleaned by archiving 3 goal-misaligned completions instead of counting them as valid progress
  - lightweight suggestion-box flow added: Philippe suggestions are stored and inserted at the top of backlog
- Hybrid agent-team v1 validated in live trials (Mar 12 evening):
  - architecture chosen: Marvin (orchestrator) + Builder + Reviewer
  - implementation style chosen: hybrid v1 with Marvin holding continuity and Builder/Reviewer using stable shared role templates in delegated task-scoped sessions
  - Trial 1 passed: Builder created `projects/_ops/scripts/autonomous-status.py`, Reviewer verified artifact reality and task fit
  - Trial 2 passed: Builder created `projects/_ops/agent-team/launch-path-spec.md` and `projects/_ops/agent-team/delegation-helper.sh`, Reviewer verified routing docs/helper and no risky config mutation
  - preferred role-model mapping documented: Marvin=`codex5.4`, Builder=`codex`, Reviewer=`qwenplus`
  - current environment limitation documented: delegated sessions may inherit fallback/default model behavior when explicit specialist routing is unavailable
- Autonomous Kanban execution path validated and hardened (Mar 13 afternoon):
  - fixed executor misrouting where generic `brief` matching sent a Blender practice brief into `projects/trading-briefs/`
  - added dedicated creative-practice routing for Blender/After Effects/Unreal practice-brief tasks
  - upgraded task scoring so Build/Fix tasks with explicit deliverable + proof and `agent_team` fit are selected ahead of lightweight Learn tasks
  - validated full agent-team chain on a real Kanban item: selector → queue → start announcement → Builder → Reviewer → completion
  - completed deliverable: `projects/creative-challenges/index.html` + `projects/creative-challenges/README.md`
  - public access path established via GitHub Pages: `https://bahonsbot.github.io/marvin-workspace/creative-challenges/`
  - Health Council timeout note for `autonomous-task-executor` downgraded to monitor-only after post-fix manual validation; reopen only if it recurs
- Market Intel execution-candidates M1 baseline established (Mar 13 late afternoon):
  - producer created at `projects/market-intel/src/execution_candidates.py`
  - artifact created at `projects/market-intel/data/execution_candidates.json`
  - producer test added at `projects/market-intel/tests/test_execution_candidates.py`
  - deterministic `signal_id` / `candidate_id`, explicit `instrument_candidates`, `primary_instrument`, and `dispatch_readiness` now exist as the first execution-facing handoff layer
  - two refinement passes hardened the baseline by blocking title/pattern family mismatches, broad roundup headlines, mixed-theme titles, FX-stress secondary mappings, and duplicate-looking material events
  - final M1 baseline judged good enough to build on: 32 candidates, 6 ready, with conservative blocking preferred over noisy false positives
  - durable sequencing remains: refine producer/interface first, then plan equity-bot consumer upgrade behind a safer rollout path
