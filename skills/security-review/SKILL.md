---
name: security-review
description: Automated nightly security analysis of the codebase. Runs at 3:30am Vietnam time, analyzes code from offensive, defensive, privacy, and operational perspectives, delivers structured report to Telegram.
---

# Security Review Skill

## Overview

This skill runs an automated security review of the workspace codebase at 3:30am Vietnam time. It uses AI to analyze code holistically, not just static rules.

## Four Analysis Perspectives

### 1. Offensive (Attacker's View)
- What could an attacker exploit?
- Injection vulnerabilities (SQL, command, XSS)
- Authentication/authorization bypasses
- Dependency vulnerabilities
- Information disclosure
- Reverse engineering risks

### 2. Defensive (Protections)
- Are protections adequate?
- Input validation
- Encryption (at rest, in transit)
- Access controls
- Rate limiting
- Error handling (don't leak details)

### 3. Data Privacy
- Is sensitive data handled correctly?
- PII handling
- Secrets management (API keys, tokens)
- Data retention
- Logging practices (is PII logged?)
- Third-party data sharing

### 4. Operational Realism
- Are security measures practical or theater?
- Realistic threat model
- Usability vs security tradeoffs
- Maintenance burden
- False sense of security
- Incident response readiness

## Process

1. **Scan codebase**: Find all code files (.py, .sh, .json)
2. **Spawn 4 sub-agents** (one per perspective), each analyzes relevant files in parallel
3. **Aggregate findings**: Combine into structured report
4. **Classify severity**: Critical / High / Medium / Low / Info
5. **Deliver to Telegram**: Numbered findings, critical = immediate alert
6. **Store report**: Save to memory/ for history

## Output Format

```
🔒 NIGHTLY SECURITY REVIEW
Generated: [timestamp]
Scope: [list of files analyzed]

══════════════════════════════
CRITICAL FINDINGS
══════════════════════════════
[numbered critical issues]

══════════════════════════════
HIGH FINDINGS
══════════════════════════════
[numbered high issues]

══════════════════════════════
MEDIUM FINDINGS
══════════════════════════════
[numbered medium issues]

══════════════════════════════
LOW/INFO FINDINGS
══════════════════════════════
[numbered low issues]

══════════════════════════════
RECOMMENDATIONS SUMMARY
══════════════════════════════
1. [Title] - [severity]
2. [Title] - [severity]
...
```

## Deep Dives

When user asks "deeper dive on recommendation #[N]", provide:
- Full evidence (code snippets, file paths, line numbers)
- Exploit scenario
- Remediation steps
- References

## Critical Alert

If critical findings exist:
- Use urgent tone
- Include immediate action items
- Tag with 🚨

## Files to Exclude from Analysis
- .git/ directory
- backup/ directory
- memory/ directory
- .openclaw/ directory
- *.bak files
- _meta.json files

## Known False Positives (Do Not Flag)

The following files may appear to contain secrets but are safe by design:

### auth.json
- Contains OAuth tokens (access/refresh tokens) for model providers
- **Why safe:** Protected by file permissions (600) AND .gitignore — never leaks to git
- OAuth requires file-based storage — cannot use env vars for Codex OAuth
- **Policy override:** When mode is 600 and file is git-ignored, treat as ACCEPTED RISK (INFO only), never HIGH/CRITICAL
- Only flag if: file permissions are wrong (world-readable) OR file is in .gitignore is broken

### config/token-manifest.json
- Token metadata tracker (expiration dates, owners, notes)
- **Why safe:** Contains NO actual credential values — only metadata
- Only flag if: actual "value" or "token" fields appear with real secrets

### config/*.json (general)
- Configuration files often contain placeholder or sample data
- Only flag real secrets, not metadata about secrets

### switch_model.sh / switch_model_auto.sh
- Input is validated against whitelist (minimax/codex), then maps to hardcoded model names
- **Why safe:** User input is never passed to jq — only used for validation, then hardcoded strings are written
- Only flag if: input validation is removed AND user input flows into jq
