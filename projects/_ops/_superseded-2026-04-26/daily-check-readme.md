# ⚠️ DEPRECATED — Use Mission Control instead

> **This tool is obsolete.** The canonical workspace status view is now the **Mission Control** Tasks page.
> The daily-check dashboard below is kept for reference only and may not function correctly.

---

# Daily Check - Workspace Status View

A lightweight HTML dashboard for checking workspace status at a glance.

## Usage

### Option 1: Local Server (Recommended)
```bash
cd /data/.openclaw/workspace
python3 -m http.server 8080
```
Then open: http://localhost:8080/projects/_ops/daily-check.html

### Option 2: Direct File Open
Open directly in browser:
```
file:///data/.openclaw/workspace/projects/_ops/daily-check.html
```
Note: Some browsers may block JSON fetching due to CORS. Use Option 1 if you see loading errors.

### Option 3: GitHub Pages
If the autonomous-kanban is deployed, this page could also be deployed there.

## What It Shows

- **Kanban Board**: Todo, In Progress, Done counts + recent tasks
- **Last Executor**: Outcome, timestamp, task description
- **Task Queue**: Active and pending subagent tasks
- **Goals**: Active goal categories

## Data Sources

Reads from local workspace files:
- `projects/autonomous-kanban/public/board.json`
- `memory/executor-last-result.json`
- `memory/executor-subagent-queue.json`

All data is local-first. No external services.