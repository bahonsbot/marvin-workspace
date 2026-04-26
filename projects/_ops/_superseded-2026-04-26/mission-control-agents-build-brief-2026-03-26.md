# Mission Control — Agents Build Brief

Date: 2026-03-26
Status: active prep brief
Owner: Marvin
Scope: prepare the next Mission Control implementation target after Chat and Tasks reached a good-enough stop point

---

## 1. Why this file exists

Agents is the next likely General-page target.

This brief turns the continuity trail into a build-safe starting point so implementation can begin without re-reading every Mission Control thread from scratch.

Primary anchors:
- `projects/_ops/mission-control-comprehensive-savepoint-2026-03-26-midnight.md`
- `projects/_ops/mission-control-execution-spec-2026-03-25.md`
- `projects/_ops/mission-control-comprehensive-savepoint-2026-03-25.md`
- `projects/_ops/mission-control-comprehensive-savepoint-2026-03-18.md`
- `projects/_ops/mission-control-visual-product-direction-memo-2026-03-17.md`
- current page implementation: `projects/mission-control/components/pages/GeneralAgentsPage.tsx`

---

## 2. Product role of Agents

### Core role
Understand who/what is active.

This page should answer, quickly:
- who is currently in play
- what each core agent is for
- whether each one is active, idle, offline, or unclear
- what quiet/system work is happening in the background

### Desired feel
Agents should feel like:
- a practical **agent squad**
- a live system overview
- readable, calm, elegant, useful

Agents should **not** feel like:
- mascot theater
- an AI character gallery
- a cron-heavy raw session ledger
- a noisy session dump pretending to be productized

---

## 3. Durable rules already established

From prior savepoints and specs:
- named agents first
- quiet/system agents second
- quiet/system agents should be separate and pruned
- practical scanning matters more than theatrics
- model shown on named agents should reflect intended assignment, not incidental current session values
- readability first
- less system-monitor energy, more elegant squad/workspace presentation

Role-based intended assignments:
- Marvin → `codex5.4`
- Builder → `codex`
- Reviewer → `qwenplus`

---

## 4. Current page state

Current file:
- `projects/mission-control/components/pages/GeneralAgentsPage.tsx`

What it already gets right:
- squad framing exists
- Marvin / Builder / Reviewer are surfaced first
- role-based identity is present
- quiet system agents are split out and collapsible
- named-agent model labels use intended routing, which is correct
- page uses the FLOATING component family rather than the old hard-edged look

What still feels transitional:
- top summary strip still reads a bit dashboard/system-metric heavy
- core cards are functional but not yet clearly Stitch/FLOATING art-directed
- current copy is serviceable but still more explanatory/technical than premium/editorial
- quiet system agents still feel closer to session rows than shaped supporting cast
- page is useful, but not yet memorable or fully “Mission Control” in the FLOATING sense

Short version:
- **structurally correct**
- **visually warmed**
- **still needs real art direction**

---

## 5. Design direction for the next pass

### Keep
- named-agent-first roster logic
- Marvin / Builder / Reviewer as part of the top visible layer
- quiet system agents below in a calmer, secondary treatment
- real session/runtime truth
- intended-model labels for named agents

### Expand to the first real roster shape
The page should no longer think only in terms of a 3-card squad.
The first meaningful visible roster should target **6 cards** in a 3x2 layout when enough agent definitions exist.

Preferred first-pass lineup:
1. Marvin
2. Builder
3. Reviewer
4. Sportsbet Advisor
5. Content Creator / Copywriter
6. Travel Planner or Personal Finance Assistant

`SEO Content Writer` should be treated as the most likely next expansion card once the roster grows beyond six.

### Push further
- make the page feel less like a metrics dashboard and more like a calm operator roster
- reduce “system monitor” energy
- increase elegance and whitespace
- sharpen hierarchy so the eye lands on core squad first, then background activity second
- improve visual distinction between:
  - identity
  - role
  - current state
  - recent activity

### Avoid
- anthropomorphic fluff
- overloading cards with too many tiny data points
- adding fake agent controls that don’t really exist yet
- turning quiet agents into an undifferentiated session wall

### Future activation placeholder rule
Future-facing real agents should visually support an **“Activate in chat”** placeholder now, but only as an honest placeholder.
That means:
- show the concept on the agents that are intended to become directly usable by Philippe
- do not pretend the backend flow already exists
- do not automatically apply it to Builder/Reviewer, which remain internal support roles

---

## 6. Recommended implementation target

### Target outcome for the next pass
Transform Agents from a good transitional squad page into a **FLOATING roster/workspace** page that feels:
- premium
- scannable
- truthful
- calm
- obviously part of the same world as the current Chat and refined Tasks pages

### Best first slice
A **presentation-first redesign** of the current page, not a data-contract rewrite.

That means:
1. keep the adapter/session-matching logic mostly intact
2. redesign page composition and card hierarchy
3. expand the visible roster shape to 6 cards
4. tighten copy and labels
5. reshape quiet-system section
6. add honest “Activate in chat” placeholders to the future-facing cards only
7. verify we still preserve truth and role clarity

Why this is the best slice:
- current data shape is good enough
- product rules are already clear
- the gap is mostly composition, hierarchy, and presentation
- avoids reopening backend truth work unless a real design blocker appears

---

## 7. Concrete build plan

### Pass 1 — composition and hierarchy
- give Agents an editorial page heading treatment aligned with Chat/Tasks where appropriate
- reduce the “3 KPI tiles” feeling at the top
- reframe the top section around the squad, not just counts
- make core agent cards the obvious visual focus

### Pass 2 — visible roster cards
For the first six visible cards:
- stronger identity block
- cleaner role line
- clearer current-state badge
- concise “what this agent does” copy
- better handling of current work / last-seen signal
- preserve intended model assignment display
- support placeholder avatars for now
- support future proper names instead of permanently functional labels
- include an honest “Activate in chat” placeholder on the future-facing real agents only

### Pass 3 — quiet system agents section
- keep it secondary and collapsible
- make cards calmer and more compact
- preserve recent chronology/value without feeling like a raw ledger
- prune visual clutter

### Pass 4 — polish and validation
- lint/build
- preview/restart via the established Mission Control flow
- live review against FLOATING quality bar

---

## 8. Suggested copy / positioning direction

### Page-level framing
Do not oversell.
This page is not “Meet your AI dream team.”
It is more like:
- who is in play
- who is available
- what’s humming in the background

### Naming / identity direction
The current functional labels are acceptable as a bridge, but the roster should be designed to support more personal naming over time.
Marvin is already personal. The other future-facing agents should eventually feel more named and less generic.

### Tone
Use warm, direct, slightly editorial language.
Avoid infra-jargon where a human phrase works.

Examples of the right direction:
- “Holding continuity in the main seat.”
- “Building the artifact when the work needs concrete execution.”
- “Pressure-testing the result before it ships.”

Avoid lines that feel too cute, too theatrical, or too robotic.

---

## 9. Tooling/process reminder for implementation

Per Philippe’s reminders:
- explicitly consider using the **Agent Team** if it improves implementation/review quality
- use **Stitch MCP export** as a first-class bridge if Agents-specific design references are available or can be generated

And per previous Mission Control lessons:
- builder result first, reviewer validation second, combined report after
- don’t let provisional/internal scaffolding leak into the user-facing page
- when asked for visual refinement, avoid unapproved structural overreach

---

## 10. Recommended next action

When implementation starts, the best next move is:

> **Run a bounded Agents UI pass focused on composition, hierarchy, and FLOATING art direction while preserving the current truthful squad/session logic.**

Not recommended as the first move:
- rebuilding adapters
- inventing agent activation controls
- turning the page into a session admin console
- adding fake future capabilities

---

## 11. Success criteria

The Agents pass is successful if:
- Marvin / Builder / Reviewer are the obvious primary focus
- the page reads as an elegant squad overview, not a session dump
- quiet system agents stay visible but clearly secondary
- role, state, and recent activity are easy to scan in under a few seconds
- the page feels materially closer to FLOATING quality than the current transitional version
- no fake controls or fake state are introduced

---

## 12. One-paragraph handoff summary

Agents is the next Mission Control target. The current page is structurally correct and already uses the right squad model, but it still feels transitional rather than truly art-directed. The right next pass is not a backend rewrite. It is a bounded FLOATING redesign of composition, hierarchy, and card presentation: named agents first, quiet system agents second, less system-monitor energy, more elegant squad/workspace presentation, with the current truthful runtime/session logic preserved.
