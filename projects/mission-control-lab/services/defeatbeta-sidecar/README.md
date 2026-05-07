# DefeatBeta Sidecar

Private/internal-only Lab sidecar prototype for Trading Analytics enrichment.

Current endpoints:

- `GET /health`
- `GET /v1/ticker/{symbol}/analytics-summary`

Lab preview now starts/stops this sidecar as an internal localhost-only service using `.lab-runtime/defeatbeta-sidecar.pid` and `.lab-runtime/defeatbeta-sidecar.log`. Manual smoke command:

```bash
PYTHONPATH=../defeatbeta-probe/.python-packages python3 app.py --host 127.0.0.1 --port 8791
```

The sidecar intentionally returns compact normalized Analytics data only. It does not expose arbitrary Python, SQL, workbook, transcript, or file access.

Runtime defaults:

- host: `127.0.0.1`
- port: `8791`
- adapter URL: `http://127.0.0.1:8791`
- health: `GET /health`
- managed by: `scripts/preview-start.sh`, `scripts/preview-stop.sh`, `scripts/lab-health.sh`
