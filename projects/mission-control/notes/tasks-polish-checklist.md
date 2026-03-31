# Tasks Page — UI Polish Checklist

**File under review:** `components/pages/TasksBoardSwitcher.tsx` (~680 lines)
**CSS companion:** `app/globals.css` (`.tasks-board-grid`)
**Reference page:** `app/general/tasks/page.tsx`

---

## P0 — Likely Bugs / Behavioral Issues

### 1. Hydration mismatch risk on board tabs
**What:** `TasksBoardSwitcher` initializes `personalBoard` and `projectsBoard` state by calling `seedPersonal()` / `seedProjects()` during SSR, then re-reads from `localStorage` on the client. If localStorage is empty on first load the server renders seeds but the client hydrates from an empty localStorage object (`{}`), causing an initial flicker or mismatch.

**Fix:** Initialize from localStorage only inside a `useEffect` (client-only), and render seed data as the initial state only if localStorage is empty on the client. Or guard the seed call with `typeof window !== 'undefined'` more carefully — the current `if (typeof window === 'undefined') return seedPersonal()` guard only skips localStorage, not the seed itself.

---

### 2. No column count badges on autonomous board columns
**What:** `AutonomousContent` renders columns via `ColumnView` but never passes a `countBadge` prop or similar. The `ColumnView` component does render `{column.count}` as a badge — however `autoColumns` from the API may not always carry accurate `count` values, and the autonomous board header lacks the `CompactSyncStatus` companion strip that Personal/Projects boards get.

**Fix:** Verify `getTaskBoard()` API response includes accurate `count` per column. Confirm `AutonomousContent` renders `<CompactSyncStatus>` alongside the board grid (it currently does, below the grid — this is fine). If column counts are missing from the API shape, add a computed pass: `columns.map(col => ({ ...col, count: col.tasks.length }))`.

---

### 3. No empty-state message for autonomous board
**What:** If all autonomous columns are empty, the board renders just the grid sections with "No cards parked in backlog / Nothing queued for execution / …" per column. This is handled, but there's no board-level empty state if the import has never run.

**Fix:** Add a board-level guard in `AutonomousContent`: if all columns have `tasks.length === 0`, render a centered empty state CTA ("No autonomous tasks yet — generate your first task or wait for the next daily generation.") instead of the grid.

---

## P1 — UX Improvements

### 4. Manual board cards have no click-to-open behavior
**What:** Personal/Projects `TaskCard` components show edit (✎) and delete (✕) buttons but clicking the card body does nothing. The autonomous board opens a drawer on card click. Inconsistency may confuse users.

**Fix:** Either add a minimal read-only drawer for Personal/Projects (click expands a summary chip), or make the card body click trigger the edit modal directly — whichever is lighter and more consistent with the overall intent.

---

### 5. Drag-and-drop drop-zone feedback is subtle
**What:** `ColumnView` highlights the column border and background on `isDropTarget`, but the change is gentle (opacity-blended gradient). On a glassmorphism background the drop signal may not feel urgent enough.

**Fix:** On `isDropTarget`, add a more pronounced scale effect on the column (`transform: 'scale(1.012)'`) and a stronger border (`boxShadow: '0 0 0 2px var(--drop-accent)'`) so the target column visibly "lifts." Also consider a brief flash of the card tint color.

---

### 6. TaskCard hover state for manual boards is passive
**What:** The card `boxShadow` and `border` only change on `isDragging`. A gentle hover state (`boxShadow` lift, slight border darkening) on manual board cards would improve affordance.

**Fix:** Add a `:hover` style block via a `useState` (`isHovered`) on the `TaskCard` wrapper `<article>`.

---

### 7. TaskModal and AutonomousTaskModal save buttons lack loading state
**What:** Both modals submit via async handlers but the primary save button only shows `{saving ? 'Saving…' : 'Save changes'}`. The button `disabled` state is correct but there is no spinner icon or button opacity change during the save.

**Fix:** Add a small CSS spinner (animated border) on the save button `style` when `saving === true`.

---

### 8. Board tab list overflows on narrow viewports
**What:** The tab `role="tablist"` is `inline-flex` with `width: fit-content`. On small screens (e.g. a phone rotated to landscape) the three boards may overflow the viewport width.

**Fix:** Add `flexWrap: 'wrap'` to the tablist container and a `max-width: 100%` guard. Consider a scrollable `overflow-x: auto` with `scrollbar-width: none` on the tablist as a lighter fix.

---

### 9. No keyboard shortcuts (Escape, navigation)
**What:** Drawer and modals close only via ✕ button or clicking the backdrop. Pressing Escape does nothing.

**Fix:** Add a `useEffect` with `useCallback` that listens for `keydown === 'Escape'` and calls the appropriate close handler. For the drawer, also add arrow-key navigation between tasks (↑↓) to move `selectedAutoTask`.

---

### 10. AutonomousTaskDrawer close button not sticky
**What:** The ✕ button sits at the top of the scrollable drawer content. If Philippe scrolls down to read feedback, the close affordance is off-screen.

**Fix:** Make the drawer header (title + close button) `position: sticky; top: 0;` within the drawer panel so the close button is always accessible.

---

### 11. No delete confirmation for manual board tasks
**What:** `handleDelete` removes a task from localStorage immediately with no confirmation dialog.

**Fix:** Either convert the ✕ button to a trash icon with a `useState` confirm step inline (show "Confirm?" text + "Yes"/"No" buttons replacing the ✕ button), or add a lightweight browser `confirm()` dialog as a minimum.

---

## P2 — Visual Refinements

### 12. Lane chip fallback (🧩) is visually undefined
**What:** `laneStyleData` returns `{ icon: '🧩', text: lane, … }` for any lane not matching personal/projects/autonomous. The generic 🧩 chip blends into the background on glassmorphism cards.

**Fix:** Define a distinct neutral chip style for the fallback lane (e.g., gray border + 📋 icon) so unknown lanes don't look broken.

---

### 13. Autonomous board subtitle / context line missing
**What:** Personal and Projects boards render `"Drag cards between columns to keep this board moving."` as a subtitle under the board title. The autonomous board header shows only `"Autonomous execution board"` with no guidance for new users.

**Fix:** Add a subtitle to `AutonomousContent` header (e.g., `"Generated by Marvin's daily task system. Execute, review, or reject from the task drawer."`).

---

### 14. 5-column CSS grid used for 3-column manual boards
**What:** `.tasks-board-grid` in `globals.css` uses `grid-template-columns: repeat(5, minmax(0, 1fr))`. Personal and Projects boards only have 3 columns — the extra 2 grid slots are empty, which is harmless but semantically noisy.

**Fix:** Pass a `columns` prop to `ColumnView` with the column count, and apply it via a `style` prop on the grid container instead of relying on the global CSS class. Or keep the global class for autonomous (5 col) and apply an override `style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}` in `ManualBoardContent`.

---

### 15. Info button (ⓘ) on CompactSyncStatus is bare-bones
**What:** The "i" button is a simple bordered circle with no hover state.

**Fix:** Add `cursor: 'pointer'` (already present), and optionally add a `background` tint on hover and a `title` attribute with the full tooltip text as fallback.

---

## P3 — Cleanup

### 16. `TasksBoardSwitcher.tsx` is a monolith (~680 lines)
**What:** One file contains ~10 distinct sub-components. This makes review and testing harder.

**Fix:** Extract into a `components/tasks/` directory:
- `TasksBoardSwitcher.tsx` (main orchestrator, state)
- `TaskCard.tsx`
- `ColumnView.tsx`
- `TaskModal.tsx`
- `AutonomousTaskModal.tsx`
- `AutonomousTaskDrawer.tsx`
- `CompactSyncStatus.tsx`
- `BoardTabList.tsx`

---

### 17. Dead seed data for non-existent boards
**What:** `seedPersonal()` and `seedProjects()` contain hardcoded example tasks that are visible on first load. These will never be deleted and are not synced to any backend.

**Fix:** If seed data is only for demo/development purposes, gate it behind a `NEXT_PUBLIC_SHOW_SEED_DATA=true` env flag. Otherwise keep as-is but document that these are demo seeds.

---

### 18. `hideHeader` on PageScaffold leaves Tasks page untitled in shell nav
**What:** `GeneralTasksPage` passes `hideHeader` to `PageScaffold`, removing the shell chrome title. The page is labeled only by the tab in the URL (`/general/tasks`) and the browser tab title.

**Fix:** Either restore a minimal page-level title strip inside the Tasks content area (outside `hideHeader`'s scope), or ensure the shell nav active-state correctly highlights the Tasks nav item when on `/general/tasks`.

---

## Priority Order

| # | Item | Priority | Effort |
|---|------|----------|--------|
| 1 | Hydration mismatch on board tabs | P0 | Low |
| 2 | Missing column count badges (autonomous) | P0 | Low |
| 3 | No autonomous empty-state | P0 | Low |
| 4 | Manual board click-to-open gap | P1 | Medium |
| 5 | Drag drop-zone feedback too subtle | P1 | Low |
| 6 | TaskCard hover state | P1 | Low |
| 7 | Modal save button loading state | P1 | Low |
| 8 | Tab overflow on narrow viewports | P1 | Low |
| 9 | Keyboard shortcuts (Escape / nav) | P1 | Medium |
| 10 | Drawer close button not sticky | P1 | Low |
| 11 | No delete confirmation | P1 | Low |
| 12 | Lane chip fallback undefined | P2 | Low |
| 13 | Autonomous board subtitle missing | P2 | Low |
| 14 | 3-col boards on 5-col CSS grid | P2 | Low |
| 15 | SyncStatus info button bare-bones | P2 | Low |
| 16 | Split TasksBoardSwitcher monolith | P3 | High |
| 17 | Gate seed data behind env flag | P3 | Low |
| 18 | hideHeader leaves page untitled | P3 | Low |
