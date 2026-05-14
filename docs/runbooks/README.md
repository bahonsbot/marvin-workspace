# Runbooks Index

Quick index for the workspace runbooks folder so common references are easier to find during autonomous passes, operator work, and incident/debug flows.

## Autonomy and Operations
- [Workspace Home-Improvement Pass](./workspace-home-improvement-pass.md)
- [Morning Meeting Decision Template](./morning-meeting-decision-template.md)
- [Memory System Health](./memory-system-health.md)
- [Deterministic Scheduler Host Service](./deterministic-scheduler-host-service.md)
- [Webhook Receiver Host Service](./webhook-receiver-host-service.md)
- [QMD CPU Mode VPS Notes](./qmd-cpu-mode-vps-notes.md)
- [OpenClaw Clean Reset Command Checklist (2026-04-17)](./openclaw-clean-reset-command-checklist-2026-04-17.md)
- [OpenClaw Clean Reset Preserve Workspace (2026-04-17)](./openclaw-clean-reset-preserve-workspace-2026-04-17.md)
- [OpenClaw Context-Maintenance Chat Spam Hotfix](./openclaw-context-maintenance-chat-spam-hotfix.md)

## Mission Control
- [Mission Control Agent Skill Matrix](./mission-control-agent-skill-matrix.md)
- [Mission Control Agents Operating Model](./mission-control-agents-operating-model.md)
- [Mission Control Agents Page Design Handoff](./mission-control-agents-page-design-handoff.md)
- [Mission Control Runtime Preview Runbook](./mission-control-runtime-preview-runbook.md)

## Network, Egress, and Placement
- [Egress Enforcement Deferred Until Trading Isolation](./egress-enforcement-deferred-until-trading-isolation.md)
- [Egress Filtering Phase 1 Plan](./egress-filtering-phase1-plan.md)
- [Egress Inventory Memo (2026-03-19)](./egress-inventory-memo-2026-03-19.md)
- [Network Endpoint Observations](./network-endpoint-observations.md)
- [Job Placement Decision Table](./job-placement-decision-table.md)

## Trading Path
- [Trading Path Container Cutover](./trading-path-container-cutover.md)
- [Trading Path Container Implementation Proposal](./trading-path-container-implementation-proposal.md)
- [Trading Path Container Isolation Plan](./trading-path-container-isolation-plan.md)

## External Integration Notes
- [Stitch MCP Codex GitHub Pages Workflow](./stitch-mcp-codex-github-pages-workflow.md)

## Quick Maintenance Picks
- Home-improvement pass: start with `workspace-home-improvement-pass.md` and run `python3 scripts/autonomy_gate.py improve` before doing any bounded workspace cleanup.
- Memory checks: use `memory-system-health.md` when a workspace pass touches memory hygiene, note structure, or recall reliability.
- Index validation: run `python3 scripts/check_runbook_index.py` after runbook additions, removals, or renames to catch link drift quickly.

## Usage Notes
- Prefer the most specific runbook first.
- Keep new runbooks linked here when they are durable references rather than one-off notes.
- If a runbook becomes obsolete, remove it from this index in the same change that replaces or archives it.
