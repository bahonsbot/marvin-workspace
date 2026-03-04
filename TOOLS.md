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
- coding-agent

### Models (Active)
- **Primary:** minimax/MiniMax-M2.5
- **Fallback:** openai-codex/gpt-5.3-codex
- **Nexos:** Removed (caused cron job issues, won't use)

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
- `projects/autonomous-trading-bot/` — Autonomous trading via Alpaca + TradingView webhooks
- `projects/market-intel-news-reader/` — PWA news reader app for iPhone (PRD in progress)

### Environment
- **Timezone:** Asia/Ho_Chi_Minh (GMT+7)
- **Note:** VPS runs on Asia/Kuala_Lumpur (GMT+8) — always specify Asia/Ho_Chi_Minh for cron jobs and display
- **User:** Philippe (Netherlands → Vietnam since Sep 2024)
- **Partner:** Girlfriend in Vietnam

---

Add whatever helps you do your job. This is your cheat sheet.
