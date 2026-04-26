# Mission Control V1 Data Contract Spec

Date: 2026-03-16
Status: implementation-facing contract draft
Depends on:
- `projects/_ops/mission-control-product-brief-2026-03-16.md`
- `projects/_ops/mission-control-v1-architecture-spec-2026-03-16.md`
- `projects/_ops/mission-control-v1-modules-implementation-plan-2026-03-16.md`

## Purpose

Define the source-of-truth, refresh behavior, and failure/staleness handling for the V1 core modules:
- Home
- Orchestrator
- Cron
- Tasks
- Agents

This document is meant to reduce implementation ambiguity.

## Global rules

### 1. Source-of-truth rule
Mission Control should prefer direct reads from real runtime/workspace sources.
Do not create a separate dashboard-owned persistent source of truth in V1.

### 2. Freshness rule
Every module should be explicit about whether its data is:
- live
- periodically refreshed
- manually refreshed
- derived/generated

### 3. Error-state rule
If a module cannot load a source, show:
- what source failed
- whether the rest of the module is still usable
- when data was last successfully refreshed if known

### 4. Partial-data rule
Do not blank whole pages if one block fails.
Render partial module content when possible.

### 5. Safety rule
Read actions are preferred by default.
Write/control actions must be explicit, bounded, and individually justified.

# 1) Home

## Home purpose
Provide a truthful, high-level snapshot of current operations.

## Home blocks and contracts

### A. Top status strip

#### Data sources
- session summary source (same source used by Agents)
- cron summary source (same source used by Cron)
- local/server time source
- optional gateway/runtime health source if accessible

#### Freshness
- refresh every 15-30 seconds for active status counts
- time updates client-side every second/minute as appropriate

#### On failure
- if session or cron count fails, show "unavailable" badge for that segment only
- do not block the rest of Home

### B. Quick actions / continue working card

#### Data sources
- current main/direct session identity
- recent activity source for "resume current work" hints

#### Freshness
- refresh with Home page load and on manual refresh

#### On failure
- fall back to static actions like "Open Orchestrator" / "Open Cron"

### C. Recent activity feed

#### Data sources
Primary:
- `memory/cron-run-log.jsonl`
Secondary later if useful:
- session activity summaries
- selected task/completion events

#### Freshness
- poll every 15-30 seconds
- support manual refresh

#### On failure
- show last successfully loaded activity snapshot if available
- otherwise show empty-state with failure notice

### D. Cron snapshot

#### Data sources
- same cron source used by Cron module

#### Freshness
- poll every 30-60 seconds

#### On failure
- show "cron snapshot unavailable" but keep page usable

### E. Agent/session snapshot

#### Data sources
- same session source used by Agents module

#### Freshness
- poll every 15-30 seconds

#### On failure
- show degraded state, keep other blocks alive

### F. Optional weather/date/quote panel

#### Data sources
- date/time: local/client + server timezone context
- weather: external API or lightweight fetch source if added later
- quote: static rotation or local curated source preferred

#### Freshness
- date/time: live or interval update
- weather: no more than every 30-60 minutes
- quote: daily refresh is sufficient

#### On failure
- these widgets should fail silently or collapse gracefully
- they must never degrade core operational visibility

# 2) Orchestrator

## Orchestrator purpose
Primary conversation/intervention surface.

## Orchestrator blocks and contracts

### A. Main chat pane

#### Data sources
- current OpenClaw main/direct chat session
- session message history from the current active source

#### Freshness
- live/streaming if supported by the existing orchestrator behavior
- otherwise near-real-time polling/updates

#### On failure
- show chat unavailable state with retry
- do not impersonate stale chat as live

### B. Session header

#### Data sources
- session metadata
- current model info
- last activity timestamp

#### Freshness
- update on session change and periodically while open

#### On failure
- chat may still render if header metadata fails

### C. Right inspector / contextual drawer

#### Data sources
- lightweight links/summaries from Tasks / Cron / Memory / Agents

#### Freshness
- on demand or lazy-loaded

#### On failure
- inspector can fail independently without breaking chat

## Reuse note
The orchestrator should reuse existing proven direct-chat behavior where possible.
The new shell should wrap/integrate, not casually replace chat transport semantics.

# 3) Cron

## Cron purpose
Show scheduled jobs, history, and safe interventions.

## Cron blocks and contracts

### A. Jobs list / cards

#### Data sources
Primary:
- OpenClaw cron job list/state

Derived classification:
- runner-backed if payload message contains `scripts/cron_runner.py`
- mixed if intentionally not runner-backed but still partly deterministic
- model-backed if intentionally reasoning-heavy

#### Freshness
- refresh every 30-60 seconds
- manual refresh available

#### On failure
- show module-level warning, keep cached/last-known data if available

### B. Run history

#### Data sources
- OpenClaw cron run history
- runner logs for deterministic jobs as supplemental detail

#### Freshness
- refresh on demand and after Run Now actions

#### On failure
- history panel may show unavailable independently of jobs list

### C. Job detail drawer

#### Data sources
- selected cron job metadata
- last runs
- runner detail log path if applicable

#### Freshness
- fetch on open

#### On failure
- drawer-level error only

### D. Run Now action

#### Action source
- OpenClaw cron run action

#### Post-action behavior
- optimistic "queued/running" indication only if confirmed
- then poll the relevant job/runs state briefly

#### Safety
- only trigger existing jobs
- no payload editing implied by Run Now

## Special display fields for V1
Cron page should explicitly show:
- runner-backed / mixed / model-backed
- next run time
- last run status
- timeout
- model (if relevant)

# 4) Tasks

## Tasks purpose
Provide a truthful visual execution board.

## Tasks blocks and contracts

### A. Board columns

#### Data sources
Primary display source:
- `projects/autonomous-kanban/public/board.json`

Truth/corroboration sources:
- `AUTONOMOUS.md`
- `memory/tasks-log.md`

#### Freshness
- refresh on page load
- manual refresh button
- optional timed refresh every 30-60 seconds if cheap

#### On failure
- if `board.json` fails, show degraded warning and offer source-file fallback view later

### B. Sync truth indicator

#### Data sources
- `board.json.updatedAt`
- maybe compare against mtime/hash of `AUTONOMOUS.md` and `memory/tasks-log.md`

#### Freshness
- evaluate on every board refresh

#### On failure
- display "sync status unknown"

### C. Task detail panel

#### Data sources
- selected task from `board.json`
- optionally resolve additional context from planner files

#### Freshness
- lazy-load detail on click if deeper parsing is needed

## V1 caution
Do not make drag-and-drop writes a core V1 contract unless the board sync path is proven fully trustworthy.
Read-first is preferred.

# 5) Agents

## Agents purpose
Show active sessions/agents in a useful operator view.

## Agents blocks and contracts

### A. Sessions list/grid

#### Data sources
- sessions list source
- optional session history source for details

#### Freshness
- poll every 15-30 seconds

#### On failure
- show sessions unavailable state without collapsing shell

### B. Filters

#### Data sources
- session type/model fields from sessions list source

#### Freshness
- same as list/grid

### C. Session detail panel

#### Data sources
- session metadata
- recent messages preview if cheap/safe

#### Freshness
- fetch on panel open

#### On failure
- detail failure should not kill the main list

## Required V1 fields
Each visible session card/list row should ideally include:
- human-friendly label/name
- session type (main / cron / subagent / direct)
- model
- activity/active state
- last active timestamp

# Shared data-source candidates

## Runtime/session sources
Candidate sources for implementation:
- OpenClaw session list/history interfaces
- existing runtime/session endpoints if available

## Cron sources
Candidate sources for implementation:
- OpenClaw cron list/runs interfaces

## Workspace/file sources
Candidate sources for implementation:
- direct filesystem reads under `/data/.openclaw/workspace`

## Runner sources
Candidate sources for implementation:
- `memory/cron-run-log.jsonl`
- `memory/cron-run-details/`
- `memory/locks/` only if needed for diagnostics, not as a primary UI source

# Data freshness summary by module

- Home: mixed, mostly periodic refresh
- Orchestrator: live or near-live
- Cron: periodic + on-demand
- Tasks: manual/periodic refresh of generated board state
- Agents: periodic refresh

# Error and empty-state guidance

## General
Every module should distinguish between:
- loading
- empty
- stale
- failed
- partial

## Examples
- empty sessions list is not the same as session-source failure
- no due cron jobs is not the same as cron query failure
- empty recent activity is not the same as runner-log read failure

# Recommended next step

The next useful spec after this one is a **technical integration plan** that decides:
- exact app structure
- exact backend/read routes or adapters
- whether Orchestrator reuses the current OpenClaw UI module directly or wraps the same underlying interfaces with a cleaner shell
