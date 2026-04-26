# Mission Control Product Brief

Date: 2026-03-16
Status: draft v1 product brief
Owner: Marvin + Philippe

## Core concept

Build a hybrid Mission Control for OpenClaw that combines:
- a **Home** landing page for overview and orientation
- a first-class **Orchestrator** module for direct chat/intervention
- modular operational views for tasks, agents, cron, memory, files, logs, and later domain-specific dashboards

This is not meant to replace OpenClaw as the source of truth.
It is meant to make OpenClaw easier, clearer, and more effective to operate.

## Product philosophy

Mission Control should be:
- a thin window into real OpenClaw/workspace/runtime state
- modular instead of monolithic
- operator-first, not vanity-first
- truthful even when data is partial or delayed
- premium and calm in UX, not merely functional

## Design principles

1. **Truth over polish**
   - no fake dashboard state
   - no shadow system pretending to own reality
2. **Home first, Orchestrator always prominent**
   - default landing page can be Home
   - direct chat/intervention must stay one click away
3. **Shared state before fancy panels**
   - define source-of-truth per module before UI elaboration
4. **Modular shell**
   - one coherent app shell, distinct operating modes
5. **Operator UX with premium polish**
   - dark, calm, intentional, Apple-lab-quality visual finish is welcome if clarity stays intact
6. **Ambient context is allowed when helpful**
   - date/time/weather and possibly quote-of-the-day are acceptable if they improve orientation or atmosphere without cluttering the screen

## Recommended product structure

### Primary modules (v1 target)
- Home
- Orchestrator
- Tasks
- Agents
- Cron
- Memory
- Files
- Logs / Activity

### Secondary / optional early modules
- Search
- light Settings / Model status views

### Later-stage domain modules
- Creative
- Learning
- Trading
- Market Intel

## Shell layout recommendation

- Left sidebar: main navigation
- Top status strip: passive operational awareness
- Main content pane: active module
- Optional right inspector drawer: contextual details, session info, or quick actions

## V1 module intent

### Home
Purpose:
- at-a-glance system orientation
- recent activity
- health state
- quick entry into current work

Suggested blocks:
- system health summary
- active sessions / agent activity
- recent cron runs / alerts
- recent completions
- quick links into Orchestrator / Tasks / Cron
- optional lightweight orientation widget area (date/time/weather, maybe quote)

### Orchestrator
Purpose:
- direct chat with Marvin / current main session
- intervention and fast control

Suggested blocks:
- primary chat area
- current session metadata
- model / status badges
- context drawer for related tasks / cron / memory

### Tasks
Purpose:
- visual execution pipeline grounded in real workspace state

Suggested blocks:
- backlog / in progress / done board
- task detail drawer
- last updated / source-of-truth indicators

### Agents
Purpose:
- visibility into active sessions/agents, not vanity cards

Suggested blocks:
- active/idle/blocked status
- session type
- model
- last activity
- spawn/steer later if safe

### Cron
Purpose:
- see schedules, runs, statuses, manual triggers, history

Suggested blocks:
- jobs table/cards
- last/next run
- run history
- migrated runner jobs vs model-backed jobs
- failure state / details links

### Memory
Purpose:
- browse and inspect daily memory, durable memory, and learnings

Suggested blocks:
- MEMORY.md
- memory/YYYY-MM-DD.md
- .learnings/
- search and quick open

### Files
Purpose:
- browse the workspace without leaving Mission Control

### Logs / Activity
Purpose:
- recent operational events, runner logs, cron results, errors, completions

## Source-of-truth map (initial)

- Sessions / active runtime: OpenClaw session/runtime state
- Cron jobs / runs: OpenClaw cron state
- Tasks: workspace planner + task logs (`AUTONOMOUS.md`, `memory/tasks-log.md`, generated board state)
- Memory: `MEMORY.md`, `memory/YYYY-MM-DD.md`, `.learnings/`, later `life/`
- Files: workspace filesystem
- Activity / deterministic cron runs: `memory/cron-run-log.jsonl`, cron history, selected task logs

## Build approach recommendation

## Recommended: hybrid

Use a broader Mission Control shell while treating the current direct chat/control experience as a first-class module inside it.

Why this is preferred:
- avoids overstuffing the existing gateway chat UI
- avoids creating a detached analytics dashboard with chat as an afterthought
- preserves what already works
- creates room for operational modules and later domain dashboards

## Explicit non-goals for v1

- Office 3D
- giant analytics suite
- public/share features
- collaboration/multi-user system
- huge smart-suggestions engine
- giant config editor

These may become relevant later, but should not lead v1.

## Recommended implementation phases

### Phase 1 — product foundation
- confirm v1 module boundaries
- define source-of-truth per module
- define interaction boundaries (read-only vs interactive)
- choose technical starting point (likely a companion app/hybrid shell)

### Phase 2 — shell + core experience
- app shell
- Home
- Orchestrator
- top status strip

### Phase 3 — operational modules
- Cron
- Tasks
- Agents

### Phase 4 — environment visibility
- Memory
- Files
- Logs / Activity

### Phase 5 — domain modules
- Trading
- Market Intel
- Creative
- Learning

## Current recommendation

Proceed next with a more detailed product/specification pass, especially:
- module-by-module source-of-truth mapping
- v1 interaction model
- companion-vs-adaptation technical approach
- design language / UI system direction
