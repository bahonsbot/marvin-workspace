# Feature Requests Log

Capabilities the user wanted but don't exist.

## Format
## [FEAT-YYYYMMDD-HHMM]

**Requested:** [what user wanted]
**Why needed:** [user's context]
**Complexity:** simple | medium | complex

**Priority:** low | medium | high
**Status:** pending | implemented | wont_fix

---

## Recent Requests

## [FEAT-20260323-1741]

**Requested:** when Mission Control later gets a Trading module, add a visible real-time research widget that shows interesting current candidates based on recent signals
**Why needed:** Philippe wants the market-intel / equity-bot / futures-bot truth layers stabilized first, then surfaced in Mission Control as a useful research-first panel instead of speculative UI. The widget should help surface strongest recent candidates, pair-trade research ideas, and value-chain signals without digging through raw files.
**Complexity:** medium

**Priority:** medium
**Status:** pending / later


## [FEAT-20260318-1813]

**Requested:** when individual agents later get their own identity/soul, add a way to activate them manually from the Agents page and talk to them in a chat surface, likely via the Chat/Orchestrator page with a link from the agent card when active.
**Why needed:** supports a more personal multi-agent system where agents are not just status cards but callable collaborators.
**Complexity:** medium-high

**Priority:** medium
**Status:** pending / later


## [FEAT-20260318-1456]

**Requested:** add an explicit Mission Control operational note/runbook covering host vs container boundary, which commands must run inside the container, preview routing truth, stale `.next` / build-output recovery, and how to verify the app process serving `preview.motiondisplay.cloud`
**Why needed:** today’s Mission Control verification exposed recurring confusion around host-side paths versus the container-visible runtime/build path
**Complexity:** simple

**Priority:** medium
**Status:** implemented


## [FEAT-20260318-0039]

**Requested:** add a thin bottom Mission Control status strip with real machine/runtime metrics like CPU, RAM, Disk, and Uptime
**Why needed:** Philippe wants the shell to feel more like a real operator desktop/control center, similar to the dashboard screenshot reference, without resorting to fake decorative widgets
**Complexity:** medium

**Priority:** high
**Status:** implemented

## [FEAT-20260317-1737]

**Requested:** preserve a detailed record of the OpenClaw HTTPS/proxy attempt, rollback steps, and unresolved constraints so future retries can resume from known facts instead of rediscovering the same path
**Why needed:** the Hostinger/OpenClaw/Mission Control update-prep path involved several real-world findings, a live rollback, and two intentionally skipped optional cleanup steps that should not be forgotten later
**Complexity:** simple

**Priority:** medium
**Status:** implemented — appended the full attempt/rollback summary to `memory/2026-03-17.md`

## [FEAT-20260317-1246]

**Requested:** Send a `🚀 Task started` notification to Telegram `goal-tasks` when `autonomous-task-executor` begins work and lands in `in_progress`
**Why needed:** Silence on `in_progress` made it unclear whether the executor actually ran, even when daily tasks were generated and execution had started
**Complexity:** simple

**Priority:** medium
**Status:** implemented — updated the `autonomous-task-executor` cron instructions so `in_progress` now sends `🚀 Task started` with task title and output path


## [FEAT-20260312-0400]

**Requested:** Session-end reminder to log to .learnings/
**Why needed:** Detection triggers existed in AGENTS.md but were never used — lessons captured in daily notes but not in structured .learnings/ system
**Complexity:** simple

**Priority:** high
**Status:** implemented — added reminder to AGENTS.md