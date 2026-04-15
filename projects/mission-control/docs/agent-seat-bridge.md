# Agent Seat Bridge

## Purpose

Give Marvin a real Mission Control bridge into seat workflows without falling back to spawned subagents.

This bridge is intentionally seat-aware:

- **Sudo** → uses the existing Mission Control orchestration path
- **Vantage** → uses a persistent lead session under the main runtime with explicit Vantage activation/context
- **Specialist seats** (Japin, Johan, Milou, Link) → use persistent seat sessions under the main runtime, with specialist-specific activation and continuity context

## Why this exists

Before this bridge, Marvin could only emulate these seats indirectly or spawn generic subagents.
That missed the point of Mission Control's seat model.

The bridge keeps seat behavior honest:

- no fake hidden runtimes
- no pretending Sudo/Vantage are ordinary subagents
- no pretending standalone specialist agent ids exist when they are not actually registered in OpenClaw today

## Entry points

### CLI script

```bash
cd /data/.openclaw/workspace/projects/mission-control
node scripts/seat-bridge.mjs --list
node scripts/seat-bridge.mjs --seat dev-team --prompt "Review this build brief and decide the smallest honest lane plan."
node scripts/seat-bridge.mjs --seat vantage --prompt "Map the best editorial/SEO path for this topic cluster."
node scripts/seat-bridge.mjs --seat japin --prompt "Help me practice beginner Vietnamese conversation."
```

Useful flags:

- `--source-session-key agent:main:main`
- `--timeout 900`
- `--dry-run`
- `--list`

### Local API route

```http
GET  /api/agents/seat-bridge
POST /api/agents/seat-bridge
```

POST body:

```json
{
  "seat": "dev-team",
  "prompt": "Audit this requirement and decide whether frontend, backend, or QA should run first.",
  "sourceSessionKey": "agent:main:main",
  "timeoutSeconds": 900,
  "dryRun": false
}
```

## Seat behavior

### Sudo

`dev-team` / `sudo`

- writes a real orchestration record into `data/sudo-delegations.json`
- starts `scripts/run-sudo-orchestration.mjs`
- preserves FE/BE/QA delegated child-run behavior

### Vantage

`content-seo-team` / `vantage`

- uses a persistent session key: `agent:main:content-seo-team-lead`
- remains honest that Vantage still routes through the main runtime
- instructs the lead session to review continuity files in `agent-workspaces/content-seo-team-lead/`

### Specialist seats

- `language-tutor` / `japin` → `agent:language-tutor:main`
- `sportsbet-advisor` / `johan` → `agent:sportsbet-advisor:main`
- `trading-advisor` / `milou` → `agent:trading-advisor:main`
- `job-advisor` / `link` → `agent:job-advisor:main`

These seats currently run as persistent specialist-flavored seat sessions under the **main** runtime, not as separate registered OpenClaw agent ids. The bridge injects the seat's own activation/continuity instructions so Marvin can use them truthfully without falling back to spawned subagents.

#### Specialist activation default (do not skip)

All specialist activation prompts should include the shared brief-presence rule:

- one short in-character acknowledgment when enough material is already present
- one short verbal handoff on meaningful completion
- no chatty/theatrical filler

Implementation guardrail:

- in `lib/agents/definitions.ts`, wrap specialist `starterPrompt` strings with `withSpecialistPresenceHandoff(...)`
- in `scripts/seat-bridge.mjs`, wrap specialist `starterPrompt` strings with the same helper

When adding a new specialist seat, use that helper by default unless Philippe explicitly asks for a different interaction behavior.

## Notes

- The bridge is for **Marvin-triggered seat execution**.
- It does **not** force a broader Chat UI redesign.
- Vantage still does not have a Sudo-style orchestration backend yet; the bridge uses the truthful lead-session lane until that exists.
