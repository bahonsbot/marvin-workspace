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
- Preferred recall order on this VPS:
  1. `qmd vsearch "query" -c life -n 3`
  2. `qmd search "query" -c life -n 3`
  3. `qmd query "query"`
- Other useful commands:
  - `qmd status`
  - `qmd collection list`
  - `bash scripts/index_memory_health.sh`
  - `bash scripts/memory_recall_smoke_test.sh`
- Categories: `life` (default), `projects`, `people`, `companies`
- Usage notes:
  - use QMD for cross-memory entity/fact lookup
  - read daily notes directly for chronology
  - treat `.learnings/*` as first-class recall input
  - pick a specific category when scope is project/person/company focused
  - local wrapper forces CPU mode (`QMD_LLAMA_GPU=cpu`) to avoid wasted Vulkan probing on this host

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
- New-group checklist:
  1. get the group ID
  2. add it to `channels.telegram.groups` in `openclaw.json`
  3. ensure BotFather group privacy is OFF if message visibility is needed
  4. apply/restart on the host so the allowlist change takes effect

### Infrastructure
- Host: Hostinger VPS (`Linux 6.8.0-106-generic`)
- Runtime: Docker (OpenClaw)
- Workspace: `/data/.openclaw/workspace`
- Primary operator user: `node`
- Backup posture:
  - manual VPS snapshot path exists
  - automated off-server backup exists
  - operational rule: do not re-flag backup/DR as missing in Morning Meeting or security review unless there is concrete evidence of drift, failure, or a newly identified coverage gap

### Cron Jobs (Active)
Note: `Delivery: none` means intentional silence by design unless otherwise noted, usually for script-only/artifact-only jobs that save outputs locally rather than announcing to Telegram.
| Job | Time (GMT+7) | Purpose | Delivery |
|-----|------------|---------|----------|
| platform-health-council | 03:00 daily | Daily system audit | telegram (`platform-health-council`) via scheduler announce |
| nightly-security-review | 03:30 daily | Security analysis | telegram (`nightly-security-review`) via scheduler announce |
| self-improvement | 04:00 daily *(05:00 server GMT+8)* | Core files review | telegram (`self-improvement`) via scheduler announce |
| weekly-test-suite | Sun 02:15 | Weekly regression tests (trading bots) | host deterministic scheduler |
| rss-feed-monitor | :10 hourly | RSS news scanning | host deterministic scheduler |
| reddit-monitor | :40 hourly | Reddit sentiment scanning | host deterministic scheduler |
| market-signal-generator | :45 hourly | Signal generation (+ reasoning engine trigger) | none |
| auto-signal-dispatcher | every 15 min | Dispatch STRONG BUY signals to equity bot | host deterministic scheduler |
| signal-accuracy-review | 22:00 daily | Review pending signal outcomes | none |
| pre-market-brief | 20:00 daily | Evening market prep brief | host deterministic scheduler |
| trading-daily-report | 08:00 daily | Equity bot daily report | host deterministic scheduler |
| daily-task-generator | 08:00 daily | Goal-driven autonomous task generation (4-5 tasks) | telegram (`goal-tasks`) |
| autonomous-task-executor | 09:00 daily | Proactive workspace-lane execution from Open Backlog; gate-enforced via `scripts/autonomy_gate.py workspace`; missing-prerequisite tasks move to `Needs Input` | telegram (`goal-tasks`) on verified completion or focused input request |
| autonomous-queue-wakeup | 10:15 / 14:15 / 18:15 daily | Main-session wakeup to process one queued autonomous task, max concurrency 1, with stale `spawned` self-heal; gate-enforced via `scripts/autonomy_gate.py queue` | telegram (`goal-tasks`) start + completion |
| workspace-home-improvement | 07:30 daily | Main-session workspace-lane maintenance pass for one bounded low-risk internal improvement; gate-enforced via `scripts/autonomy_gate.py improve` | none by default; report later in Morning Meeting |
| skill-level-check | Sun 07:00 weekly | Weekly hybrid skill assessment (test mode for objective skills, challenge mode for creative skills) | none |
| audit-sensitive-snapshot | Sun 03:15 | Weekly sensitive-file drift snapshot via runner task | none |
| enrichment-ab-review | Mon 10:00 | Weekly enrichment A/B review | none |
| session-log-cleanup | 05:20 daily | Purge OpenClaw raw session log files older than 5 days from `/data/.openclaw/agents/main/sessions` | none |
| nightly-memory-extraction | 01:00 daily | Durable memory extraction | none |

**Disabled legacy OpenClaw cron wrapper posture:**
- After the Mar 19 deterministic scheduler cutover, old disabled OpenClaw wrapper jobs are cleanup candidates, not runtime truth.
- `deterministic-scheduler-watchdog` was removed on 2026-03-23 after host-side verification confirmed `marvin-deterministic-scheduler.service` is installed, enabled, and healthy.
- Do not treat disabled wrapper timeout/error metadata as current runtime health for tasks now owned by `scripts/deterministic_scheduler.py`.
| entity-lifecycle-manager | Sun 05:00 weekly | Demote old life/ entities to archive | none |
| data-manager | Sun 05:00 weekly | JSONL/log rotation (>30 days) | none |
| dependency-update-audit | Mon 10:30 weekly | Check for outdated dependencies | none |
| news-feed-generator | DISABLED | Superseded by RSS/Reddit monitor pipeline | none |

**Cron Context-Sharing Pipeline (Market Intel):**
- `rss-feed-monitor` writes RSS context
- `reddit-monitor` enriches with Reddit findings and correlations
- `market-signal-generator` reads combined context and generates signals
- `reasoning-engine` runs after signal generation

- **Context file:** `memory/cron-context.json` (rolling state, script-managed updates)
- **Rule:** Do not manually edit context in cron prompts; Python `CronContext` is source of truth

**Script-first migration status (updated Mar 19):**
- Deterministic runner-backed jobs are now executed by the host-managed deterministic scheduler service, not by OpenClaw `agentTurn` wrappers
- Host service: `marvin-deterministic-scheduler.service`
- Deterministic scheduler code: `scripts/deterministic_scheduler.py`
- Classification rule: script-only jobs with no LLM reasoning requirement belong on the deterministic scheduler; analysis/review jobs that require model reasoning belong on OpenClaw cron
- Decision table: `docs/runbooks/job-placement-decision-table.md`
- Intentionally model-backed: `nightly-memory-extraction`, `platform-health-council`, `nightly-security-review`, `self-improvement`, `daily-task-generator`, `signal-accuracy-review`, `market-signal-generator`
- Save points / refs: `projects/_ops/cron-savepoint-2026-03-16.md`, `docs/runbooks/deterministic-scheduler-host-service.md`

### Mission Control Runtime / Preview Notes
- Savepoint naming rule: prefer concise savepoint filenames, e.g. `mc-savepoint-YYYY-MM-DD-<descriptor>.md`, over long sentence-style names
- Preview runtime dependency note: `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js` and `projects/mission-control/scripts/preview-origin-proxy.js` require npm package `ws`; a passing Next.js build alone does not prove preview health if `ws` is missing
- Chat transcript rehydration now reads persisted session logs via `projects/mission-control/app/api/runtime-bridge/route.ts`
  - Apr 2 rewind fix: hydrated transcript merge is timestamp-aware and overwrite-safe so older persisted history cannot clobber newer live messages during later hydrate cycles
  - Apr 2 UX stabilization: transient ACTIVITY/SYSTEM notices are no longer durable transcript rows; compression/fallback notices render in a transient notice channel instead, and default Chat load should prefer `agent:main:main`
  - Apr 2 late-night regression lesson: repeated active-session transcript rehydration can cause delayed duplicate turns and transcript scroll jumps; for the active live thread, hydrate on session change/empty transcript, then prefer WS live updates over repeated signature-based history merges
- Autonomous Tasks sync posture:
  - structured store (`projects/mission-control/data/autonomous-tasks.json`) remains current-state authority
  - `AUTONOMOUS.md` is the legacy mirror/sync surface
  - Apr 2 cleanup behavior: Mission Control `Clean up` now reconciles legacy task sections back to the structured board state for active legacy-linked tasks
  - Apr 2 delete behavior: manual task removal now deletes the full multiline legacy task block from `AUTONOMOUS.md`, not just the bullet title line
  - Apr 2 import behavior: stale legacy suppression keys should not permanently block regenerated backlog tasks from re-importing
  - Apr 2 manual execution behavior: if a requested model override is not actually honored, Mission Control should fail visibly instead of silently running on MiniMax/default; bootstrap/context root files must never count as reviewable artifacts
  - Apr 4 browser/runtime parity note: if Tasks capability checks are used in both server execution and browser preflight, set both server and `NEXT_PUBLIC_*` env variants or the UI can show false missing-capability warnings even when the backend is configured; current web-research pair is `MISSION_CONTROL_WEB_RESEARCH_ENABLED` / `MISSION_CONTROL_SEARCH_PROVIDER` plus `NEXT_PUBLIC_MISSION_CONTROL_WEB_RESEARCH_ENABLED` / `NEXT_PUBLIC_MISSION_CONTROL_SEARCH_PROVIDER`
  - Apr 4 execute-health note: `task.status = in-progress` and `run.status = running` are not enough to prove a live autonomous run; when debugging, verify session-log creation at `/data/.openclaw/agents/main/sessions/<sessionId>.jsonl`, a registry match in `/data/.openclaw/agents/main/sessions/sessions.json`, or observable transcript/model usage before assuming the worker actually started
  - registry source: `/data/.openclaw/agents/main/sessions/sessions.json`
  - important runtime truth: this file is keyed directly by `sessionKey`; do not assume a nested `sessions.*` wrapper when resolving a session
  - session logs: `/data/.openclaw/agents/main/sessions/<sessionId>.jsonl`
- Mission Control Chat route posture:
  - `/general/chat` and `/chat` intentionally suppress the shell bottom system strip so the page can use a true fixed-workspace layout
  - the Chat page also bypasses the normal shared page-scaffold title/header so the top control rail and bottom composer dock can own the visible working area
- Apr 1 Tasks/runtime posture:
  - autonomous task current-state authority = `projects/mission-control/data/autonomous-tasks.json`
  - `AUTONOMOUS.md` is legacy mirror/sync surface, not equal authority
  - Tasks page now uses live polling only while autonomous work is actively running
  - autonomous completion notifications now fan out to Chat activity line + top-right shell toast + subtle sound cue
  - shell bottom status strip is intentionally disabled globally for now, not deleted as a concept
- Mission Control repo wrap rule:
  - `projects/mission-control` may commit cleanly inside its own nested repo while the outer workspace still has unwrapped file changes
  - before telling Philippe a Mission Control feature is live, do outer-workspace wrap + preview restart + one light verification pass against the integrated version

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
- news-feeds
- proactive-execution
- deepresearchwork


### Workspace Local Skills
- frontend-skill — verbatim OpenAI front-end skill for visually strong landing pages, websites, apps, prototypes, demos, and game UI
  - Path: `skills/frontend-skill/SKILL.md`

### Models (Operational Routing)
- Primary provider: Bailian
- Default lightweight delegation: `minimax/MiniMax-M2.7`
- Higher-reasoning delegation: `bailian/qwen3.5-plus` *(currently unavailable; do not route live jobs or Mission Control to it until subscription returns)*
- Active Codex posture uses both:
  - `openai-codex/gpt-5.4` for runway / orchestration / higher-reasoning work
  - `openai-codex/gpt-5.3-codex` for coding-heavy delegated work
- Either Codex route may be used depending on task shape and current runtime needs
- Optional comparison models: `glm-5`, `kimi-k2.5`
- Active alias notes:
  - `codex5.4` = Marvin orchestration / higher-reasoning work
  - `codex` = coding-specialist route
  - `codex5.4mini` = lightweight Codex orchestration, follows the same prompt guidance as `codex5.4` unless a mini-specific guidance file is later added
  - `minimax2.7` = requires `api: "anthropic-messages"` and `baseUrl: "https://api.minimax.io/anthropic"`

### Hybrid Agent-Team v1 (legacy workflow reference)
- Status: largely superseded by the live Dev Team / Sudo workflow in Mission Control
- `projects/_ops/agent-team/` is currently a prompt/template/reference package, not a standalone runnable software package
- Historical architecture:
  - Marvin (orchestrator) → Builder → Reviewer
- Historical preferred model mapping:
  - Marvin → codex5.4
  - Builder → codex
  - Reviewer → minimax2.7
- Legacy queue/history note:
  - older autonomous-task routing references may still mention `agent_team` mode in logs/state/docs
  - treat those as legacy context unless a current workflow explicitly uses them
- Current posture:
  - preserve reusable prompt/review patterns if still valuable
  - otherwise prefer the live Dev Team / Sudo path for internal multi-lane implementation work
- Reference path: `projects/_ops/agent-team/`

### Image Analysis
- Bailian models: analyze attachments, limited at fetching external image URLs
- URL-image workaround: fetch/download first, then analyze as attachment
- Use Codex when URL-based image fetch is required

### Codex CLI Setup (Fallback Model)

- **Separate OAuth:** Codex CLI requires its own OAuth login, independent of OpenClaw's OAuth
  - Login command: `codex login --device-auth` (device code flow works best)
  - Tokens stored in `~/.codex/`
- **Important distinction:** Codex CLI auth is separate from the main OpenClaw dashboard/orchestrator runtime, which resolves its Codex identity from `/data/.openclaw/agents/main/agent/auth-profiles.json` via `openai-codex:default`
  - Runtime OAuth refresh command: `openclaw models auth login --provider openai-codex --set-default`
  - Rule: do not edit `auth-profiles.json` directly unless Philippe explicitly approves it
- **Current posture:** dual-home Codex CLI wrapper experiments were removed; do not assume `/data/codex-work-home` or `/data/codex-personal-home` exist. Runtime account switching for the main OpenClaw path is a Philippe-only manual runbook, not a normal CLI flow.
- **Runbook:** `docs/runbooks/openai-codex-runtime-account-switch.md`
- **Git repo required:** Codex refuses to run outside a git repository
  - For scratch work: `mktemp -d && git init` before running Codex
- **Coding agent skill:** Built-in OpenClaw skill `coding-agent` delegates to Codex/Claude Code/Pi
  - Usage: `pty:true workdir:~/project background:true command:"codex exec --full-auto 'prompt'"`
  - Always use `pty:true` — coding agents need a pseudo-terminal
- **Stitch → Codex workflow:** when implementing from Stitch or design exports, extract and state the design tokens explicitly first (palette, typography, spacing, surface treatment, icon/style rules) before asking Codex to build.
  - Runbook: `docs/runbooks/stitch-mcp-codex-github-pages-workflow.md`
  - Practical rule: do not assume Codex will infer the right visual system from raw Stitch output alone
- **Codex exec filesystem limits:** sandboxed Codex exec sessions may fail on workspace writes for preview or `memory/` artifacts.
  - Practical rule: if a task needs to write preview state, logs, or `memory/*` outputs reliably, run it from the main Marvin session instead of inside Codex exec

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
- `projects/autonomous-trading-bot/scripts/run_webhook_receiver_foreground.sh` — systemd-friendly foreground launcher for trading webhook receiver
  - Host service: `marvin-webhook-receiver.service`
  - Runbook: `docs/runbooks/webhook-receiver-host-service.md`
- `scripts/deterministic_scheduler.py` — Host-side deterministic scheduler for script-only cron tasks
  - Purpose: runs script-only `cron_runner.py --task ...` jobs outside OpenClaw `agentTurn`
  - Control: `bash scripts/deterministic_scheduler_ctl.sh {start|stop|restart|status}`
  - Log: `memory/deterministic-scheduler.log`
  - State/PID: `memory/deterministic-scheduler-state.json`, `memory/deterministic-scheduler.pid`
  - Gold-standard persistence: host systemd service `marvin-deterministic-scheduler.service`
  - Runbook: `docs/runbooks/deterministic-scheduler-host-service.md`
  - Current ownership split:
    - deterministic scheduler = script-only runner-backed jobs
    - OpenClaw cron = model-backed analysis/review jobs
- `scripts/ralphy.sh` — Autonomous coding agent (reads PRD, iterates on code)
  - Resolves `codius` dynamically with `command -v`
  - Optional override: `CODIUS_BIN=/absolute/path/to/codius`
- `scripts/ralphy-notify.sh` — Telegram notifications for ralphy
- `scripts/audit-log.sh` — Security action logging (text + JSONL)
- `scripts/audit-sensitive-snapshot.sh` — Low-noise sensitive-file change detector (baseline + drift logging)
- `scripts/check_token_age.py` — Token expiration checker (replaces deprecated `check-token-age.sh`)
- `scripts/install_deterministic_timers.py` — DEPRECATED legacy user-timer installer, superseded by host-side `marvin-deterministic-scheduler.service`
- `scripts/nightly-memory-extraction.sh` — Memory extraction cron
- `scripts/cron_runner.py` — Script-first execution entry for migrated deterministic cron jobs
  - Usage:
    ```bash
    python3 scripts/cron_runner.py --list-tasks
    python3 scripts/cron_runner.py --task data-manager
    python3 scripts/cron_runner.py --task rss-feed-monitor --json
    ```
  - Logs: `memory/cron-run-log.jsonl`
  - Detail logs: `memory/cron-run-details/`
  - Locks: `memory/locks/`
  - Current status: deterministic cron jobs are routed through the runner, but OpenClaw cron still launches agentTurn sessions; runtime overhead is reduced, not eliminated
- `scripts/cron_tasks/session_log_cleanup.py` — Purges old raw OpenClaw session logs from `/data/.openclaw/agents/main/sessions`
  - Retention: deletes `.jsonl`, `.jsonl.deleted.*`, `.jsonl.reset.*`, and stale `.tmp` files older than 5 days
  - Preserves: `sessions.json`
  - Dry run: `python3 scripts/cron_tasks/session_log_cleanup.py --dry-run`
- `scripts/cron_tasks/enrichment_ab_review.py` — Weekly enrichment A/B review runner for signal comparison snapshots
- `scripts/daily-task-generator.py` — Daily autonomous task generation (08:00 ICT, 4-5 goal-aligned tasks)
  - Guardrails: no default case studies, no fake creative-output MVPs, social/content tasks require concrete source work, useful surprise MVPs allowed for tool/system/project-improvement lanes
- `scripts/queue_state.py` — Queue helper for autonomous-task orchestration

  Quick usage:
  ```bash
  python scripts/queue_state.py status
  python scripts/queue_state.py can-start
  python scripts/queue_state.py heal-stale
  ```

  - `status` — prints JSON summary for `memory/executor-subagent-queue.json` including totals, spawned/pending/completed/blocked counts, and any stale spawned entries
    - Example shape: `{"total": 5, "spawned": 0, "pending": 0, "completed": 4, "blocked": 1, "staleSpawned": []}`
  - `can-start` — lightweight gate check for scripting
    - exit `0` = no active spawned task (`CAN_START`)
    - exit `1` = active spawned task exists (`ACTIVE_SPAWNED`)
    - exit `2` = queue missing/invalid or bad invocation
  - `heal-stale` — marks stale `spawned` tasks as `blocked` and prints JSON like `{"healed": 0, "queueFile": "..."}`
  - `scripts/queue_triage.py` — richer delegated-queue operator summary (counts, warnings, next action, blocker reasons, human or JSON output)
    - Quick usage:
      ```bash
      python scripts/queue_triage.py
      python scripts/queue_triage.py --json
      python scripts/queue_triage.py --limit 3
      ```
  - **When to use:** use `queue_state.py` for inspection and manual healing; use `queue_triage.py` when you want a faster human-readable diagnosis of why the queue is idle/blocked/active; use `autonomy_gate.py queue` for cron preflight decisions, including the same stale-slot self-heal behavior plus run/skip decision output
  - **Decision table:**

    | Need | Use | Why |
    |---|---|---|
    | Inspect current queue counts/status | `python scripts/queue_state.py status` | Read-only summary for humans/scripts |
    | Check if a new delegated task may start | `python scripts/queue_state.py can-start` | Lightweight gate without full cron policy |
    | Manually heal stale `spawned` entries | `python scripts/queue_state.py heal-stale` | Targeted operator repair |
    | Decide whether scheduled queue wakeup should run | `python scripts/autonomy_gate.py queue` | Full cron preflight with active-hours/policy checks |
    | Decide whether daily backlog executor should run | `python scripts/autonomy_gate.py workspace` | Full workspace-lane preflight |
    | Decide whether daily home-improvement pass should run | `python scripts/autonomy_gate.py improve` | Full bounded-maintenance preflight |

  - **Ownership rule:** `queue_state.py` is the operator inspection/manual-heal tool. `autonomy_gate.py` is the cron-facing run/skip decision layer.
  - **Note:** `autonomous-subagent-runner` cron is disabled. Active queue processing now happens via `autonomous-queue-wakeup` (main-session wakeup path) and `autonomous-task-executor`.
- `scripts/autonomy_gate.py` — Cron preflight gate for proactive autonomy
  - Usage:
    - `python scripts/autonomy_gate.py workspace` — allow/skip the daily workspace-lane backlog executor
    - `python scripts/autonomy_gate.py queue` — allow/skip queued delegated work wakeups
    - `python scripts/autonomy_gate.py improve` — allow/skip the daily workspace home-improvement pass
  - Returns JSON with `mode`, `decision`, `reason`, and `details`
    - Example `workspace` / `improve` run shape: `{"mode": "workspace", "decision": "run", "reason": "workspace autonomy run allowed", "details": {"open_backlog": 2, "in_progress": 2}}`
    - Example `queue` skip shape: `{"mode": "queue", "decision": "skip", "reason": "no pending delegated tasks", "details": {"healed": 0, "pending": 0, "spawned": 0}}`
  - Exit codes:
    - `0` = run allowed
    - `1` = skip
    - `2` = invalid usage or queue/file error
  - Decision logic:
    - all modes skip outside active hours or if `AUTONOMY.md` is missing
    - `workspace` also skips when there is no Open Backlog work or an active delegated spawned task
    - `queue` self-heals stale spawned slots, then decides based on pending delegated work
    - `improve` allows one bounded workspace improvement pass when active-hour and queue conditions are satisfied
  - Timing note: for reminder-style cron jobs such as `autonomous-queue-wakeup`, `cron run` accepts/enqueues the run first; visible queue-state mutations happen only after the reminder is delivered to the main session and processed
- `scripts/add-task-suggestion.py` — Add a Philippe suggestion and place it at the top of Open Backlog
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
- `projects/mission-control/` — hybrid Mission Control companion shell for OpenClaw (active scaffold with real local/runtime wiring)
  - Current implementation state:
    - scaffold exists, builds, and has passed review
    - Home/Cron/Agents/Logs wired to real local/runtime sources
    - Tasks uses real board truth-path + sync indicator
    - Cron adapter now merges runner-log truth for runner-backed jobs instead of trusting stale cron metadata alone
    - Orchestrator has a real read-first integration spike, but chat embedding remains intentionally unresolved/provisional
    - **Chat direction (Mar 18-20):** Bridge-first, not embed-first. Preserve exact gateway chat behavior; avoid custom transport or pseudo-embedded replacements until route/auth/session parity is proven safe. Reference: `projects/_ops/mission-control-chat-product-decision-brief-2026-03-18.md`
    - non-interactive lint baseline added
    - Visual identity: **FLOATING** design system — warm cream/ivory palette (#F7F2E9, #F4EEE4), forest green accents (#062E26, #0A332B, #163B31), editorial serif headlines, glass/elevated surfaces. Design tokens: `projects/mission-control/docs/FLOATING-DESIGN-SYSTEM.md`. Design handoff: `projects/mission-control/docs/FLOATING-HANDOFF.md`. (Note: design docs live in `projects/mission-control/docs/`, not root `docs/`.)
  - Adapter layer:
    - `lib/adapters/runtime.ts` — safe runtime command/file access for app routes
    - `lib/adapters/cron.ts` — cron list/run truth, including runner-log reconciliation
    - `lib/adapters/sessions.ts` — session and agent activity reads
    - `lib/adapters/activity.ts` — recent system/workspace activity shaping
    - `lib/adapters/home.ts` — Home dashboard composition from live sources
    - `lib/adapters/orchestrator.ts` — current Orchestrator integration/read path
    - `lib/adapters/tasks.ts` — AUTONOMOUS/board/task truth-path integration
  - Core planning refs:
    - `projects/_ops/mission-control-product-brief-2026-03-16.md`
    - `projects/_ops/mission-control-v1-architecture-spec-2026-03-16.md`
    - `projects/_ops/mission-control-v1-modules-implementation-plan-2026-03-16.md`
    - `projects/_ops/mission-control-v1-data-contract-spec-2026-03-16.md`
    - `projects/_ops/mission-control-v1-technical-integration-plan-2026-03-16.md`
    - `projects/_ops/orchestrator-integration-decision-memo-2026-03-16.md`
    - `projects/_ops/mission-control-v1-app-scaffold-brief-2026-03-16.md`
    - `projects/_ops/mission-control-v1-technical-integration-plan-2026-03-16.md`
    - `projects/_ops/orchestrator-integration-decision-memo-2026-03-16.md`
  - Current checkpoint notes:
    - Next.js patched from 14.2.15 to ^14.2.35; build passes
    - npm audit still reports upstream high-severity dependency findings; acceptable for local scaffold stage, revisit before real exposed deployment
    - Remaining major implementation question is how far to take Orchestrator integration after the successful read-first spike
    - Preview access: Mission Control is intended to be publicly reachable at `http://preview.motiondisplay.cloud` when host nginx is correctly proxying to the container-side app on port `3005`
    - Runtime truth: Mission Control runs inside the OpenClaw container, not on host loopback
    - Operational rule: treat host nginx → reachable container-side app routing as the durable requirement; do not rely on a specific container IP remaining stable
- `projects/market-intel/` — signal generation + reasoning pipeline (active)
  - **Execution-candidates pipeline (Mar 13):**
    - Producer: `projects/market-intel/src/execution_candidates.py`
    - Artifact: `projects/market-intel/data/execution_candidates.json`
    - Purpose: execution-facing handoff layer between Market Intel signals and the equity bot
- `projects/autonomous-trading-bot/` — Alpaca paper equity bot (active)
  - Consumer bridge: `projects/autonomous-trading-bot/src/execution_candidates_adapter.py`
  - Runtime flag: `EXECUTION_CANDIDATES_ENABLED=true`
  - Current clean-sheet epoch: `candidate-clean-sheet-2026-03-13`
  - **Execution-candidates mode:** candidate artifact drives symbol selection when enabled; if the artifact is missing/invalid, troubleshooting should verify the adapter path and current dispatcher behavior before assuming signal-generation failure
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
4. **Legacy Bailian MiniMax token limit:** Bailian `MiniMax-M2.5` accepts up to ~196,608 input tokens.
   - Symptom: HTTP 400 with message like `Range of input length should be [1, 196608]`
   - Fix: Prefer `minimax/MiniMax-M2.7` for direct MiniMax routing. `bailian/qwen3.5-plus` is currently unavailable here, so do not depend on it for live prompts until subscription returns.
5. **MiniMax M2.7 404 on clean setup:** When 404 survives a clean provider/alias setup, it is almost always a transport/API-contract mismatch, not a credential or hostname problem.
   - Diagnostic path: read provider's official API docs → read OpenClaw provider docs → compare against current config → apply minimum transport-layer fix
   - For M2.7 specifically: use `api: "anthropic-messages"` + `baseUrl: "https://api.minimax.io/anthropic"` (not the bare `/v1` path)

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
- Signal review workflow: `projects/market-intel/docs/signal-review-workflow.md`
- Signal review helper: `projects/market-intel/scripts/save_signal_review.py`
- Canonical signal-review contract: `tracked_signals.json` (verification store) + dated markdown review notes (audit trail) + `model_feedback.json` (aggregate output)
- Feedback store: `projects/market-intel/data/model_feedback.json`
- Accuracy tracker: `projects/market-intel/src/accuracy_tracker.py`

### Deeper References
- Project strategy and history: `MEMORY.md` + `memory/YYYY-MM-DD.md`
- Morning Meeting decision template: `docs/runbooks/morning-meeting-decision-template.md`
- Mission Control runtime/preview operations: `docs/runbooks/mission-control-runtime-preview-runbook.md`
- Market Intel notes: `projects/market-intel/notes/`
- Egress hardening refs:
  - `docs/runbooks/egress-filtering-phase1-plan.md`
  - `docs/runbooks/egress-inventory-memo-2026-03-19.md`
  - `docs/runbooks/egress-enforcement-deferred-until-trading-isolation.md`
  - `docs/runbooks/network-endpoint-observations.md`
- Mar 19 host service refs:
  - `docs/runbooks/deterministic-scheduler-host-service.md`
  - `docs/runbooks/webhook-receiver-host-service.md`

### Structured Learnings
- `.learnings/corrections.md` — recurring corrections, preferences, style adjustments
- `.learnings/errors.md` — command failures, tool/API errors, exceptions
- `.learnings/requests.md` — feature requests and capability gaps
- Purpose: keep reusable lessons separate from daily notes and curated memory

### Environment
- System runtime: `Asia/Kuala_Lumpur (GMT+8)` (VPS server time)
- User-facing display: `Asia/Ho_Chi_Minh (GMT+7)` ( Philippe's timezone)
- **Rule:** Always display times in `Asia/Ho_Chi_Minh` unless explicitly requested otherwise

---

Keep this file operational and current. Move history/retrospectives to MEMORY or project docs.
