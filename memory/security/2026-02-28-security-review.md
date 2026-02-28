# 🔒 NIGHTLY SECURITY REVIEW
**Generated:** 2026-02-28T04:30:00+08:00 (ICT)  
**Scope:** Workspace codebase analysis (4 perspectives)

---

## 📊 EXECUTIVE SUMMARY

| Category | Critical | High | Medium | Low | Info |
|----------|----------|------|--------|-----|------|
| Offensive | 0 | 1 | 2 | 1 | 2 |
| Defensive | 0 | 0 | 2 | 2 | 1 |
| Privacy | 0 | 0 | 1 | 2 | 1 |
| Operational | 0 | 1 | 1 | 1 | 2 |
| **TOTAL** | **0** | **2** | **6** | **6** | **6** |

**Overall Posture:** 🟢 MODERATE - No critical issues found. Basic protections in place.

---

## 1. OFFENSIVE ANALYSIS (Attacker's View)

### HIGH FINDINGS

#### 1.1 Publicly Accessible Supabase URL in Horizons PMS
- **Severity:** HIGH → ACKNOWLEDGED (Feb 28)
- **Issue:** Supabase URL exposed as `NEXT_PUBLIC_SUPABASE_URL` environment variable, making it publicly accessible
- **Note:** URL exposure in client code is standard practice for Supabase. Security depends on Supabase RLS configuration, not code.
- **Evidence:** 
  ```typescript
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  ```
- **Risk:** Attacker can directly query Supabase API if anon key is also exposed
- **Mitigation:** Ensure Supabase RLS (Row Level Security) policies are properly configured

### MEDIUM FINDINGS

#### 1.2 No Input Validation on Booking Form
- **Severity:** MEDIUM
- **File:** `projects/horizons-pms/app/src/app/bookings/bookings-form.tsx`
- **Issue:** Guest name field accepts plain text without sanitization
- **Evidence:** `<input name="guest_name" type="text" required placeholder="e.g. John Doe" />`
- **Risk:** Potential for XSS if data is displayed without escaping, or injection if passed to backend

#### 1.3 Relative Path Usage in Market Intel
- **Severity:** MEDIUM
- **File:** `projects/market-intel/src/signal_generator.py`
- **Issue:** Uses relative paths for file operations
- **Evidence:** `with open('data/patterns.json', 'r') as f:`
- **Risk:** Path traversal could occur if working directory changes

### LOW/INFO FINDINGS

#### 1.4 No Rate Limiting on Public Endpoints
- **Severity:** LOW
- **Issue:** No rate limiting observed on Horizons PMS search endpoints

#### 1.5 Debug/Verbose Error Messages Potential
- **Severity:** INFO
- **Issue:** Error handling could leak stack traces in production

---

## 2. DEFENSIVE ANALYSIS (Protections)

### MEDIUM FINDINGS

#### 2.1 Missing CSRF Protection on Forms
- **Severity:** MEDIUM → DEFERRED (Phase 2)
- **File:** `projects/horizons-pms/app/src/app/bookings/bookings-form.tsx`
- **Issue:** Forms use basic HTML form submission without explicit CSRF tokens
- **Note:** PMS not live yet; defer to Phase 2

#### 2.2 No Input Length Limits
- **Severity:** MEDIUM → DEFERRED (Phase 2)
- **File:** `projects/horizons-pms/app/src/app/bookings/bookings-form.tsx`
- **Issue:** Text inputs (guest_name, notes) lack maxLength attributes
- **Note:** PMS not live yet; defer to Phase 2

### LOW FINDINGS

#### 2.3 Supabase Key Environment Variable Chain
- **Severity:** LOW
- **Issue:** Fallback from `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `NEXT_PUBLIC_SUPABASE_ANON_KEY` could cause confusion

#### 2.4 Cookie Settings Not Explicit
- **Severity:** LOW
- **File:** `projects/horizons-pms/app/src/lib/supabase/server.ts`
- **Issue:** Cookie options (HttpOnly, Secure, SameSite) not explicitly set

### INFO FINDINGS

#### 2.5 Audit Logging Present
- **Severity:** INFO
- **Positive:** `scripts/audit-log.sh` implements input sanitization for log injection prevention

---

## 3. DATA PRIVACY ANALYSIS

### MEDIUM FINDINGS

#### 3.1 PII in Memory Files
- **Severity:** MEDIUM → ACKNOWLEDGED
- **File:** `life/areas/people/philippe/items.json`
- **Issue:** Contains personal facts about user
- **Note:** This is expected — the AI's memory about the user. Not shared externally.

### LOW FINDINGS

#### 3.2 World-Readable Token Manifest
- **Severity:** LOW
- **File:** `config/token-manifest.json`
- **Evidence:** File permissions 644 (world-readable)
- **Note:** File only contains metadata, no actual secrets

#### 3.3 No Data Retention Policy
- **Severity:** LOW
- **Issue:** Market intel data (rss_alerts.json, reddit_alerts.json) accumulates without cleanup

### INFO FINDINGS

#### 3.4 Supabase Handles Data Securely
- **Severity:** INFO
- **Positive:** Supabase client configured, relies on Supabase's security model

---

## 4. OPERATIONAL ANALYSIS

### HIGH FINDINGS

#### 4.1 Token Expiration - GitHub Token
- **Severity:** HIGH → RESOLVED (Feb 28)
- **Issue:** github-api-token expires 2026-03-03
- **Resolution:** Token refreshed by Philippe on Feb 28

### MEDIUM FINDINGS

#### 4.2 No Backup Encryption
- **Severity:** MEDIUM → ACKNOWLEDGED
- **Issue:** Backup directory may contain sensitive data
- **Note:** VPS snapshots handle backups; no local backups needed

### LOW FINDINGS

#### 4.3 Cron Job Overlap
- **Severity:** LOW
- **Issue:** platform-health-council (03:00) and nightly-security-review (03:30) run sequentially
- **Impact:** Could cause resource contention

### INFO FINDINGS

#### 4.4 Heartbeat Disabled
- **Severity:** INFO
- **Note:** Fixed heartbeat cron disabled due to noisy Telegram delivery (2026-02-27)

#### 4.5 Model Switching Scripts Safe
- **Positive:** `switch_model.sh` and `switch_model_auto.sh` properly validate input against whitelist

---

## 📋 RECOMMENDATIONS SUMMARY

| # | Finding | Severity | Action |
|---|---------|----------|--------|
| 1 | Token expiration (GitHub) | HIGH | Regenerate before Mar 3 |
| 2 | Supabase RLS policies | HIGH | Verify enforce |
| 3 | Input validation (forms) | MEDIUM | Add validation/sanitization |
| 4 | CSRF protection | MEDIUM | Add tokens to forms |
| 5 | PII in life/ directory | MEDIUM | Encrypt or restrict |
| 6 | Backup encryption | MEDIUM | Verify encryption |
| 7 | Input length limits | MEDIUM | Add maxLength attrs |
| 8 | Cookie settings | LOW | Explicit HttpOnly/Secure |

---

## ✅ POSITIVE SECURITY POSTURES

1. **Audit logging** with input sanitization prevents log injection
2. **Model switching** scripts use whitelist validation
3. **File permissions** on auth.json are correct (600)
4. **Cron jobs** have defined schedules and logging
5. **No hardcoded secrets** found in codebase (auth.json protected)

---

*Report generated by Marvin's nightly security review (4:30 AM ICT)*
