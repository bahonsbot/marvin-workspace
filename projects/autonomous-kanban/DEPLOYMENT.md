# Deployment Guide

## GitHub Pages URL

**Live URL:** https://bahonsbot.github.io/marvin-workspace/autonomous-kanban/

## Deployment Method

The project deploys to GitHub Pages via GitHub Actions workflow (`.github/workflows/deploy.yml`).
- **Trigger:** Push to master branch with changes in `projects/autonomous-kanban/**`
- **Output:** Static export to `docs/autonomous-kanban/` folder
- **URL path:** `/autonomous-kanban/`

## API Routes Limitation

⚠️ **Important:** The project contains API routes (`src/pages/api/board.ts`, `src/pages/api/move.ts`) that perform file-based read/write operations. These **will not work** on GitHub Pages because:

1. GitHub Pages only serves static files - no server-side code execution
2. The API routes are excluded from the static export
3. There is no backend server to handle file I/O

### Local Development (API routes work)

```bash
cd projects/autonomous-kanban
npm run dev
# API routes available at http://localhost:3000/api/board
```

### Fallback Options for Production

If you need the kanban board to persist data in production:

1. **Client-side storage only** - Use localStorage/IndexedDB in the browser
2. **External backend** - Deploy API routes to a separate service (Vercel, Railway, Render)
3. **Third-party API** - Use a headless CMS or database-as-a-service (Supabase, Firebase)

## Manual Deployment

```bash
cd projects/autonomous-kanban
GITHUB_PAGES=true npm run build
# Output in out/ folder - commit to master in docs/autonomous-kanban/
```