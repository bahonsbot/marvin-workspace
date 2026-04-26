# TOOLS.md - Local Ops Notes

Environment-specific runtime notes only.
Use this file for live setup facts, commands, service locations, runtime dependencies, scheduler ownership, file paths, and environment constraints.
Do not use it as a diary.

## What goes where
- `TOOLS.md`: current operational reality
- `MEMORY.md`: durable decisions and standing rules
- `memory/YYYY-MM-DD.md`: chronology, investigations, approvals, temporary states, execution notes

Quick rule:
- If it answers "how is the environment set up right now?" put it here.
- If it answers "what rule should still matter next month?" put it in `MEMORY.md`.
- If it answers "what happened today, and why?" put it in daily memory.

## Current Runtime Baseline
- OpenClaw CLI version: `2026.4.15` (`openclaw --version`, verified Apr 17, 2026)
- Workspace: `/data/.openclaw/workspace`
- Host: Hostinger VPS
- Runtime: Docker
- Primary operator user inside container: `node`
- Canonical OpenClaw CLI path: `/data/.npm-global/bin/openclaw`
- Current rule: use the host/container restart path for runtime restarts, not `openclaw gateway restart` from inside the container
- Current operational posture: the Apr 17 reset baseline is restored and verified. Rewiring is now targeted follow-up work, not an open-ended recovery state. Prefer minimal clean fixes over patch stacking, and avoid routine backup restores.
- Nexos provider note: Nexos model entries are currently re-injected on gateway restart by the Hostinger Docker environment. Removing Nexos-related files inside the current container does not persist. Treat Nexos as unavoidable ambient config for now unless there is a deliberate, approval-backed container rebuild plan.

## Container Access
- Root shell from host: `docker exec -it openclaw-ktrt-openclaw-1 bash`
- Node shell from host: `docker exec -it --user node openclaw-ktrt-openclaw-1 bash`
- Rule of thumb: use `node` for normal OpenClaw/workspace work, use root only when truly needed for global package operations inside the container

## GitHub
- GitHub account: `bahonsbot`
- Workspace repo: `https://github.com/bahonsbot/marvin-workspace`
- `gh` CLI is authenticated

## Memory and Recall
### QMD
- Preferred recall order:
  1. `qmd vsearch "query" -c life -n 3`
  2. `qmd search "query" -c life -n 3`
  3. `qmd query "query"`
- Useful checks:
  - `qmd status`
  - `qmd collection list`
  - `bash scripts/index_memory_health.sh`
  - `bash scripts/memory_recall_smoke_test.sh`
- Categories: `life`, `projects`, `people`, `companies`
- Local wrapper forces CPU mode with `QMD_LLAMA_GPU=cpu`

### Search Scope Clarifier
- `QMD`: workspace memory/entity recall
- Mission Control web research provider: runtime web search, currently separate from QMD
- General Brave/SearXNG posture belongs in `MEMORY.md`, not in QMD notes

## Telegram
- Bot: `@bahons_bot`
- Direct chat: paired
- Known groups:
  - nightly-security-review: `-1003855426803`
  - platform-health-council: `-1003504843228`
  - self-improvement: `-1003721620909`
  - proactive-execution: `-1003742262384`
  - market-signals: `-1003850594375`
  - autonomous-trading-bot: `-1003711398278`
  - goal-tasks: `-1003704803669`
- New group checklist:
  1. get the group ID
  2. add it to `channels.telegram.groups` in config
  3. ensure BotFather group privacy is OFF if visibility is needed
  4. apply/restart on the host so allowlist changes take effect

## Scheduler Ownership
### OpenClaw cron
OpenClaw cron should own model-backed reasoning/review jobs.
Verified enabled jobs from `/data/.openclaw/cron/jobs.json` on Apr 17, 2026:
- `nightly-memory-extraction`
- `platform-health-council`
- `nightly-security-review`
- `self-improvement`
- `market-signal-generator`
- `signal-accuracy-review`
- `daily-task-generator`
- `autonomous-task-executor`
- `autonomous-queue-wakeup`
- `workspace-home-improvement`
- `skill-level-check`

### Deterministic scheduler
Script-only jobs belong on the host deterministic scheduler.
- Service: `marvin-deterministic-scheduler.service`
- Runner: `scripts/deterministic_scheduler.py`
- Main entry: `python3 scripts/cron_runner.py --list-tasks`
- Logs: `memory/cron-run-log.jsonl`, `memory/cron-run-details/`
- Do not treat disabled legacy wrapper jobs as runtime truth

### Queue/autonomy gates
- Queue/workspace/improvement gate: `python3 scripts/autonomy_gate.py {queue|workspace|improve}`
- Queue inspection/manual healing: `python3 scripts/queue_state.py {status|can-start|heal-stale}`
- Human-readable queue diagnosis: `python3 scripts/queue_triage.py --json`

## Mission Control Runtime Notes
- Project path: `projects/mission-control/`
- Current app stack: `next 16.2.0`, `react 19.2.0`, `react-dom 19.2.0`, `ws` required
- Main preview/runtime ports:
  - app: `3005`
  - sidecar/health: `3006`
  - proxy/helper: `3007`
- Preview stop rule: `projects/mission-control/scripts/preview-stop.sh` must remain PID-file scoped. Do not revert to broad `pkill` patterns.
- Runtime bridge dependencies: `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js` and `projects/mission-control/scripts/preview-origin-proxy.js` require the `ws` package
- Preview public TLS note: `preview.motiondisplay.cloud` currently has a certificate/hostname mismatch under strict TLS; local preview smoke can still pass, and this is deferred/non-blocking for dashboard/lab.
- Tasks truth rule:
  - authoritative store: `projects/mission-control/data/autonomous-tasks.json`
  - mirror/sync surface: `AUTONOMOUS.md`
- Memory/files editor foundation: `projects/mission-control/components/editor/CodeMirrorEditor.tsx`
- Chat helpers:
  - `components/chat/chat-rich-text.tsx`
  - `components/chat/chat-ui-helpers.ts`
  - `components/chat/chat-tool-groups.tsx`

## Specialist Workspaces
- Canonical specialist data lives under: `/data/.openclaw/workspace/agent-workspaces/<seat>/...`
- Seat-local roots like `/data/.openclaw/workspace-job-advisor` are compatibility/runtime shells, not a second source of truth
- Repair/check helper: `python3 scripts/specialist_workspace_aliases.py --apply`

## Trading Bot Operations
- Receiver launcher: `projects/autonomous-trading-bot/scripts/run_webhook_receiver_foreground.sh`
- Host service: `marvin-webhook-receiver.service`
- Health endpoints:
  - `http://127.0.0.1:8000/health`
  - `http://127.0.0.1:8000/health/auth`
- Watchdog log: `projects/autonomous-trading-bot/logs/webhook_watchdog.out.log`
- Receiver log: `projects/autonomous-trading-bot/logs/webhook_receiver.out.log`
- Quick recovery:
  ```bash
  cd /data/.openclaw/workspace/projects/autonomous-trading-bot
  pkill -f webhook_receiver.py
  bash scripts/run_webhook_receiver.sh
  ```

## Key Scripts and Runbooks
### Scripts
- `scripts/deterministic_scheduler.py`: host-side script-only scheduler
- `scripts/cron_runner.py`: deterministic cron task entry point
- `scripts/autonomy_gate.py`: cron/autonomy preflight gate
- `scripts/queue_state.py`: queue inspection/manual healing
- `scripts/queue_triage.py`: queue diagnosis
- `scripts/daily-task-generator.py`: daily backlog generation
- `scripts/cron_tasks/session_log_cleanup.py`: old session-log cleanup
- `scripts/check_token_age.py`: token age check

### Runbooks
- `docs/runbooks/deterministic-scheduler-host-service.md`
- `docs/runbooks/webhook-receiver-host-service.md`
- `docs/runbooks/mission-control-runtime-preview-runbook.md`
- `docs/runbooks/openai-codex-runtime-account-switch.md`
- `docs/runbooks/morning-meeting-decision-template.md`

## Safety Constraints
- Do not edit `gateway.auth` or `gateway.mode` directly in `openclaw.json` from inside the container
- Do not run `openclaw gateway stop/restart` inside the container
- OpenClaw self-updates are manual-only unless Philippe explicitly asks
- Verify ownership/permissions before writes under `/data/.openclaw/`
- If a bug traces to installed OpenClaw dist files, treat host/package patching as a separate lane from workspace edits

## Environment
- Server/runtime timezone: `Asia/Kuala_Lumpur` (GMT+8)
- User-facing timezone: `Asia/Ho_Chi_Minh` (GMT+7)
- Display operational times in `Asia/Ho_Chi_Minh` unless Philippe asks otherwise

Keep this file lean. Push narrative and retrospectives back into daily memory or project docs.
