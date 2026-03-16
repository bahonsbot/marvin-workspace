# TOOLS.md - Local Ops Notes

Environment-specific runtime notes only.
Use this file for live setup facts, not historical logs or long retrospectives.

---

## Core Setup

### GitHub
- Account: `bahonsbot`
- Repo: `https://github.com/bahonsbot/marvin-workspace`
- CLI: `gh` authenticated

### QMD (Semantic Memory Search)
- Backend: `qmd 1.0.8`
- Quick commands:
  - `qmd search "query" -c life -n 3`
  - `qmd index <file>`
  - `qmd stats`
- Categories: `life` (default), `projects`, `people`, `companies`
- QMD usage rules:
  - Use qmd for cross-memory entity/fact lookup
  - Read daily notes directly for chronological context
  - Pick a specific category when scope is project/person/company focused

### Telegram
- Bot: `@bahons_bot`
- Direct chat: paired and working
- Groups:
  - nightly-security-review: `-1003855426803`
  - platform-health-council: `-1003504843228`
  - self-improvement: `-1003721620909`
  - proactive-execution: `-1003742262384`
  - market-signals: `-1003850594375`
  - autonomous-trading-bot: `-1003711398278`
  - goal-tasks: `-1003704803669`

### Infrastructure
- Host: Hostinger VPS (`Linux 6.8.0-101-generic`)
- Runtime: Docker (OpenClaw)
- Workspace: `/data/.openclaw/workspace`
- Primary operator user: `node`

### Cron Jobs (Active)
| Job | Time (GMT+7) | Purpose | Delivery |
|-----|------------|---------|----------|
| platform-health-council | 03:00 daily | Daily system audit | none |
| nightly-security-review | 03:30 daily | Security analysis | none |
| self-improvement | 04:00 daily *(05:00 server GMT+8)* | Core files review | none |
| weekly-test-suite | Sun 02:15 | Weekly regression tests (trading bots) | none (alert only on fail) |
| rss-feed-monitor | :10 hourly | RSS news scanning | none |
| reddit-monitor | :40 hourly | Reddit sentiment scanning | none |
| market-signal-generator | :45 hourly | Signal generation (+ reasoning engine trigger) | none |
| auto-signal-dispatcher | every 15 min | Dispatch STRONG BUY signals to equity bot | none |
| signal-accuracy-review | 22:00 daily | Review pending signal outcomes | none |
| pre-market-brief | 20:00 daily | Evening market prep brief | none |
| trading-daily-report | 08:00 daily | Equity bot daily report | none (explicit send in task) |
| daily-task-generator | 08:00 daily | Goal-driven autonomous task generation (4-5 tasks) | telegram (`goal-tasks`) |
| autonomous-task-executor | 09:00 daily | Proactive workspace-lane execution from Open Backlog; gate-enforced via `scripts/autonomy_gate.py workspace`; missing-prerequisite tasks move to `Needs Input` | telegram (`goal-tasks`) on verified completion or focused input request |
| autonomous-queue-wakeup | 10:15 / 14:15 / 18:15 daily | Main-session wakeup to process one queued autonomous task, max concurrency 1, with stale `spawned` self-heal; gate-enforced via `scripts/autonomy_gate.py queue` | telegram (`goal-tasks`) start + completion |
| workspace-home-improvement | 11:30 daily | Main-session workspace-lane maintenance pass for one bounded low-risk internal improvement; gate-enforced via `scripts/autonomy_gate.py improve` | none by default; report later in Morning Meeting |
| enrichment-ab-review | Mon 10:00 | Weekly enrichment A/B review | none |
| nightly-memory-extraction | 01:00 daily | Durable memory extraction | none |
| entity-lifecycle-manager | Sun 05:00 weekly | Demote old life/ entities to archive | none |
| data-manager | Sun 05:00 weekly | JSONL/log rotation (>30 days) | none |
| dependency-update-audit | Mon 10:30 weekly | Check for outdated dependencies | none |
| skill-level-check | Sun 07:00 weekly | Hybrid skill assessment (test + challenge mode) | none |
| news-feed-generator | DISABLED | Superseded by RSS/Reddit monitor pipeline | none |

**Cron Context-Sharing Pipeline (Market Intel):**
- `rss-feed-monitor` writes RSS context
- `reddit-monitor` enriches with Reddit findings and correlations
- `market-signal-generator` reads combined context and generates signals
- `reasoning-engine` runs after signal generation

- **Context file:** `memory/cron-context.json` (rolling state, script-managed updates)
- **Rule:** Do not manually edit context in cron prompts; Python `CronContext` is source of truth

### Built-in OpenClaw Skills
- coding-agent — Delegates to Codex/Claude Code/Pi for coding tasks

### Workspace-Installed Skills (via clawhub)
- humanizer
- stock-market-pro
- marketing-skills
- us-stock-analysis
- openclaw-agent-optimize
- my-skills
- google_maps_pro
- security-review
- creative-prompts

### Models (Operational Routing)
- Primary provider: Bailian
- Default lightweight delegation: `bailian/MiniMax-M2.5`
- Higher-reasoning delegation: `bailian/qwen3.5-plus`
- Optional comparison models: `glm-5`, `kimi-k2.5`
- Coding-heavy fallback: `openai-codex/gpt-5.3-codex`
  - **Note:** We use both Codex versions intentionally:
    - `codex5.4` (gpt-5.4): Marvin orchestration, high-reasoning tasks
    - `codex` (gpt-5.3-codex): Coding-specific work

### Hybrid Agent-Team v1
- **Architecture:** Marvin (orchestrator) → Builder → Reviewer
- **Model mapping:**
  - Marvin → codex5.4
  - Builder → codex
  - Reviewer → qwenplus
- **Use for:** Implementation-heavy, high-value, clearly scoped tasks
- **Reference:** `projects/_ops/agent-team/` package

### Image Analysis
- Bailian models: analyze attachments, limited at fetching external image URLs
- URL-image workaround: fetch/download first, then analyze as attachment
- Use Codex when URL-based image fetch is required

### Codex CLI Setup (Fallback Model)

- **Separate OAuth:** Codex CLI requires its own OAuth login, independent of OpenClaw's OAuth
  - Login command: `codex login --device-auth` (device code flow works best)
  - Tokens stored in `~/.codex/` — both Codex CLI and OpenClaw OAuth needed
- **Important distinction:** Codex CLI auth is separate from the main OpenClaw dashboard/orchestrator runtime, which resolves its Codex identity from `/data/.openclaw/agents/main/agent/auth-profiles.json` via `openai-codex:default`
- **Runtime note (Mar 14):** earlier dual-home Codex CLI wrapper experiment was removed during cleanup after the working OpenClaw-side manual switch method was established. Do not assume `/data/codex-work-home` or `/data/codex-personal-home` still exist.
- **Git repo required:** Codex refuses to run outside a git repository
  - For scratch work: `mktemp -d && git init` before running Codex
- **Coding agent skill:** Built-in OpenClaw skill `coding-agent` delegates to Codex/Claude Code/Pi
  - Usage: `pty:true workdir:~/project background:true command:"codex exec --full-auto 'prompt'"`
  - Always use `pty:true` — coding agents need a pseudo-terminal

### Skill Profile
- `config/skill-profile.json` — Stores Philippe's current skill levels (novice/beginner/intermediate) and constraints
- Used by `daily-task-generator.py` to ensure generated tasks match skill level
- Edit this file to update skill progression

### Hybrid Skill Assessment Framework
- `scripts/skill-level-check.py` — Weekly skill assessment with two modes:
  - **Test mode** (Python, Japanese): Objective checks with scoring rubric
  - **Challenge mode** (Blender, After Effects, Unreal): Challenge briefs with heuristic evaluation
- Outputs reports to `memory/skill-assessments/YYYY-MM-DD-<skill>.md`
- Maintains summary in `memory/skill-assessments/latest.json`
- Includes recommendation: `keep-level` or `ready-for-trial-next-level`
- Set `TASK_ASSESSMENT_BIAS=true` env var to enable assessment-biased task generation

### Scripts
- `scripts/ralphy.sh` — Autonomous coding agent (reads PRD, iterates on code)
- `scripts/ralphy-notify.sh` — Telegram notifications for ralphy
- `scripts/audit-log.sh` — Security action logging (text + JSONL)
- `scripts/audit-sensitive-snapshot.sh` — Low-noise sensitive-file change detector (baseline + drift logging)
- `scripts/check-token-age.sh` — Token expiration checker
- `scripts/nightly-memory-extraction.sh` — Memory extraction cron
- `scripts/daily-task-generator.py` — Daily autonomous task generation (08:00 ICT, 4-5 goal-aligned tasks)
  - Guardrails: no default case studies, no fake creative-output MVPs, social/content tasks require concrete source work, useful surprise MVPs allowed for tool/system/project-improvement lanes
- `scripts/queue_state.py` — Queue helper for autonomous-task orchestration
  - Usage:
    - `python scripts/queue_state.py status` — show queue state
    - `python scripts/queue_state.py can-start` — exit 0 = can start, exit 1 = blocked
    - `python scripts/queue_state.py heal-stale` — mark stale spawned tasks as blocked
  - **Note:** `autonomous-subagent-runner` cron is disabled. Active queue processing now happens via `autonomous-queue-wakeup` (main-session wakeup path) and `autonomous-task-executor`.
- `scripts/autonomy_gate.py` — Cron preflight gate for proactive autonomy
  - Usage:
    - `python scripts/autonomy_gate.py workspace` — allow/skip the daily workspace-lane backlog executor
    - `python scripts/autonomy_gate.py queue` — allow/skip queued delegated work wakeups
    - `python scripts/autonomy_gate.py improve` — allow/skip the daily workspace home-improvement pass
  - Returns JSON with `decision: run|skip` and a reason; also self-heals stale queue slots in `queue` mode
- `scripts/add-task-suggestion.py` — Add a Philippe suggestion and place it at the top of Open Backlog
- `switch_model.sh` / `switch_model_auto.sh` — Model switching
- `projects/_ops/agent-team/` — Hybrid v1 reusable internal workflow package
  - Operator entry: `START-HERE.md`
  - Map/checklist: `package-map.md`, `operator-checklist.md`
  - Core roles/prompts/contracts: `builder.md`, `reviewer.md`, `handoff-contracts.md`, `delegation-rules.md`, live prompt files
  - Routing/support: `launch-path-spec.md`, `delegation-helper.sh`, `live-usage.md`, `example-handoffs.md`, `reusable-workflow-package.md`
  - Trial artifacts:
    - `projects/_ops/scripts/autonomous-status.py` — local autonomous workflow status utility
    - `projects/_ops/agent-team/launch-path-spec.md` — preferred/fallback specialist launch-path spec
    - `projects/_ops/agent-team/delegation-helper.sh` — quick reference for hybrid delegation routing
- `skills/google_maps_pro/scripts/get_tour_plan.py` — Route matrix helper

### Active Projects
- `AUTONOMOUS.md` — Goal-driven daily task planner (Open Backlog + In Progress)
- `projects/market-intel/` — signal generation + reasoning pipeline (active)
  - **Execution-candidates pipeline (Mar 13):**
    - Producer: `projects/market-intel/src/execution_candidates.py`
    - Artifact: `projects/market-intel/data/execution_candidates.json`
    - Purpose: execution-facing handoff layer between Market Intel signals and the equity bot
- `projects/autonomous-trading-bot/` — Alpaca paper equity bot (active)
  - Consumer bridge: `projects/autonomous-trading-bot/src/execution_candidates_adapter.py`
  - Runtime flag: `EXECUTION_CANDIDATES_ENABLED=true`
  - Current clean-sheet epoch: `candidate-clean-sheet-2026-03-13`
- `projects/futures-bot/` — futures bot (Phase 1 complete, implementation in progress)
- `projects/manual-trading-brief/` — pre-market brief generator (cron at 20:00 MYT)
- `projects/autonomous-kanban/` — Goal-driven task Kanban UI (active)
  - GitHub Pages: `https://bahonsbot.github.io/marvin-workspace/autonomous-kanban/`
  - Deploy flow: `.github/workflows/pages.yml` (build + publish on push)
- `projects/creative-challenges/` — Daily creative challenge generator (active)
  - GitHub Pages: `https://bahonsbot.github.io/marvin-workspace/creative-challenges/`
  - Deploy flow: `.github/workflows/pages.yml` (copied into combined Pages artifact on push)

### Retired Projects (Cryo)
- `projects-cryo/horizons-pms/` — PMS system (on hold, archived for reference)
- `projects-cryo/market-intel-news-reader/` — PWA news reader prototype (archived)

### Trading Bot Troubleshooting

**Common Crash Causes:**
1. **WEBHOOK_HOST binding:** Receiver refuses `0.0.0.0` (security feature). Use `127.0.0.1` or `localhost`.
   - Fix: `WEBHOOK_HOST=127.0.0.1` in `.env`
2. **Unquoted env vars with spaces:** `AUTO_MIN_CONFIDENCE=STRONG BUY` breaks parsing
   - Fix: Quote values: `AUTO_MIN_CONFIDENCE="STRONG BUY"`
3. **Port already in use:** Another process bound to 8000
   - Fix: `lsof -i :8000` to find culprit, or change `WEBHOOK_PORT`
4. **MiniMax input token limit:** Bailian `MiniMax-M2.5` accepts up to ~196,608 input tokens.
   - Symptom: HTTP 400 with message like `Range of input length should be [1, 196608]`
   - Fix: Use `bailian/qwen3.5-plus` for high-context or reasoning-heavy prompts

**Watchdog Script:**
- Location: `projects/autonomous-trading-bot/scripts/webhook_watchdog.sh`
- Behavior: 60s sleep loop, restarts receiver if down (no cron dependency)
- Logs: `projects/autonomous-trading-bot/logs/webhook_watchdog.out.log`
- **Runtime note (Mar 13 evening):** watchdog was temporarily down during receiver recovery and was restarted later that night. Verify live process state if troubleshooting automatic recovery.

**Health Check Endpoints:**
- Basic health: `http://127.0.0.1:8000/health`
- Auth validation: `http://127.0.0.1:8000/health/auth` (validates the current HMAC-based auth scheme)
- Manual test: `curl http://127.0.0.1:8000/health/auth`
- **Auth validation flow (Mar 13 patch):** `/health/auth` now internally generates timestamp + HMAC signature using the bot's configured secret, then validates against the same auth logic as the webhook receiver. Use this to verify auth config without sending an external webhook.
- **Runtime note (Mar 13 late night):** after the clean-sheet reset, `auto_signal_dispatch.json` was archived and rotated; current dispatch epoch starts from `candidate-clean-sheet-2026-03-13`.

**Quick Recovery:**
```bash
cd /data/.openclaw/workspace/projects/autonomous-trading-bot
pkill -f webhook_receiver.py  # Stop any zombie processes
bash scripts/run_webhook_receiver.sh  # Restart with proper env
```

### Model Learning References
- Canonical evidence-pack schema: `projects/market-intel/docs/evidence-pack-schema.md`
- Feedback store: `projects/market-intel/data/model_feedback.json`
- Accuracy tracker: `projects/market-intel/src/accuracy_tracker.py`

### Deeper References
- Project strategy and history: `MEMORY.md` + `memory/YYYY-MM-DD.md`
- Market Intel notes: `projects/market-intel/notes/`

### Environment
- System runtime: `Asia/Kuala_Lumpur (GMT+8)` (VPS server time)
- User-facing display: `Asia/Ho_Chi_Minh (GMT+7)` ( Philippe's timezone)
- **Rule:** Always display times in `Asia/Ho_Chi_Minh` unless explicitly requested otherwise

---

Keep this file operational and current. Move history/retrospectives to MEMORY or project docs.
