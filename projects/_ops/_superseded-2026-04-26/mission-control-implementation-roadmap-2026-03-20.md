# Mission Control Implementation Roadmap

Date: 2026-03-20
Status: active roadmap
Owner: Marvin + Philippe
Purpose: capture the current phased plan for Mission Control based on the original product concept, the work already completed, and Philippe's latest prioritization updates.

---

# 1. Current strategic position

Mission Control is no longer a vague concept.
It now has a real working backbone.

## What is already sound

These areas are now strong enough to count as real foundations rather than speculative prototypes:

- **Shell direction**
  - left navigation
  - top status strip
  - center-module composition
  - bottom system strip
- **Home**
  - useful enough for orientation
  - visually good enough for now
  - intentionally *not* the current focus for deeper refinement
- **Chat**
  - Agent Rail direction is good
  - center area is correctly moving toward real chat rather than “UI about chat”
  - embedded-chat architecture is proven locally
  - remote/live embed path is still unresolved and deferred
- **Tasks**
  - materially more truthful
  - no longer feels like decorative kanban theater
- **Agents**
  - renamed correctly from Sessions to Agents
  - stronger squad/identity framing
- **Cron**
  - now operationally clear
  - correctly distinguishes deterministic/runner-backed vs model-backed vs mixed
- **Overall product tone**
  - much closer to an operator shell
  - much less like an AI demo dashboard

## Important prioritization update from Philippe

Philippe explicitly wants **final Home-page refinement deferred** until much later.
Reason:
- the Home page already works and looks good enough for now
- the exact final Home feature set is not yet fully decided
- premature optimization there would risk polishing the wrong version

This overrides any earlier instinct to finalize Home sooner.

Durable rule:
- **Do not treat Home as the next major refinement target.**
- Keep it stable unless something specifically breaks or Philippe asks.

---

# 2. Product principles that remain active

These still govern the roadmap and should not be silently violated.

1. **Truth over polish**
   - no beautiful lies
   - no invented live state
   - no fake module intelligence if the underlying source of truth is weak

2. **Hybrid companion shell around real OpenClaw truth**
   - not a clean-sheet replacement
   - not a detached analytics dashboard
   - not a shadow system inventing its own state

3. **Chat remains central in importance**
   - even if Home is the landing page
   - the product must never become a dashboard with chat awkwardly bolted on

4. **Modular growth**
   - build useful operator modules first
   - domain modules later
   - avoid kitchen-sink v1 sprawl

5. **Thin shell, powerful internals**
   - Mission Control visualizes, coordinates, and frames
   - real behavior comes from real runtime/workspace truth

6. **Operator-first UX**
   - dense but calm
   - dark low-glare palette
   - scanable
   - practical

---

# 3. What still needs to be done

## 3.1 Complete the missing core V1 modules

These were part of the original concept and remain important.

### Memory
Needed:
- browser for `MEMORY.md`
- browser for `memory/YYYY-MM-DD.md`
- visibility into `.learnings/`
- clear separation between durable memory, daily memory, and corrections/errors/requests
- read/search first, editing later only if safe enough

Why it matters:
- continuity is one of Mission Control’s real superpowers
- it strengthens the “truth over polish” principle

### Files
Needed:
- boring, reliable workspace file browser
- preview/read mode
- maybe minimal light editing later

Why it matters:
- expands Mission Control from dashboard into actual operating shell

### Search
Needed:
- global search across memory, docs, workspace files
- keyword search first
- semantic search later if cleanly grounded

Why it matters:
- likely one of the most valuable tabs once it exists

### Settings / Status
Needed:
- careful scoped views into runtime/model/integration state
- safe visibility first
- avoid a broad dangerous config editor

Why it matters:
- completes the shell without turning it into a control-plane hazard

---

## 3.2 Finish Chat properly

Chat is now directionally right, but not fully finished.

### Already true
- Agent Rail is good
- embedded-reuse architecture has been proven locally
- stock Control UI was made embeddable for trusted origins by local patch
- the page no longer wastes the center with explanatory cards

### Still missing
- real usable remote/live embed path
- trusted external Control UI URL/origin strategy
- deployment-aware embed selection rather than loopback-only behavior
- later: interactive agent switching

### Durable current posture
- do **not** rush the live/external embed routing now
- defer that until closer to actual live usage
- keep the architecture decision, postpone the external-origin resolution

---

## 3.3 Deepen operational maturity of the existing modules

### Agents
Later improvements:
- richer real session inspection
- better “what is this agent doing” detail
- maybe later steer/spawn/inspect controls if safe

### Cron
Later improvements:
- richer job drill-down
- stronger run-history detail
- easier transition from overview to evidence/logs

### Logs / Activity
Needed:
- stronger operational-feed feeling
- clearer pulse of the system
- better surfacing of meaningful events rather than just raw event presence

### Tasks
Not a priority right now, but later could deepen with:
- clearer intervention surfaces
- maybe review/approval flows if they connect to real truth

---

## 3.4 Improve visual cohesion later

Needed eventually:
- more consistent spacing rhythm
- stronger card hierarchy
- more unified token usage
- more premium final polish

But:
- this should happen after more core utility exists
- avoid turning polish into procrastination

---

## 3.5 Add domain modules only after the core shell is complete

Not current priority:
- Creative
- Learning
- Trading
- Market Intel

These should be fed by real project/runtime artifacts, not invented dashboard state.

---

# 4. Recommended phased approach

## Phase A — Complete the true V1 core shell

### Goal
Finish the missing core modules so Mission Control matches the original concept as a genuinely useful operator shell.

### Scope
- Memory
- Files
- Search
- basic Settings / Status

### Why this phase comes next
Because the current product is already strong in:
- Home
- Chat structure
- Tasks
- Agents
- Cron

What it lacks now are the remaining operator surfaces that make the whole shell feel complete and durable.

### Exit criteria
Mission Control includes all core V1 modules in meaningful first form:
- Home
- Chat
- Tasks
- Agents
- Cron
- Memory
- Files
- Logs / Activity
- Search
- basic Settings / Status

---

## Phase B — Finish Chat for real

### Goal
Resolve the remaining gap between the now-correct Chat page structure and the final real embedded/live chat experience.

### Scope
- trusted external/embed URL strategy
- real remote/live embed path
- final embedded Control UI behavior or best fallback
- preserve Agent Rail
- later prep for interactive agent switching

### Why this is not immediate next
Because the remaining work now crosses into:
- routing/origin decisions
- deployment reality
- control-plane/security implications

That is better handled when the intended live shape is clearer.

### Exit criteria
Chat is:
- usable
- embedded as intended
- not dependent on separate-window fallback for the main experience
- still grounded in one real transport/auth boundary

---

## Phase C — Operational depth pass

### Goal
Make the existing modules more operationally mature.

### Scope
- deeper Agents inspection
- richer Cron drill-down
- stronger Logs / Activity
- improved cross-module “what matters now” visibility
- maybe carefully selected safe manual actions

### Exit criteria
Mission Control feels like a true control room, not just a good shell.

---

## Phase D — Domain modules

### Goal
Expand the shell into Philippe-specific mission surfaces once the general operator core is stable.

### Likely order
1. Trading
2. Market Intel
3. Learning
4. Creative

### Why this order
Trading and Market Intel already have stronger existing operational truth and artifacts to bind to.

---

## Phase E — Home finalization

### Goal
Only once the rest of the shell is mature, revisit Home and decide what its final role and feature mix should be.

### Important prioritization note
This phase is intentionally **late**.

Why:
- Home already works and looks good enough
- Philippe is not yet fully certain what the final Home feature set should be
- refining it too early risks polishing the wrong target

### Possible later focus areas
- better “what needs attention now” logic
- stronger summary composition across modules
- more deliberate ambient/orientation widgets
- final placement of any quick actions

### Durable rule
Do not burn cycles “perfecting” Home before the rest of the shell earns that work.

---

# 5. Recommended near-term execution order

If asked “what next?”, this is the current best answer.

## Immediate recommended order
1. **Memory**
2. **Files**
3. **Search**
4. **basic Settings / Status**
5. **finish Chat embed/live path**
6. **deepen Logs / Activity / Agents / Cron**
7. **domain modules**
8. **final Home page refinement**

---

# 6. What not to do next

Avoid these for now:
- over-polishing Home
- reopening settled shell debates without cause
- drifting into giant visual-polish-only passes
- pushing domain modules before the core shell is complete
- solving the live Chat embed routing problem prematurely if it requires broad origin/routing decisions before the deployment shape is ready

---

# 7. Current practical recommendation

If work resumes fresh, the strongest next module is:

## Memory

Why:
- high leverage
- strongly aligned with OpenClaw’s real strengths
- supports continuity and trust
- expands Mission Control meaningfully without requiring risky control-plane changes

Then:
- Files
- Search

That sequence gives the shell depth without derailing into deployment-sensitive questions too early.

---

# 8. One-paragraph roadmap summary

Mission Control now has a real working backbone: shell, Home, Chat structure, Tasks, Agents, and Cron are all directionally strong enough to count as real product foundations. The next priority is not more Home refinement, but completing the missing core operator modules — especially Memory, then Files and Search — so the shell becomes genuinely complete and useful. After that, the right move is to finish Chat properly in a deployment-aware way, deepen operational maturity in Logs/Agents/Cron, expand into domain modules, and only then circle back to final Home-page refinement once Philippe is clearer on exactly what Home should ultimately be.
