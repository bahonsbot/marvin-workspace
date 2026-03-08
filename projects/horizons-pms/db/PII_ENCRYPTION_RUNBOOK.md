# Guest PII Encryption Runbook (Phase A+B)

This runbook covers **additive, reversible** hardening for guest PII in Horizons PMS.

## Files
- Migration SQL: `sql/006_guest_pii_encryption_phase_ab.sql`

## Preconditions
1. PostgreSQL/Supabase has `pgcrypto` extension enabled.
2. You have a strong encryption key (32+ chars).
3. Backup/snapshot is available before migration.

## Execute Phase A+B

```sql
-- Set key for current DB session only
SET app.pii_encryption_key = '<your-strong-key>';

-- Run migration
\i sql/006_guest_pii_encryption_phase_ab.sql
```

## Validation Queries

```sql
select
  count(*) as total_rows,
  count(*) filter (where name is not null and name_enc is not null) as name_backfilled,
  count(*) filter (where email is not null and email_enc is not null) as email_backfilled,
  count(*) filter (where phone is not null and phone_enc is not null) as phone_backfilled,
  count(*) filter (where id_type is not null and id_type_enc is not null) as id_type_backfilled,
  count(*) filter (where id_number is not null and id_number_enc is not null) as id_number_backfilled,
  count(*) filter (where email is not null and email_hash is not null) as email_hash_backfilled,
  count(*) filter (where phone is not null and phone_hash is not null) as phone_hash_backfilled
from guests;
```

Optional spot check (same DB session, key loaded):

```sql
select
  id,
  convert_from(pgp_sym_decrypt(name_enc, current_setting('app.pii_encryption_key')), 'UTF8') as name_plain,
  convert_from(pgp_sym_decrypt(email_enc, current_setting('app.pii_encryption_key')), 'UTF8') as email_plain
from guests
where name_enc is not null
limit 3;
```

## Rollback (before plaintext drop)
- No destructive rollback needed for Phase A+B.
- App can continue reading plaintext columns (`name`, `email`, `phone`, `id_type`, `id_number`).
- Encrypted/hash columns can remain in place.

## Security Notes
- Do not store `app.pii_encryption_key` in SQL migration files.
- Keep key in secret manager / env, not in repository.
- Rotate keys in a later phase by bumping `key_version` and re-encrypting.
