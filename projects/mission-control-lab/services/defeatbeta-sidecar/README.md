# DefeatBeta Sidecar

Private/internal-only Lab sidecar prototype for Trading Analytics enrichment.

Current endpoints:

- `GET /health`
- `GET /v1/ticker/{symbol}/analytics-summary`

This is not wired into Docker or Mission Control runtime yet. Run it manually for smoke testing:

```bash
PYTHONPATH=../defeatbeta-probe/.python-packages python3 app.py --host 127.0.0.1 --port 8791
```

The sidecar intentionally returns compact normalized Analytics data only. It does not expose arbitrary Python, SQL, workbook, transcript, or file access.
