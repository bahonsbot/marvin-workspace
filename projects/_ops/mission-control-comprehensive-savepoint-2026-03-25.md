# Mission Control Comprehensive Save Point

Date: 2026-03-25
Status: end-of-night comprehensive continuity package
Owner: Marvin + Philippe
Purpose: give tomorrow-Marvin a full, practical handoff for Mission Control after the Mar 24 FLOATING redesign session, including conceptual shifts, what was implemented, what was tried and rejected, what still needs work, and exactly how to resume without Philippe having to restate context.

---

## Read this first

This file is the current Mission Control continuity anchor and supersedes the prior Mar 24 savepoint for practical next-step work.

For implementation-safe continuation after the Mar 25 product-structure clarification, also read:
- `projects/_ops/mission-control-execution-spec-2026-03-25.md`

If tomorrow-you only reads one Mission Control handoff file, read this one.

Read alongside:
- `projects/mission-control/docs/FLOATING-DESIGN-SYSTEM.md`
- `projects/mission-control/docs/FLOATING-HANDOFF.md`
- `projects/_ops/mission-control-comprehensive-savepoint-2026-03-24.md`
- `memory/2026-03-24.md`
- `memory/2026-03-25.md`
- `MEMORY.md` (Mission Control Direction section)

Do not rely on older Mission Control assumptions without reconciling them against this file.

---

# 1. Durable Mission Control product truth (updated)

## The big conceptual shift from this session

**The visual identity changed fundamentally:**

- BEFORE: "calm premium dark operator desktop, with restrained Apple-lab energy"
- AFTER: **FLOATING** — warm cream/ivory background, forest green accents, editorial serif headlines, glass/elevated surfaces, generous whitespace, "Floating Island" aesthetic

This is not just a color swap. The entire design language changed:
- Dark nav → top-tab domain switching (General / Trading)
- Dark panels → isolated floating surfaces with soft shadows
- Cold/steel accents → warm beige/bone/sage/green-black palette
- Dense dashboard energy → editorial, breathable, content-first

## The domain split is now real

Mission Control now has two domains:
- **General** — airy, editorial, lighter density. Pages: Home, Chat, Tasks, Agents, Crons, Memory, Files
- **Trading** — denser, analytical, but still FLOATING in style. Pages: Overview, Market Intel, Signals, Watchlist, Bot, Reports

The root `/` redirects to `/general/home`.

The two domains switch the sidebar page set. The shell and top tabs are shared.

## Durable non-negotiables (still in force, updated)
1. truth over polish
2. useful before beautiful, then beautiful once useful
3. no fake state, no fake realtime, no fake embedded chat success
4. domain personality may vary by job (General = airy, Trading = denser)
5. Trading surfaces stay research-first — no fake broker UI, no fake terminal theater
6. Search is NOT a top-level page — it belongs embedded in Memory, Files, and Trading pages
7. Winners/losers is explicitly deferred

---

# 2. What was implemented today (Mar 24 evening)

## Commit history for this session

```
2d440a7  feat: migrate mission control to floating domain shell
3908efb  fix(mission-control): align general pages with floating shell
43805ba  feat(general/chat): redesign page with FLOATING Chat concept
```

Plus design doc commits:
```
a49bb7a  feat(mission-control): start FLOATING shell redesign — warm cream theme, top tabs, glass sidebar
7e47386  docs: add FLOATING redesign handoff for local preview run
e353dc9  docs: add design token extraction step to Stitch-Codex runbook
12c65f7  learn: document VCF_BEARER_TOKEN preview limitation
```

## What each commit did

### `a49bb7a` — FLOATING shell foundation (design docs + shell code)
- Created `docs/FLOATING-DESIGN-SYSTEM.md` — full design token spec from Stitch concept
  - Warm cream/ivory palette (#F7F2E9, #F4EEE4, #F0E9DC)
  - Forest green accents (#062E26, #0A332B, #163B31)
  - Sage-mint badges (#D8E5D8, #5E786D)
  - Editorial serif + clean sans type system
  - Glass/frosted components, rounded corners, diffuse shadows
- Created `components/shell/TopTabBar.tsx` — General/Trading top tabs
- Modified `globals.css` — replaced dark navy with warm cream/green FLOATING theme
- Modified `AppShell.tsx` — grid layout with top tabs + sidebar
- Modified `Sidebar.tsx` — FLOATING styling, green accent active states
- Modified `BottomSystemStrip.tsx` — light ambient styling
- Image source: `mc_floating_telegram.jpg` (Philippe's Stitch concept shared via Telegram)

### `2d440a7` — Domain architecture migration
- General/Trading domain split with route structure (`/general/...`, `/trading/...`)
- Sidebar switches page set by domain
- Trading scaffold (Overview, Market Intel, Signals, Watchlist, Bot, Reports)
- Compat redirects for legacy routes (`/orchestrator` → `/general/chat`, `/market-intel` → `/trading/market-intel`, etc.)
- Root redirect: `/` → `/general/home`

### `3908efb` — Consistency cleanup pass
- Added `components/shared/floating.ts` — reusable `floatingPanelStyle()` and `floatingInsetStyle()` helpers
- Aligned General pages with FLOATING shell:
  - Chat: dark panels → cream/glass surfaces
  - Tasks: kanban columns softened
  - Agents: status/state styling warmed
  - Crons: job cards and badges updated
  - Memory rail/panels: updated
  - Files rail/panels: updated
- Cleaned naming:
  - "Open Orchestrator" → "Open Chat"
  - "Cron" → "Crons" in page title
  - inspector hint: Orchestrator → Chat
- Light Chat page cleanup (still needed more work — hence the next pass)

### `43805ba` — Full Chat redesign from Stitch concept
- Added Cormorant Garamond Google Font to `app/layout.tsx`
- Complete rewrite of `components/pages/GeneralChatPage.tsx` (733 lines)
- Implemented the Stitch concept precisely:
  - Warm ivory gradient background (#F7F2E9 → #F4EEE4 → #F0E9DC)
  - Centered serif greeting headline (58px Cormorant Garamond)
  - Two pill CTAs below greeting
  - Chat bubble thread with real session data:
    - Assistant bubbles: pale cream (#F8EFD9), soft shadow, left-aligned
    - User bubbles: deep green (#062E26), white text, stronger shadow, right-aligned
    - Small circular avatars outside each bubble
  - Top-right: frosted search capsule + two frosted icon buttons
  - Composer dock: strongest glass effect, anchored bottom, frosted translucent, `+`/media/mic/Send
  - Ambient telemetry strip: dot-separated VP/CPU/MEM/DISK/Refreshed metrics
- Shell (AppShell, Sidebar, TopNav) preserved exactly as-is
- Build passed
- Note: non-blocking lint warning about `<head>` font tag approach (functional, cosmetic only)

---

# 3. What still needs work

## High priority — next session

### 1. General Chat refinement
The Stitch concept is now implemented but Philippe said it's "not close to how I want it yet." The structure is there but needs iteration. Key areas to revisit based on Philippe's feedback:
- Bubble styling may need refinement
- Composer dock may need adjustments
- Overall layout rhythm still needs tuning

### 2. General Tasks — needs Stitch design
Tasks was cleaned up in 3908efb but still needs a proper Stitch-driven redesign. The kanban board is functional but not yet art-directed to the FLOATING standard.

### 3. General Agents — needs Stitch design
Agents was visually warmed but still needs a proper Stitch concept to reach FLOATING quality.

### 4. General Crons — needs Stitch design
Crons was consistency-updated but still needs art direction.

### 5. General Memory — light polish check
Memory is likely close but needs a quick consistency review against the FLOATING spec.

### 6. General Files — light polish check
Files is probably okay but should be verified.

### 7. Trading domain — defer design work
Philippe explicitly deferred Trading design work. Focus is on General pages first.

### 8. Preview restart issues
The preview helper script (`preview-start.sh`) writes PID/log to `memory/mission-control-preview/` which caused Codex permission issues. Workaround: run the script directly as `node` user, not via Codex exec context. Root cause is sandboxed exec environment, not a real app issue.

## Lower priority — later

### 9. Trading pages visual refinement
When General is done, Trading needs a design pass too. Market Intel in particular is still the old page content under a new route.

### 10. Search integration
Search is no longer a standalone page. It belongs embedded in Memory, Files, and Trading pages as a local capability.

### 11. VCF_BEARER_TOKEN preview limitation
Remote preview at `preview.motiondisplay.cloud` requires `VCF_BEARER_TOKEN` which is only on Philippe's local machine. Local preview at port 3005 works fine. Documented in `12c65f7`.

---

# 4. How to run the preview

## Local preview (VPS)
```bash
cd /data/.openclaw/workspace/projects/mission-control
npm run build
npm run start -- --port 3005
# or use the helper:
./scripts/preview-start.sh
```

Preview runs at: `http://127.0.0.1:3005`

## Remote preview
Requires Philippe's local machine with `VCF_BEARER_TOKEN` set. See `docs/FLOATING-HANDOFF.md` for the full local runbook.

---

# 5. The Stitch-to-Codex workflow (reference)

This session established a working Stitch → Codex pipeline:

1. Philippe designs in Stitch (desktop 2560×2184, Tailwind + Inter, Material Design 3 colors)
2. Philippe exports shares the Stitch concept via Telegram
3. Marvin or Codex analyzes the image
4. Marvin writes implementation handoff brief
5. Codex implements with the design tokens and layout spec
6. Build + preview verification
7. Commit

Key lesson: always extract design tokens from Stitch HTML before handing to Codex. Translation losses are real.

### Stitch MCP connection (for future reference)
- Config: `/data/.codex/config.toml`
- Stitch API key: `AQ.Ab8RN6Jo2tgpOZnBFbMqMnW9dff346VYnu_N9AyvRopEgyiCEA`
- Project ID: `4170246566914068496` (Atelier Bot Dashboard)
- Tools: list_projects, get_project, list_screens, get_screen, generate_screen_from_text, edit_screens, generate_variants, create_project

---

# 6. Key files reference

## Design
- `docs/FLOATING-DESIGN-SYSTEM.md` — design tokens, color palette, type system, spacing, effects
- `docs/FLOATING-HANDOFF.md` — what changed, how to run preview, what was tried, what was deferred

## Components changed/created
- `components/shared/floating.ts` — NEW: reusable `floatingPanelStyle()` and `floatingInsetStyle()` helpers
- `components/shell/TopTabBar.tsx` — NEW: General/Trading tab switcher
- `components/pages/GeneralChatPage.tsx` — complete redesign from Stitch concept
- `components/pages/GeneralHomePage.tsx` — naming cleanup (Orchestrator → Chat)
- `components/pages/GeneralTasksPage.tsx` — FLOATING consistency pass
- `components/pages/GeneralAgentsPage.tsx` — FLOATING consistency pass
- `components/pages/GeneralCronsPage.tsx` — FLOATING consistency pass + "Crons" title
- `components/pages/GeneralMemoryPage.tsx` — FLOATING consistency pass
- `components/pages/GeneralFilesPage.tsx` — FLOATING consistency pass
- `components/memory/MemoryRail.tsx` — FLOATING rail styling
- `components/files/FilesRail.tsx` — FLOATING rail styling
- `components/shell/RightInspector.tsx` — copy cleanup (Orchestrator → Chat)
- `app/layout.tsx` — added Cormorant Garamond font

## Routing
- `app/page.tsx` — root redirect to `/general/home`
- `app/general/` — General domain pages
- `app/trading/` — Trading domain pages
- `app/orchestrator/` — redirect → `/general/chat`
- `app/market-intel/` — redirect → `/trading/market-intel`
- `app/cron/` — redirect → `/general/crons`
- `app/tasks/` — redirect → `/general/tasks`
- `app/agents/` — redirect → `/general/agents`
- `app/memory/` — redirect → `/general/memory`
- `app/files/` — redirect → `/general/files`
- `app/logs/` — redirect → `/general/home`
- `app/search/` — redirect → `/general/home`

## Scripts
- `scripts/preview-start.sh` — starts Next.js production preview on port 3005
- `scripts/preview-stop.sh` — stops the preview

---

# 7. Git commits (Mar 24 evening session)

```
43805ba  feat(general/chat): redesign page with FLOATING Chat concept
3908efb  fix(mission-control): align general pages with floating shell
2d440a7  feat: migrate mission control to floating domain shell
12c65f7  learn: document VCF_BEARER_TOKEN preview limitation
7e47386  docs: add FLOATING redesign handoff for local preview run
a49bb7a  feat(mission-control): start FLOATING shell redesign — warm cream theme, top tabs, glass sidebar
e353dc9  docs: add design token extraction step to Stitch-Codex runbook
```

---

# 8. Morning Meeting notes from Mar 24

All security fixes from the Mar 24 morning session were applied before the FLOATING redesign session. Key security commits:
- `92398e2` — futures-bot rate limit bucket cap
- `4bccd23` — ATB fail-fast without webhook secret
- `353c0f4` — futures-bot fail-fast without webhook secret
- `8d2e64f` — Telegram chat ID redaction in brief logs
- `2ae063f` — autonomy queue file permissions
- `46b2528` — webhook log pruning failures → warnings
- `c274661` — bounded kanban sync/publish subprocesses
- `eb67060` — remove empty in-progress section drift

Durable decisions:
- Backup/DR baseline is established (manual VPS snapshot + automated off-server backup). Future reviews should treat as present unless concrete evidence of drift.
- Security Review Medium 2 (ATB qty floor) deferred for broker/instrument-aware design.
- Security Review Medium 3 (ALLOW_CONTAINER_BIND) accepted risk for now.
- Security Review Low 3 (Reddit usernames) deferred for focused privacy/utility review.
- Overnight reviews now consult recent daily memory before surfacing findings.

---

# 9. Philippe's working context

- Timezone: Asia/Ho_Chi_Minh (GMT+7)
- Uses Telegram for sharing images/designs
- Has local machine with VCF_BEARER_TOKEN for remote preview
- Stitch project: "Atelier Bot Dashboard" (ID: 4170246566914068496)
- Stitch API key stored in `/data/.codex/config.toml`
- Codex CLI runs from `/data/.codex/` in container workspace, NOT host

---

# 10. Long-term Mission Control roadmap (from MEMORY.md, for reference)

1. Memory
2. Files
3. Search (embedded in Memory/Files/Trading, not standalone)
4. basic Settings / Status
5. finish Chat live/embed path
6. deepen Logs / Activity / Agents / Cron
7. domain modules
8. final Home refinement

Note: the "calm premium dark operator desktop" language in MEMORY.md is now superseded by the FLOATING direction. Update MEMORY.md Mission Control Direction section to reflect the new visual identity when resuming.

---

# 11. What to do tomorrow (Mar 25)

## Immediate next steps
1. Read this savepoint
2. Read `docs/FLOATING-DESIGN-SYSTEM.md` and `docs/FLOATING-HANDOFF.md`
3. Check the preview: `http://127.0.0.1:3005/general/chat`
4. Get Philippe's feedback on the Chat redesign — what needs changing specifically?
5. Generate Stitch concepts for remaining General pages: Tasks, Agents, Crons
6. Implement Stitch designs for those pages one by one

## Approach for remaining General pages
1. Philippe creates Stitch design in his local Stitch app
2. Shares via Telegram as image
3. Marvin/Codex analyzes the image
4. Marvin writes implementation brief
5. Codex implements
6. Verify + commit

## What NOT to do tomorrow
- Do NOT redesign Trading pages yet (deferred)
- Do NOT add new domains or restructure
- Do NOT touch backend adapters or truth layer
- Do NOT add fake realtime or shadow chat systems
- Do NOT invest in broad Trading visual polish until General is done
