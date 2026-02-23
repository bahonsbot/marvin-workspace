---
name: google_maps_pro
description: Handles travel planning, restaurant recommendations, place lookup, and route/tour calculations with strict Google Maps cost controls. Use when Philippe asks for itineraries, route planning, travel time comparisons, or location recommendations (especially via Telegram).
metadata:
  openclaw:
    requires:
      env: ["GOOGLE_MAPS_API_KEY"]
---

# Google Maps Pro

Provide high-quality travel outcomes while minimizing API spend.

## Operating defaults

- Never expose API keys in replies, logs, memory files, or commits.
- Ask for missing context before expensive calls:
  - current city/area,
  - transport mode,
  - time constraints,
  - preferences (food type, vibe, budget).
- Output style: bullet summary first, then offer details on request.

## Decision defaults (Philippe-specific)

- **Geography:** do not assume location silently. Ask to confirm where he is now.
- **Transport mode:** ask first if not stated.
- **Restaurant ranking:** prioritize best-rated places with **at least 50 ratings**.
- **Itinerary sizing:**
  - sightseeing-only: 5-8 stops,
  - mixed day (food/drinks/rest): balanced plan.

## Budget and quota guardrails

- Daily budget targets:
  - Places: 320 requests/day
  - Routes (traffic): 160 requests/day
- If usage appears near limit, send a proactive warning.
- On `429` or `QUERY_OVER_LIMIT`, explain clearly that daily free tier is reached and suggest:
  1) waiting until tomorrow, or
  2) manual search fallback.

## Field mask rules (mandatory)

Use the minimum required fields only.

| API Type | Field Mask | Purpose |
|---|---|---|
| Simple Route | `routes.duration,routes.distanceMeters` | A→B travel estimate |
| Tour Matrix | `originIndex,destinationIndex,duration,distanceMeters` | Multi-stop planning |
| Places | `id,displayName,formattedAddress` | Search and shortlist |

Notes:
- Matrix indexes are required to map each result to origin/destination pairs.
- Including origin/destination indexes in matrix does not change practical cost versus a valid matrix response.

## Session token rule

For autocomplete→place detail flows, always generate a `uuid4` `sessionToken` and reuse it through the full flow.

## Traffic usage rule

Only use traffic-aware routing when user asks for current/accurate timing.
- Trigger words: “accurate”, “current”, “right now”, “live traffic”.
- Otherwise use standard routing.

## Vietnam local routing note

In Vietnam, `TWO_WHEELER` often yields better realistic routing for local trips and bridge constraints. But do **not** assume it automatically.
- Ask user mode first.
- If user says motorbike/scooter: use `TWO_WHEELER`.
- If user says car/private driver: use `DRIVE`.

## Batching rule (critical)

If user asks for a full-day itinerary or multi-stop optimization, call **route matrix once** for all stops. Do not call point-to-point route API for each leg unless matrix is unavailable.

## Interaction flow

1. Clarify missing requirements quickly (location, mode, timing, trip style).
2. Build candidate stops (or restaurants) with minimal fields.
3. Run one matrix for multi-stop plans.
4. Rank and produce best outcome.
5. Return concise bullets first.
6. Ask if Philippe wants detailed legs, alternates, or map links.

## Telegram behavior

When invoked from Telegram, keep the first response concise and practical:
- plan summary,
- best options,
- rough travel durations,
- one follow-up question if needed.

## Tools and references

- Use `scripts/get_tour_plan.py` for route matrix calls.
- Read `references/integration.md` for request patterns and error handling.
