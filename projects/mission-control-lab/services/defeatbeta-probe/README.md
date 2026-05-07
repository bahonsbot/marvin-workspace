# DefeatBeta Probe

Lab-only Phase 0 probe for `defeatbeta-api`.

This is intentionally not a service and not a public endpoint. It installs Python packages into `.python-packages/` and keeps runtime caches under `.cache/` inside this folder.

Run:

```bash
python3 probe.py AAPL MSFT ASML TSM
```

Generated JSON reports are written under `reports/` and ignored by git.
