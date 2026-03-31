# Mission Control Comprehensive Savepoint — 2026-03-31 Lunch

## Purpose
This is the canonical Mission Control handoff for the late morning / early afternoon Mar 31 session.

Read this before resuming Mission Control work.
It is intended to be detailed enough that a future agent can continue without Philippe having to re-explain:
- what changed today
- what was discovered technically
- what was fixed versus only proposed
- what product understanding shifted
- what remains open
- what to avoid reopening casually
- what the next safe build moves are

This savepoint should be read after:
1. `projects/_ops/mission-control-comprehensive-savepoint-2026-03-31-midnight.md`
2. `docs/runbooks/mission-control-runtime-preview-runbook.md`
3. this file

---

## Executive Summary
This session was a **Chat/runtime continuity and operator UX surgery session**.

The work was not about inventing new page concepts. It was about making Mission Control feel more like a truthful operator workspace and less like a page that keeps forgetting itself or making Philippe fight the UI.

Three main categories of work happened:

### 1. Chat transport/runtime stability
A real Mission Control Chat bug was found and fixed:
- after sending a message, Philippe could get effectively kicked out of the live session
- the message still sent, but the composer became unusable
- a hard reload was required to reconnect and see the response

That bug turned out to be real React/hook dependency churn in the runtime bridge, not user imagination and not just browser weirdness.

It was fixed in two stages:
- send-triggered websocket teardown fixed
- follow-up summary-refresh session flicker reduced/fixed

### 2. Chat state persistence across navigation
Mission Control Chat had a structural UX weakness:
- leaving Chat for another page like Tasks and returning caused visible transcript rehydration from scratch
- the page felt like it forgot its own live state

This was traced to architecture, not network cache:
- Chat runtime lived at page level
- route navigation unmounted the page
- coming back rebuilt the bridge + transcript state

That was fixed by introducing a shell-level Mission Control runtime provider, much closer to the Nerve pattern.

### 3. Operator-facing chat UX refinements
Several smaller but meaningful UX improvements landed:
- long tool-bubble rows now wrap onto multiple lines instead of truncating to one line with ellipsis
- assistant file-path mentions now link into the Files page
- the file-path linker was tuned after first deployment so it only links real file-looking workspace paths, not generic code-ish tokens like `read` or CSS property names

The overall result is that Chat now feels materially more stable, more continuous, and more useful as a real operator interface.

---

## Product State At End Of Session

### Chat
Chat is now in a much healthier state than it was at the start of the day.

Current posture:
- major send/disconnect bug appears fixed
- brief reconnect flicker appears fixed or materially reduced
- transcript/runtime state now survives route navigation between pages
- tool rows are more readable
- file-path references can route directly into Files

Chat should be considered **good enough for now again**, but with clear boundaries:
- do not casually redesign it
- only reopen for real workflow gains or real bugs

### Files integration
Files-page integration from chat is now real in a first-pass form.
This is an important UX milestone because it starts tying Mission Control pages together as one environment rather than separate islands.

### Mission Control architecture direction
Today strengthened an important conceptual direction:
- **shell-level persistent providers for long-lived operator state are the right architecture**
- page-local state for core runtime surfaces causes too much churn and forgetfulness

This is not just about Chat. It is likely a reusable lesson for other Mission Control runtime-heavy surfaces later.

---

## Part I — Morning / Context / Governance

## 1. Model transition and guidance
At the start of the active user session, Philippe explicitly asked that `model-guidance/gpt-5.4.md` be read because the session had switched to GPT-5.4.
That was done before continuing.

This matters for handoff because the session was intentionally operating under the model-specific guidance for `openai-codex/gpt-5.4`.

---

## 2. Morning Meeting outcome
Morning Meeting was intentionally light and clean.
Approved dispositions were logged into `memory/2026-03-31.md`.

Accepted risks / no-action items:
- Mission Control upload route still lacks MIME/file-type allowlist, but current auth/isolation posture makes this accepted risk for now
- `pre-market-brief` can emit a warn/noise condition from missing VIX data despite successful delivery; accepted risk
- `skill-level-check` cron metadata uses a cosmetic field-name variance (`nextRunMs` vs `nextRunAtMs`); accepted risk
- self-improvement report found no active issues

No Morning Meeting fix work was required.

---

## Part II — Chat Disconnect / Reconnect Investigation

## 3. Reported problem
Philippe reported a highly annoying Mission Control Chat bug:
- after every sent message, he would effectively get kicked out of the chat
- the message still sent
- the UI would then not allow further messages
- he had to hard reload the page and wait for reconnect to read the answer

This was not framed as a vague feeling issue. It was a concrete usability failure.

---

## 4. First audit: root cause was in `useRuntimeBridge.ts`

### Observed architecture
Mission Control Chat send/runtime behavior flows through:
- `projects/mission-control/hooks/useRuntimeBridge.ts`
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`
- runtime bridge APIs + WS sidecar + preview-origin proxy

The audit found a very plausible and high-confidence root cause in the React hook dependency graph.

### Root cause 1 — send-triggered bridge teardown
In `useRuntimeBridge.ts`, the `load()` callback depended on `messages.length`.

That created this chain:
1. user sends a message
2. `messages` grows
3. `messages.length` changes
4. `load()` callback identity changes
5. `handleGatewayEvent()` identity changes because it depends on `load()`
6. websocket `useEffect(...)` dependency changes
7. effect tears down and rebuilds the websocket bridge

That matched the user symptom almost perfectly:
- send works
- session gets knocked out
- reconnect/hard reload needed

### Fix applied
The hydration decision was moved inside `setMessages((current) => ...)`, so it no longer needed closure dependence on `messages.length`.
Then `messages.length` was removed from the `load()` dependency list.

### Commit
- `d417389` — `mission-control: stop bridge reconnect on every sent message`

### Verification
- lint passed on the hook file
- code path strongly matched symptom
- later user testing showed major improvement

---

## 5. Deployment model clarification
Before testing was considered complete, Philippe asked whether a browser refresh was enough for the fix to be live.

This required a cross-check against:
- Mission Control savepoints
- `docs/runbooks/mission-control-runtime-preview-runbook.md`
- live process state

### Finding
Mission Control preview was running as a production-style preview stack, not a hot-reloading dev server.
Observed process shape included:
- Next server
- preview-origin proxy
- runtime-bridge WS sidecar

Therefore:
- browser refresh alone was **not** enough to guarantee the patch was live
- proper preview build + restart was required for certainty

### Standard deployment path used
- `./scripts/preview-build.sh`
- `./scripts/preview-restart.sh`

This is the correct current operational path for preview deployment.

---

## 6. Follow-up symptom: `SESSION CONNECTED -> SESSION WAITING -> SESSION CONNECTED`
After the first fix and restart, the catastrophic failure looked gone, but Philippe still noticed a smaller wobble:
- `SESSION CONNECTED`
- `SESSION WAITING`
- `SESSION CONNECTED`

Importantly:
- the composer remained usable
- this was not the original full failure anymore

### Interpretation
This suggested a smaller bridge/session churn issue still existed:
- probably not a full send-path teardown anymore
- but likely some summary refresh or websocket effect recreation was still causing brief reinitialization

---

## 7. Second audit: summary-refresh websocket churn

### Root cause 2
A second issue was found in `useRuntimeBridge.ts`:
- the websocket bridge effect still depended on broader runtime summary object paths
- summary refresh churn could recreate the bridge effect even if material transport values had not changed

### Fix applied
Bridge-effect inputs were refactored into stable scalar locals:
- websocket configured flag
- browser reachability
- websocket URL
- websocket bridge token
- gateway session token

The effect dependency list was narrowed to those scalars instead of broader nested object paths.

### Commit
- `1d4c3d2` — `mission-control: stabilize bridge effect deps on summary refresh`

### Verification
- lint clean
- preview restarted again
- subsequent user testing suggested the flicker was gone or materially reduced
- Philippe reported that `SESSION CONNECTED` also seemed to return faster

### Important current posture
Treat the reconnect problem as **resolved for now**.
If it reappears later, the next audit layer should be:
- WS sidecar / preview-origin proxy handshake behavior
not another first-pass React-state speculation loop

---

## Part III — Chat Transcript Persistence Across Page Navigation

## 8. Reported UX problem
Philippe reported another real operator pain point:
- when navigating from Chat to another page like Tasks and then back to Chat,
- the entire transcript history visibly reloaded again
- the page did not feel like it retained its runtime state

This was framed correctly by Philippe as a UX continuity problem, not necessarily a “bug” in the narrow sense.

---

## 9. Initial diagnosis
The current Mission Control architecture at that time was:
- `/general/chat` page mounted `MissionControlChatRuntime`
- `MissionControlChatRuntime` created `useRuntimeBridge(initialSummary)` directly
- bridge state lived inside that page-local hook instance

So route navigation caused:
1. Chat page unmount
2. hook destruction
3. in-memory transcript loss
4. remount on return
5. fresh hydration from server

This meant the issue was not primarily browser cache. It was state ownership.

---

## 10. Nerve cross-check
Before implementing a fix, Philippe asked for a crawl through the local Nerve repo at `/tmp/openclaw-nerve` because Mission Control had borrowed concepts from it.

### What Nerve showed
Nerve keeps chat/session state in top-level providers, not in the chat panel itself.
Relevant pattern observed:
- `GatewayProvider`
- `SettingsProvider`
- `SessionProvider`
- `ChatProvider`
- then app UI

In Nerve, the chat UI panel is largely a renderer, while core runtime/message/session state is provider-owned.

### Important nuance
Nerve is closer to a single-shell app where providers stay mounted while the visible panel changes.
That means it avoids transcript reload partly because:
1. state is provider-owned
2. providers survive UI navigation

### Conclusion
Nerve strongly reinforced the right Mission Control direction:
- move core chat runtime ownership above the page level
- make Chat consume a persistent provider instead of instantiating the bridge every mount

---

## 11. Fix implemented: shell-level runtime provider
A proper persistent-provider version was then built.

### New structure
Added:
- `projects/mission-control/components/chat/MissionControlRuntimeProvider.tsx`

Mounted in:
- `projects/mission-control/app/layout.tsx`

Updated:
- `projects/mission-control/components/chat/MissionControlChatRuntime.tsx`

### Provider role
The new provider owns:
- runtime bridge instance
- current summary
- summary hydration path

The Chat page now hydrates that provider with server summary and consumes the existing live runtime if already present.

### Why this matters
Now when navigating:
- Chat → Tasks → Chat

The core runtime state can survive at shell level instead of being destroyed with the page component.

### Commit
- `cb11ff0` — `mission-control: persist chat runtime across route switches`

### Verification
- lint clean
- build clean
- preview restarted
- Philippe tested:
  - sent a live test message
  - switched pages
  - returned to Chat
  - confirmed it worked much better and transcript continuity was materially improved

### Durable architecture lesson
This is a major conceptual takeaway from today:
**persistent operator runtime state should live at shell/provider level, not page level, when continuity across navigation matters.**

This lesson likely applies beyond Chat.

---

## Part IV — Tool Bubble UX Fix

## 12. Reported issue
Philippe pointed out that tool bubbles in chat only rendered on one line.
Long tool descriptions often exceeded the bubble width, so only the first portion was visible.

### Problem details
Tool preview text was hard-coded to use:
- single line
- hidden overflow
- ellipsis truncation

This made long:
- file paths
- exec commands
- tool metadata

hard to read.

---

## 13. Fix implemented
In `MissionControlChatSurface.tsx`, tool row rendering was updated to:
- allow multiple lines
- wrap long content naturally
- top-align rows so wrapping remains visually coherent

Key changes included:
- `alignItems: 'flex-start'`
- `whiteSpace: 'pre-wrap'`
- `overflowWrap: 'anywhere'`
- `wordBreak: 'break-word'`

### Commit
- `8e69530` — `mission-control: wrap long tool bubble descriptions`

### Verification
- safe long-path and long-command tool calls were triggered in chat
- Philippe reviewed the rendering and said it looked good enough for now

### Current posture
Good enough for now.
Possible future polish ideas mentioned and worth remembering:
- slightly softer line spacing
- clamp to 2–3 lines by default with expand-on-click
- more intentional styling for expanded tool rows

No further work needed now.

---

## Part V — File Path Links From Chat Into Files

## 14. Product idea and feasibility check
Philippe asked whether file paths mentioned in chat could link directly into the Mission Control Files page so clicking a path would open the corresponding file there.

This was a good idea and not too futuristic.

### Feasibility findings
The Files page already accepted:
- `?path=...`
- `?file=...`

So the backend/page routing side was already mostly there.

That meant a chat-side linkifier could route a file mention like:
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`

to something like:
- `/general/files?path=projects/mission-control/components/chat&file=projects/mission-control/components/chat/MissionControlChatSurface.tsx`

This made the idea immediately practical.

---

## 15. First implementation
The rich-text renderer in `MissionControlChatSurface.tsx` was extended with a strict-ish workspace file-path linkifier.

### First-pass goals
- detect obvious workspace file paths in assistant message text
- convert them into internal links to the Files page
- normalize absolute workspace paths under `/data/.openclaw/workspace/...`
- avoid over-linking random prose as much as possible

### Commit
- `596ad35` — `mission-control: link workspace file paths from chat to Files page`

### Initial problem discovered immediately
Philippe reported that the paths were still not clickable in practice.
Why?
Because many file mentions in chat were being rendered as inline code first, which overrode the plain-text linker behavior.

---

## 16. Second implementation: clickable code-styled file links
The renderer was adjusted so that if an inline-code segment itself was a workspace file path, it would render as:
- clickable link
- but still visually styled as code

This preserved the aesthetic while making the link actually useful.

### Important note
This fix was deployed immediately after Philippe noticed the issue.
There is no separate commit noted in chat for this tiny intermediate fix, but the code path changed before the next tightening pass below.

---

## 17. Third implementation: tighten overactive linking
Once clickable code-style links worked, Philippe observed that the linker had become too eager.
It was now linking some code-ish things that were not real files, for example:
- `read`
- `exec`
- CSS property names in backticks

### Fix applied
The matcher was tightened with a stricter `isLikelyWorkspaceFilePath(...)` gate.
A thing now only links if it:
- normalizes to a workspace-relative path
- contains at least one `/`
- starts under an allowed workspace root such as `projects/`, `docs/`, `scripts/`, etc.
- has a final segment that actually looks like a filename

### Result
Real file paths still link.
Generic code-ish tokens no longer should.

### Current posture
This feature is now in a good first-pass state:
- useful
- materially integrated
- not too spammy

Possible future improvements worth remembering:
- dedicated visual style for internal file links distinct from normal web links
- structured file chips/rows for `File:` sections
- stronger auto-scroll/highlight behavior on the Files page when navigated from chat

---

## Part VI — Supporting Non-Mission-Control Workspace Work Today

## 18. Workspace home-improvement pass
The scheduled workspace home-improvement gate allowed execution.
A bounded workspace-lane improvement was made:

### Change
- `scripts/add-task-suggestion.py`
- `sync_board()` now warns to stderr if the Kanban sync script is missing or exits non-zero instead of silently doing nothing

### Why it mattered
Promoting a Philippe suggestion could appear successful while the board remained unsynced, creating false confidence and confusing diagnosis.

### Value
This is a small but useful workflow-friction reduction.
It is separate from Mission Control, but part of today’s overall cleanliness/handoff picture.

---

## 19. Daily workspace autonomy executor
The workspace autonomy executor was run through the gate flow.
A Blender learning practice brief task moved into progress and a Telegram notification was sent to the goal-tasks group.
No notable bug/incident emerged from that run.

This is not central to Mission Control but is part of the day’s operational record.

---

## Part VII — Current Mission Control Technical Posture

## 20. Files/pages/routes truth relevant to today’s work
Important route truths reaffirmed today:
- Mission Control preview is currently run as a production-style preview stack, not hot-reload dev
- source edits require proper build/restart for certainty
- Files page already supports `path` and `file` search params and can therefore be used as a target for internal file navigation links

Important preview/runtime components observed live:
- Next server
- preview-origin proxy
- runtime-bridge WS sidecar

---

## 21. Current Chat truth after today
Chat now has all of the following together:
- real runtime bridge
- real transcript persistence across route navigation
- improved reconnect stability
- fixed send-path survival
- improved tool-bubble readability
- clickable internal file-path references

This is a meaningful quality jump.
It makes Chat more like a durable workspace and less like a fragile demo surface.

---

## 22. Product understanding changes from today
Today clarified several durable product truths:

### A. Stability work matters as much as visual polish
Philippe’s most valuable feedback today was not about surface aesthetics first. It was about friction:
- getting kicked out after send
- losing transcript continuity on page switches
- unreadable tool rows
- file references not connecting to the file browser

The correct response was surgery, not decoration.

### B. Mission Control pages should increasingly behave like one environment
The file-link work is a good example.
Chat should not be a dead transcript island. It should route into Files, and likely later into Tasks, Memory, and Agents too when appropriate.

### C. Nerve remains a useful architecture reference, not a design template
The Nerve cross-check was valuable because it reinforced provider-owned runtime state. That was an architecture lesson, not a reason to mimic Nerve aesthetically.

### D. Route-persistent state is a likely recurring pattern
Any Mission Control surface that behaves like a live workspace may want shell-level state rather than page-local state.
This should be kept in mind before building future live-heavy panes.

---

## Part VIII — Open Questions / Next Safe Steps

## 23. What should not be reopened casually
Do **not** casually reopen Chat for broad redesign.
Today’s work solved real mechanical problems and improved continuity.
Protect that.

Only reopen Chat if there is:
- a real usability issue
- a meaningful operator-workflow gain
- a specific UI request from Philippe

---

## 24. Good next-safe steps after this savepoint
These are the best next kinds of Mission Control work now, in rough order:

### Option 1 — Continue improving cross-page connective tissue
Examples:
- make file-link navigation slightly richer
- add more intentional “open in Files” affordances
- consider linkified task refs or memory refs later

### Option 2 — Return to Tasks / Autonomous frontier
The midnight savepoint already established Tasks as the major active build frontier.
Now that Chat is mechanically healthier, it may make sense to resume that frontier with better continuity and less chat friction.

### Option 3 — Only if needed, deeper Files-page polish for linked-open behavior
If Philippe later wants a sharper feel when arriving from chat:
- stronger file highlight
- more obvious selected row state
- scroll/focus to preview region

### Option 4 — Reopen transport only if bugs recur
If reconnect weirdness comes back under normal use:
- audit WS sidecar / preview-origin proxy handshake
- do not start by re-litigating the same React-hook fixes unless evidence points there again

---

## 25. Longer-term objectives reinforced today
Longer-term Mission Control direction remains:
- truthful operator workspace, not a fake dashboard
- strong continuity between pages
- durable runtime state where it matters
- useful before decorative
- integrated environment rather than isolated modules
- General stays airy/editorial, Trading stays denser and more analytical later

Today especially strengthened these long-term goals:
- continuity
- connectedness between pages
- architectural persistence for live workspace flows

---

## Part IX — Concrete Changed Files / Commits

## 26. Mission Control files materially changed today
### Runtime stability
- `projects/mission-control/hooks/useRuntimeBridge.ts`

### Persistent runtime provider
- `projects/mission-control/components/chat/MissionControlRuntimeProvider.tsx`
- `projects/mission-control/components/chat/MissionControlChatRuntime.tsx`
- `projects/mission-control/app/layout.tsx`

### Chat UX / rendering
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`

### Non-Mission-Control workflow improvement
- `scripts/add-task-suggestion.py`

---

## 27. Important commits from today
- `d417389` — `mission-control: stop bridge reconnect on every sent message`
- `1d4c3d2` — `mission-control: stabilize bridge effect deps on summary refresh`
- `cb11ff0` — `mission-control: persist chat runtime across route switches`
- `8e69530` — `mission-control: wrap long tool bubble descriptions`
- `596ad35` — `mission-control: link workspace file paths from chat to Files page`

Note: the final file-link tightening pass was applied and deployed after the initial link commit. If the exact commit is needed later, verify via `git log --oneline -- projects/mission-control/components/chat/MissionControlChatSurface.tsx`.

---

## 28. Operational deployment notes
Every Mission Control fix today that needed to be live was deployed using proper preview rebuild/restart rather than assuming browser refresh or dev hot-reload.

This was the correct discipline and should remain so unless the runtime topology changes.

---

## Final Handoff Summary
If you are the next agent picking this up later today:

1. Chat is in a much better place now.
2. The major send/disconnect bug was real and fixed.
3. The smaller reconnect flicker was also addressed.
4. Chat transcript continuity across page switches is now provider-based and should be protected.
5. Tool rows now wrap properly.
6. File paths in chat now route into Files in a useful first-pass way.
7. Do not casually redesign Chat after all this; protect the mechanical gains.
8. The next best Mission Control frontier is likely Tasks/Autonomous again or cross-page connective tissue, not random Chat churn.

If something seems off later, start from this savepoint and verify whether the issue is:
- transport/runtime
- provider/state ownership
- renderer behavior
- or page-to-page connective tissue

Do not make Philippe re-explain today’s discoveries if this file can save that loop.
