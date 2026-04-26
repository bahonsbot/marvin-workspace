# Mission Control V1 Modules Implementation Plan

Date: 2026-03-16
Status: implementation planning
Depends on:
- `projects/_ops/mission-control-product-brief-2026-03-16.md`
- `projects/_ops/mission-control-v1-architecture-spec-2026-03-16.md`

## Purpose

Define the first buildable implementation plan for the V1 core Mission Control modules:
- Home
- Orchestrator
- Cron
- Tasks
- Agents

This document focuses on:
- exact source data
- key UI blocks
- allowed user actions
- reuse vs new build boundaries
- interaction safety level

## General implementation rule

Prefer:
- reuse of current proven OpenClaw behavior where it already works well
- thin integration layers over reinvention
- read-first modules before heavy write flows

Avoid:
- inventing a new source of truth
- rich editing before data sync is trustworthy
- building vanity modules before operator-critical ones

# 1) Home

## Purpose
Home is the default landing page and the high-level operational overview.

## Primary user questions
- What is happening right now?
- Is anything unhealthy or stuck?
- What should I click into next?
- What has run recently?

## Source data
- active sessions summary
- cron jobs summary (due/running/failed/recent)
- recent runner logs from `memory/cron-run-log.jsonl`
- selected recent task/completion info
- gateway/runtime health indicators if available
- optional orientation widgets: local/server time, weather

## V1 UI blocks
1. **Top status strip**
   - system/gateway state
   - active sessions count
   - due/running cron count
   - current date/time
2. **Primary quick-action card**
   - continue Orchestrator chat
   - open Tasks
   - open Cron
3. **Recent activity feed**
   - latest significant actions/runs/completions/errors
4. **Cron snapshot**
   - recent runs, failures, next due items
5. **Agent/session snapshot**
   - active main/cron/subagent/direct sessions
6. **Optional orientation panel**
   - weather
   - quote-of-the-day
   - only if visually calm and lightweight

## Allowed actions (V1)
- navigate to deeper modules
- quick-open current orchestrator
- maybe trigger safe refresh

## Safety level
Read-only, except navigation and harmless refresh.

## Reuse vs new build
- new layout/view
- reuse real session/cron/runtime data sources
- no custom state ownership

# 2) Orchestrator

## Purpose
Primary intervention and conversation surface.

## Primary user questions
- What is the current active conversation with Marvin?
- What context am I in?
- What can I do from here quickly?

## Source data
- main direct gateway chat session
- session metadata/status
- model/session info
- attachments/messages from current active session

## V1 UI blocks
1. **Main chat pane**
2. **Session header**
   - current model
   - runtime/session identifiers (human-friendly)
   - status / last activity
3. **Right-side inspector (optional in v1)**
   - quick links to recent tasks, cron, memory, files
4. **Quick actions row**
   - inspect cron
   - inspect tasks
   - open memory
   - open active sessions

## Allowed actions (V1)
- send message
- receive/display responses
- view session context
- attach files if existing underlying chat supports it safely

## Safety level
Interactive.

## Reuse vs new build
Strongly prefer reuse/integration of existing chat behavior.
Do not rebuild chat transport logic casually if current OpenClaw UI already solves it reliably.

## Main caution
The Orchestrator is too important to treat as a redesign sandbox. Use the new shell to improve framing and flow, not to destabilize the core chat experience.

# 3) Cron

## Purpose
Show scheduled automation clearly and make safe cron intervention easy.

## Primary user questions
- What is scheduled?
- What ran recently?
- What failed?
- Which jobs are runner-backed vs model-backed?
- Can I run this now safely?

## Source data
- OpenClaw cron job list/state
- cron run history
- runner logs (`memory/cron-run-log.jsonl`) for migrated jobs
- saved migration status docs only as explanatory reference, not live source

## V1 UI blocks
1. **Jobs table/cards**
   - job name
   - type (runner-backed / mixed / model-backed)
   - next run
   - last run
   - status
2. **Filters**
   - all / runner-backed / mixed / model-backed / failing
3. **Run history panel**
   - recent runs
   - duration
   - success/failure
4. **Job detail drawer**
   - payload summary
   - timeout
   - model if relevant
   - recent run history
   - runner log links if applicable

## Allowed actions (V1)
- run now
- inspect history/details
- maybe enable/disable only if clearly safe and already supported cleanly

## Safety level
Interactive but bounded.

## Reuse vs new build
- reuse real OpenClaw cron state/history APIs
- add UI classification layer for job type
- avoid inventing a separate cron database

## Important V1 distinction
This page should visually explain the current architecture:
- deterministic jobs moved to runner path
- some jobs remain mixed
- some are intentionally model-backed

# 4) Tasks

## Purpose
Provide a truthful visual task board for execution state.

## Primary user questions
- What’s in backlog?
- What’s in progress?
- What’s done?
- Is the board trustworthy?

## Source data
- `AUTONOMOUS.md`
- `memory/tasks-log.md`
- `projects/autonomous-kanban/public/board.json`

## V1 UI blocks
1. **Board columns**
   - To Do
   - In Progress
   - Done
2. **Task detail panel**
   - full task text
   - proof/unlocks/reason if parseable
   - links to relevant artifacts if known
3. **Sync/truth indicators**
   - last refreshed
   - source files
   - warning if board state may be stale or inconsistent

## Allowed actions (V1)
- browse
- inspect details
- manual refresh/sync trigger

## Safety level
Read-first.

## Reuse vs new build
- reuse the current board generation path
- do not make drag/drop state mutation the headline feature in v1 unless sync correctness is fully proven

## Main caution
A slick but untrustworthy task board is worse than a modest but accurate one.

# 5) Agents

## Purpose
Provide visibility into active agents/sessions and later agent-team operations.

## Primary user questions
- Which sessions are alive?
- Which are active vs idle?
- What model are they using?
- Which type of session is this?

## Source data
- sessions list/history
- subagent status where available
- runtime metadata

## V1 UI blocks
1. **Agent/session grid or list**
   - name/label
   - type (main / cron / subagent / direct)
   - model
   - activity state
   - last active time
2. **Filters**
   - all / main / cron / subagent / direct
3. **Session detail panel**
   - basic metadata
   - recent messages preview if cheap/safe

## Allowed actions (V1)
- inspect
- filter
- open related session/module
- maybe steer/kill later, not required for v1

## Safety level
Mostly read-only.

## Reuse vs new build
- reuse session listing/history sources
- do not make the page about decorative agent cards; center utility

# Suggested implementation order

## Phase 1 — shell + Home + Orchestrator
Reason:
- establishes the identity of the product
- gives immediate daily utility
- keeps Marvin interaction central

## Phase 2 — Cron + Agents
Reason:
- strongest operational visibility wins after Home/Orchestrator
- aligns with recent cron architecture work

## Phase 3 — Tasks
Reason:
- high value, but truthfulness must be protected
- better to integrate after shell and ops primitives are stable

## Phase 4 — Memory / Files / Logs
Reason:
- deepen the environment view after the core flow is proven

# Immediate next spec recommendation

After this plan, the best next document is a **source-of-truth and API/file contract spec** for the same five modules.

That next spec should answer, module by module:
- exactly which files/endpoints feed each block
- refresh behavior
- latency/staleness expectations
- what the UI should do when data is unavailable
