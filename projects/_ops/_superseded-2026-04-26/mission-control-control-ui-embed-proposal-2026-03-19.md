# Mission Control → Control UI Embed Proposal (2026-03-19)

## Goal
Allow Mission Control to embed the real OpenClaw Control UI chat inside the Chat page, while keeping the default security posture as **deny-by-default** and avoiding a broad clickjacking regression.

## Current Verified Reality

### Live behavior
The current local Control UI endpoint returns:
- `X-Frame-Options: DENY`
- `Content-Security-Policy: ... frame-ancestors 'none' ...`

So stock Control UI embedding is currently blocked by explicit server-side policy.

### Verified code-level enforcement
In the compiled OpenClaw gateway bundle:
- File: `/usr/local/lib/node_modules/openclaw/dist/gateway-cli-C2ZZYgwu.js`
- `buildControlUiCspHeader()` currently hardcodes:
  - `frame-ancestors 'none'`
- `applyControlUiSecurityHeaders(res)` currently hardcodes:
  - `X-Frame-Options: DENY`
  - `Content-Security-Policy: buildControlUiCspHeader()`

### Verified config surface today
Current `gateway.controlUi` schema/config includes fields like:
- `allowedOrigins`
- `dangerouslyAllowHostHeaderOriginFallback`
- `allowInsecureAuth`
- `dangerouslyDisableDeviceAuth`

These appear to govern **who may access the Control UI**, not **who may frame/embed it**.

There is no documented first-class config field today for:
- `frameAncestors`
- `embedOrigins`
- `allowEmbedding`
- `xFrameOptions`

## Product Interpretation
There is no ready-made stock embed mode in the current OpenClaw version.
If others have an embedded “Mission Control”-style setup, they are likely doing one of:
1. custom-patched OpenClaw Control UI headers,
2. reverse-proxy header rewriting,
3. a native custom chat shell that reuses the same backend behavior without iframe embedding.

## Recommended Direction

### Best path
Implement a **narrow embed allowlist** in OpenClaw itself.

This should preserve:
- default = no embedding
- explicit opt-in only
- scoped trusted origins only

This is preferable to reverse-proxy header rewriting because it is:
- more honest,
- easier to reason about,
- less brittle over upgrades,
- safer to document and maintain.

## Minimal Patch Shape

### New config concept
Add a new config field under `gateway.controlUi`, for example:

```json
{
  "gateway": {
    "controlUi": {
      "embedAllowedOrigins": [
        "http://127.0.0.1:3005",
        "https://preview.motiondisplay.cloud"
      ]
    }
  }
}
```

Name can vary, but the behavior should be:
- absent/empty => current behavior remains unchanged
- non-empty => only those origins may frame the Control UI

### Header behavior
If `embedAllowedOrigins` is empty:
- keep current behavior
  - `X-Frame-Options: DENY`
  - `frame-ancestors 'none'`

If `embedAllowedOrigins` is non-empty:
- remove `X-Frame-Options: DENY`
  - reason: `X-Frame-Options` cannot express multiple modern allowlisted origins safely; `ALLOW-FROM` is obsolete and unreliable
- build CSP with:
  - `frame-ancestors 'self' <allowed-origin-1> <allowed-origin-2> ...`

Example:
```http
Content-Security-Policy: default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'self' http://127.0.0.1:3005 https://preview.motiondisplay.cloud; ...
```

### Minimal implementation points
Patch the control UI security-header path so it becomes config-aware:

1. Replace the current fixed function:
- `buildControlUiCspHeader()`

with something like:
- `buildControlUiCspHeader(embedAllowedOrigins?: string[])`

2. Replace the current fixed function:
- `applyControlUiSecurityHeaders(res)`

with something like:
- `applyControlUiSecurityHeaders(res, options)`

Where `options` includes sanitized `embedAllowedOrigins`.

3. Thread `gateway.controlUi.embedAllowedOrigins` from config resolution into the Control UI serving path.

## Security Constraints
If we do this, the feature should obey all of these:

1. **Default deny stays intact**
   - no config => same current behavior

2. **Explicit origin allowlist only**
   - no wildcard
   - no scheme-less hostnames
   - no implicit Host-header fallback for embedding

3. **Origin validation required**
   - only `http://` / `https://`
   - no path/query/hash
   - canonicalized origin strings only

4. **Do not couple embed policy to `allowedOrigins`**
   - access origins and frame ancestors are different concerns
   - overloading the existing field would make future reasoning messier

5. **Prefer same-origin / explicitly trusted origins**
   - local Mission Control preview and production preview origin should be intentionally declared

## Why not reverse proxy rewrite first?
Reverse proxy rewriting could work, but it is the worse primary solution because:
- it hides the true product behavior
- it is easy to forget during upgrades
- it splits security logic across layers
- it makes debugging harder

Reverse proxy rewrite is acceptable as a temporary experiment, not as the clean durable path.

## Why not use top-level window only?
Top-level `gatewayUrl` remains a valid fallback, but it does not satisfy the product goal Philippe clarified:
- keep Agent Rail on the left
- real chat in the main center area
- minimal surrounding chrome

That target is best served by a real embed path or a native custom chat surface.

## Recommended Execution Sequence

### Phase 1
Implement config-aware embed allowlist in OpenClaw code, but do not enable it by default.

### Phase 2
After patch exists, add only the narrow trusted origins needed for Mission Control.

Likely initial candidates:
- `http://127.0.0.1:3005`
- `http://localhost:3005`
- possibly the final external Mission Control preview origin if the deployment model requires it

### Phase 3
Test iframe embed in Mission Control Chat page with Agent Rail preserved.

## Rollback
Rollback is simple if done this way:
1. remove `embedAllowedOrigins` from config
2. restart gateway
3. Control UI returns to:
   - `X-Frame-Options: DENY`
   - `frame-ancestors 'none'`

## Recommendation
This is the best current path if the goal is truly:
- real Control UI chat,
- embedded in Mission Control,
- without inventing a fake parallel chat transport.

If approved, next work should be:
1. patch OpenClaw locally to add `embedAllowedOrigins`
2. validate headers locally
3. wire Mission Control Chat page to iframe/embed the Control UI cleanly
