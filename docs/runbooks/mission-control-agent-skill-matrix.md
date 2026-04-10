# Mission Control Agent Skill Matrix

Last updated: 2026-04-09
Owner: Marvin / Philippe
Scope: current agent setup truth for Mission Control seats

## Purpose

This note answers two practical questions:
1. what each agent knows from the start
2. which skills or local skill packs are currently in that agent's arsenal

This is current-state truth, not aspirational future wiring.

## Reading key

- **Activation maturity**
  - `Direct` = real dedicated runtime seat
  - `Marvin-routed` = seat-specific mode/routes through Marvin or main runtime
- **Task framing maturity**
  - `Strong` = clear role, outputs, startup behavior, and continuity/workspace posture
  - `Medium` = clear role and startup behavior, but lighter specialist wiring
- **Skill posture**
  - `Explicit skills` = named skills captured in workspace docs
  - `Local skill pack` = uploaded local reference files are the practical source of truth
  - `Global access` = available through Marvin/OpenClaw generally, not seat-specific by default

## Matrix

| Agent | Seat type | Activation maturity | What they know from the start | Current skill arsenal | Notes |
|---|---|---:|---|---|---|
| Marvin | Control | Direct | Control role, orchestration posture, runtime defaults, starter prompt, next-step framing | Global access via OpenClaw workspace skills | Canonical main seat |
| Sudo | Team lead | Marvin-routed | Dev-team lead role, roadmap/delegation posture, expected outputs, lead-route starter, workspace anchor | `coding-agent`, `frontend-skill`, `github` | Strongest team-lead setup |
| Vantage | Team lead | Marvin-routed | Content/SEO lead role, editorial strategy posture, expected outputs, lead-route starter, workspace anchor | `copywriting`, `programmatic-seo`, `seo-audit`, `copy-editing`, `social-content`, `analytics-tracking`, `humanizer` | Editor-in-Chief posture |
| Johan | Specialist | Direct | Sportsbet role, thesis-evidence-risk framing, required continuity-file review, startup questions, expected outputs | Local skill: `skills/sportsbet-advisor/SKILL.md` | Structured continuity now lives in `memory/continuity.md`, `memory/bettor-profile.md`, `.learnings/corrections.md`, and `memory/research/` |
| Milou | Specialist | Direct | Trading role, risk-first posture, required continuity-file review, startup questions, expected outputs | Local skill: `skills/trading-advisor/SKILL.md` + references; linked skills: `stock-market-pro`, `us-stock-analysis` | Structured continuity now lives in `memory/continuity.md`, `memory/trader-profile.md`, `.learnings/corrections.md`, and `memory/analyses/` |
| Japin | Specialist | Direct | Language-tutor role, direct runtime seat, required continuity-file review, lesson memory contract, expected outputs | Local skill: `skills/language-learning/SKILL.md` | Strongest specialist continuity model |

## Agent-by-agent notes

### Marvin
- Real runtime target: `agent:main:main`
- Starts in control mode
- Uses broad workspace skill access rather than a narrow seat-specific arsenal

### Sudo
- Real posture: lead route, not fake independent runtime
- Should scope, split lanes, and supervise implementation work
- Skills are explicitly documented in `agent-workspaces/dev-team-lead/SKILLS.md`

### Vantage
- Real posture: lead route for content, search, and editorial direction
- Should act more like Editor-in-Chief than direct draft grinder
- Skills are explicitly documented in `agent-workspaces/content-seo-team-lead/SKILLS.md`

### Johan
- Real posture: skeptical sports probability analysis
- Practical source of truth is the workspace-local `skills/sportsbet-advisor/` skill
- Must use:
  - `memory/continuity.md`
  - `memory/bettor-profile.md`
  - `.learnings/corrections.md`
- `memory/research/` is the running history lane for substantial betting-research sessions

### Milou
- Real posture: technical-analysis and risk-first trading guidance
- Practical source of truth is the workspace-local `skills/trading-advisor/` skill
- Must use:
  - `memory/continuity.md`
  - `memory/trader-profile.md`
  - `.learnings/corrections.md`
- `memory/analyses/` is the running history lane for substantial analysis sessions
- Additional workspace-linked market-analysis skills extend that base:
  - `stock-market-pro`
  - `us-stock-analysis`

### Japin
- Real posture: direct specialist runtime with structured lesson continuity
- Must use:
  - `memory/learner-profile.md`
  - `memory/continuity.md`
  - `.learnings/corrections.md`
- Practical skill source is the workspace-local `skills/language-learning/` skill

## Current maturity summary

Strongest setup order right now:
1. Marvin
2. Sudo
3. Vantage
4. Japin
5. Milou / Johan

Why:
- Marvin is the real control seat
- Sudo and Vantage have the cleanest explicit skill manifests
- Japin has the strongest specialist continuity/routing posture
- Milou and Johan are well-defined, but rely more on local skill-pack alignment than fully productized seat-specific skill manifests

## Source files

- `projects/mission-control/lib/agents/definitions.ts`
- `docs/runbooks/mission-control-agents-operating-model.md`
- `agent-workspaces/dev-team-lead/SKILLS.md`
- `agent-workspaces/content-seo-team-lead/SKILLS.md`
- `agent-workspaces/sportsbet-advisor/MEMORY.md`
- `agent-workspaces/trading-advisor/SKILLS.md`
- `agent-workspaces/trading-advisor/WORKSPACE.md`
- `agent-workspaces/language-tutor/MEMORY.md`
- `agent-workspaces/language-tutor/WORKSPACE.md`
- `skills/sportsbet-advisor/SKILL.md`
- `skills/trading-advisor/SKILL.md`
- `skills/language-learning/SKILL.md`
