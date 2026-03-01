# A/B Enrichment Review - 2026-03-01

## Key metric deltas
- Baseline signals: **30**
- Enriched signals: **50**
- Net lift (enriched - baseline): **+31** (66.7% vs baseline)
- Overlap: **13** shared signals
- Baseline-only: **8**
- Enriched-only: **31**
- Baseline overlap retention: **43.3%** of baseline items also present in enriched
- Enriched novelty share: **62.0%** of enriched items are new vs baseline

## Practical interpretation
Enrichment materially increases signal volume and surfaces many additional candidates. At the same time, overlap is moderate (43.3% baseline retention; 26.0% of enriched set overlaps baseline), which indicates enrichment is changing selection behavior, not just adding small marginal coverage. This is a promising recall gain, but precision impact is still unvalidated from this single snapshot.

## Recommendation
**Gather more data (continue shadow mode)** before promotion.

Reasoning: the lift is strong (+31) but the divergence is high (31 enriched-only vs 8 baseline-only). Keep shadow A/B active for a longer window and compare downstream quality metrics (review outcomes / false-positive rate / actionable-hit rate) before switching production routing to enriched.
