# HTML Artifact Audit - 2026-03-01

## Scope
- Target: `projects/market-intel-news-reader/news_feed.json`
- Audit set: top 10 feed entries by current sort order (latest first)
- Goal: detect residual HTML artifacts and identify likely source class

## Top 10 Entry Results (pass/fail)

| # | id | type | result | notes |
|---|---|---|---|---|
| 1 | `rss_2026-03-01T091529735997Z` | rss | PASS | No HTML tag/entity residue in title/summary/excerpt |
| 2 | `rss_2026-03-01T091529735980Z` | rss | PASS | No HTML tag/entity residue |
| 3 | `rss_2026-03-01T091529735937Z` | rss | PASS | No HTML tag/entity residue |
| 4 | `rss_2026-03-01T091529304837Z` | rss | PASS | No HTML tag/entity residue |
| 5 | `rss_2026-03-01T091529304779Z` | rss | PASS | No HTML tag/entity residue |
| 6 | `rss_2026-03-01T091529304748Z` | rss | PASS | No HTML tag/entity residue |
| 7 | `rss_2026-03-01T091529304664Z` | rss | PASS | No HTML tag/entity residue |
| 8 | `rss_2026-03-01T091529304644Z` | rss | PASS | No HTML tag/entity residue |
| 9 | `rss_2026-03-01T091529304615Z` | rss | PASS | No HTML tag/entity residue |
| 10 | `rss_2026-03-01T091529304593Z` | rss | PASS | No HTML tag/entity residue |

## Residual artifact classes observed in current feed (outside top 10)

Even though top 10 is clean, residual content artifacts still exist elsewhere in the same generated feed:

1. **JavaScript blob in excerpt text (`js_blob`)**
   - Example: `"(function(){'use strict';function g(){..."`
   - Seen in AP entries routed through `news.google.com/rss/articles/...`
   - Likely source class: **fetched article body / article excerpt enrichment** (`enriched_text_source: "article_excerpt"`)

2. **Navigation boilerplate from article page (`nav_boilerplate`)**
   - Example: `"Skip to main content Skip to navigation ..."`
   - Seen in Guardian entries with very long `article_excerpt`
   - Likely source class: **fetched article body / article excerpt enrichment** (page chrome captured instead of article-only text)

3. **Markdown table residue in Reddit top comments (`md_table`)**
   - Example: `"**User Report**| | | |\n:--|:--|:--|:--"`
   - Seen in multiple `reddit` items under `top_comment_snippet`
   - Likely source class: **reddit fields** (comment markdown preserved and then embedded into summary)

## Root-cause hypothesis

1. **Top-10 cleanliness is currently due to source mix, not guaranteed sanitization end-state**
   - Latest 10 happened to be clean RSS summaries/headlines.
   - Artifact-prone items still exist lower in list and can move into top 10 on next run.

2. **Article excerpt enrichment currently trusts extracted text too much**
   - HTML cleanup likely strips many tags, but not enough content filtering for script/nav boilerplate.
   - AP via Google News redirect pages appears to return non-article JS payloads.

3. **Reddit markdown is intentionally retained but not normalized for reader UX**
   - Markdown tables are valid text but look like artifacts in compact summaries.

## Fix recommendations

### Quick fixes (low-risk, immediate)

1. **Guardrail: drop suspicious excerpts before merge into summary**
   - If excerpt contains any of:
     - `"(function(){"`, `"addEventListener("`, `"Copyright The Closure Library"`
     - `"Skip to main content"`
   - Then set `article_excerpt=""` and keep plain summary/headline.

2. **Length and structure filter for excerpt quality**
   - Reject excerpt when token mix indicates navigation noise (high ratio of repeated menu words like `News`, `Opinion`, `Sport`, `Search`).

3. **Normalize Reddit comment markdown for summary field**
   - Strip markdown table separator lines (`:--|:--|...`) and collapse pipe-heavy rows.

### Robust fixes (higher effort, better long-term)

1. **Source-aware extraction policy**
   - For domains known to be noisy in current extractor path (e.g., `news.google.com` redirect pages), bypass article-body enrichment and use feed summary/title only.

2. **Article-body quality scoring before acceptance**
   - Add acceptance criteria for `article_excerpt`:
     - minimum sentence-like ratio,
     - low script-token ratio,
     - low nav-keyword ratio.
   - Only keep excerpt if score passes threshold.

3. **Dedicated text-clean pipeline per source type**
   - RSS summary cleaner,
   - fetched-body cleaner,
   - reddit markdown-to-plain cleaner.
   - Keep provenance in `enriched_text_source` and optionally `enrichment_quality` for debugging.

## Conclusion
- **Top 10 entries: PASS (10/10 clean).**
- **Feed-level residual artifacts still present** in older/lower-ranked entries, primarily from `article_excerpt` enrichment and Reddit markdown formatting.
- Recommended next step: apply quick guardrails first, then add robust quality scoring to prevent regressions.
