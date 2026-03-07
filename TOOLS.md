# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

## Current Setup

### GitHub
- **Account:** bahonsbot
- **Repo:** https://github.com/bahonsbot/marvin-workspace (public)
- **CLI:** `gh` authenticated and working

### QMD (Semantic Memory Search)
- **Backend:** qmd 1.0.8 for semantic search across memory layers
- **Manual commands:**
  - `qmd search "query" -c life -n 3` — search knowledge graph
  - `qmd index <file>` — add file to index
  - `qmd stats` — show index statistics

**Usage Patterns:**
- **When to use qmd:** You need to find facts/entities across all memory (daily notes + MEMORY.md + life/ graph)
- **When to read daily notes directly:** You want chronological context or recent conversations
- **Category options:** `-c life` (default), `-c projects`, `-c people`, `-c companies`
- **Examples:**
  ```bash
  # Find all facts about autonomous-trading-bot
  qmd search "autonomous trading bot" -c life -n 5
  
  # Find people-related entities
  qmd search "Philippe girlfriend" -c people -n 3
  
  # Search project-specific memory
  qmd search "futures bot IBKR" -c projects -n 5
  
  # Find high-confidence signals
  qmd search "STRONG BUY signal" -n 10
  ```

### Telegram
- **Bot username:** @bahons_bot
- **Bot token:** (stored in config, not here)
- **Direct chats:** Paired and working
- **Groups:**
  - nightly-security-review (`-1003855426803`)
  - platform-health-council (`-1003504843228`)
  - self-improvement (`-1003721620909`)
  - proactive-execution (`-1003742262384`)
  - market-signals (`-1003850594375`)
  - autonomous-trading-bot (`-1003711398278`)

### VPS / Infrastructure
- **Host:** Hostinger VPS (Linux 6.8.0-101-generic)
- **Location:** Hostinger (remote)
- **SSH:** Access via root user
- **Container:** Docker running OpenClaw
- **Workspace:** `/data/.openclaw/workspace`

### Cron Jobs (Active)
| Job | Time (GMT+7) | Purpose | Delivery |
|-----|------------|---------|----------|
| platform-health-council | 03:00 | Daily system audit | none |
| nightly-security-review | 03:30 | Security analysis | none |
| self-improvement | 04:00 *(05:00 server GMT+8)* | Core files review | none |
| rss-feed-monitor | :10 hourly | RSS news scanning | none |
| reddit-monitor | :40 hourly | Reddit sentiment | none |
| market-signal-generator | :45 hourly | Signal generation | manual |
| reasoning-engine | :50 hourly | Signal analysis | none |
| nightly-memory-extraction | 23:00 | Memory extraction | none |
| data-manager | Sun 05:00 | Prune old data | none |

**Cron Context-Sharing Pipeline (Market Intel):**
```
rss-feed-monitor (:10)
  ↓ writes to memory/cron-context.json
reddit-monitor (:40)
  ↓ reads RSS context, adds Reddit findings
  ↓ writes to memory/cron-context.json
market-signal-generator (:45)
  ↓ reads combined RSS + Reddit context
  ↓ generates signals with cross-source correlations
  ↓ runs reasoning-engine
```
- **Context file:** `memory/cron-context.json` (5-8 KB, overwritten each run)
- **Benefits:** Signals leverage multiple sources, higher confidence when RSS + Reddit align
- **Pattern for new jobs:** Load context → process → update context → next job builds on it

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

### Models (Active)
- **Bailian Provider:** Primary provider (configured Mar 4, 2026 — migration complete Mar 6, 2026)
  - `bailian/MiniMax-M2.5` — Basic tasks, data gathering, simple dispatch (7 cron jobs)
  - `bailian/qwen3.5-plus` — Reasoning, analysis, security reviews (7 cron jobs)
  - Qwen family: qwen3.5-plus, qwen3-max-2026-01-23, qwen3-coder-next/plus
  - Zhipu GLM: glm-5, glm-4.7
  - Kimi: kimi-k2.5
- **Direct MiniMax-M2.5:** Deprecated (subscription ended 2026-03-22, all jobs migrated to Bailian)
- **Fallback:** openai-codex/gpt-5.3-codex (OAuth)
- **Nexos:** Removed (caused cron job issues, won't use)

**Image Analysis Capabilities:**
- ✅ **Can analyze:** Telegram attachments (images sent directly to bot)
- ❌ **Cannot fetch:** External URLs (network restrictions on Bailian models)
- **Workaround:** Download image first, then send as attachment for analysis
- **Alternative:** Use Codex for URL-based image analysis (has external fetch capability)

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
