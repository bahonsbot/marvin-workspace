# RSS Feed Audit - March 2, 2026

## Summary

| Status | Count |
|--------|-------|
| ✅ Working | 13 |
| ⚠️ Issues | 4 |
| **Total** | **17** |

---

## ✅ Working Feeds (13)

| Feed | URL | Status | Notes |
|------|-----|--------|-------|
| Business_Bloomberg | rss.app | 200 | Twitter proxy active |
| FinancialJuice | rss.app | 200 | |
| YCombinator | rss.app | 200 | |
| ZeroHedge | rss.app | 200 | |
| UnusualWhales | rss.app | 200 | |
| Reuters_Finance | rss.app | 200 | |
| AP_Top | news.google.com | 200 | |
| Guardian_World | theguardian.com | 200 | |
| Guardian_Business | theguardian.com | 200 | |
| DW_Top | rss.dw.com | 200 | |
| Bloomberg_Tech | news.google.com | 200 | |
| Bloomberg_Markets | news.google.com | 200 | |
| Financial_Times | ft.com | 301 | Redirects but works |

---

## ⚠️ Feeds with Issues (4)

| Feed | Issue | Recommendation |
|------|-------|----------------|
| **MarketWatch** | 301 redirect | Update to new URL format |
| **CNBC_Top** | 403 Forbidden | **Remove** - CNBC blocks RSS |
| **Yahoo_Finance** | 429 Rate Limited | Consider alternative or add API |
| **Nasdaq_News** | Connection failed (000) | **Remove** - feed appears dead |

---

## Recommendations

1. **Remove dead feeds:**
   - `CNBC_Top` - blocks RSS access
   - `Nasdaq_News` - endpoint no longer responds

2. **Investigate/fix:**
   - `Yahoo_Finance` - may need different endpoint or user-agent
   - `MarketWatch` - update to modern RSS URL

3. **Keep as-is:**
   - All rss.app Twitter proxies working well
   - Google News RSS bridges functional
   - Guardian/DW/Bloomberg direct feeds healthy

---

*Audit conducted: 2026-03-02*
