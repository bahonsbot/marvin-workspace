# Mission Control Broad Save Point

Date: 2026-03-18
Status: broad continuity save point
Owner: Marvin + Philippe
Scope: preserve all meaningful Mission Control context from the Mar 16 and Mar 17 sessions so tomorrow's work can resume without losing product intent, technical truth, UX direction, preview setup, or unresolved questions.

---

## Why this document exists

This is the continuity package for Mission Control at end-of-night.

Goal:
- prevent tomorrow's work from losing any important context
- capture both implementation truth and product interpretation
- preserve screenshot-driven design intent, review findings, preview-route setup, and current next-step recommendations

This doc should be read before resuming Mission Control work.

---

## Executive summary

Mission Control is now a **real, building, previewable app**, not just a concept or scaffold.

Current state:
- Home, Orchestrator, Sessions, Cron, Logs, and Tasks all exist as real routes backed by meaningful adapter data.
- The app now has a working **preview URL** at `http://preview.motiondisplay.cloud`.
- The broad product direction remains confirmed:
  - **Mission Control must not rebuild OpenClaw from scratch**
  - it should be a **hybrid companion shell** around real OpenClaw/runtime/workspace truth
  - **Orchestrator remains the center of gravity**, even if Home is the landing page
  - UX and functionality come first
  - premium feel is desired, but the current UI is **not premium enough yet**, only clearly moving in the right direction

Main product read after live preview:
- **Sessions** is currently the strongest page emotionally and structurally
- **Tasks** is currently the biggest mismatch with Philippe's intended mental model because it still reads too much like a structured list instead of a real kanban board
- **Orchestrator** looks clean but still carries the unresolved product question of where the real chat surface should live inside Mission Control
- **Home** is promising and neat, but wants richer visual instrumentation later
- **Cron** and **Logs** are now coherent, useful supporting modules

---

## Durable product stance

Mission Control is:
- a hybrid companion shell
- a truthful operator desktop
- a calm dark control environment
- local-first, workspace-aware, runtime-aware
- a UX improvement layer around OpenClaw, not a reinvention of OpenClaw

Mission Control is **not**:
- a clean-sheet OpenClaw replacement
- a fake-native dashboard with invented state
- a flashy sci-fi cockpit
- a generic admin panel
- a mascot-heavy AI squad theater app

Non-negotiables:
1. Do not rebuild OpenClaw from scratch.
2. Truth over polish.
3. Usefulness before beauty.
4. Premium polish is welcome only after the working flows are solid.
5. Orchestrator stays central in importance.

---

## Core architecture decisions already made

### 1. Hybrid companion shell is the correct architecture
Confirmed repeatedly by both product docs and live review.

Meaning:
- use real OpenClaw/runtime/workspace truth
- reuse existing proven control/chat behavior where possible
- avoid fake shadow state
- wrap the existing system in a better shell instead of replacing it

Primary references:
- `projects/_ops/orchestrator-integration-decision-memo-2026-03-16.md`
- `projects/_ops/mission-control-v1-app-scaffold-brief-2026-03-16.md`
- `projects/_ops/mission-control-visual-product-direction-memo-2026-03-17.md`

### 2. Orchestrator should not be clean-sheet rewritten
Current decision:
- do not implement a fake custom chat transport
- do not invent a shadow session system
- preserve or tightly bridge the real control path
- improve framing, context, shell ergonomics, and surrounding navigation first

### 3. Home can be the landing page, but Orchestrator remains the center of gravity
This is durable and important.

Meaning:
- Home can be the calm orientation and command center landing screen
- Orchestrator must still feel one click away and first-class
- Mission Control should not become an analytics dashboard with chat awkwardly bolted on later

### 4. Build order discipline matters
Live lesson from this week:
- real source-of-truth first
- shell second
- polish third
- deeper interaction after that

This discipline prevented a beautiful-but-fake dashboard outcome.

---

## What was already present before tonight

By end of Mar 16 / early Mar 17, Mission Control already had:
- real scaffold under `projects/mission-control/`
- meaningful adapters for runtime/session/cron/tasks/activity/home/orchestrator
- Home, Orchestrator, Agents, Cron, Tasks, Logs routes
- real runtime-backed shell posture
- a successful read-first Orchestrator integration spike
- lint/build passing
- Next.js patched to `^14.2.35`

Durable checkpoint from earlier memory:
- current meaningful modules: Home, Cron, Agents, Logs, Tasks, Orchestrator
- Orchestrator chat embedding remained intentionally unresolved/provisional
- local-first Docker VPS environment remained the operating assumption

---

## Screenshot interpretation and clarified product direction

Philippe shared screenshot references and clarified how they should be interpreted.

### Home screenshot interpretation
Desired feel:
- premium control-center landing page
- hierarchy, ambient polish, calm spacing
- desktop-like orientation layer
- not a cold raw dashboard

Explicitly desired Home ambient layer:
- current time
- weather
- quote of the day

Important constraint:
- these are secondary
- they should support atmosphere/orientation, not dominate the page

### Orchestrator screenshot interpretation
Desired feel:
- chat-first shell
- context around the conversation
- not a rebuilt chat system
- not a mock conversation panel pretending to be finished

### Tasks screenshot interpretation
Desired feel:
- cleaner operator-grade kanban framing
- recognizable board structure
- real card/column mental model
- not a debug-style structured list

### Agents screenshot interpretation
Desired feel:
- highly scannable live session/agent visibility
- active vs quiet vs other states easy to read
- useful, not theatrical
- not mascot fluff

### Trading / Market Intel screenshot interpretation
These are:
- useful inspiration for later domain modules
- **not** current V1 priority

### Visual style interpretation
Philippe explicitly likes the idea of a restrained **"Apple design labs"** feel once the flows work smoothly.

Interpretation:
- premium but restrained
- thoughtful spacing and hierarchy
- local control-center energy
- not empty gloss
- not wild theatrics

Important correction from Philippe tonight:
- current UI is **not premium enough yet**
- it is simply moving in the right direction

That distinction must be preserved.

Reference:
- `projects/_ops/mission-control-visual-product-direction-memo-2026-03-17.md`

---

## What was implemented during the Mar 17 session

### A. Review of current Home / Orchestrator / Agents pass
Review verdict:
- accepted as real and useful
- major truth: not pretend-dashboard territory anymore
- shell was becoming real, but a few weak spots remained

Review conclusions at that point:
1. improve Orchestrator bridge
2. reduce duplicate adapter work
3. make RightInspector contextual
4. tighten runtime status language

### B. Bounded improvement pass after the review
Implemented and verified:
- Orchestrator bridge became more explicit and more truthful
- runtime-derived control-path logic improved
- loopback/local-only honesty preserved
- RightInspector became route-contextual
- key adapters were request-cached
- runtime state wording improved from fuzzy “Live” to clearer labels like:
  - `adapter-backed`
  - `partial visibility`
  - `unavailable`

### C. Codex CLI issue diagnosed and fixed
Durable finding:
- Codex CLI auth layer was logged into a different OpenAI account than the main OpenClaw runtime Codex profile
- this explained the false-seeming immediate usage-limit error
- fix was to re-auth **Codex CLI only**
- main runtime auth profile was intentionally left untouched

Durable distinction:
- **Codex CLI auth** is separate from **OpenClaw runtime auth**

### D. Reviewer-style shell pass conclusions
High-level review after more implementation:
- Home / Orchestrator / Agents had become more productized
- Cron / Logs / Tasks still felt scaffold/debug-like at that stage
- biggest shell problem then was uneven maturity across modules

This led to the next implementation sequence.

### E. Cron / Logs / Tasks shell-coherence pass
Implemented and verified:
- **Cron** stopped being a raw JSON dump and became a structured jobs + recent-runs surface
- **Logs** became a compact activity feed
- **Tasks** became cleaner and more productized, but not yet sufficiently kanban-like

### F. Orchestrator refinement pass
Implemented and verified:
- hierarchy tightened
- bridge made more actionable
- loopback/local endpoint warnings added
- recent sessions section made faster to scan
- page moved closer to “return here first” territory

### G. Home refinement + Sessions second pass + shell polish
Implemented and verified:
- Home copy became more direct and less design-memo-like
- Sessions page became tighter and more scannable
- sidebar terminology aligned with Sessions naming
- small shell copy consistency pass completed

### H. Shell-consistency polish pass
Implemented and verified:
- terminology mismatches removed
- `Agents` vs `Sessions` labeling aligned across surfaces
- `Cron jobs` vs `Cron` labeling aligned

---

## Current page-by-page reality after live browser preview

### Home
Current status:
- neat, promising, and directionally right
- operational landing page works
- calm structure is good
- still wants more visual instrumentation later

Philippe feedback:
- looks pretty neat
- weather widget could use more visualization
- graphs/charts may make sense later

Interpretation:
- Home is no longer the main problem
- later work should enrich its “living system” feel without overloading it

### Orchestrator
Current status:
- clean and credible
- centrality improved
- bridge logic is more honest and more useful
- still does **not** embed the real chat surface yet

Philippe feedback:
- looks clean
- big button exists, but it is not yet obvious where the actual chat window will live in Mission Control
- wants possibility of giving Orchestrator a face/icon
- data-heavy structure may make more sense once actual chat/state fills in

Interpretation:
- the big unresolved question is now explicit:
  - **where exactly should the real conversation/orchestrator experience live inside Mission Control?**
- this is now a product/architecture decision, not just a polish task

### Tasks
Current status:
- cleaner than before
- no longer raw/debuggy
- but still too list-like

Philippe feedback:
- does not yet feel much like a kanban board
- should stick closer to the existing GitHub Pages kanban mental model and/or screenshot reference
- the Data Integrity block is too prominent / not yet useful enough in its current position and wording

Interpretation:
- **Tasks is the biggest mismatch with intended mental model right now**
- next major UI correction pass should focus here

### Sessions
Current status:
- strongest page right now
- clean, neat, highly legible

Philippe feedback:
- favorite page so far
- asks whether agents/subagents/crons can have a face/icon
- wonders whether layout could evolve beyond rows into more card/grid treatment

Interpretation:
- strong validation of the direction
- next pass should keep the current clarity but add identity/icon language and possibly hybrid card/list layout

### Cron
Current status:
- useful and coherent
- but somewhat adjacent in feel to Sessions

Philippe feedback:
- nice list
- partially feels like a duplicate of Sessions
- likes runner/mixed tags and categorization

Interpretation:
- do not overreact yet
- improve Sessions first, then reassess whether Cron needs stronger differentiation

### Logs
Current status:
- clean enough
- useful supporting page

Philippe feedback:
- looks clean as is
- no real logs to click through yet
- right context bar is a nice touch but needs future real use

Interpretation:
- good enough for current phase
- should remain in “supporting but not urgent” bucket for now

### Right inspector / context bar
Current status:
- now contextual per route
- still somewhat provisional

Interpretation:
- good enough for now
- later should become more data-aware and module-aware

### Bottom-left “Operating posture” block
Current status:
- acts like a globally visible quote/stance element

Philippe feedback:
- uncertain how to feel about it yet
- may not yet justify itself

Interpretation:
- not sacred
- could later become:
  - a more useful shell utility/status block
  - a rotating contextual prompt
  - or a Home-only philosophical/ambient element

---

## Additional feature request from live feedback

Philippe requested a **thin bottom system-status row** similar to the earlier dashboard screenshot.

Desired possible metrics:
- CPU usage
- RAM usage
- Disk usage
- Uptime
- maybe other small operational signals

Interpretation:
- this is a strong feature candidate
- should use **real data only**
- should stay visually restrained
- would improve the “operator control center” feeling significantly

This is worth treating as a planned next-step module-level enhancement, not as a throwaway idea.

---

## Current preview setup (important)

### Outcome
A proper preview route is now working.

Public preview URL:
- `http://preview.motiondisplay.cloud`

### How it works
Because the app exists in the OpenClaw container environment, not on the host:
- Mission Control is run **inside the container**
- it is bound to `0.0.0.0:3005` inside the container
- nginx runs on the host
- nginx proxies to the **container IP** rather than host loopback

Container information observed tonight:
- container name: `openclaw-ktrt-openclaw-1`
- container IP used for preview: `172.18.0.2`

Winning nginx upstream:
- `proxy_pass http://172.18.0.2:3005;`

### Preview URL verification evidence
Confirmed successful preview response through nginx:
- `HTTP/1.1 200 OK`
- `Server: nginx/1.24.0 (Ubuntu)`
- `X-Powered-By: Next.js`
- content length around `41215`

### Important operational note
Right now the preview depends on the Mission Control app process staying alive inside the container.

That means:
- if the current shell/process dies, preview goes down
- tomorrow, persistent process management may be worth addressing

### Preview setup issues encountered and resolved tonight
1. raw IP/port preview was rough and/or hanging
2. `next start` initially failed because the `.next` build output was incomplete/stale
3. nginx config initially had syntax mistakes and a broken symlink from an accidental wrong subdomain filename
4. host-loopback proxy target failed because the app was not actually running on the host
5. correct solution was to proxy from host nginx to the container IP where the app was actually reachable

### Durable lesson from preview setup
For this environment:
- Mission Control preview is feasible and much cleaner than exposing OpenClaw control UI directly
- but because the app lives inside the container, preview routing must respect the host-vs-container boundary explicitly

---

## Stable serve-path finding

A focused diagnosis was done on why `next build` passed while `next start` seemed broken.

Finding:
- the `.next` output had been incomplete/stale at the earlier test moment
- after a clean regeneration, stable production-style serve worked again

Durable takeaway:
- `npm run build` can be used to regenerate a healthy `.next` output if production serve gets into a weird missing-artifacts state

This should be remembered if preview serving appears broken again later.

---

## Current implementation strengths

1. **Truthful hybrid posture is being preserved**
   - no fake transport
   - no fake live state
   - no dashboard-owned shadow truth layer

2. **Shell coherence is much stronger now**
   - terminology alignment improved
   - Cron/Logs/Tasks no longer feel like pure dumps
   - Orchestrator and Sessions now feel more intentionally shaped

3. **Previewability exists now**
   - real browser review is possible through `preview.motiondisplay.cloud`

4. **Sessions page has strong product energy**
   - strong candidate for identity refinement next

---

## Current implementation weaknesses / biggest gaps

1. **Tasks is still not sufficiently kanban-native**
   - too list-like
   - data-integrity/truth block too dominant relative to the board

2. **Orchestrator still lacks the final answer to chat placement**
   - bridge exists
   - framing exists
   - actual embedded conversation location remains unresolved

3. **Home still needs richer visual instrumentation later**
   - weather widget is currently too plain
   - could benefit from modest living-system visualization

4. **Operating posture block may not yet justify its place**
   - currently more atmospheric than operational

5. **No persistent preview process yet**
   - preview relies on a live running app process in container

---

## Strongly recommended next sequence

This sequence was proposed and accepted directionally before the night ended.

### 1. Tasks kanban correction pass
Primary goal:
- make Tasks feel like a true board first
- move truth/integrity explanation into a secondary supporting role

Likely work:
- stronger kanban column layout
- better board visual hierarchy
- closer alignment with GitHub Pages board / screenshot mental model
- demote or redesign Data Integrity block

### 2. Sessions identity + layout evolution
Primary goal:
- preserve the strong current page
- add icon/identity language for agent/session types
- possibly move toward hybrid card + list layout

Likely work:
- faces/icons for main agent, subagents, cron/system sessions
- stronger active-card treatment
- anomaly visibility improvements

### 3. Bottom system-status strip
Primary goal:
- add the thin operational system strip Philippe requested

Metrics candidates:
- CPU
- RAM
- Disk
- Uptime
- maybe app/runtime health

Rule:
- real data only

### 4. Orchestrator product decision pass
Primary goal:
- answer where the real chat surface/orchestrator experience should actually live inside Mission Control

This should be treated as a deliberate product/architecture decision, not a casual polish pass.

---

## Things tomorrow-me must not forget

1. Philippe explicitly corrected the phrase “premium enough.”
   - Correct durable framing:
     - current UI is **promising and on the right track**
     - current UI is **not premium enough yet**

2. The live preview route exists now and should be used for future review:
   - `http://preview.motiondisplay.cloud`

3. The preview currently depends on a live container-side Mission Control process on port `3005`.

4. The Orchestrator is still not the actual in-page chat experience.
   - This is now an open product question, not an accidental omission.

5. Tasks needs the next major correction more than any other module.

6. Sessions is Philippe’s favorite page so far.
   - Do not accidentally flatten or overcomplicate what currently works there.

7. Bottom system-status strip is a real feature request, not idle musing.

8. The bottom-left Operating posture block is not yet proven valuable.

---

## Suggested resume checklist for tomorrow

Before coding:
1. open `http://preview.motiondisplay.cloud`
2. click through Home / Orchestrator / Tasks / Sessions / Cron / Logs
3. re-read this save point and the visual direction memo
4. confirm the preview app process is still alive; if not, restart it inside the container
5. start from **Tasks kanban correction pass**

If preview is down tomorrow, re-establish with:
```bash
# inside container
cd /data/.openclaw/workspace/projects/mission-control
npm run build
npm run start -- --hostname 0.0.0.0 --port 3005
```

And keep nginx pointed at:
- `172.18.0.2:3005`

---

## Key reference files

Core direction and planning:
- `projects/_ops/mission-control-visual-product-direction-memo-2026-03-17.md`
- `projects/_ops/mission-control-next-implementation-brief-2026-03-17.md`
- `projects/_ops/mission-control-v1-app-scaffold-brief-2026-03-16.md`
- `projects/_ops/orchestrator-integration-decision-memo-2026-03-16.md`
- `projects/_ops/mission-control-product-brief-2026-03-16.md`
- `projects/_ops/mission-control-v1-architecture-spec-2026-03-16.md`
- `projects/_ops/mission-control-v1-data-contract-spec-2026-03-16.md`
- `projects/_ops/mission-control-v1-technical-integration-plan-2026-03-16.md`

Runtime / implementation:
- `projects/mission-control/`

Daily memory references:
- `memory/2026-03-16.md`
- `memory/2026-03-17.md`

---

## Final end-of-night statement

Mission Control is no longer at the “planning only” stage.
It is now:
- real
- previewable
- directionally strong
- still imperfect
- and carrying a much clearer product shape than it did yesterday

Tomorrow’s work should not start by re-deciding the whole project.
It should start from the truths above and push the next highest-leverage correction:

**make Tasks feel like the board Philippe expects, then deepen Sessions identity, then add the bottom system-status strip, then tackle the larger Orchestrator chat-placement question deliberately.**
