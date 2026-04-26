# Mission Control Next Implementation Brief

Date: 2026-03-17
Status: execution brief
Owner: Marvin + Philippe
Purpose: define the next concrete Mission Control build slice without reopening already-settled architecture/product questions.

## Why this brief exists

The broader Mission Control planning stack already exists:
- product brief
- architecture spec
- modules implementation plan
- data contract spec
- technical integration plan
- orchestrator decision memo
- app scaffold brief
- visual + product direction memo

This document is intentionally narrower.
It answers:
- what exactly should be built next
- what should not be touched yet
- what success looks like for this implementation round

## Scope of this implementation slice

### Primary scope
1. **Home UI pass**
2. **Orchestrator shell pass**

### Secondary scope (only if primary scope lands cleanly)
3. **Agents UI pass**

Do not expand beyond this unless Philippe explicitly asks.

## Non-negotiable constraints

1. **Do not rebuild OpenClaw chat/control from scratch**
   - Mission Control remains a hybrid companion shell.
   - No custom chat transport.
   - No shadow session system.

2. **Truth over polish**
   - Use real adapters and source-of-truth paths.
   - Do not fake live state.
   - If data is partial, surface that honestly.

3. **Usefulness before beauty**
   - Premium polish is welcome.
   - But this slice succeeds only if workflow clarity improves.

4. **No new dashboard-owned persistent state**
   - No new DB.
   - No separate task/session/cache ownership layer beyond acceptable temporary UI state.

5. **Stay within the current shell**
   - Left nav, top status strip, center workspace, right inspector pattern remains the baseline.

## Module 1: Home UI pass

## Goal
Turn Home from a structured JSON/debug surface into a real operational landing page.

## Home must answer
- What is happening now?
- Is anything unhealthy, stuck, or due soon?
- What should I open next?
- How do I resume momentum quickly?

## Required inputs
Use existing real data sources via current adapters:
- sessions summary
- cron summary
- recent activity
- runtime/gateway health where available

## Required UI elements

### 1. Top status strip improvements
Show concise operational awareness, such as:
- gateway/runtime health
- active sessions count
- due/running cron count
- current time

### 2. Primary operational cards/sections
At minimum:
- **Continue work / resume orchestration**
- **System snapshot**
- **Recent activity**
- **Quick links** into Orchestrator / Cron / Tasks / Agents

### 3. Attention/priority shaping
Home should not present all information with equal weight.
Surface:
- failures
n- degraded state
- due/running pressure
- recent important actions
before lower-priority information.

### 4. Ambient orientation panel
Include a restrained desktop-like orientation block with:
- current time
- weather placeholder or integration-ready area
- quote-of-the-day placeholder or lightweight local stub

Important:
- this is secondary
- it should support the vibe and orientation
- it must not dominate the operational area

## Home must not do yet
- no giant analytics dashboard
- no fake charts for decoration
- no domain-specific trading widgets yet
- no config editor behavior

## Home success criteria
This pass is successful if Philippe can open Home and immediately understand:
- current system condition
- whether anything needs attention
- what work is active
- where to click next

## Module 2: Orchestrator shell pass

## Goal
Turn the Orchestrator route from a read-first status spike into a more intentional chat-centered control surface, without rewriting chat behavior.

## Core rule
Mission Control must **wrap, frame, or bridge** the real OpenClaw control path.
It must not invent a new one.

## Required outcome
The Orchestrator page should feel like a meaningful module in Mission Control, even if the actual conversation transport remains external/reused.

## Required UI elements

### 1. Chat-centered layout
The page should visually prioritize:
- current session / conversation focus
- not just metadata dumps

### 2. Session framing
Show useful context such as:
- current/default model
- gateway reachability
- active direct session count
- recent session context
- integration mode/status

### 3. Honest integration state
Retain explicit honesty that:
- Mission Control is not implementing its own chat transport
- current path is hybrid-reuse
- chat embedding/bridge status is real, not implied

### 4. Actionable next-step affordance
The page should include a clear “continue/open real orchestrator” action or bridge placeholder, depending on what is safely possible in this pass.

If full safe bridge behavior is not yet implemented, the page must still make the intended action path obvious.

### 5. Context support
Add/support a context area for relevant links into:
- Tasks
- Cron
- Agents
- Memory later

## Orchestrator must not do yet
- no custom message transport
- no fake send box that does not really work
- no shadow chat history
- no pretending the real control path has been replaced

## Orchestrator success criteria
This pass is successful if:
- the route feels central, not provisional in a bad way
- it clearly frames the real orchestrator/control path
- it improves orientation and actionability around chat
- it remains honest about what is and is not implemented

## Module 3: Agents UI pass (secondary, only if scope allows)

## Goal
Turn Agents from a raw session dump into a scannable live-system session view.

## Required UI elements
- visible active vs idle vs unknown states
- session label/type/model/last active
- clearer grouping or list hierarchy
- counts/status chips where useful

## Must preserve
- operational utility over flashy agent theater
- real session truth only

## Agents success criteria
The page should let Philippe quickly understand:
- what sessions are alive
- which ones are active
- what models they use
- what type of session each one is

## Suggested implementation order inside this slice

1. Refactor shared presentation primitives if needed
   - cards
   - status badges
   - section blocks
   - layout helpers

2. Complete Home pass

3. Complete Orchestrator pass

4. Only then consider Agents pass

## Review checklist

### Home
- [ ] no raw JSON dump as the primary experience
- [ ] active sessions and cron state are clearly visible
- [ ] recent activity is shaped into readable UI
- [ ] quick actions/navigation are obvious
- [ ] ambient panel exists but stays secondary
- [ ] page feels operational, not decorative

### Orchestrator
- [ ] route still respects hybrid-reuse posture
- [ ] no custom chat transport introduced
- [ ] page clearly communicates current integration state
- [ ] user has a clear path to continue/open the real orchestrator flow
- [ ] surrounding context improves the page instead of cluttering it

### Agents (if included)
- [ ] active/idle state is easy to scan
- [ ] model/type/last-active are visible
- [ ] page reads like a live ops surface, not a raw dump

## Definition of done for this slice

This slice is done when:
- Home feels like a real landing page
- Orchestrator feels intentionally framed and useful
- no architecture boundary was broken
- the app still builds and lint passes
- the UI is more usable, not just more decorated

## Explicitly out of scope for this slice
- Cron UI pass
- Tasks refinement
- Memory module buildout
- Files module buildout
- Search module
- Settings module
- Trading / Market Intel module work
- OpenClaw config mutations
- risky control-plane changes

## Recommended next slice after this one

Once this slice lands cleanly, the next likely build brief should cover:
1. Cron UI pass
2. Tasks refinement
3. Memory / Files / Search sequencing review
