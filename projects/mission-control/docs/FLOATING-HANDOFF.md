# Mission Control — FLOATING Redesign Handoff

**Date:** 2026-03-24
**Status:** Shell rebuilt, home page rebuilt, preview needs to be run locally
**Concept source:** Philippe's Stitch design (Floating Island UI)

---

## What Changed

### 1. Design System — NEW FILE
**`docs/FLOATING-DESIGN-SYSTEM.md`**

A full design token spec based on Philippe's Stitch concept. Contains:
- Warm cream/off-white color palette (`#faf8f5`, `#fffdfb`)
- Forest green accent system (`#0f1f19`, `#3c6658`, `#79a694`, `#a3d0be`, `#d4e7dd`)
- Glass card spec: `rgba(255,255,255,0.72)` + `backdrop-filter:blur(16px)` + subtle border + `border-radius:24px` + soft shadow
- Floating island spec: `rgba(255,255,255,0.85)` + stronger blur + white border
- Typography: Inter font, warm text colors (`#1a1a1a`, `#3d3d3d`, `#7a7a7a`)
- Full spacing and border-radius scale
- Component specs for cards, nav, tabs, bottom strip

### 2. Global CSS — MODIFIED
**`app/globals.css`**

Replaced dark Mission Control palette with FLOATING warm palette:
- Background: `#faf8f5` (warm off-white)
- Glass panels: semi-transparent white with blur
- Accent: forest green tones
- No dark backgrounds anywhere

### 3. AppShell — MODIFIED
**`components/shell/AppShell.tsx`**

Changed layout from dark sidebar-based to top-tab + sidebar grid:
```tsx
// NEW layout: top tab bar + sidebar + main
<div style={{ gridTemplateColumns: '220px minmax(0, 1fr)', paddingTop: 52 }}>
  <Sidebar />
  <main>{children}</main>
  <BottomSystemStrip />
</div>
```

### 4. TopTabBar — NEW FILE
**`components/shell/TopTabBar.tsx`**

New component — fixed top bar with:
- "Mission Control" wordmark (left)
- Mode tabs: "General" and "Trading" as pill tabs
- Search icon (right)
- Profile avatar circle (right)
- Blur background, thin bottom border

### 5. Sidebar — MODIFIED
**`components/shell/Sidebar.tsx`**

FLOATING styling applied:
- Warm gradient background (`#f5f0eb` → `#ebe6e0`)
- Nav items: rounded cards, green accent on active state
- Left accent bar on active item
- Bottom widget: glass card with Ops Pulse (sessions + cron status)

### 6. BottomSystemStrip — MODIFIED
**`components/shell/BottomSystemStrip.tsx`**

Light restyle:
- Warm elevated background
- Green status dot with glow
- Muted grey text
- Thinner, cleaner appearance

### 7. Home Page — MODIFIED
**`app/page.tsx`**

All data fetching logic KEPT INTACT. Only visual styling changed:
- Background → warm off-white
- All cards → glass fill (`rgba(255,255,255,0.72)` + blur + subtle border + `border-radius:24px`)
- Text → warm dark tones
- CTA buttons → forest green gradient
- Signal radar cards → green accent tones
- Status pill → forest green bg

**All adapter/data logic untouched:**
- `getHomeSummary()`
- `getSessions()`
- `getCronJobs()`
- `getWeather()`
- `getGreeting()` (time-aware: "Good evening, Philippe." at 7pm)
- `getRecentActivity()`
- `getSignals()`

### 8. Image Source
**`mc_floating_telegram.jpg`** — Philippe's Stitch concept sent via Telegram, downloaded to workspace.

---

## What Was Tried to Get preview.motiondisplay.cloud Working

### Attempt 1 — Local dev server
```bash
cd /data && PORT=3000 npm run dev --prefix projects/mission-control
```
Result: Server started but only on `127.0.0.1:3000` — not accessible externally.

### Attempt 2 — Direct Vercel deploy on VPS
```bash
cd projects/mission-control && npx vercel --prod=false
```
Result: Vercel CLI needs `VCF_BEARER_TOKEN` auth which is only on Philippe's local machine. Failed with authentication error.

### Attempt 3 — cloudflared tunnel
```bash
cloudflared tunnel --url http://localhost:3000
```
Result: Cloudflared not installed on VPS. Installing it failed due to network restrictions.

### Attempt 4 — localtunnel
```bash
lt --port 3000 --subdomain mission-control-preview
```
Result: Tunnel created but URL didn't resolve from outside.

### Attempt 5 — Restart script from correct directory
```bash
bash scripts/restart-preview.sh
```
Result: Script runs `vercel dev` which needs the `VCF_BEARER_TOKEN` auth. In headless VPS mode without the token, it hangs on authentication.

### Root Cause
`preview.motiondisplay.cloud` is a **Vercel Cloudflare Tunnel** — it requires `VCF_BEARER_TOKEN` to authenticate. This token only exists on Philippe's local machine where Vercel CLI is logged in. The VPS does not have this token.

---

## How to Run the Preview — Two Options

### Option A — From Philippe's Local Machine (Fastest)

```bash
cd [mission-control-repo]
git pull  # pull latest changes
vercel dev
```

This uses the local Vercel auth with the `VCF_BEARER_TOKEN` and creates the `preview.motiondisplay.cloud` tunnel automatically.

### Option B — Push to GitHub (Auto-Deploy)

```bash
cd [mission-control-repo]
git add .
git commit -m "feat: FLOATING redesign — warm cream shell + top tabs"
git push
```

Vercel's GitHub integration will auto-deploy to a preview URL.

---

## What Was Committed

```
f0d6ab3 feat(mission-control): start FLOATING shell redesign — warm cream theme, top tabs, glass sidebar
4fb3e1b feat(mission-control): apply FLOATING design to home page
```

---

## Design Direction Summary

The FLOATING concept is a **warm, light, premium personal dashboard** — NOT dark. Key differences from current Mission Control:

| | Current MC | FLOATING |
|---|---|---|
| Theme | Dark navy | Warm cream/off-white |
| Accent | Blue/teal | Forest green |
| Layout | Dark sidebar | Light sidebar + top tabs |
| Cards | Dark glass | White cream glass |
| Feel | Command center | Clean personal workspace |
| Mode switcher | None | General / Trading tabs |

---

## What Stays the Same

- All adapters (`lib/adapters/`)
- All page components (`app/*/page.tsx`)
- Routing and navigation structure
- Live data integration
- Backend/infrastructure

---

## Next Step

Run `vercel dev` locally and share the `preview.motiondisplay.cloud` URL so we can review the FLOATING redesign together.
