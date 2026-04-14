# Mission Control Dependency Migration Plan

Last updated: 2026-04-14
Owner: Marvin / Philippe
Scope: planned dependency migration for `projects/mission-control` only

## Purpose

Mission Control is materially behind the rest of the workspace front-end stack:
- `next` `14.2.35` → latest `16.2.3`
- `react` / `react-dom` `18.3.1` → latest `19.2.5`
- `typescript` `5.6.3` → latest `6.0.2`
- `eslint-config-next` `14.2.35` → latest `16.2.3`

This is not a safe blind-bump task. Treat it as a phased migration with explicit verification after each step.

## Current Baseline (verified 2026-04-14)

### Package posture
```json
{
  "next": "^14.2.35",
  "react": "18.3.1",
  "react-dom": "18.3.1",
  "typescript": "5.6.3",
  "eslint": "^8.57.1",
  "eslint-config-next": "^14.2.35"
}
```

### Build / lint baseline
- `npm run lint` → PASS with 1 warning
  - `components/agents/AgentSeatCard.tsx`: `@next/next/no-img-element`
- `npm run build` → PASS on current stack
- Current build output: Next.js `14.2.35`
- Middleware active and building successfully
- App Router in use (`app/` directory, route handlers, middleware)

## Why this needs a plan

The risk is not from patch bumps. The risk is from a framework-generation jump that crosses:
- Next 14 → 15 → 16
- React 18 → 19
- TypeScript 5.6 → 6
- Next ESLint integration changes
- Next config key changes
- request/search-param API changes across App Router surfaces

## Codebase-specific likely breakpoints

These are the highest-probability breakpoints based on the current Mission Control codebase.

### 1. `next lint` script may stop being the right path
Current script:
```json
"lint": "next lint"
```

Risk:
- newer Next versions have moved linting expectations closer to plain ESLint CLI flows
- even if `next lint` still works during some upgrade step, it should not be treated as the durable end-state

Planned response:
- migrate lint script to plain ESLint when the Next/ESLint stack is upgraded
- verify rule coverage remains equivalent

### 2. `next.config.js` experimental key drift
Current config:
```js
experimental: {
  webpackBuildWorker: false,
  serverComponentsExternalPackages: ['@fugood/whisper.node', '@fugood/node-whisper-linux-x64'],
}
```

Risk:
- `experimental.serverComponentsExternalPackages` has changed across Next releases
- Next 15/16 may expect a different key or treat this as deprecated/no-op
- Mission Control depends on native whisper packages, so this cannot be hand-waved away

Planned response:
- update config keying to the current supported equivalent during the migration
- explicitly verify transcribe/build/runtime behavior after the config change

### 3. Mixed `searchParams` patterns in App Router pages
Current code uses both:
- async-style `searchParams?: Promise<...>` in `app/general/chat/page.tsx`
- sync-style `searchParams?: {...}` in pages like:
  - `app/files/page.tsx`
  - `app/memory/page.tsx`
  - `app/search/page.tsx`

Risk:
- Next request API behavior changed across newer releases
- mixed conventions are a classic upgrade footgun, especially in redirect/compat pages

Planned response:
- normalize page signatures to one verified current pattern during migration
- prioritize redirect/compat pages and server-rendered pages that consume query state

### 4. Middleware auth path must be re-verified
Current middleware:
- performs Basic Auth checks
- inspects forwarded headers
- uses `Buffer.from(..., 'base64')`
- protects all non-local requests except static/image/favicon paths

Risk:
- middleware/runtime behavior is sensitive to framework upgrades
- auth breakage here would make preview access fail in annoying ways

Planned response:
- explicitly verify:
  - localhost bypass still works
  - remote auth challenge still works
  - bad credentials still return `401`
  - missing env still returns `503`

### 5. Native / external package handling for transcription path
Mission Control depends on:
- `@fugood/whisper.node`
- `@fugood/node-whisper-linux-x64`
- `ws`

Risk:
- bundling/server external handling may shift across Next versions
- this can pass type-checking and still fail at runtime or preview start

Planned response:
- include transcription and WS-sidecar smoke tests in the migration verification checklist
- do not declare migration complete on build success alone

### 6. React 19 compatibility pass
Current app uses React 18.3.1.

Risk:
- most code may survive, but provider trees, runtime bridge client hooks, and chat-heavy surfaces are the likely places where stricter behavior, hydration assumptions, or dependency version mismatches show up first

Planned response:
- upgrade React only inside the planned framework migration
- smoke test the following after upgrade:
  - Chat connect/send/stop flow
  - session switching
  - transcript hydration after reload
  - file upload flow
  - Tasks board load and edit actions

## Recommended migration order

Do not jump straight to the latest everything in one move.

### Phase 0 — Safety and evidence
Before any dependency mutation:
1. Philippe takes VPS snapshot
2. create git savepoint/commit
3. capture current `npm run lint`
4. capture current `npm run build`
5. restart/verify preview on current stack if needed

### Phase 1 — Tooling cleanup first
Goal: reduce avoidable noise before the framework jump.

Steps:
1. switch Mission Control lint script from `next lint` to ESLint CLI if required by target stack
2. keep lint green except for intentionally accepted warnings
3. preserve current build success before changing framework versions

### Phase 2 — Next config compatibility
Goal: update config keys that are likely to drift across versions.

Steps:
1. update `next.config.js` to the current supported external-package keying
2. keep `webpackBuildWorker` posture explicit only if still supported and still needed
3. rebuild and confirm native-package handling still works

### Phase 3 — Framework version jump
Goal: move Mission Control to the modern baseline in one bounded migration lane.

Recommended target set:
- `next` `16.2.x`
- `react` `19.2.x`
- `react-dom` `19.2.x`
- `eslint-config-next` matching Next version
- `eslint` compatible with target Next version
- `typescript` hold at a compatible stable version first; do not force TypeScript 6 on the same pass unless clean

Important rule:
- prefer matching the proven `autonomous-kanban` front-end generation where reasonable
- do not add a TypeScript-6 jump on the same pass unless the stack is already clean on the framework upgrade

### Phase 4 — Request API normalization
Goal: fix any page/route signatures that break or warn under the upgraded stack.

Priority targets:
- `app/files/page.tsx`
- `app/memory/page.tsx`
- `app/search/page.tsx`
- any other App Router surface using old request prop assumptions

### Phase 5 — Runtime verification
Build success is necessary, not sufficient.

Required verification:
1. `npm run lint`
2. `npm run build`
3. preview restart succeeds
4. local preview responds on expected port
5. Chat page loads
6. runtime bridge connects
7. send a test chat message
8. session switch still works
9. file upload route still works
10. Tasks page still loads and edits correctly
11. middleware auth still behaves correctly for local and non-local paths
12. if transcription is in scope, verify `/api/transcribe` path still initializes correctly

## What not to bundle into the same change

Avoid combining this migration with:
- design/UI work
- Chat refactors
- preview architecture changes
- auth policy changes
- runtime-bridge rewrites
- broad dependency refreshes across unrelated projects

Keep it boring.

## Rollback posture

If the migration breaks preview/runtime:
1. revert git changes for Mission Control dependency/config updates
2. reinstall from the previous lockfile state
3. rebuild on the old stack
4. if needed, fall back to the VPS snapshot as the hard stop

## Recommendation

### Safe now
- keep autonomous-kanban on small patch/minor updates only
- keep Python patch bumps as separate housekeeping work

### Do next
- perform a dedicated Mission Control dependency migration pass following this runbook

### Do not do
- do not blind-bump all Mission Control packages to latest in one command and hope the preview gods are feeling kind
