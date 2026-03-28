# Mission Control Chat Implementation Brief

Date: 2026-03-28
Status: active implementation brief
Owner: Marvin + Philippe
Scope: next-wave redesign/rebuild direction for Mission Control Chat

---

## 1. Why this brief exists

After the Mar 27 Mission Control recalibration, Chat had been considered “good enough for now.”

That judgment should now be updated.

The combination of:
- the Mar 27 Mission Control source-of-truth docs
- a targeted audit of the public `openclaw-nerve` repo
- Philippe’s visual notes from using Nerve
- screenshot review of Nerve’s chat thread and chart-in-chat behavior

makes a stronger next-step case:

**Mission Control Chat should likely become the next primary page target again.**

Not because the current page is broken, but because the Nerve reference clarifies a more valuable direction:
- custom operator-grade chat surface
- compressed process noise
- real inline artifacts
- session-aware control surface
- truthful runtime-backed behavior

This brief captures what to borrow, what not to borrow, and how to build a bounded first implementation pass without turning Mission Control into a Nerve clone.

---

## 2. Current durable Mission Control truth to preserve

The following remains in force and should not be casually broken by a Chat rebuild:

1. **Mission Control is a custom operating shell, not a stock OpenClaw embed.**
2. **Truth over polish.** No fake chat success, fake realtime, or invented system state.
3. **FLOATING remains the active design system.**
4. **Home remains shell/chrome truth.**
5. **Mission Control should not become a generic admin dashboard or dark-mode clone of Nerve.**
6. **Chat should remain honest about runtime/auth/backend boundaries.**
7. **The Mar 27 docs are primary continuity anchors:**
   - `docs/runbooks/mission-control-adaptation-runbook-2026-03-27.md`
   - `projects/_ops/mission-control-comprehensive-savepoint-2026-03-27-night.md`

Important reinterpretation:
- the earlier “Chat is good enough for now” judgment was valid before the Nerve audit
- after the audit and screenshot review, **Chat is now a strong candidate for the next meaningful page pass**

---

## 3. What Nerve actually proves

## 3.1 The key lesson

The biggest useful lesson from Nerve is **not** its dark styling.

It is this product pattern:

**Use the OpenClaw gateway as the engine, but own the operator surface.**

That means:
- custom chat UI
- custom rendering of tool/thinking/event states
- custom artifact rendering
- session-aware controls
- companion server/UI infrastructure around the gateway

This is the right direction for Mission Control too.

---

## 3.2 What the Nerve audit confirmed technically

Targeted repo audit confirmed that Nerve chat is a real custom build, not an embedded stock chat view.

### Confirmed architectural shape
- custom **React** frontend
- custom **Node/Hono** backend
- browser connects to a **server-side WebSocket proxy** (`/ws`)
- proxy then connects to the real OpenClaw gateway
- frontend handles the real gateway event protocol itself
- supporting REST/SSE endpoints provide file/session/workspace/auth functionality

### Confirmed product behavior from code + screenshots
- collapsible tool/thinking containers
- grouped tool-call rendering
- inline diff rendering
- inline file-content rendering
- context meter in chat chrome
- model / effort controls in chat chrome
- rich artifact rendering in-thread
- serious file-browser/editor support

### Important limitation
This audit was targeted, not an exhaustive repo-for-repo teardown.
It is enough to confidently use Nerve as:
- an **interaction model reference**
- a **chat architecture reference**
- an **artifact rendering reference**

It should **not** be treated as automatic proof that every single Nerve feature belongs in Mission Control.

---

## 4. Philippe’s observed Nerve wins that should influence Mission Control

The following observations are now explicit product input.

## 4.1 Clean thread via compressed process rows

Philippe liked that Nerve avoids “log soup” by collapsing technical churn into neat rows such as:
- **Thinking**
- **Tools**

Desired effect:
- the main thread remains readable
- only the meaningful conversational/result layer is prominent
- details are visible on demand, not always expanded

This is now a core requirement for the Mission Control chat direction.

---

## 4.2 Top-of-chat operator controls

Philippe explicitly noticed and liked controls such as:
- Model
- Effort
- Stop
- Reset

These matter because they make the chat feel like an **operating surface**, not a basic messenger thread.

Mission Control should adopt this principle.

---

## 4.3 Inline charts in chat

Philippe was impressed by the ability to surface a serious trading chart directly inside the conversation.

The correct product takeaway is:
- charts should be treated as **first-class thread artifacts**
- not thumbnails
- not dumb attachments
- not forced navigation away from the conversation

This should influence Mission Control’s artifact model, even if the first implementation remains bounded.

---

## 4.4 Inline diffs in chat

Philippe explicitly called out the code diff behavior.

Mission Control should support:
- before/after diff rendering in-thread for edit/write actions
- this should help the user inspect changes without leaving the conversation immediately

Apply/reject buttons are a possible future extension, but not required for phase 1.

---

## 4.5 Context meter

Philippe called out the context bar/percentage.

This should become part of Mission Control chat chrome because it helps the page feel operational and helps explain context pressure during longer sessions.

---

## 4.6 Browser-native file editing

Philippe liked that files can be edited directly in-browser without leaving the product.

This does not mean file-browser parity must be bundled into phase 1 Chat, but it reinforces the broader Mission Control direction:
- chat and files should feel like adjacent parts of one operational surface

---

## 4.7 Task → subagent → review loop

Philippe also called out Nerve’s kanban/task execution model:
- execute task
- spawn worker/subagent
- show run state
- announce completion
- move to review
- approve/reject loop

This is a strong future pattern, especially for Tasks/Agents, but should be treated as **adjacent inspiration**, not phase-1 Chat scope.

---

## 5. What Mission Control Chat should borrow from Nerve

## 5.1 Borrow directly

These should shape the next Mission Control Chat pass.

### A. Clean thread by default
- collapse technical churn
- group tool usage
- expose detail on demand
- do not force the user through verbose process logs to read the useful answer

### B. Chat as an operator console
- top-of-thread controls
- clearly visible runtime/session state
- model/effort visibility
- stop/reset actions
- context meter

### C. Artifact-native responses
- diffs
- file previews
- charts
- tool/event groups

### D. Structured thread hierarchy
Preferred response rhythm:
1. user prompt
2. compressed technical/process rows if needed
3. readable assistant answer
4. supporting artifact block(s)

### E. Session-aware chat
- chat must know which session it belongs to
- runtime/session switching should be explicit and truthful
- chat should not feel detached from the underlying agent/session model

---

## 5.2 Borrow conceptually, but simplify

### A. Custom gateway-facing chat architecture
Mission Control should likely move toward a custom chat client over the real gateway protocol.

### B. Inline artifact rendering
Borrow the concept, but start with a small renderer set.

### C. Workspace adjacency
Let chat feel part of a bigger operational shell, but do not require full Nerve-scale workspace parity immediately.

---

## 5.3 Do not borrow literally

### A. Nerve’s visual system
Do **not** import the dark look literally.
Mission Control must remain FLOATING.

### B. Full Nerve product surface
Do **not** accidentally widen the task into:
- voice stack
- updater system
- multi-agent fleet UI parity
- broad admin-console rebuild
- full settings parity

### C. Product tone
Mission Control should remain:
- calmer
- more editorial in General
- less “dense tactical cockpit” than Nerve by default

---

## 6. Design interpretation for Mission Control Chat

## 6.1 Main design goal

Mission Control Chat should become:

**a FLOATING operator conversation surface with compressed process visibility and real inline artifacts**

Not:
- bubble-heavy fake messenger
- decorative concierge landing page with weak operations
- log console
- literal Nerve reskin

---

## 6.2 Visual translation from Nerve into FLOATING

Nerve’s useful patterns should be translated, not copied.

### Translation rules
- Nerve dark compressed strips → FLOATING light compressed rails/capsules
- dark control chrome → warm ivory/forest control bar
- utilitarian status UI → calmer editorial/operational hybrid
- hard tactical density → softer but still operational hierarchy

---

## 6.3 Specific UI direction

### Thread structure
- spacious readable conversation area
- process rows appear as lightweight collapsible event strips
- assistant reply remains the main readable block
- artifacts sit below/within the response in a deliberate container

### Process strips
Recommended kinds:
- Thinking
- Tools
- Files
- Review / Applied changes (future)

Recommended behavior:
- collapsed by default
- show short label + summary + maybe timing/count
- open inline without blowing up the whole thread visually

### Top chrome
Should likely include:
- session or agent identity
- model
- effort/thinking
- context meter
- stop/reset controls
- maybe a compact connection/runtime state

### Composer
- must stay operational, simple, and quiet
- no over-designed emotional concierge effect
- strong affordance, low clutter

---

## 7. Technical direction for Mission Control Chat

## 7.1 Strategic direction

Mission Control should move toward a **custom chat surface over real runtime interfaces**.

That means the goal is not:
- embedding stock OpenClaw chat more nicely

The goal is:
- using OpenClaw as engine/truth
- owning the thread, event handling, and artifact rendering in Mission Control

---

## 7.2 Minimum architecture implied by the Nerve lesson

A credible first custom-chat slice likely needs:

### Frontend
- custom chat thread renderer
- session-aware state
- streaming delta/final rendering
- collapsible process rows
- artifact renderers
- top-of-chat operator controls

### Backend/support layer
Potentially needed, depending on current Mission Control constraints:
- gateway-facing websocket/proxy path or equivalent event bridge
- session metadata/helper endpoints
- file/artifact helper endpoints if current adapters are insufficient
- auth-safe runtime access path

### Event handling layer
Need a clear model for:
- chat started / delta / final
- tool start / result
- lifecycle start / end
- session filtering
- stall/recovery posture

---

## 7.3 Artifact system: bounded first version

Recommended initial artifact renderers:

1. **Tool Group Renderer**
   - grouped tools with expandable detail

2. **Diff Renderer**
   - before/after text or code changes

3. **File Preview Renderer**
   - render text/code file output cleanly

4. **Chart Renderer (bounded)**
   - support a deliberate chart artifact path
   - likely enough for phase 1 to support a contained chart block contract
   - do not commit phase 1 to a giant custom trading-chart subsystem unless explicitly approved

---

## 8. Recommended phase plan

## Phase 1 — Custom chat operating surface
Goal:
- make Chat materially more useful and cleaner without dragging in the whole Nerve universe

### Phase 1 includes
- custom thread hierarchy
- collapsible Thinking/Tools strips
- top chrome with model/effort/context meter/stop/reset
- session-aware state
- diff artifact renderer
- file artifact renderer
- bounded chart artifact container/path
- cleaner composer

### Phase 1 excludes
- voice/PTT/wake words
- full Nerve-style workspace parity
- apply/reject-on-diff if it complicates the first pass too much
- task-subagent-review loop implementation
- large shell redesign outside Chat

Success criteria:
- chat is cleaner to scan
- process noise is compressed
- artifacts feel native
- controls feel operational
- thread feels more like a cockpit and less like a mockup

---

## Phase 2 — Adjacent operational depth
Possible additions after phase 1 proves itself:
- richer chart behavior
- better session lineage visibility
- smarter artifact actions (open in files, inspect source, maybe apply/reject)
- stronger workspace adjacency
- better subagent visibility

---

## Phase 3 — Cross-page operating patterns
If phase 1 works well, then consider borrowing Nerve-like patterns into:
- Tasks review loop
- Agents run-state visibility
- task execution into worker/subagent flow

---

## 9. Recommended build posture

## 9.1 Do this next

Before implementation starts, produce a tighter execution spec that answers:
1. what current Mission Control chat code is preserved vs replaced
2. what data/event path the custom chat will use
3. whether a proxy/support server layer is required immediately or can be staged
4. what exact artifact contracts will be supported in phase 1
5. how the FLOATING design system translates process strips and top chrome

---

## 9.2 Practical implementation bias

Prefer:
- one bounded meaningful chat pass
- evidence-driven UI behavior
- real event/rendering improvements
- product-tight restraint

Avoid:
- giant speculative architecture
- copying Nerve wholesale
- reopening unrelated Mission Control pages during the Chat pass

---

## 10. Questions to resolve before implementation

These are the useful next questions, not blockers to writing the spec:

1. **Data/event path**
   - Does current Mission Control already have enough runtime access to support a real custom chat stream?
   - Or does it need a Nerve-style proxy/helper layer first?

2. **Chart scope**
   - For phase 1, should chart-in-chat be:
     - a generic artifact container,
     - a trading-specific widget path,
     - or a deferred placeholder contract?

3. **Diff actions**
   - Is phase 1 diff rendering enough,
   - or should open/apply/reject actions be part of the first build?

4. **Session model**
   - Should Chat remain primarily “General Chat page for current agent/session”
   - or become more explicitly session-switching in-page?

5. **Files adjacency**
   - Should the first pass include tighter chat ↔ files coordination,
   - or keep file editing as separate but compatible surface?

---

## 11. Working conclusion

The correct Mission Control interpretation after the Nerve audit is:

**Chat is no longer just “good enough for now.” It is now a strong candidate for the next serious product pass.**

The reason is not visual envy.
The reason is that Nerve clarifies a better operating-surface model:
- compress process noise
- expose real controls
- render real artifacts inline
- keep the gateway as engine/truth
- own the UI experience deliberately

That is the part Mission Control should borrow.
