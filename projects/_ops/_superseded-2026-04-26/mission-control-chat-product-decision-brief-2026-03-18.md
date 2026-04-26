# Mission Control Chat Product Decision Brief

Date: 2026-03-18
Status: proposed direction for approval before implementation
Scope: rename/reframe the current `Orchestrator` page into `Chat`

---

## 1. Decision summary

Mission Control should move from an `Orchestrator`-named page toward a clearer, more future-proof **Chat** product surface.

This page should be:
- the primary conversation surface
- chat-first
- grounded in real OpenClaw control/runtime truth
- designed to support future agent-specific conversations
- more personal than current OpenClaw chat, but not a fake clean-sheet replacement

### Recommendation
Adopt the following v1 product shape:

1. **Page name:** `Chat`
2. **Primary role:** talk to the current active agent
3. **Left rail:** named agent selector / presence strip
4. **Main column:** conversation thread + composer + lightweight action affordances
5. **Right support panel:** active agent/context/runtime summary
6. **Do not** attempt a full custom chat transport or shadow orchestration runtime

---

## 2. Why rename Orchestrator → Chat

`Orchestrator` is accurate internally, but it is not the best product label.

### Problems with `Orchestrator`
- sounds system-internal rather than user-facing
- implies control plumbing more than actual conversation
- becomes awkward once named agents become more personal and selectable

### Why `Chat` is better
- instantly legible
- future-proof if multiple agents become selectable
- still compatible with Marvin as the primary orchestrator behind the scenes
- easier to understand as the main interaction surface

### Decision
Use **Chat** as the product label.
Keep orchestration as an internal/runtime concept, not the main user-facing page name.

---

## 3. Product role of the Chat page

### What Chat should be
- the place where Philippe talks to the currently selected agent
- the main interaction surface for command, discussion, planning, and response
- a chat-native surface with useful metadata and selective controls
- the eventual home for agent-specific conversation entry

### What Chat should not be
- a clean-sheet replacement for OpenClaw transport/auth/runtime
- a generic dashboard panel with a chat box inside it
- a raw terminal/control console with prettier borders
- an overbuilt multi-pane admin UI that buries the actual conversation

---

## 4. Recommended layout

### A. Left rail: agent selector / presence strip
Purpose:
- make the multi-agent system feel personal and navigable
- show who is available / active
- create a clear future path for agent-specific chat

Contents:
- Marvin
- Builder
- Reviewer
- future named agents
- later: possibly selected special-purpose agents if they genuinely behave like actors

Per item:
- avatar / icon
- name
- role
- status dot
- tiny one-line state (`Running`, `Idle`, `Ready`, etc.)

Rules:
- keep the rail lightweight
- no long histories here
- no dumping all cron/system actors into it
- cron/system actors belong elsewhere unless they become real conversational actors

---

### B. Main column: conversation thread
Purpose:
- remain the dominant center of gravity
- preserve the clarity of current OpenClaw chat
- support rich but calm conversation browsing

Contents:
- conversation thread
- composer
- optional action row / buttons
- compact metadata under messages when helpful

Recommended message metadata:
- model used
- agent used
- maybe theme/context if meaningful
- avoid excessive telemetry noise

Rules:
- metadata should support trust, not clutter
- the thread should remain readable first
- avoid making every message look like a diagnostic block

---

### C. Right support panel: active context
Purpose:
- give context without pushing it into the main thread

Good contents:
- active agent card
- current model
- recent tool/runtime hints
- session status summary
- future: current task/objective context

Avoid:
- duplicating the whole Agents page
- showing large raw logs
- overloading with metrics that belong elsewhere

---

## 5. What to borrow from current OpenClaw

### Keep
- chat-first interaction model
- chronological thread
- clear separation between user and assistant messages
- proven command/response flow
- lightweight model/agent metadata under messages

### Improve
- more breathing room
- stronger visual hierarchy
- less utilitarian dashboard feel
- more personal agent identity

---

## 6. What not to copy literally

From current/older OpenClaw chat:
- raw utilitarian control-panel feel
- overly system-admin presentation
- generic conversation identity

From richer dashboard concepts:
- do not overpack with controls around the thread
- do not make the side panels compete with the main conversation
- do not add decorative complexity without clear use

---

## 7. Relationship to the Agents page

### Agents page
Should answer:
- who exists
- who is active
- who is quiet
- what role/model/status each agent has

### Chat page
Should answer:
- who am I talking to now
- what is being discussed/performed
- what contextual runtime support matters to this conversation

### Intended future bridge
- agent card on Agents page can later link to Chat with that agent selected
- manual agent activation can later start from Agents and hand off into Chat

This means the two pages should be complementary, not redundant.

---

## 8. Future hooks to preserve now

The Chat design should leave room for later:

1. **manual agent activation**
2. **agent-specific conversation entry**
3. **switching between named agents**
4. **agent avatars / personal identity language**
5. **context-aware side panels**
6. **possible tool/action affordances per selected agent**

These should be designed for, but not fully implemented all at once.

---

## 9. Suggested v1 implementation approach

### Phase 1: structural rename + layout direction
- rename nav/page from `Orchestrator` to `Chat`
- build the three-part layout:
  - left agent rail
  - main chat surface
  - right context panel
- keep the current real integration honesty intact

### Phase 2: identity and metadata refinement
- improve active agent presentation
- add calm message metadata
- refine visual personality

### Phase 3: later interactive expansion
- agent selection behavior
- agent handoff from Agents page
- richer context / tool actions

---

## 10. Recommendation

**Approve this direction.**

The next implementation pass should be:

1. rename `Orchestrator` → `Chat`
2. implement a v1 Chat layout with:
   - left agent rail
   - main thread
   - right context panel
3. preserve honesty about current runtime/control integration
4. avoid overbuilding the multi-agent interaction model before the layout is right

---

## 11. One-line product definition

> **Chat is the main conversation surface in Mission Control: a calmer, more personal OpenClaw-native chat with room for future agent-specific interaction.**
