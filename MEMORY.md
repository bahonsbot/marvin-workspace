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
- Status: on hold
- Core: PRD and schema foundation prepared
- Key refs:
  - `projects/horizons-pms/PRD.md`
  - `projects/horizons-pms/db/`
  - `projects/horizons-pms/sql/`

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
