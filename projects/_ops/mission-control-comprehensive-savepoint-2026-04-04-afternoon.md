# Mission Control Comprehensive Savepoint — 2026-04-04 Afternoon

## What this savepoint is
This is the later-today handoff after a session that mixed:
- Morning Meeting cleanup and operational hygiene
- model-routing cleanup after Qwen subscription loss
- a real fix for the `agent:main:main` vs `agent:main:cron` Chat-session problem
- Phase 1 browser editing for Mission Control Files + Memory

This savepoint exists so the next session does **not** have to rediscover:
- which Morning Meeting findings were already handled versus deferred
- why Mission Control Chat used to land in cron sessions and how that was fixed
- exactly what the new browser editor can do today
- what remains intentionally out of scope for the editor
- why the preview runtime briefly broke after the editor work
- which next editor phases are smart, and which would be premature feature creep

Read this together with:
- `MEMORY.md`
- `memory/2026-04-04.md`
- `projects/_ops/mission-control-comprehensive-savepoint-2026-04-02-night.md`
- `projects/mission-control/components/editor/*`
- `projects/mission-control/components/files/FilesPreviewSection.tsx`
- `projects/mission-control/components/memory/MemoryDocumentEditor.tsx`

---

## Executive summary
Today produced four meaningful Mission Control outcomes:

1. **Morning Meeting backlog got cleaned up properly**
   - stale security symlink fixed
   - preview creds removed from git tracking and ignored correctly
   - resolved learnings entries were actually marked resolved
   - kernel version drift in `TOOLS.md` fixed
   - stale `creative-prompts` reference removed

2. **Live Qwen routing was removed cleanly**
   - Qwen-backed cron jobs were moved to `minimax/MiniMax-M2.7`
   - Mission Control Chat and Tasks no longer expose Qwen as a live user-facing model choice
   - docs were updated so future Marvin doesn’t casually route jobs toward an unavailable model

3. **Mission Control Chat now treats `agent:main:main` as canonical**
   - Chat no longer defaults into a cron session just because that was the only recent visible session
   - Mission Control now has authoritative root-session awareness and can auto-bootstrap the main session if missing

4. **Mission Control Files and Memory are now editable in-browser (Phase 1)**
   - Files page: single-document CodeMirror editing for text files
   - Memory page: single-document CodeMirror editing for durable/daily/learnings docs
   - both have Save / Cancel / Reload and Cmd/Ctrl+S
   - both use mtime-based conflict detection
   - Memory can now create a missing target file directly from the page by saving into it

The biggest new product truth after this session is:

## Mission Control now has real browser-side editing, but it is intentionally a restrained Phase 1
It is **not** a full tabbed Cursor clone yet.
That is good. The current implementation is useful without pretending to be a complete IDE.

---

## 1. Morning Meeting cleanup that already happened today

### 1.1 Security-report hygiene
A stale `memory/security/latest_review.md` symlink was pointing at March instead of current nightly reports.
That is fixed.

### 1.2 Preview credential exposure in git
The file:
- `projects/mission-control/.preview-runtime/mission-control-preview.env`

was being tracked in git.
That was fixed by:
- removing it from the git index with `git rm --cached`
- adding `projects/mission-control/.gitignore`
- keeping the file locally on disk

Philippe confirmed the creds themselves remain valid and did **not** need rotation.
The issue was exposure in git tracking, not broken live auth.

### 1.3 Learnings cleanup
Two existing `.learnings/errors.md` entries were already fixed in code but still marked active:
- `ERR-20260402-1737` — manual task model override silent mismatch
- `ERR-20260402-1756` — transcript hydration rewind

Those statuses were updated to resolved.

### 1.4 Low-risk doc cleanup
- `TOOLS.md` kernel version updated to `Linux 6.8.0-106-generic`
- `creative-prompts` removed from `TOOLS.md` because it is not actually installed
- `projects/mission-control/data/task-lifecycle-events.json` added to `.gitignore`

### 1.5 Deferred item
Cron-details retention (`memory/cron-run-details/`, ~15MB and a few thousand files) was explicitly **deferred**, not ignored.
Do not re-raise it like it was forgotten.

---

## 2. Qwen routing cleanup

Philippe’s Qwen-backed subscription ended, so live paths needed to stop depending on it.

### What changed
Three model-backed cron jobs were switched from Qwen to MiniMax:
- `nightly-security-review`
- `self-improvement`
- `nightly-memory-extraction`

Mission Control changes:
- Chat model menu no longer offers Qwen
- Tasks shared allowed model aliases no longer offer Qwen
- reviewer-facing default model label moved from `qwenplus` to `minimax2.7`
- one saved autonomous task record still pointing to `qwenplus` was remapped to `minimax2.7`

### Docs updated
`TOOLS.md` and `MEMORY.md` were updated to say Qwen is currently unavailable for live routing.

### Result
The system should no longer casually present or depend on Qwen in live Mission Control UX or selected cron paths.
Historical strings in logs/history may still exist and are not a bug by themselves.

---

## 3. Canonical main-session fix for Chat

### Problem that existed
Mission Control Chat was selecting from a **recent active-session list**, not from a fuller authoritative root-session view.
That meant:
- if `agent:main:main` was not visible in recent sessions
- and a cron session was visible
- Mission Control could land in `agent:main:cron...`

Worse, if `agent:main:main` did not yet exist at all, Philippe had to go through Gateway UI first to bootstrap it.

### Actual fix that was implemented
Mission Control now does three things:

1. **Loads authoritative root-session awareness**
   - not just recent active sessions
   - summary/runtime contract now includes root-session awareness and `mainSession`

2. **Treats `agent:main:main` as canonical**
   - cron sessions are still manually selectable
   - cron sessions are no longer valid auto-defaults

3. **Bootstraps the main session automatically when missing**
   - once the runtime bridge connects, Mission Control can create `agent:main:main`
   - there is also a send-time guard so the first prompt can still succeed even if bootstrap timing is late

### Important behavioral rule now
Mission Control Chat should follow this posture going forward:
- default target = `agent:main:main`
- recent sessions menu = manual switching only
- cron sessions = visible but never auto-selected as the default chat target

### Relevant commits
Nested Mission Control repo:
- `239e2876` — `chat: prefer and bootstrap canonical main session`

Outer workspace repo:
- `b066846` — `mission-control: prefer and bootstrap canonical main session`

---

## 4. Browser editing — Phase 1 (the important part)

This was the main build frontier opened today after the session-selection fix.

### 4.1 Why this was reopened
Philippe asked whether Mission Control could stop being read-only for Files and Memory, using Nerve’s file editor as the reference.

The right answer turned out to be:
- yes, definitely
- but do **not** copy all of Nerve blindly
- build the restrained first useful layer first

That is exactly what happened.

---

## 4.2 What Phase 1 now does

## Files page
Mission Control Files can now edit **text files directly in the preview pane**.

### Current behavior
- click a file in Files page
- if it is a text file, preview pane becomes a CodeMirror editor
- Save / Cancel / Reload controls appear
- Cmd/Ctrl+S triggers save
- mtime conflict detection prevents silent overwrite of changed-on-disk files
- image files remain preview-only
- blocked paths remain blocked through the existing Files boundary logic

### Important constraint
Files editing does **not** open up memory files.
The existing blocked-path rules remain intentional.
Do not casually remove that boundary.

## Memory page
Mission Control Memory can now edit:
- `MEMORY.md`
- daily memory documents in `memory/YYYY-MM-DD.md`
- learnings documents in `.learnings/*.md`

### Current behavior
- Memory view loads the selected target as a CodeMirror editor
- Save / Cancel / Reload controls appear
- Cmd/Ctrl+S triggers save
- mtime conflict detection prevents stale overwrite
- if the selected memory target does not exist yet, the page stays truthful **and still lets the user create it by editing + saving**

This last part matters. Memory is no longer “missing file, sorry, nothing to do”. It is now “missing file, edit here and save to create it.”

---

## 4.3 Actual architecture implemented

### New editor primitives
Added under:
- `projects/mission-control/components/editor/CodeMirrorEditor.tsx`
- `projects/mission-control/components/editor/editorTheme.ts`
- `projects/mission-control/components/editor/languageMap.ts`

These are the Nerve-inspired editor foundation pieces.

### Files side changes
New/updated files:
- `components/files/FilesPreviewSection.tsx`
- `components/files/FilePreviewPanel.tsx`
- `components/pages/GeneralFilesPage.tsx`
- `app/api/files/write/route.ts`
- `lib/adapters/files.ts`
- `lib/types/contracts.ts`

What changed conceptually:
- preview payload now includes `mtimeMs` and `writable`
- Files preview pane can save text files
- write route validates path scope and conflict state

### Memory side changes
New/updated files:
- `components/memory/MemoryDocumentEditor.tsx`
- `components/memory/DocumentContent.tsx`
- `components/pages/GeneralMemoryPage.tsx`
- `app/api/memory/document/route.ts` (PUT added)
- `lib/adapters/memory.ts`
- `lib/types/contracts.ts`

What changed conceptually:
- memory payload now includes `mtimeMs` and `writable`
- selected memory document is editable in a client-side editor
- missing target docs can be created by save

### Dependency additions
Mission Control now depends on CodeMirror packages and the `ws` runtime dependency.
`ws` remains necessary for preview-side runtime scripts.
Do not remove it casually again.

---

## 4.4 What went wrong during implementation

Two implementation detours happened and matter as durable context.

### Detour A — coding pass got wedged
A delegated Codex pass got partway through the editor work, then stalled and mixed in a few unrelated diffs.
That required manual supervision/cleanup.

### Detour B — preview broke after package cleanup
During cleanup, `ws` was temporarily removed under the mistaken assumption that it was stray package noise.
That broke:
- `scripts/runtime-bridge-ws-sidecar.js`
- `scripts/preview-origin-proxy.js`

Symptoms:
- `next start` on internal port came up fine
- preview helper failed its final `curl` check on port `3005`
- logs showed `Cannot find module 'ws'`

### Fix
`ws` was restored to Mission Control dependencies.
After that:
- build passed
- preview restart succeeded
- root check returned expected `307 Temporary Redirect`

### Durable lesson
`ws` is not optional package clutter in Mission Control.
It is a real runtime dependency for preview-side infrastructure.

---

## 4.5 Verification done today

### Build verification
Mission Control build was run successfully after the final fixes.

### Preview verification
Preview restart completed successfully after `ws` was restored.
Expected verification result at root:
- `HTTP/1.1 307 Temporary Redirect`

### Commits
Nested Mission Control repo:
- `2b7ab49f` — `files,memory: add in-browser editing with codemirror`
- `411f38cc` — `build: restore ws for preview proxy and sidecar`

Outer workspace repo:
- `7c8e1a8` — `mission-control: add in-browser file and memory editing`
- there should also be a corresponding later outer wrap for the `ws` restore + handoff docs from this session

Important: the nested Mission Control repo currently has **no configured remote**, so nested `git push` is not available by default. Outer workspace push remains the practical shared checkpoint.

---

## 5. What the editor is **not** yet

This matters so future work doesn’t pretend a Phase 1 editor is something bigger.

The current browser editor is **not yet**:
- a multi-tab workspace
- a split-pane editor
- draft-persistence across reloads/localStorage restore
- autosave
- file rename / create / delete workflow in Files
- search-across-files / command palette
- diff/merge UI
- binary editor
- image annotation editor
- lock coordination or presence indicators

That is fine.
The current implementation is honest and already useful.

---

## 6. Smart next phases for the editor

If Philippe keeps using Files/Memory editing and likes it, these are the smart next layers.

## Phase 2 — polish + guardrails
Recommended next, before any “IDE” ambitions:
- dirty-navigation guard (warn before losing unsaved edits)
- better save/conflict toasts or inline banners
- more explicit read-only styling when `writable=false`
- small save-state affordances in Files/Memory meta strips
- maybe keyboard hint cleanup and tiny UX polish on button states

This is probably the best next step.

## Phase 3 — practical workspace ergonomics
Only after Phase 2 proves worthwhile:
- local draft persistence per file/document
- reopen last draft on reload
- one lightweight tab strip for recently opened files
- compare on-disk version vs draft when conflict occurs

This would move it closer to the Cursor feel without overbuilding.

## Phase 4 — Nerve-like workspace sophistication
Only if Mission Control genuinely earns it in regular use:
- proper multi-tab open-file manager
- richer command navigation
- broader workspace mutation tools
- stronger conflict resolution UI
- maybe file operations beyond plain save

Not urgent right now.

---

## 7. Specific warnings for later-today Marvin

### Do not casually reopen solved areas
- do not casually reopen the Chat main-session fix unless Philippe sees it fail again in real use
- do not casually broaden Files access into Memory paths
- do not casually remove `ws`
- do not casually redesign Files/Memory chrome just because editing now exists

### If editing is reopened next
Start by observing real usage friction first:
- Did Philippe actually edit from Files?
- Did Philippe use Memory editing productively?
- Did conflicts occur in normal use?
- Was missing-file creation on Memory useful?
- Did he ask for tabs, or did we merely assume he wanted them?

### If something appears broken in preview
Check these first:
- `projects/mission-control/.preview-runtime/next.log`
- `projects/mission-control/.preview-runtime/latest.log`
- `projects/mission-control/.preview-runtime/ws-sidecar.log`

If `next` is healthy but preview root is not, suspect proxy/sidecar, not the app build itself.

---

## 8. Recommended next-step ordering

If Mission Control work continues later today or tomorrow, the best order is:

1. **Light live verification of Files + Memory editing**
   - confirm save, cancel, reload, and Cmd/Ctrl+S feel right
   - confirm a missing daily memory file can be created

2. **Collect actual friction from Philippe**
   - what feels missing first?
   - save-state feedback?
   - tabs?
   - layout tweaks?

3. **Do only the smallest next editor polish pass**
   - probably dirty-navigation warning or better inline save/conflict feedback

4. **Then stop unless a clear pain point remains**

This is not the moment for a giant IDE refactor.

---

## 9. End-of-session posture
Mission Control is in a stronger state than it was this morning.

The truths to trust now are:
- Morning Meeting cleanup is up to date
- Qwen has been removed from live Mission Control choices and selected cron routes
- Chat should now align itself to `agent:main:main` instead of cron by default
- Files and Memory editing are real and usable in-browser
- preview is healthy again after restoring `ws`

The smart posture from here is **measured validation**, not another broad rewrite.
