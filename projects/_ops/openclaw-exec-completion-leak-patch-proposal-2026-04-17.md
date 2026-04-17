# OpenClaw exec-completion / heartbeat prompt leak patch proposal — 2026-04-17

## Problem
Shared runtime bug: async exec completions triggered by `tools.exec.notifyOnExit` can leak both:
1. raw `System (untrusted): [time] Exec finished ...` lines
2. the internal heartbeat prompt text from `buildExecEventPrompt()`

This has been observed in both OpenClaw Control UI and Mission Control, so the issue is upstream/shared rather than Mission Control-only.

## Confirmed code path

### 1) Exec completion becomes an untrusted system event
File: `/data/.npm-global/lib/node_modules/openclaw/dist/server-node-events-CW0RMHTo.js`

Relevant behavior:
- `exec.finished` / `exec.denied` parse payload
- if `tools.exec.notifyOnExit !== false`, they call:
  - `enqueueSystemEvent(text, { sessionKey, contextKey, trusted: false })`
  - `requestHeartbeatNow(... reason: "exec-event")`

So raw completion text is intentionally queued as an **untrusted system event**.

### 2) Heartbeat prompt is generated from exec-event state
File: `/data/.npm-global/lib/node_modules/openclaw/dist/heartbeat-runner-k7YMyolD.js`

Relevant behavior:
- `resolveHeartbeatRunPrompt()` detects `hasExecCompletion`
- it uses `buildExecEventPrompt({ deliverToUser: params.canRelayToUser })`
- internal/non-relay text is:
  - `An async command you ran earlier has completed. The result is shown in the system messages above. Handle the result internally. Do not relay it to the user unless explicitly requested.`

This proves `heartbeat-events-filter.ts` is part of the causal chain, but not the final visibility bug.

### 3) System events are formatted into visible-looking transcript lines
File: `/data/.npm-global/lib/node_modules/openclaw/dist/session-system-events-f3BG7DJD.js`

Relevant behavior:
- `drainFormattedSystemEvents()` formats queued entries as:
  - `System (untrusted): [timestamp] ...`
- these blocks are passed into prompt assembly

### 4) Prompt assembly prepends system-event blocks into reply context
File: `/data/.npm-global/lib/node_modules/openclaw/dist/get-reply-Bt3IWYIA.js`

Relevant behavior:
- `buildReplyPromptBodies()` prepends `systemEventBlocks` to reply bodies

That is expected for internal reasoning, but it becomes a problem if those artifacts later cross the visible transcript boundary.

### 5) Hidden-message filter is too narrow
File: `/data/.npm-global/lib/node_modules/openclaw/dist/session-utils.fs-D0aM3URM.js`

Relevant behavior:
- `isInternalSystemPromptText(rawText)` already detects:
  - `An async command you ran earlier has completed...`
  - heartbeat instructions
  - reminder/cron internal instructions
- but `isHiddenOpenClawTranscriptMessage(message)` only applies that check when `message.role === "user"`

Current logic:
- hide silent assistant tokens (`NO_REPLY`, `HEARTBEAT_OK`)
- if role is not `user`, return false
- only then check `isInternalSystemPromptText(joinRawMessageText(message))`

This is the most likely reason the internal exec-heartbeat prompt can still leak if it is stored/broadcast as a non-user message.

### 6) Live chat suppression only handles heartbeat ACKs, not internal exec prompts
File: `/data/.npm-global/lib/node_modules/openclaw/dist/server.impl-STMC_0uD.js`

Relevant behavior:
- `shouldHideHeartbeatChatOutput()` only controls heartbeat surface visibility at a coarse level
- `normalizeHeartbeatChatFinalText()` strips `HEARTBEAT_OK`-style heartbeat ACKs
- `isSuppressedControlReplyText()` only handles silent control tokens like `NO_REPLY` / `HEARTBEAT_OK`

So if the internal exec prompt text appears as assistant-visible text, current suppression logic does not treat it as hidden.

## Minimal patch recommendation

### Patch 1, primary
File: `session-utils.fs-D0aM3URM.js`

#### Change
Make `isHiddenOpenClawTranscriptMessage(message)` hide internal system prompt text regardless of message role, not only when `role === "user"`.

#### Current shape
```js
function isHiddenOpenClawTranscriptMessage(message) {
  if (!message || typeof message !== "object") return false;
  if (isSilentAssistantTranscriptMessage(message)) return true;
  if (normalizeLowercaseStringOrEmpty(message.role) !== "user") return false;
  return isInternalSystemPromptText(joinRawMessageText(message));
}
```

#### Proposed shape
```js
function isHiddenOpenClawTranscriptMessage(message) {
  if (!message || typeof message !== "object") return false;
  if (isSilentAssistantTranscriptMessage(message)) return true;
  return isInternalSystemPromptText(joinRawMessageText(message));
}
```

#### Why
This is the cleanest shared hide boundary because it affects both:
- transcript reads/history hydration
- live session.message broadcast filtering (`createTranscriptUpdateBroadcastHandler()` also uses `isHiddenOpenClawTranscriptMessage`)

### Patch 2, companion hardening
File: `session-utils.fs-D0aM3URM.js`

Extend `isInternalSystemPromptText(rawText)` to also match raw exec system-event lines, for example:
- `System (untrusted): [..] Exec finished ...`
- `System (untrusted): [..] Exec denied ...`
- `System (untrusted): [..] Exec started ...`

Suggested detection shape:
```js
if (/^system(?: \(untrusted\))?: \[[^\]]+\]\s*exec (started|finished|denied|completed|failed)\b/i.test(raw)) return true;
```

#### Why
This catches the raw `System (untrusted)` exec lines themselves at the same shared hide boundary.

## Optional secondary patch
File: `/data/.npm-global/lib/node_modules/openclaw/dist/server.impl-STMC_0uD.js`

If live assistant-visible text can still surface before transcript filtering, add an explicit suppression branch for the internal exec prompt text inside the heartbeat/output suppression path, not just for `HEARTBEAT_OK` tokens.

That would be a belt-and-suspenders guard, but the primary boundary should still be `isHiddenOpenClawTranscriptMessage()`.

## Recommendation
Best first fix: Patch 1 + Patch 2.

Reason:
- smallest shared change
- directly addresses both observed leak forms
- less risky than removing exec system events from internal prompt assembly entirely
- preserves internal reasoning context while blocking user-visible transcript leakage
