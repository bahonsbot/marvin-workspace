# Mission Control Chat Phase 1 Execution Spec

Date: 2026-03-28
Status: active execution spec
Owner: Marvin + Philippe
Depends on:
- `projects/_ops/mission-control-chat-implementation-brief-2026-03-28.md`
- `docs/runbooks/mission-control-adaptation-runbook-2026-03-27.md`
- `projects/_ops/mission-control-comprehensive-savepoint-2026-03-27-night.md`

---

## 1. Goal

Ship a **bounded, high-value custom Mission Control chat pass** that meaningfully upgrades the page from a styled concept surface into a more operational, artifact-aware, session-aware chat experience.

This phase should specifically deliver:
- cleaner thread hierarchy
- compressed technical/process noise
- operator-grade chat chrome
- inline artifact rendering
- a credible path toward a real custom chat client over runtime truth

This phase should **not** try to turn Mission Control into full Nerve parity.

---

## 2. Phase-1 success criteria

Phase 1 is successful if the resulting Chat page:

1. is materially easier to scan than the current version
2. compresses process noise into expandable strips
3. supports inline diff/file/chart artifacts in a believable way
4. exposes session/model/effort/context information in useful chat chrome
5. remains honest about runtime/backend boundaries
6. stays visually aligned with FLOATING rather than drifting into generic dark cockpit cloning

---

## 3. The five open questions, now resolved

## 3.1 Data/event path

### Decision
**Do not build phase 1 as a fake static adapter-only redesign.**

Also, **do not block phase 1 on fully cloning Nerve’s backend stack first.**

Instead:
- phase 1 should be built around a **custom Mission Control chat UI surface**
- with a **staged runtime path**
- preserving the ability to move toward a richer Nerve-like event/proxy layer next

### Interpretation
There are really two layers here:

#### Layer A — UI/interaction layer (phase 1 must do this now)
- custom thread layout
- custom process strips
- custom artifacts
- custom chat chrome

#### Layer B — deeper runtime transport layer (phase 1 should prepare for this, but not overbuild it)
- richer live event handling
- possible websocket/proxy bridge
- better session-stream fidelity

### Practical decision
For phase 1:
- build the chat page so it is **architecturally ready** for real event streaming and richer runtime coupling
- but do not force a full Nerve-style backend rewrite before we can improve the page

### Why
If we make the transport layer the first hard dependency, the chat redesign risks becoming an infrastructure project instead of a product improvement.

### Required posture
- use real existing Mission Control/runtime truth where available
- do not fake successful live chat features
- if a feature still uses a provisional or adapter path, label or structure it honestly

---

## 3.2 Session model

### Decision
**Current-session-first.**

Do not turn the Chat page into a full session command center in phase 1.

Instead:
- keep the page primarily centered on the currently active session/agent
- make session identity, status, and control much clearer in-page
- leave richer session-tree control to future adjacent work if needed

### Phase-1 session requirements
The chat page should clearly show:
- active session identity
- agent identity
- current model
- effort/thinking mode
- context pressure
- status (idle/running/thinking etc.) where available

### Why
This preserves focus and avoids dragging the page toward a Nerve-style full fleet interface too early.

---

## 3.3 Files adjacency

### Decision
**Loose but intentional adjacency.**

Phase 1 should not tightly fuse chat and file editing into one giant mixed surface.

Instead:
- support chat-native file artifacts
- support “open in files” or equivalent future-friendly linkage if cheap
- keep the Files page as its own coherent surface

### Why
This gets the main value without reopening the entire file-browser architecture right now.

---

## 3.4 Diff actions

### Decision
**Render-first, optional open-in-files, no apply/reject requirement in phase 1.**

### Phase-1 diff contract
Required:
- diff rendering inside the chat artifact system
- file path shown
- before/after structure
- simple stats if available

Optional if cheap:
- “open in files” affordance

Not required in phase 1:
- apply patch
- reject patch
- merge resolution
- source-control style review workflow

### Why
The major user value is inspectability in-thread, not patch-management completeness.

---

## 3.5 Chart scope

### Decision
**Bounded artifact contract first.**

Phase 1 should support chart-in-chat as a legitimate artifact type, but should not commit to a full custom trading chart platform.

### Phase-1 chart posture
- allow a real chart artifact block in the thread
- make it feel first-class and properly sized
- pair it with explanatory copy
- keep the renderer contract flexible

Possible phase-1 implementations:
1. static-to-light-interactive artifact block
2. a simple embedded widget path
3. a structured chart component container with mocked-but-honest or real sourced data depending on existing infra

What phase 1 should **not** do automatically:
- rebuild TradingView
- promise universal market charting
- force trading-specific complexity into every chat interaction

---

## 4. Product shape for the new Chat page

## 4.1 Core page concept

The new Chat page should become:

**a FLOATING chat workspace with operator controls, compressed process rails, and native response artifacts**

The experience target is:
- calm
- editorial enough to feel premium
- operational enough to feel useful
- less decorative concierge, more real working surface

---

## 4.2 Page anatomy

### A. Top chat chrome
Purpose:
- orient the operator quickly
- expose key controls/state without visual overload

Should include:
- session/agent identity
- model selector or model display
- effort/thinking control/display
- context meter
- stop action
- reset action
- compact runtime/status indicator if available

### B. Main thread
Purpose:
- preserve conversational readability
- support technical visibility without drowning the user

Contains:
- user messages
- assistant messages
- collapsible process rails
- artifact blocks

### C. Composer
Purpose:
- simple, quiet, operational input surface

Should:
- remain restrained
- keep strong affordance
- avoid turning back into a decorative hero section

---

## 4.3 Thread hierarchy rules

Preferred thread rhythm:
1. user prompt
2. compressed process rail(s) if relevant
3. assistant answer / summary
4. supporting artifact(s)

Important:
- the assistant answer should remain the main readable unit
- process rails should support it, not dominate it

---

## 5. New UI primitives to introduce

## 5.1 ProcessRail

A lightweight collapsible row for process visibility.

Variants:
- Thinking
- Tools
- Files
- maybe System / Run State later

Required behavior:
- collapsed by default
- shows label + short summary + optional timing/count
- expands inline
- visually lighter than a card

FLOATING translation:
- warm cream/ivory surface
- subtle forest accent
- minimal chrome
- calm hover/expand motion

---

## 5.2 ToolGroupArtifact

A grouped presentation of multiple tool actions.

Desired behavior:
- “Used 7 tools” or equivalent summary
- expanding reveals the individual actions
- each action can show preview text
- only entries with artifact-worthy output need richer expansion

Borrow conceptually from Nerve:
- `ToolGroupBlock.tsx`
- grouped tool rows rather than raw log spam

---

## 5.3 DiffArtifact

Inline before/after diff block inside chat.

Required:
- file path
- before/after columns or equivalent clear comparison
- readable code/text rendering
- visually contained inside the thread

Borrow conceptually from Nerve:
- `src/features/chat/DiffView.tsx`
- `src/features/chat/edit-blocks.ts`
- `src/features/chat/components/ToolGroupBlock.tsx`

Phase-1 rule:
- support diff rendering
- do not require patch application workflow

---

## 5.4 FileArtifact

Render file content or write output as a first-class thread block.

Use cases:
- newly written file
- extracted content preview
- code/text artifact preview

Borrow conceptually from Nerve:
- `FileContentView.tsx`

---

## 5.5 ChartArtifact

A serious chart container in the thread.

Required:
- larger surface than a message bubble
- clear title/context
- visual pairing with short interpretive text
- honest data/rendering posture

Phase-1 rule:
- real chart container path exists
- full trading/product sophistication can come later

---

## 5.6 ContextMeter

A visible context-usage indicator in top chat chrome.

Desired behavior:
- show percentage
- readable at a glance
- escalates visually when nearing pressure

It should function as:
- operator feedback
- not decorative telemetry

---

## 6. Recommended code-level implementation direction

## 6.1 Main target file
Primary page likely remains centered on:
- `projects/mission-control/components/pages/GeneralChatPage.tsx`

But phase 1 should stop treating that file as a monolithic styled page dump.

### Recommendation
Refactor the page into a small composed system.

---

## 6.2 Suggested component breakdown

Create or move toward components like:

### Chat shell / chrome
- `components/chat/ChatTopBar.tsx`
- `components/chat/ContextMeter.tsx`
- `components/chat/SessionIdentityStrip.tsx`

### Thread
- `components/chat/ChatThread.tsx`
- `components/chat/ChatMessage.tsx`
- `components/chat/AssistantResponseBlock.tsx`
- `components/chat/UserMessageBlock.tsx`

### Process rails
- `components/chat/process/ProcessRail.tsx`
- `components/chat/process/ThinkingRail.tsx`
- `components/chat/process/ToolsRail.tsx`

### Artifacts
- `components/chat/artifacts/ToolGroupArtifact.tsx`
- `components/chat/artifacts/DiffArtifact.tsx`
- `components/chat/artifacts/FileArtifact.tsx`
- `components/chat/artifacts/ChartArtifact.tsx`

### Composer
- `components/chat/ChatComposer.tsx`

### Parsing / mapping helpers
- `lib/chat/thread-model.ts`
- `lib/chat/artifact-detection.ts`
- `lib/chat/process-summary.ts`

The exact names can change, but the decomposition matters.

---

## 6.3 Thread-model approach

Mission Control needs a small internal thread model that can distinguish between:
- user message
- assistant answer
- thinking/process segment
- tool group
- diff artifact
- file artifact
- chart artifact

This should be represented explicitly rather than inferred ad hoc in JSX.

### Recommendation
Introduce a normalized display-model layer that turns current raw/adapted chat/runtime input into a renderable thread sequence.

That gives us:
- cleaner rendering logic
- easier future migration to richer runtime data
- clearer artifact detection

---

## 6.4 Artifact detection approach

Phase 1 should not rely on magical inference everywhere.

### Recommendation
Use explicit detection helpers for:
- edit/diff-style outputs
- file-write outputs
- chart-worthy outputs
- grouped tools

For the diff lane specifically, Nerve should be studied directly as a reference for:
- extracting edit blocks
- routing them into a dedicated diff renderer

---

## 6.5 Nerve files worth studying directly during implementation

For the diff/tool lane:
- `/tmp/openclaw-nerve/src/features/chat/DiffView.tsx`
- `/tmp/openclaw-nerve/src/features/chat/edit-blocks.ts`
- `/tmp/openclaw-nerve/src/features/chat/components/ToolGroupBlock.tsx`
- `/tmp/openclaw-nerve/src/features/chat/FileContentView.tsx`

For general chat architecture ideas:
- `/tmp/openclaw-nerve/src/features/chat/ChatPanel.tsx`
- `/tmp/openclaw-nerve/src/contexts/ChatContext.tsx`
- `/tmp/openclaw-nerve/src/features/chat/operations/streamEventHandler.ts`
- `/tmp/openclaw-nerve/src/hooks/useWebSocket.ts`
- `/tmp/openclaw-nerve/server/lib/ws-proxy.ts`

Important rule:
- borrow patterns, not aesthetics wholesale

---

## 7. Data-flow recommendation for phase 1

## 7.1 Short-term posture

Phase 1 should use the **best currently available real runtime/chat inputs** Mission Control already has access to, but structure the UI so it can accept richer streaming/event inputs later.

### Design rule
The thread model and renderers should not care whether their source data came from:
- current adapters
- a future richer event source
- a Nerve-style proxy path

That is how we avoid throwing the work away later.

---

## 7.2 Future-proofing requirement

All new chat UI primitives should be written so that later they can consume richer runtime events such as:
- lifecycle start/end
- tool start/result
- chat delta/final
- session-level status changes

without forcing another redesign.

---

## 8. Interaction rules

## 8.1 Process rails
- collapsed by default
- not every minor event becomes its own giant block
- grouping is preferred when it improves scanability

## 8.2 Artifacts
- should appear inline where they support the answer
- should be full enough to be useful
- should not feel like detached attachments

## 8.3 Assistant answers
- should still read like answers first
- not be swallowed by artifacts or process UI

## 8.4 Controls
- top controls should feel operational but restrained
- do not overload the bar with every possible toggle in phase 1

---

## 9. Visual rules for FLOATING translation

## 9.1 Keep
- warm ivory/cream background logic
- editorial restraint
- premium whitespace
- forest accents
- calm glass/elevated surfaces when justified

## 9.2 Add
- more direct operational hierarchy
- lighter-weight process rows
- clearer status/control affordances
- more serious artifact containers

## 9.3 Avoid
- oversized decorative greeting energy
- bubble clutter
- ornamental chrome around utilitarian controls
- drifting toward dark Nerve mimicry

---

## 10. Exact phase-1 implementation order

## Step 1 — restructure the page into components
- reduce `GeneralChatPage.tsx` monolith
- introduce thread/chrome/composer/artifact primitives

## Step 2 — implement top chat chrome
- session identity
- model/effort display
- context meter
- stop/reset affordances

## Step 3 — implement thread model + message hierarchy
- assistant vs user blocks
- support insertion of process rails between messages/results

## Step 4 — implement process rails
- Thinking rail
- Tools rail
- grouped compressed display

## Step 5 — implement diff/file artifact lane
- diff renderer first
- file artifact renderer second
- this is one of the safest, highest-value Nerve-inspired additions

## Step 6 — implement bounded chart artifact lane
- serious chart container
- no giant chart-platform detour

## Step 7 — tune visuals into FLOATING restraint
- spacing
- typography
- control density
- artifact sizing

## Step 8 — verify against real page behavior
- readability
- scanability
- artifact usefulness
- no fake-runtime regression

---

## 11. Explicit non-goals for phase 1

Do **not** let phase 1 turn into:
- full Nerve clone
- full transport/backend rewrite
- voice/chat multimodal platform expansion
- task board rebuild
- agent fleet architecture rewrite
- full Files page rewrite
- giant trading-chart project

---

## 12. Verification checklist

Before calling phase 1 “done,” confirm:

1. Chat thread is easier to scan than current page
2. Thinking/Tools rails reduce clutter rather than adding it
3. Diff artifacts are truly useful inline
4. File artifacts are readable and honest
5. Chart artifact feels native, not bolted on
6. Top chrome makes the page feel more operational
7. FLOATING identity remains intact
8. No fake/live-state claims were introduced

---

## 13. Recommended implementation stance

### Best route
Use a bounded implementation pass by a coding agent or focused build session, with the brief + this execution spec as source of truth.

### Good builder constraints
- keep the current Mission Control architecture intact where possible
- preserve FLOATING direction
- borrow Nerve’s interaction patterns, not its skin
- prioritize readable thread behavior over feature count

---

## 14. Final phase-1 judgment

Phase 1 should be approved as:

**a bounded custom-chat upgrade that introduces process compression, operator chrome, and artifact-native conversation without overcommitting to a full Nerve-scale rebuild.**

That is the right next step because it:
- addresses the strongest newly validated product opportunity
- uses the Nerve audit intelligently
- preserves Mar 27 Mission Control truth
- creates a usable bridge toward deeper runtime-backed chat later
