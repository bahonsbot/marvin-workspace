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
- `switch_model.sh` / `switch_model_auto.sh` — Model switching
- `skills/google_maps_pro/scripts/get_tour_plan.py` — Route matrix helper

### Active Projects
- `projects/horizons-pms/` — PMS system for hotel front-desk (PRD in progress)
- `projects/market-intel/` — Stock market analysis and research (Phase 1-3 complete)
- `projects/autonomous-trading-bot/` — Autonomous **equity** trading via Alpaca (paper trading live since Mar 1, 2026)
  - **Nickname:** "equity-bot" (for distinction from futures-bot)
  - **Directory:** `autonomous-trading-bot` (don't rename — breaks cron paths)
  - **Webhook endpoint:** `https://tradehook.motiondisplay.cloud/webhook` (public HTTPS, nginx + Certbot)
  - **Symbol mapper:** 50+ sector ETFs, 60+ company tickers, 30+ macro ETFs (no blind AAPL trades)
  - **Auto-dispatch:** STRONG BUY gating, min confidence threshold, market-hours gate, duplicate suppression
  - **FAST regime:** Dynamic activation under high/critical context stress (lower threshold, bounded qty multiplier)
  - **Watchdog:** Lightweight restart script (60s sleep loop, no cron)
  - **Risk controls:** Idempotency locking, payload size limits (1MB), rate limiting, secret redaction
- `projects/market-intel-news-reader/` — PWA news reader app for iPhone (PRD in progress)
- `projects/futures-bot/` — Futures trading bot (PRD created Mar 4, scheduled for implementation)
  - **Broker:** IBKR (application submitted Mar 2026, pending approval 1-3 business days)
  - **Paper trading:** Free with IBKR (vs Tradovate $25/month)
  - **Phase 1 status:** Complete — 1,349 LOC, 14/14 tests passed, dry-run validated

### Trading Bot Troubleshooting

**Common Crash Causes:**
1. **WEBHOOK_HOST binding:** Receiver refuses `0.0.0.0` (security feature). Use `127.0.0.1` or `localhost`.
   - Fix: `WEBHOOK_HOST=127.0.0.1` in `.env`
2. **Unquoted env vars with spaces:** `AUTO_MIN_CONFIDENCE=STRONG BUY` breaks parsing
   - Fix: Quote values: `AUTO_MIN_CONFIDENCE="STRONG BUY"`
3. **Port already in use:** Another process bound to 8000
   - Fix: `lsof -i :8000` to find culprit, or change `WEBHOOK_PORT`

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

### Model Learning & Evidence-Pack Workflow

**Purpose:** Improve signal reasoning by learning from historical outcomes. When signals are verified (correct/partial/incorrect), the evidence pack provides context for model fine-tuning.

**File Locations:**
- `projects/market-intel/data/model_feedback.json` — Central feedback tracker
- `projects/market-intel/data/enhanced_signals.json` — Signals with reasoning scores
- `projects/autonomous-trading-bot/data/tracked_signals.json` — Executed trades linked to signals
- `projects/futures-bot/data/` — Futures-specific signal tracking (Phase 2+)

**Evidence Pack Schema:**
```json
{
  "signal_id": "mi-042",
  "timestamp": "2026-03-06T14:30:00Z",
  "title": "Fed signals rate cut pause",
  "category": "financial",
  "confidence_level": "STRONG BUY",
  "reasoning_score": 87,
  "evidence_pack": {
    "summary": "Fed Chair Powell hints at pausing rate cuts amid inflation concerns",
    "drivers": ["inflation uptick", "employment strong", "Fed commentary"],
    "metrics": {"cpi_mo": 0.4, "unemployment": 3.7, "fed_funds": "4.75-5.0%"},
    "sector_impact": ["financials", "real_estate", "utilities"],
    "confidence": 0.85
  },
  "outcome": "correct|partial|incorrect",
  "outcome_date": "2026-03-07",
  "outcome_notes": "Market moved as predicted, SPY +1.2%"
}
```

**Accuracy Tracker Commands:**
```bash
# Review pending signals (interactive)
cd /data/.openclaw/workspace/projects/market-intel
python3 src/accuracy_tracker.py --review

# Evaluate a specific signal
python3 src/accuracy_tracker.py --eval 42 correct
python3 src/accuracy_tracker.py --eval 43 partial
python3 src/accuracy_tracker.py --eval 44 incorrect

# Generate accuracy report
python3 src/accuracy_tracker.py --report
```

**Feedback Loop:**
1. Signal generated with reasoning score (0-100)
2. Trade executed (if STRONG BUY + passes risk checks)
3. Outcome verified after 24-48 hours (manual review via `--review`)
4. Evidence pack saved to `model_feedback.json`
5. Reasoning engine uses feedback to adjust future scoring weights
6. Cron job `signal-accuracy-review` runs daily at 22:00 ICT

**Cross-Project Integration:**
- **Market Intel:** Generates signals, tracks accuracy
- **Equity Bot:** Executes signals, logs trade outcomes
- **Futures Bot:** Will follow same pattern (Phase 2 implementation)
- **Shared Learning:** All three projects contribute to `model_feedback.json`

### Environment
- **Timezone:** Asia/Ho_Chi_Minh (GMT+7)
- **Note:** VPS runs on Asia/Kuala_Lumpur (GMT+8) — always specify Asia/Ho_Chi_Minh for cron jobs and display
- **User:** Philippe (Netherlands → Vietnam since Sep 2024)
- **Partner:** Girlfriend in Vietnam

---

Add whatever helps you do your job. This is your cheat sheet.
