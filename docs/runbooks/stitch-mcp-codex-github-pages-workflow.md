# Stitch → MCP → Codex → GitHub Pages Workflow

## Overview

This runbook documents the complete end-to-end workflow for vibe-designing a web app in Stitch (Google's AI design tool), having Codex build it from the design via MCP, and deploying it to GitHub Pages.

**Last updated:** 2026-03-24

---

## System Architecture

```
Stitch (browser) ──MCP API──> Codex CLI (VPS) ──build──> GitHub repo ──Pages──> Live site
                         |
                   ~/.codex/config.toml
                   /data/.codex/config.toml (container path)
```

---

## Prerequisites

- Stitch account with a project (stitch.withgoogle.com)
- Google AI subscription (gives access to Stitch)
- Stitch API key generated from the Stitch MCP export panel
- Codex CLI installed (`npm i -g @openai/codex`)
- GitHub account with repo creation permissions
- GitHub CLI (`gh`) authenticated on the VPS

---

## Step 1 — Generate Stitch API Key

1. Go to **stitch.withgoogle.com**
2. Open your project
3. Click **Export** → **MCP**
4. Copy the generated config snippet (contains the API key)

The config looks like:
```toml
[mcp_servers.stitch]
url = "https://stitch.googleapis.com/mcp"
[mcp_servers.stitch.http_headers]
"X-Goog-Api-Key" = "YOUR-KEY-HERE"
```

---

## Step 2 — Configure Codex MCP

### Find the right config location

Codex CLI config is at `~/.codex/config.toml` on the **host**, but on the Docker/OpenClaw VPS it runs from `/data/.codex/config.toml` inside the container.

```bash
# Check if config already exists
cat /data/.codex/config.toml
```

### Add Stitch MCP config

If `config.toml` doesn't exist yet, create it:
```toml
[mcp_servers.stitch]
url = "https://stitch.googleapis.com/mcp"
[mcp_servers.stitch.http_headers]
"X-Goog-Api-Key" = "YOUR-ACTUAL-API-KEY"
```

If `config.toml` already exists, append just the `[mcp_servers.stitch]` section.

### Verify

```bash
codex mcp list
```

Should show `stitch` listed as an enabled server.

### Available Stitch MCP tools

```
mcp__stitch__list_projects
mcp__stitch__get_project
mcp__stitch__list_screens
mcp__stitch__get_screen
mcp__stitch__generate_screen_from_text
mcp__stitch__edit_screens
mcp__stitch__generate_variants
mcp__stitch__create_project
```

---

## Step 3 — Test the Stitch Connection

### List your projects

```bash
codex exec --full-auto "Use the Stitch MCP to list all your projects and return their IDs and names."
```

### Get a specific project

```bash
curl -s -H "X-Goog-Api-Key: YOUR-KEY" \
  "https://stitch.googleapis.com/mcp" -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":1,"params":{"name":"get_project","arguments":{"projectId":"YOUR-PROJECT-ID"}}}'
```

### List screens in a project

```bash
curl -s -H "X-Goog-Api-Key: YOUR-KEY" \
  "https://stitch.googleapis.com/mcp" -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":1,"params":{"name":"list_screens","arguments":{"projectId":"YOUR-PROJECT-ID"}}}'
```

---

## Step 4 — Build with Codex

### Spawn Codex

```bash
codex exec --full-auto "Use the Stitch MCP to get the screen details for project ID YOUR-ID. Then build a React + Vite + Tailwind CSS implementation of the design. Create the project at /data/PROJECT-NAME/. Make it visually excellent with proper components. Run npm run build when done."
```

Or use OpenClaw's coding-agent skill for a managed subagent.

### Key Codex prompting tips for design-to-code

- Tell Codex to **read the Stitch HTML reference first**
- Tell it **not to just copy the HTML** but to build proper React components
- Specify the tech stack explicitly: **React + Vite + Tailwind CSS**
- Mention the design language: **Material Design 3 colors, Inter font, glass-panel aesthetic**
- Require **mobile responsiveness**
- Ask for a **README.md** with how-to-run instructions

### Important: set the Vite base path

Before building, Codex must set the correct base path for GitHub Pages subpath deployment:

```javascript
// vite.config.js
export default defineConfig({
  base: '/REPO-NAME/',
  // ...
})
```

Without this, assets point to `/assets/` instead of `/REPO-NAME/assets/` and the page is blank in production.

---

## Step 5 — GitHub Repo and GitHub Pages Setup

### Create the repo

```bash
gh repo new REPO-NAME --description "DESCRIPTION" --public
```

### Create a dist-to-pages deploy workflow

The cleanest approach is GitHub Actions workflow mode.

1. **On `main` branch:** push the `dist/` folder contents (built app) to the repo root
2. **In repo Settings → Pages:** set source to GitHub Actions (workflow)
3. **Push a workflow file** (`.github/workflows/deploy.yml`) that deploys from the root

Workflow file:
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Push workflow

```bash
cd /tmp
git clone https://github.com/USER/REPO.git
cd REPO
git checkout -b gh-pages
# copy dist/ contents to current dir
git add .
git commit -m "Setup GitHub Actions deploy"
git push origin gh-pages --force
```

Then set Pages to use workflow mode pointing to `main` branch root.

### Quick force-redeploy

If Pages shows stale content, force a new build:
```bash
git commit --allow-empty -m "Force Pages rebuild" && git push
```

---

## Troubleshooting

### Page is blank (white screen)

1. **Check browser console** for 404 errors on JS/CSS assets
2. **Most common cause:** Vite `base` path is wrong
   - Inspect `index.html` in the built output — assets should have `href="/REPO-NAME/assets/..."`
   - Fix: rebuild with `npm run build -- --base /REPO-NAME/`

### Icons show as text instead of rendered icons

**Cause:** External font (e.g. Google Fonts Material Symbols) is blocked or not reaching the browser in production.

**Fix:** Self-host icon libraries. Use Lucide React (bundled, no CDN needed) instead of Material Symbols Outlined.

```bash
npm install lucide-react
```

Create an `Icon.jsx` mapping component:
```jsx
import { LayoutDashboard, Bell, Settings, ... } from 'lucide-react';
const iconMap = {
  'dashboard': LayoutDashboard,
  'notifications': Bell,
  ...
};
export const Icon = ({ name, size = 24 }) => {
  const Component = iconMap[name] || (() => <span>{name}</span>);
  return <Component size={size} />;
};
```

Then replace `<span className="material-symbols-outlined">icon</span>` with `<Icon name="icon" />`.

### Codex exec calls timeout

- Codex exec calls can be killed by OpenClaw's subprocess timeout
- For long tasks, use a background exec session and poll
- Alternatively, test Stitch MCP directly via curl (faster, more reliable for debugging)

### npm install fails with rate limit

- npm registry has separate rate limits from MiniMax API
- Retry after a few minutes
- For production, pin package versions to avoid unexpected new installs

### GitHub Pages shows 404

- Pages can take 1-2 minutes after first push to activate
- Check Pages settings: source must match where built files are
- Verify files are on the right branch: `gh api repos/USER/REPO/git/trees/BRANCH --recursive`

---

## Key Lessons

1. **Codex MCP config lives at `/data/.codex/config.toml` in Docker/OpenClaw**, not at the host `~/.codex/`
2. **Vite `base` must be set** for subpath GitHub Pages deployment before running `npm run build`
3. **External font CDNs break in production** — always self-host icon libraries when deploying to GitHub Pages
4. **Lucide React** is a reliable, self-contained icon library that works everywhere
5. **Test with curl first** when Codex exec calls are timing out — confirms whether the API issue is Codex-side or network-side
6. **GitHub Pages may need a new commit** to trigger a rebuild after switching Pages modes

---

## Design Token Extraction — Critical Step (2026-03-24 update)

**This step is mandatory for future Stitch → Codex projects.**

When Codex reads the Stitch HTML, it sees the rendered output — not the design tokens that produced it. Stitch uses Material Design 3 CSS custom properties (`--md-sys-color-*`) mapped to Tailwind utility classes. Codex cannot reliably reverse-engineer the original design tokens from class names alone, which causes:
- wrong or missing colors
- incorrect border/shadow styles
- mismatched bar chart colors
- icon set mismatches

### Step 0 — Extract design tokens BEFORE spawning Codex

After downloading the Stitch HTML but before handing it to Codex:

```bash
# Extract all hex colors from the HTML
grep -oE '#[0-9a-fA-F]{6}' your-design.html | sort -u | grep -vE 'google|gstatic|w3|mozilla|favicon'

# Extract CSS custom properties (design tokens)
grep -oE '--[a-z-]+:[^;]+' your-design.html | sort -u

# Extract the custom CSS classes and their definitions
grep -oE 'class="[^"]*"' your-design.html | sort -u | grep -iE 'surface|primary|secondary|glass|backdrop|shadow' | head -40

# Extract inline style blocks (glass panels, special effects)
python3 -c "
import re
with open('your-design.html') as f:
    html = f.read()
styles = re.findall(r'<style[^>]*>(.*?)</style>', html, re.DOTALL)
for s in styles:
    print(s.strip())
"
```

### Canonical design tokens from the Atelier Bot project

Use these as a reference when prompting Codex:

**Colors:**
```
Primary blue:    #0058bc  (hover/dark: #0070eb, #005bc1, #004493)
Secondary green: #006e28  (hover/dark: #00732a)
Background:      #faf9fe  (page), #1a1b1f (dark surfaces)
Sidebar:         #f4f3f8
Surface greys:   #eeedf3, #e9e7ed, #dad9df, #e3e2e7
Text primary:   #1a1b1f
Text muted:      #717786
Error red:      #ba1a1a  (dark: #93000a, #930005)
Light red:      #ffdad6, #ffb4aa
Light blue:     #d8e2ff, #adc6ff
Dark surfaces:  #2a2b2f, #2f3034, #414755
```

**Effect tokens:**
```
Glass panel:    background: rgba(255,255,255,0.7); backdrop-filter: blur(20px)
Card shadow:    box-shadow: 0 1px 4px rgba(0,0,0,0.06)
Pulse glow:    box-shadow: 0 0 15px rgba(0,110,40,0.6)
Border:         1px solid rgba(193,198,215,0.3)  ← use this instead of Tailwind border-*
Active nav:     white background, #0058bc text, box-shadow: 0 1px 4px rgba(0,0,0,0.08)
Font:           Inter (Google Fonts) — add to Tailwind config
Icons:          Material Symbols Outlined via Google Fonts CDN
               OR Lucide React (self-contained, no CDN) — see Icons section below
```

### Prompt Codex with design tokens explicitly

When spawning Codex for a Stitch design project, always include:

```
IMPORTANT DESIGN TOKENS (extract these from the Stitch HTML first, do not invent new colors):
- Page background: #faf9fe
- Sidebar: #f4f3f8
- Primary blue: #0058bc
- Secondary green: #006e28
- Error red: #ba1a1a
- Card background: rgba(255,255,255,0.7) + backdrop-filter: blur(20px)
- Card border: 1px solid rgba(193,198,215,0.3)
- Card shadow: box-shadow: 0 1px 4px rgba(0,0,0,0.06)
- Font: Inter (Google Fonts)
- DO NOT use Tailwind border-* classes — use inline style borders with rgba(193,198,215,0.3)
- DO NOT invent colors — use the hex values above
```

### If Stitch has a Design System screen

1. In Stitch, open the Design System screen
2. Export it as a separate reference
3. Pass the Design System HTML to Codex alongside the screen HTML
4. Note: the Design System screen ID may look like `asset-stub-assets-...` — this is Stitch's internal asset reference and may not be retrievable via MCP API. Extract tokens from the screen HTML directly instead.

### Material Symbols vs Lucide for icons

Stitch uses Material Symbols Outlined (Google Fonts CDN). This breaks in production on GitHub Pages if the CDN is blocked.

**Recommended approach for future projects:**
- Try Material Symbols first if you know the CDN will work
- If icons break in production, switch to Lucide React (self-contained, no CDN)
- Always extract the icon names from the Stitch HTML and map them to Lucide equivalents

Icon mapping reference (Material Symbols → Lucide):
```
dashboard   → LayoutDashboard
settings    → Settings
notifications → Bell
add / plus → Plus
stop        → Square
analytics   → BarChart3
trending_up → TrendingUp
bolt        → Zap
help_outline → HelpCircle
smart_toy   → Bot
warning     → AlertTriangle
activity    → Activity
chevron_right → ChevronRight
logout      → LogOut
receipt_long → FileText
```

---

## Related Docs

- Codex runtime account switch: `docs/runbooks/openai-codex-runtime-account-switch.md`
- Morning meeting template: `docs/runbooks/morning-meeting-decision-template.md`
