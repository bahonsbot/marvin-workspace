# Secrets Rotation Policy

## Overview

This document outlines the practical secrets rotation policy for the project. Regular rotation of secrets reduces the window of exposure if a secret is compromised.

> **Note:** This policy describes the *aspirational* framework. Actual operational controls are implemented via lightweight scripts (see `scripts/check_token_age.py`). There is no formal "Security Team" — rotation is handled by the autonomous agent operator.

## Scope

This policy applies to all secrets including:
- API tokens
- OAuth tokens
- Database credentials
- Encryption keys
- SSH keys
- Service account credentials

## Rotation Schedule

| Secret Type | Rotation Frequency | Max Age |
|-------------|---------------------|---------|
| API Tokens | Every 30 days | 30 days |
| OAuth Tokens | Every 60 days | 90 days |
| Database Credentials | Every 90 days | 90 days |
| Encryption Keys | Every 180 days | 180 days |
| SSH Keys | Every 90 days | 90 days |
| Service Account Keys | Every 30 days | 30 days |

## Automated Checking

Use the provided `scripts/check-token-age.sh` script to monitor token age:

```bash
# Check tokens older than default (30 days)
./scripts/check-token-age.sh

# Check tokens older than 15 days
./scripts/check-token-age.sh 15
```

The script reads token metadata from `config/token-manifest.json` (or environment-configured path) and flags any tokens exceeding the specified age threshold.

## Token Manifest

Each token should be registered in `config/token-manifest.json` with the following structure:

```json
{
  "tokens": [
    {
      "name": "api-token-production",
      "type": "api-token",
      "created": "2026-01-15T10:30:00Z",
      "expires": "2026-02-14T10:30:00Z",
      "environment": "production",
      "owner": "team-backend",
      "notes": "Used for external API calls"
    }
  ]
}
```

## Rotation Process

1. **Generate new secret** - Create new credentials using approved methods
2. **Update configuration** - Deploy new secret to all dependent systems
3. **Verify functionality** - Confirm the new secret works correctly
4. **Revoke old secret** - Remove the old secret after verification period (24-48 hours)
5. **Update manifest** - Record the rotation in `config/token-manifest.json`
6. **Document** - Note the rotation in the audit log

## Emergency Rotation

If a secret is suspected to be compromised:
1. Revoke the compromised secret immediately
2. Generate and deploy a new secret
3. Investigate the breach
4. Update all dependent systems
5. Document the incident

## Responsibilities

- **Developers**: Use the checker script regularly, rotate secrets on schedule
- **Security Team**: Audit compliance, investigate incidents
- **Ops**: Automate rotation where possible, maintain secret management infrastructure

## Compliance

- Run the token age checker at least weekly
- All secrets must be documented in the token manifest
- No secret should exceed its max age (see rotation schedule table)
- Rotation must be logged in audit trail
