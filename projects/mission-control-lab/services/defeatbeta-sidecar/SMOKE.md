# DefeatBeta Sidecar Smoke Results

Date: 2026-05-07

Manual local command:

```bash
PYTHONPATH=projects/mission-control-lab/services/defeatbeta-probe/.python-packages \
  python3 projects/mission-control-lab/services/defeatbeta-sidecar/app.py --host 127.0.0.1 --port 8791
```

Endpoints checked:

```text
GET /health
GET /v1/ticker/AAPL/analytics-summary?includeDiagnostics=true
GET /v1/ticker/ASML.AS/analytics-summary
GET /v1/ticker/EQNR.OL/analytics-summary
```

Results:

- `/health`: ok, DefeatBeta package `0.0.52` visible.
- `AAPL`: `status=available`, full coverage for prices/statements/ratios/quality/events, ~10.2s response in warm local run.
- `ASML.AS`: resolved to `ASML`, `status=available`, full coverage. This confirms first-pass alias mapping works for known ADR/plain-symbol cases.
- `EQNR.OL`: `status=unavailable`, all coverage flags false. This confirms empty datasets are not exposed as misleading zero-valued analytics.

Current posture:

- Sidecar is implemented as a manual/internal prototype only.
- Not wired to Docker, not exposed publicly, not added to Lab restart scripts yet.
- Next step is a TypeScript server-side Lab adapter that calls this endpoint when the sidecar is present and fails soft when absent.
