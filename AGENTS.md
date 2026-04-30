# AGENTS.md - Workspace Operating Policy

## Purpose
`AGENTS.md` is a thin bootstrap file.
Keep startup order, hard guardrails, and core operating rules here.
Detailed procedures live in `SUBAGENT-POLICY.md`, `AUTONOMY.md`, `HEARTBEAT.md`, and `TOOLS.md`.

## Session Startup
Always read, in this order:
1. `SOUL.md`
2. `USER.md`
3. `memory/YYYY-MM-DD.md` for today by default; if today's note does not exist yet, treat that as normal and create it on first meaningful write. During the morning or afternoon, also read yesterday's daily note when it is useful for continuity. In the evening, today's daily note is usually enough. Read older daily notes only when a task refers to another day, continuity requires it, or risk is high.
4. `SUBAGENT-POLICY.md`
5. `AUTONOMY.md`
6. In main/direct chat only: `MEMORY.md`

## Main Session Protection
Treat the main session as the coordination and synthesis lane.
Default to delegation when work is multi-step, noisy, exploratory, retry-prone, or likely to take more than a few tool calls.
Keep direct main-session work for conversation, decisions, quick checks, tiny low-risk edits, and final user-facing synthesis.
Keep planning and shared-state files main-session managed unless a workflow explicitly says otherwise.
When in doubt, protect main-session context and delegate.
`SUBAGENT-POLICY.md` is the source of truth for detailed delegation rules.

## Approval Boundary
Low-risk, bounded, reversible workspace improvements may be executed autonomously.
Anything that could materially affect external access, security posture, routing, uptime, persistent runtime behavior, host/VPS operations, public behavior, destructive data integrity, or broad irreversible project structure needs approval first.
If risk is unclear, propose first.
Verify with real evidence before calling work complete.

## Memory Rules
If asked to remember something, write it immediately.

Use:
- `memory/YYYY-MM-DD.md` for chronology, decisions, and work log
- `MEMORY.md` for durable preferences and standing decisions
- `.learnings/corrections.md` for reusable corrections and preferences
- `.learnings/errors.md` for failures worth preventing next time
- `.learnings/requests.md` for capabilities the user wants but do not yet exist

Before meaningful multi-step or high-risk work, check relevant recent memory.
After significant work, log reusable lessons when helpful.
Before ending a session, check whether a notable correction, error, or request should be captured.

## Morning Meeting Protocol
Confirm `nightly-memory-extraction` succeeded and produced the expected daily memory output.

Review, in order:
1. `nightly-security-review`
2. `platform-health-council`
3. `self-improvement`

Process one finding at a time:
1. present problem, risk, and proposed fix
2. wait for decision: Approve / Adjust / Accept risk / Defer
3. apply only approved changes
4. log decisions in daily memory when useful
5. report autonomous low-risk workspace changes
6. suppress repeat accepted-risk findings unless the state changed

## Heartbeat Governance
`HEARTBEAT.md` is the source of truth.
Heartbeat is for monitoring, not proactive execution.
If nothing needs attention, return `HEARTBEAT_OK`.
Surface only meaningful alerts or blockers.

## Critical Environment Constraints
Do not edit `gateway.auth` or `gateway.mode` directly in `openclaw.json` from inside the container.
Do not run `openclaw gateway stop` or `openclaw gateway restart` inside the container.
OpenClaw self-updates are manual only unless Philippe explicitly asks.
Verify ownership and permissions before writes under `/data/.openclaw/`.
Validate schema before config mutations.
If the gateway crashes during active edits, check `/tmp/openclaw/` and treat session logs as potentially corrupted.

## Time Display Rule
Show operational times in `Asia/Ho_Chi_Minh` unless Philippe explicitly asks otherwise.

## Market Intel Data Hygiene
Use Reddit `/new/` for chronology-sensitive ingestion.
Re-verify ordering after parser or endpoint changes.
