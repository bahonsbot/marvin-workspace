# Dependency Inventory

Last updated: 2026-03-09
Owner: Platform Health Council follow-up (WARN-5)

## Python

### Workspace root
- File: `requirements.txt`
- Declared:
  - `requests==2.32.5`
- Purpose: shared utility scripts at workspace level.

### `projects/futures-bot/`
- File: `projects/futures-bot/requirements.txt`
- Declared:
  - `pytest>=8.0.0`
  - `PyYAML>=6.0.0`
  - `requests>=2.31.0`
- Notes: test/runtime deps are declared in-project.

### `projects/autonomous-trading-bot/`
- **No pinned dependency file currently found** (`requirements.txt` / `pyproject.toml` missing).
- Current state: project runs with local environment + imports in `src/`.
- Risk: dependency drift and harder reproducibility.
- Follow-up recommendation:
  1) create `requirements.txt` from verified runtime deps,
  2) pin versions after test pass,
  3) add periodic `pip list --outdated` check.

## Node.js

### `projects/autonomous-kanban/`
- File: `projects/autonomous-kanban/package.json`
- Build artifact mirror present: `projects/autonomous-kanban/.next/package.json`
- Notes: source `package.json` is authoritative.

### `projects-cryo/horizons-pms/app/`
- File: `projects-cryo/horizons-pms/app/package.json`
- Notes: project retired to cryo; dependency updates paused indefinitely.

## Inventory Gaps (tracked)

1. `autonomous-trading-bot` missing first-class dependency manifest.
2. No automated weekly outdated-dependency scan yet (covered by WARN-6).

## Maintenance Rule

When adding a new project:
- Python: include `requirements.txt` or `pyproject.toml`.
- Node: include `package.json` + lockfile.
- Update this file in the same PR/commit.
