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

### Telegram
- **Bot username:** @bahons_bot
- **Bot token:** (stored in config, not here)
- **Direct chats:** Paired and working
- **Groups:**
  - nightly-security-review (`-1003855426803`)
  - platform-health-council (`-1003504843228`)
  - self-improvement (`-1003721620909`)

### VPS / Infrastructure
- **Host:** Hostinger VPS (Linux 6.8.0-100-generic)
- **Location:** Hostinger (remote)
- **SSH:** Access via root user
- **Container:** Docker running OpenClaw
- **Workspace:** `/data/.openclaw/workspace`

### Cron Jobs (Active)
| Job | Time (ICT) | Purpose |
|-----|------------|---------|
| platform-health-council | 03:00 | Daily system audit |
| nightly-security-review | 03:30 | Security analysis |
| self-improvement | 04:00 | Core files review |
| fixed-heartbeat-30m | Every 30min | Periodic health check |

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
- **Nexos:** Disabled (provider block removed)

### Scripts
- `backup-workspace.sh` — Manual backup (Philippe runs VPS snapshots)
- `switch_model.sh` / `switch_model_auto.sh` — Model switching
- `scripts/audit-log.sh` — Security action logging
- `scripts/check-token-age.sh` — Token expiration checker
- `skills/google_maps_pro/scripts/get_tour_plan.py` — Route matrix helper

### Environment
- **Timezone:** Asia/Ho_Chi_Minh (ICT, GMT+7)
- **User:** Philippe (Netherlands → Vietnam since Sep 2024)
- **Partner:** Girlfriend in Vietnam

---

Add whatever helps you do your job. This is your cheat sheet.
