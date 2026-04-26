# Mission Control Savepoint — R3 Preview WS Debug — 2026-04-23

## Purpose
This savepoint captures the exact Mission Control state after the first focused R3 proof attempt on the preview websocket path, including the real fix that landed, what it proved, and what is still blocked.

It is intended to let a future agent resume without re-deriving which transport assumptions are already disproven and which seam still needs tracing.

---

## Executive summary
R3 is still not complete, but the problem is now much narrower than before.

What is now firmly established:
1. **The Gateway websocket contract itself is healthy.**
   - direct websocket probes to the Gateway endpoint produce `connect.challenge` immediately
   - the upstream Gateway is not the current blocker

2. **The Mission Control sidecar can do more than was first assumed.**
   - direct sidecar probes showed `connect.challenge` flowing through
   - the sidecar can also surface a successful `mc-server-connect` response when the client stays open long enough
   - so the sidecar is not simply "dead" or universally failing

3. **A real preview websocket proxy bug was fixed.**
   - the preview websocket path had been implemented as a raw upgraded TCP tunnel
   - this was replaced with a websocket-to-websocket proxy bridge
   - that fix was committed as `3f8f904` (`mission-control: proxy runtime bridge via websocket client`)

4. **The remaining blocker is now post-connect proof, not dead transport.**
   - after adding temporary debug logging and rebuilding preview, end-to-end preview websocket probes on port `3005` did surface both `connect.challenge` and a successful `mc-server-connect`
   - this means the full preview-visible path can now complete the guarded server-owned connect handshake
   - the unresolved seam moved one step later: proving one real post-connect RPC cleanly over that same path

---

## Durable current state

### Preview env/runtime state
The current preview runtime is deliberately exercising the guarded R3 path:
- `MISSION_CONTROL_SERVER_CONNECT=1`
- `MISSION_CONTROL_GATEWAY_AUTH_TOKEN` present
- `MISSION_CONTROL_WS_SIDECAR_TOKEN` present
- `MISSION_CONTROL_WS_UPSTREAM_ORIGIN=https://preview.motiondisplay.cloud`

This means the preview descriptor currently reports:
- `auth.serverConnectConfigured: true`
- `auth.gatewaySessionAuthConfigured: true`

But that descriptor remains **configuration evidence**, not proof that the browser-visible preview websocket path is actually completing the server-owned connect flow.

---

## What was proved

### 1. Direct Gateway websocket is healthy
Direct websocket probes to:
- `ws://127.0.0.1:18789`

showed:
- socket open succeeds quickly
- first event is `connect.challenge`

Durable conclusion:
> The Gateway websocket endpoint is alive and challenge-first as expected.

This removes the Gateway contract itself as the likely root cause for the current preview-path failure.

---

### 2. Direct sidecar path is capable of challenge/connect behavior
Direct probes to:
- `ws://127.0.0.1:3006/mission-control-runtime?bridgeToken=...`

showed two important facts:
- the sidecar can pass through `connect.challenge`
- in a cleaner probe, the sidecar could also surface a successful `mc-server-connect` response

This means earlier log lines like:
- `WebSocket was closed before the connection was established`
- upstream close `1006`

should not be over-interpreted as proof that the sidecar cannot connect upstream. In several earlier cases, those logs were consistent with the client side closing first while the upstream was still connecting.

Durable conclusion:
> The sidecar is not the primary disproven component anymore.

---

### 3. Full preview path can now complete the guarded connect handshake
End-to-end preview probes to:
- `ws://127.0.0.1:3005/api/runtime-bridge/ws?bridgeToken=...`

after the proxy fix plus temporary debug logging showed:
- socket `OPEN`
- `connect.challenge`
- successful `mc-server-connect` response with protocol `3`

Durable conclusion:
> The preview-visible websocket path is no longer blocked at the handshake layer.
>
> The next proof target is a real post-connect RPC over that same path.

---

## Real fix that landed

### Fixed file
- `projects/mission-control/scripts/preview-origin-proxy.js`

### Problem before the fix
The preview proxy forwarded `/api/runtime-bridge/ws` by opening a raw TCP socket to the sidecar and replaying the HTTP upgrade request manually.

That approach was brittle for this bridge because it relied on low-level raw socket behavior rather than a proper websocket proxy implementation.

### What changed
The preview proxy now:
- accepts the browser websocket with `WebSocketServer({ noServer: true })`
- opens a real upstream `WebSocket(...)` to the sidecar target
- forwards browser -> sidecar frames via websocket APIs
- forwards sidecar -> browser frames via websocket APIs
- closes the pair with normalized close codes/reasons

### Commit
- `3f8f904` `mission-control: proxy runtime bridge via websocket client`

### Why this change should be kept
Even though the end-to-end R3 proof is still blocked, this was a legitimate bug in the preview websocket transport and the new implementation is a safer/fitter transport boundary than raw byte tunneling.

Rollback if absolutely needed:
- revert `3f8f904`

Current recommendation:
- **do not revert yet**
- treat it as a good transport fix unless it is later shown to break something else

---

## What this savepoint disproved

### Disproved hypothesis 1
> "The Gateway endpoint itself might not be emitting the challenge."

False. Direct Gateway probes show `connect.challenge` immediately.

### Disproved hypothesis 2
> "The sidecar path is simply broken and cannot connect upstream."

Too strong / false. Direct sidecar probes showed challenge flow and successful `mc-server-connect` behavior under controlled conditions.

### Disproved hypothesis 3
> "The earlier preview bug was only architectural speculation."

False. The raw socket websocket tunneling in `preview-origin-proxy.js` was a real bug worth fixing.

---

## What remains unresolved

### Main unresolved question
Why does a real post-connect RPC still fail to return cleanly after the preview-visible path successfully completes `connect.challenge -> mc-server-connect`?

### Most likely remaining seam
One of these is now the next likely issue:
1. the chosen follow-on RPC method/params are not valid for the current connected session state
2. the bridge is passing connect correctly but later message flow is noisy or not yet bounded for request/response proof
3. session-target assumptions need tightening before using `chat.history`, `sessions.patch`, or `chat.send` through the preview proof client
4. temporary logging needs one more pass around first post-connect request/response behavior rather than handshake entry

---

## Recommended next move
Do **not** jump to R4 or broaden architecture yet.

Continue with the narrowest next proof slice:
1. keep the current preview transport fix in place
2. use the now-working preview-visible handshake path to prove one bounded post-connect RPC cleanly
3. prefer a minimal proof target such as a valid `chat.history` or `sessions.patch` request against a known-good session key
4. log the first outbound request and first inbound response after `mc-server-connect`
5. once one real RPC works, move immediately to one send/abort/final-event proof for a visible session

Success criterion for the next slice:
- prove that the preview-visible path can do more than handshake
- then decide whether R3 is complete enough to freeze or whether one more bounded RPC/send proof is required

---

## Safe statements for a future agent
A future agent can safely say:
- R3 is still not proved end-to-end
- the Gateway websocket contract is healthy
- the sidecar is more capable than initially assumed
- a real preview websocket proxy bug was fixed and committed as `3f8f904`
- the current blocker is now the full preview websocket path, not the raw Gateway contract

A future agent should **not** say without new proof:
- that preview server-owned connect is fully working end-to-end
- that the sidecar is the sole blocker
- that the preview proxy fix alone completed R3
- that R4 work should start now

---

## Handy references
Core files for the next slice:
- `projects/mission-control/scripts/preview-origin-proxy.js`
- `projects/mission-control/scripts/runtime-bridge-ws-sidecar.js`
- `projects/mission-control/scripts/preview-start.sh`
- `projects/mission-control/.preview-runtime/mission-control-preview.env`
- `projects/mission-control/lib/adapters/orchestrator.ts`
- `projects/mission-control/hooks/useRuntimeBridge.ts`

Earlier savepoint still relevant:
- `projects/_ops/mission-control-savepoint-after-r2-verification-2026-04-23.md`
