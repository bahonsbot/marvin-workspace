# MEMORY.md - Curated Long-Term Memory

## AI Assistant: Marvin

- Name: Marvin
- Vibe: Dry wit, direct, helpful friend first
- Configured with personality in SOUL.md

## Philippe's Setup

### Models
- **Primary:** MiniMax 2.5 (minimax/MiniMax-M2.5)
- **Fallback:** OpenAI Codex GPT-5.3 (openai-codex/gpt-5.3-codex) via OAuth
- **Nexos:** Disabled temporarily (provider block removed from active config)
- **Switch commands:** /minimax, /codex, "switch to minimax", "switch to codex"

### Codex + Coding-Agent Skill Setup (Feb 2026)
- Codex CLI requires its own separate OAuth login via `codex login` or `codex login --device-auth`
- Device code flow (`codex login --device-auth`) works best to avoid browser state mismatch issues
- OAuth tokens saved in Codex CLI are separate from OpenClaw's OAuth (both needed)
- Built-in OpenClaw skill: `coding-agent` - delegates to Codex/Claude Code/Pi agents
- Usage: `bash pty:true workdir:~/project background:true command:"codex exec --full-auto 'prompt'"`
- Always use `pty:true` for coding agents - they need a pseudo-terminal
- Codex refuses to run outside a git repo - use `mktemp -d && git init` for scratch work
- Blender Python scripts: Blender 4.x renamed EEVEE → BLENDER_EEVEE_NEXT and Transmission → Transmission Weight
- Codex can analyze images: `codex exec --full-auto "Look at this image: /path/to/image.jpg"`

### Memory Settings (Feb 2026)
- Memory flush on compaction: enabled
- Session memory: enabled  
- QMD backend: installed at /data/.openclaw/qmd but not yet enabled
- Memory search: disabled (no embedding provider)

### Heartbeat
- Fixed at 30-minute intervals (not adaptive) to avoid interrupting conversations

### Image Analysis (Feb 2026)
- Built-in image tool has a bug: rejects MiniMax even though model supports images
- Workaround: Use Codex to analyze images
- QMD reminder set for next Saturday

### Preferences
- Always ask for confirmation before installing skills flagged as suspicious by VirusTotal
- For non-trivial cleanup/fix actions, propose the plan first and wait for Philippe’s explicit confirmation before executing
- For new skill builds, ask targeted design questions and validate constraints before implementation (prevents rework later)
- NEVER store tokens/API keys in git remote URLs - use `gh auth` or environment variables instead

### GitHub
- Account: bahonsbot (GitHub CLI authenticated)
- Repo: https://github.com/bahonsbot/marvin-workspace (public)
- Purpose: store code projects (Blender scripts, etc.)
- .gitignore configured to exclude sensitive files (*.md, backup/, memory/, .openclaw/, etc.)
- When writing code, always commit and push to this repo automatically

### Telegram
- Bot: Configured and working
- Paired for direct command delivery
- Smart updater phase delivery validated (check/decision/final report all delivered to Telegram)

### Infrastructure
- Git repo initialized (Marvin <marvin@local.com>)
- **Daily backup**: 4am Vietnam time, delivers to Telegram
- **Nightly security review**: 3:30am Vietnam time, analyzes workspace, delivers to Telegram
- **Platform health council**: 3:00am Vietnam time, currently stable after pairing fix
- **Smart auto updater**: 10:00am Asia/Kuala_Lumpur (`smart-auto-updater-daily`) pinned to MiniMax-M2.5
- Backup targets: USER.md, MEMORY.md, AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md
- Workspace: /data/.openclaw/workspace

### Group Chat Rules
- **DM (direct)** → anything goes (personal, random, whatever)
- **Group chats** → topic-locked based on channel/group name
- **Reply to all messages** in group chats — not just when pinged
- If channel name is "stock-analysis" → only discuss stock analysis
- If channel name is "blender-tips" → only discuss Blender
- Follow whatever topic the channel name indicates

### Installed Skills (Feb 2026)
- **humanizer** - Remove AI writing patterns, make text sound more natural
- **stock-market-pro** - Yahoo Finance analysis with charts (RSI/MACD/BB/VWAP/ATR)
- **marketing-skills** - 23 marketing modules (CRO, SEO, copy, ads, pricing, etc.)
- **us-stock-analysis** - Comprehensive US stock analysis (fundamentals + technical)
- **openclaw-agent-optimize** - Optimize OpenClaw setup (cost, context, reliability)
- **my-skills** - Personal behaviour rules (no looping, be concise, memory management, task management, error handling)
- **google_maps_pro** - Custom travel/location planning skill with budget-safe Google Maps usage, ask-first clarifications, matrix batching, and Telegram-friendly output style

### Security Setup (Feb 2026)
- **Nightly Security Review**: Runs at 3:30am Vietnam time, analyzes codebase from 4 perspectives (offensive, defensive, privacy, operational), delivers to Telegram
- **First review found**: Hardcoded API keys in auth.json and analyze_image.py
- **Fix applied**: Updated .gitignore to protect auth.json and *.bak files from git

### Docker Environment Rules (Feb 2026)
These rules prevent common issues in this Docker setup:

1. **"Don't Touch the Lock" Rule**
   - Do NOT modify `gateway.auth` or `gateway.mode` in openclaw.json directly
   - These are managed by host environment variables
   - Changing them breaks CLI pairing and loses access to tools

2. **"No Internal Restarts" Rule**
   - Never run `openclaw gateway stop` or `restart` from inside the container
   - Killing the gateway process can crash the container or cause boot loops
   - If restart needed, ask Philippe to do it from the VPS host

3. **"Permission Awareness" Rule**
   - Always verify file ownership before writing to `/data/.openclaw/` directory
   - If new files are created and access is lost, remind Philippe to run:
     `sudo chown -R node:node /data/.openclaw/`
   - This applies to config files, cron jobs, scripts, etc.

4. **"Schema-First Config" Rule**
   - Never invent new top-level keys in `openclaw.json` (example mistake: adding `system`)
   - Validate CLI-supported config shape first (via `openclaw ... --help` / `doctor`)
   - For heartbeat behavior, only use supported config paths or ask Philippe to apply host-side changes
   - Invalid config keys can crash/break gateway startup in this Docker setup

### Philippe's Context
- From Netherlands, living in Vietnam since Sep 2024
- Girlfriend works in Vietnam
- Creative hobbies: animation, graphic design, photography, writing, cooking
- Career interests: Blender, After Effects, Unreal Engine, novel writing, stock trading
- Previously: hospitality, WoW Game Master (France), Head Teacher (Macau), marketing/comms (Amsterdam), Group Comms Manager (Tilburg)
