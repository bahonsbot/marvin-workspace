# Mission Control Chat Integration Audit

Date: 2026-03-18
Status: audit complete, implementation strategy recommended

## Goal
Make the new Mission Control `Chat` page become the real usable gateway chat surface **without breaking behavior parity** with the existing OpenClaw gateway chat.

## Non-negotiable constraint
The Mission Control chat must preserve the behavior of the current real gateway chat, including:
- slash commands
- session options
- thinking/working output behavior
- underlying gateway/runtime semantics

Mission Control is a hybrid layer, not a replacement runtime.

## Current state
- The current `app/orchestrator/page.tsx` is a **framing shell**, not a real embedded chat.
- The current adapter (`lib/adapters/orchestrator.ts`) is read-first and intentionally conservative.
- Existing `_ops` docs already lean toward **reuse / bridge**, not custom transport replacement.
- There is no current safe embedded chat module already wired into Mission Control.

## What was checked
- `lib/adapters/orchestrator.ts`
- `lib/adapters/runtime.ts`
- `app/orchestrator/page.tsx`
- `projects/_ops/orchestrator-integration-decision-memo-2026-03-16.md`
- current project grep for iframe/embed/webview/stream/chat-related implementation paths

## Result
There is **not yet** an existing production-ready embedded-chat integration path in Mission Control.

That means we should not pretend the page is already a native replacement for gateway chat.

## Integration options

### Option A — Full custom chat implementation in Mission Control
Rejected for v1.

Why:
- highest behavior drift risk
- likely to break or incompletely replicate `/` commands, session options, and reasoning/working-output behavior
- violates the hybrid-layer principle if done too early

### Option B — Safe embed / bridge of the real existing gateway chat
Recommended direction.

Why:
- preserves behavior parity best
- keeps Mission Control as the framing shell around the real trusted system
- aligns with earlier decision memo and current product constraints

### Option C — Launch-out only (button opens original gateway chat elsewhere)
Useful fallback, but too weak as the main product destination.

Why:
- safe, but does not really make Mission Control Chat a true destination
- acceptable fallback if embed is temporarily blocked

## Recommendation
Adopt a **bridge-first Chat v1**:

1. Mission Control `Chat` remains the product surface.
2. The real gateway chat is reused/embedded/bridged inside it.
3. Mission Control-owned UI surrounds it:
   - left agent rail
   - right context/support panel
4. If a real embed path is blocked, fall back temporarily to a clean launch/hand-off path rather than building a fake custom replacement.

## Practical implementation rule
- Prefer **behavioral parity over cosmetic integration**.
- If a choice must be made between “looks more integrated” and “works exactly like gateway chat”, choose exact behavior.

## Recommended implementation sequence

### Phase 1 — discover real embed/bridge options
Determine whether the gateway dashboard chat can be safely:
- embedded in an iframe or framed route
- proxied through a safe internal route
- surfaced through an existing web endpoint without breaking auth/session behavior

### Phase 2 — choose v1 integration mode
Pick one of:
- embedded chat surface (preferred if safe)
- framed/bridged live route
- launch-out fallback with strong in-page context if true embedding is blocked

### Phase 3 — integrate with current Chat shell
Once the real behavior path is confirmed safe:
- keep current left rail
- keep current right panel
- replace the placeholder center surface with the real chat path

## What not to do next
- do not build a custom synthetic message system
- do not reimplement command parsing
- do not emulate reasoning/working-output behavior manually
- do not claim parity before proving it

## Current best next action
Investigate the actual gateway dashboard/web route and auth behavior to find the safest real embed/bridge path.

## One-line conclusion
> Mission Control Chat should become real by safely reusing the existing gateway chat, not by recreating it.