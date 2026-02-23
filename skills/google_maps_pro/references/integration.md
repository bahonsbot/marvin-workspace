# Google Maps Pro Integration Notes

## Environment

```bash
export GOOGLE_MAPS_API_KEY="<set in environment only>"
```

Never store this key in markdown, git history, memory files, or chat output.

## Request patterns

### Places shortlist (cost-safe)
- Request only: `id,displayName,formattedAddress`
- Apply ranking preference:
  - rating DESC,
  - ratings_count >= 50 filter.

### Simple route (A to B)
- Field mask: `routes.duration,routes.distanceMeters`
- Use traffic aware only when explicitly requested.

### Tour planning (3+ stops)
- Use matrix endpoint once.
- Field mask: `originIndex,destinationIndex,duration,distanceMeters`
- Build full day itinerary from single matrix result.

## Error handling

### Quota errors
If API returns `429` or `QUERY_OVER_LIMIT`:
1. Tell user daily free tier is reached.
2. Offer manual-search fallback.
3. Suggest retry tomorrow.

### Near-limit warning
If request volume appears near daily cap, proactively warn before next expensive step.

## Output style

Always send:
1. concise bullet summary first,
2. then offer “details on request”.

## Clarification checklist before calls

Ask quickly when missing:
- Current location / city,
- Transport mode (motorbike vs car),
- Time window,
- Trip type (sightseeing-only or mixed day).
