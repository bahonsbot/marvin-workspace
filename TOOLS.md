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
| enrichment-ab-review | Mon 10:00 | Weekly enrichment A/B review | none |
| nightly-memory-extraction | 23:00 daily | Durable memory extraction | none |
| data-manager | Sun 05:00 | Prune old data/logs | none |
| news-feed-generator | DISABLED | Superseded by RSS/Reddit monitor pipeline | none |

**Cron Context-Sharing Pipeline (Market Intel):**
- `rss-feed-monitor` writes RSS context
- `reddit-monitor` enriches with Reddit findings and correlations
- `market-signal-generator` reads combined context and generates signals
- `reasoning-engine` runs after signal generation

- **Context file:** `memory/cron-context.json` (rolling state, script-managed updates)
- **Rule:** Do not manually edit context in cron prompts; Python `CronContext` is source of truth

### Installed Skills (Workspace)
- humanizer
- stock-market-pro
- marketing-skills
- us-stock-analysis
- openclaw-agent-optimize
- my-skills
- google_maps_pro
- security-review
- creative-prompts
- coding-agent (built-in OpenClaw skill)

### Models (Operational Routing)
- Primary provider: Bailian
- Default lightweight delegation: `bailian/MiniMax-M2.5`
- Higher-reasoning delegation: `bailian/qwen3.5-plus`
- Optional comparison models: `glm-5`, `kimi-k2.5`
- Coding-heavy fallback: `openai-codex/gpt-5.3-codex`

### Image Analysis
- Bailian models: analyze attachments, limited at fetching external image URLs
- URL-image workaround: fetch/download first, then analyze as attachment
- Use Codex when URL-based image fetch is required

### Codex CLI Setup (Fallback Model)

- **Separate OAuth:** Codex CLI requires its own OAuth login, independent of OpenClaw's OAuth
  - Login command: `codex login --device-auth` (device code flow works best)
  - Tokens stored in `~/.codex/` — both Codex CLI and OpenClaw OAuth needed
- **Git repo required:** Codex refuses to run outside a git repository
  - For scratch work: `mktemp -d && git init` before running Codex
- **Coding agent skill:** Built-in OpenClaw skill `coding-agent` delegates to Codex/Claude Code/Pi
  - Usage: `pty:true workdir:~/project background:true command:"codex exec --full-auto 'prompt'"`
  - Always use `pty:true` — coding agents need a pseudo-terminal

### Scripts
- `scripts/ralphy.sh` — Autonomous coding agent (reads PRD, iterates on code)
- `scripts/ralphy-notify.sh` — Telegram notifications for ralphy
- `scripts/audit-log.sh` — Security action logging
- `scripts/check-token-age.sh` — Token expiration checker
- `scripts/nightly-memory-extraction.sh` — Memory extraction cron
- `scripts/daily-task-generator.py` — Daily autonomous task generation (08:00 ICT, 4-5 goal-aligned tasks)
- `switch_model.sh` / `switch_model_auto.sh` — Model switching
- `skills/google_maps_pro/scripts/get_tour_plan.py` — Route matrix helper

### Active Projects
- `projects/horizons-pms/` — PMS system (currently on hold)
- `projects/market-intel/` — signal generation + reasoning pipeline (active)
- `projects/autonomous-trading-bot/` — Alpaca paper equity bot (active)
- `projects/market-intel-news-reader/` — PWA news reader (active)
- `projects/autonomous-kanban/` — Goal-driven task Kanban UI (active)
  - GitHub Pages: `https://bahonsbot.github.io/marvin-workspace/autonomous-kanban/`
- `projects/futures-bot/` — futures bot (Phase 1 complete, implementation in progress)

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

**Health Check Endpoints:**
- Basic health: `http://127.0.0.1:8000/health`
- Auth validation: `http://127.0.0.1:8000/health/auth` (validates shared secret)
- Manual test: `curl http://127.0.0.1:8000/health/auth`

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
- Display timezone: `Asia/Ho_Chi_Minh (GMT+7)`
- Server timezone: `Asia/Kuala_Lumpur (GMT+8)`
- Rule: schedule and present times in `Asia/Ho_Chi_Minh` unless explicitly requested otherwise

---

Keep this file operational and current. Move history/retrospectives to MEMORY or project docs.
