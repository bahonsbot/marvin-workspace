# Mission Control Savepoint — 2026-04-15 afternoon

## Snapshot
- **Window:** 2026-04-15, Morning Meeting through early afternoon
- **Surface:** Mission Control preview / General domain
- **Theme of this block:** calm the Chat surface, improve long-task legibility, make Files materially more useful, and trim shell chrome without reopening broad redesign work
- **Operator stance:** Philippe is explicitly happy with the current Mission Control state after this block and wants a proper save before new work
- **Verification posture used throughout:** build → preview restart → live check / Philippe confirmation before moving on

## Key commits in this block
- `90e345a` — `Document Apr 14 Mission Control runtime fixes`
- `7bdd743` — `Tidy Mission Control tool-run history previews`
- `53d8350` — `Polish Mission Control chat controls and activity`
- `5f32540` — `Improve Mission Control long-task status signaling`
- `fc64dce` — `Upgrade Mission Control editor to CodeMirror`
- `d4cffdd` — `Add Mission Control editor find button`
- `1e96204` — `Add Files name search and preview polish`
- `f13f522` — `Constrain Files search results height`
- `719727e` — `Tidy Mission Control shell chrome`

## What changed

### 1. Morning Meeting doc sweep closed the Apr 14 runtime drift
This was not product work, but it matters for continuity.

Applied during Morning Meeting:
- `TOOLS.md` now has a consolidated Apr 14 Mission Control runtime-truth block covering:
  - WS sidecar gateway-target caching
  - shortened hashed autonomous session ids
  - Marvin task default-model alignment (`codex5.4 -> gpt-5.4`)
  - detached autonomous-task startup-validation hardening

Why it matters:
- the runtime behavior was already fixed, but operator truth in the docs was lagging behind
- this prevents future sessions from re-diagnosing already-solved Apr 14 issues as if they were still live

Relevant commit:
- `90e345a`

### 2. Chat history-loaded tool runs stopped dumping giant read/output bodies
Problem Philippe surfaced:
- on morning preview refreshes, some older/hydrated tool runs could show effectively the entire file/output body in the collapsed or lightly expanded card
- classic example: a long `read` result with the whole runbook visible inline, then effectively repeated again under `Result`

Root cause:
- for history-hydrated tool rows, some `read` / `exec` entries could fall back to the full `meta` text when richer args/context were absent
- that made the UI summary path too trusting and too verbose

Fix:
- tightened `projects/mission-control/components/chat/chat-tool-groups.tsx`
- history-loaded `read` / `exec` rows now stay summary-first
- expanded `read` / `exec` details use `ChatFileContentView` instead of dumping large bodies inline by default
- write/edit artifact viewers were left alone

Result:
- refreshed tool history is much calmer
- large read/exec bodies remain accessible, but no longer hijack the transcript visually
- Philippe confirmed the fix immediately after refresh

Relevant commit:
- `7bdd743`

### 3. Chat top rail + activity strip were polished in one bounded batch
Philippe surfaced four related issues:
- model / thinking pills were slightly too narrow for longer labels
- thinking labels were capitalized and should be lowercase
- during `IN PROGRESS`, live activity text could temporarily push the transcript width sideways and create horizontal scroll
- standalone `Runtime phase` cards (`Run started` / `Run finished`) were taking too much transcript space for too little value

Fixes applied:
- widened the model and thinking pills in `MissionControlChatSurface.tsx`
- changed visible thinking labels back to lowercase
- tightened `ChatActivityStrip` overflow behavior so live activity chips cannot widen the transcript lane
- suppressed standalone lifecycle transcript rows where `entry.kind === 'process'` and `entry.stage === 'lifecycle'`

Important nuance:
- this suppression is only for lifecycle runtime-phase blocks
- it does **not** suppress normal system notices, errors, or other non-lifecycle transcript entries

Result:
- calmer top rail
- cleaner live activity behavior
- less transcript junk from `Run started` / `Run finished`
- Philippe approved the batch

Relevant commit:
- `53d8350`

### 4. Long-task visibility moved from vibes to explicit status
Philippe surfaced a real usability problem:
- for longer tasks, silence made it unclear whether Marvin was still working, already done, or silently stalled
- he did not want to babysit the chat to guess whether a long tool run was alive

Decision:
- do **not** reintroduce transcript noise
- add a persistent Mission Control status indicator in the top Chat bar
- also tighten the assistant-side behavioral rule so long tasks get explicit closeout

UI/runtime changes:
- added a compact runtime-status pill just left of `Stop`
- states are calm and legible: `Ready / Working / Finalizing / Attention / Disconnected`
- fixed a narrow runtime truth problem by clearing lingering `activeRunId` values on final/error/send-failure paths in `useRuntimeBridge.ts`

Behavior-rule change:
- `AGENTS.md` now explicitly requires:
  - kickoff for work likely to take more than ~5 minutes
  - one short progress update if still running after ~8–10 minutes
  - a terminal user-facing update within about 30 seconds after tools effectively finish

Why this pairing matters:
- the indicator tells Philippe what state Mission Control thinks the run is in
- the behavioral rule reduces the chance of ending in silent completion limbo even if the UI state is technically correct

Relevant commit:
- `5f32540`

### 5. Files / Memory editor moved from fake CodeMirror to real CodeMirror 6
Before this block:
- `components/editor/CodeMirrorEditor.tsx` was still a styled textarea despite the name
- there was no honest in-editor search

What landed:
- replaced the textarea-based shared editor with a real CM6 editor
- preserved external API: filename, value, readOnly, onChange, onSave
- preserved `Cmd/Ctrl+S`
- enabled built-in search/find with `@codemirror/search`
- added restrained Mission Control-specific theme/highlighting
- added language handling for common file types used in Files and Memory surfaces

Scope note:
- this was deliberately kept as an editor-foundation upgrade, not a Files/Memory page redesign

Result:
- Files and Memory now have a real editor foundation instead of pretending
- built-in search support exists at the editor level

Relevant commit:
- `fc64dce`

### 6. Editor search got an explicit `Find` button because browser Cmd/Ctrl+F is not trustworthy enough
Philippe immediately found the practical problem:
- `Cmd/Ctrl+F` often opened browser find instead of the editor search panel

That was a good catch.

Why it happened:
- browser-level find shortcuts still win too easily when focus is outside the editor
- relying on `Cmd/Ctrl+F` alone makes the feature feel flaky even when CM6 search is actually wired correctly

Fix:
- added a visible `Find` button to the shared editor header
- clicking it focuses the editor and opens the CM6 search panel programmatically
- applies to both Files and Memory editors

Current truthful behavior:
- if focus is already inside the editor, `Cmd/Ctrl+F` should hit CM search
- if focus is elsewhere, the browser may still win
- the button is now the deterministic entry point

Relevant commit:
- `d4cffdd`

### 7. Files page got a real name-only search and better preview flow
Philippe wanted a search on the Files page for **folder/file names only**, not file content.

Decision:
- skip the weak current-directory-only version
- build the useful workspace-wide version within the same allowed Files scope

What landed:
- workspace-wide name-only search on the Files page
- query-param driven, not fake live client search
- capped to 50 results
- file results open preview and jump to `#file-preview`
- directory results open that folder
- `Recent files` reduced from 8 to 3
- file selection now auto-scrolls to the preview section reliably when the preview loads

Why it matters:
- Files can now help locate things by path/name without conflating that with content search
- the page now behaves more like a useful workspace browser and less like a static listing

Relevant commit:
- `1e96204`

### 8. Files search results were then constrained into their own scroll area
After using the new Files search, Philippe liked it but immediately spotted the layout issue:
- long result sets made the entire page very tall

Fix:
- constrained the search-results section into a fixed-height shell with an internal scroller
- behavior now mirrors the more bounded feel of the file browser itself

Result:
- less page sprawl
- preview and lower page sections stay closer

Relevant commit:
- `f13f522`

### 9. Shell chrome cleanup stayed bounded and useful
Two small shell changes landed without reopening bigger shell work:
- collapsed sidebar no longer shows the bottom date at all
- top-right green `P` profile pill was removed as placeholder chrome with no real function
- search icon remains and now sits alone at the far right

Why it matters:
- cleaner collapsed sidebar
- less pretend future-state UI in the top bar

Relevant commit:
- `719727e`

## Current verified state

### Chat
- hydrated/history-loaded `read` / `exec` tool rows now stay summary-first
- large result bodies open through a collapsible viewer instead of flooding inline layout
- model/thinking pills are slightly roomier
- thinking labels display in lowercase
- live activity chips no longer widen the transcript lane during active runs
- standalone lifecycle `Run started` / `Run finished` transcript blocks are suppressed
- top bar now includes a small persistent runtime-status pill just left of `Stop`
- Philippe is happy with the present Chat state and does not want broad reopenings right now

### Files / Memory
- shared editor is now real CodeMirror 6, not textarea theater
- Files + Memory editors support CM6 built-in search
- header `Find` button is the honest deterministic search entry point
- Files page has workspace-wide name-only search with 50-result cap
- `Recent files` cap is 3
- file selection scrolls to preview automatically
- search results live in a bounded scrollable container instead of stretching the page

### Shell
- collapsed sidebar footer is cleaner because the date is hidden in collapsed mode
- placeholder top-bar profile pill is gone

### Runtime / preview verification posture
- each bounded product slice was verified with build + preview restart, not only code edits
- no evidence from this block that the preview/runtime stack regressed
- Philippe explicitly said he is pretty happy with the current Mission Control state after this set of changes

## Durable product / operator lessons reinforced
- history-hydrated tool rows should never default to full raw result bodies in their preview lane; large read/exec output must stay summary-first
- for embedded editors inside a browser app, `Cmd/Ctrl+F` alone is not a sufficient search affordance; provide an explicit UI entry point unless focus capture is guaranteed
- long-task UX should be solved with a calm persistent status + explicit completion signaling, not by stuffing more lifecycle chatter into the transcript
- small shell cleanups are worth doing when they remove obvious placeholder chrome, but they should stay bounded and not spiral into a broader shell rethink

## Open / watch-only items
- Chat-local transcript search was discussed and intentionally deferred for now; Philippe doubts he would use it enough to justify immediate work
- File editor search is now functional, but if the CM6 search panel styling feels visually off later, a small styling pass may still be worthwhile
- The new long-task status pill should be watched during real 10–15 minute runs to confirm the `Working -> Finalizing -> Ready` semantics feel truthful in practice
- Browser `Cmd/Ctrl+F` remains browser-owned when focus is outside the editor; this is expected and now intentionally handled by the explicit `Find` button

## Recommended next step
Do **not** casually reopen broad Mission Control design work.

If/when Mission Control is reopened next, prefer one of these bounded lanes:
1. real-world validation of the long-task status pill on longer runs
2. small editor/search styling follow-up only if the CM6 search panel feels visually out of place
3. a genuinely new surface or capability, not another general polish wander

## Notes for future sessions
- Philippe explicitly asked for a proper save before touching anything else; this file is part of that continuity handoff
- The current Mission Control posture after this block is: calmer, more truthful, more usable, and intentionally not over-expanded
- Treat this as a stable checkpoint, not an invitation to reopen half the app because the paint is still wet elsewhere
