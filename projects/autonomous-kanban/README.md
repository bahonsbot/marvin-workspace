# Autonomous Kanban

A 3-column Kanban board for markdown task files:

- `/data/.openclaw/workspace/AUTONOMOUS.md`
- `/data/.openclaw/workspace/memory/tasks-log.md`

## Features

- To Do / In Progress / Done columns
- Parses **Open Backlog** section from `AUTONOMOUS.md` (`- ` bullets)
- Parses completed tasks from `tasks-log.md` (`- ✅` lines)
- Task move actions that update markdown files
- Auto-refresh every 30 seconds
- Responsive Tailwind UI (mobile + desktop)
- Static export config enabled (`output: "export"`)

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
```

Static output is generated in `out/`.

## Notes

- Runtime file updates rely on API routes (`/api/board`, `/api/move`) and local filesystem access.
- If you deploy strictly as static files on GitHub Pages, those API routes are not available; the UI export still works, but markdown mutations require a server runtime.
- You can override file paths with env vars:
  - `AUTONOMOUS_FILE_PATH`
  - `TASK_LOG_FILE_PATH`
