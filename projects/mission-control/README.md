# Mission Control V1 (Scaffold)

Initial local-first scaffold for the Mission Control companion app.

## What exists

- App shell: sidebar, top status bar, right inspector placeholder
- Core routes: Home, Orchestrator, Cron, Tasks, Agents, Logs
- Adapter stubs: home, sessions, cron, tasks, activity
- API skeletons under `app/api/*` wired through adapters

## Important limitation

`/orchestrator` is intentionally **provisional**. It is an integration slot, not a fake finished rewrite of OpenClaw chat/control.

## Local run

```bash
cd /data/.openclaw/workspace/projects/mission-control
npm install
npm run dev
```

Open `http://localhost:3000`.

## Quality checks (non-interactive)

```bash
npm run lint
npm run build
```

ESLint is preconfigured with `next/core-web-vitals` + `next/typescript`, so `npm run lint` runs without setup prompts in CI/local.

## Next implementation step

Wire adapters to real local runtime/workspace sources without introducing a shadow database or alternate source of truth.

## Sudo delegation posture

- Chat seat selection now lives in the Mission Control chat chrome via the `Seat` dropdown.
- `?seat=` is the preferred activation path for Marvin, Sudo, and Vantage. Selecting a seat updates routing truth in-place without injecting starter text into the composer.
- Sudo remains a truthful lead-route seat on top of the main Mission Control session.
- FE / BE / QA delegation is now real: Mission Control can spawn tracked child runs from the Sudo chat surface.
- Marvin oversight is now explicit for structural escalation: blocker, conflict, approval boundary, or elevated uncertainty that Sudo should not auto-continue through.
- Delegated lane defaults are explicit:
  - Frontend Developer: `codex`
  - Backend Developer: `codex`
  - QA Engineer: `minimax2.7`
- Recent delegated runs are stored locally in `data/sudo-delegations.json` and surfaced in chat with status, requested model, child session key, and concise result/error text.
- Orchestration records now carry an explicit oversight state so the UI can distinguish normal Sudo execution from Marvin review and blocking approval requests.

Additional implementation notes: [docs/sudo-delegation-phase2.md](/data/.openclaw/workspace/projects/mission-control/docs/sudo-delegation-phase2.md)

## Operational runbook

For runtime/build/preview troubleshooting, use:

- `/data/.openclaw/workspace/docs/runbooks/mission-control-runtime-preview-runbook.md`

### Service-style runtime commands

Current lane intent:
- `dashboard.motiondisplay.cloud` = canonical live lane
- `lab.motiondisplay.cloud` = durable sandbox lane
- `preview.motiondisplay.cloud` = preview / rollback lane

Preferred operational interface inside the OpenClaw container from `projects/mission-control/`:

```bash
./scripts/mission-control-service-start.sh
./scripts/mission-control-service-stop.sh
./scripts/mission-control-service-restart.sh
./scripts/mission-control-service-health.sh
```

Current implementation note:
- these wrappers currently delegate to the existing preview bundle scripts
- build still uses `./scripts/preview-build.sh`
- preview scripts remain the underlying implementation during the transition

Underlying scripts:

```bash
./scripts/preview-build.sh
./scripts/preview-start.sh
./scripts/preview-stop.sh
./scripts/preview-restart.sh
```
