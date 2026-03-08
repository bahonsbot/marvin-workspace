# Horizons PMS DB Draft (Phase 1)

This folder contains an initial PostgreSQL schema draft for the Horizons PMS Phase 1 scope.

## Why this structure

- **Core required tables implemented:** `rooms`, `bookings`, `guests`, `rates`.
- **`room_types` helper table added intentionally:**
  - The PRD defines fixed room categories (studio/1bed/2bed/3bed).
  - `rates.room_type_id` was required, and using a lookup table gives clean foreign keys and consistent values.

## Key design decisions

1. **Operational constraints first**
   - Booking dates must satisfy `check_in < check_out`.
   - Overlapping active bookings for the same room are blocked with a Postgres `EXCLUDE` constraint.

2. **Status guardrails via CHECK constraints**
   - Room status: `available`, `occupied`, `maintenance`, `reserved`.
   - Booking status: `confirmed`, `checked_in`, `checked_out`, `cancelled`, `no_show`.

3. **Practical indexing for front-desk workflows**
   - Fast lookups by room status/type.
   - Booking calendar and date-range queries.
   - Guest contact lookups and per-room/per-guest booking history.
   - Daily room-type pricing lookups.

4. **Phase 1 simplicity**
   - No payment tables.
   - No channel manager or dynamic pricing logic.
   - Schema stays close to PRD and can be migrated forward later.

## Notes for next iteration

- Add `users` and role-based access integration with Supabase Auth.
- Consider audit fields (`created_by`, `updated_by`) for booking edits.
- Add guest nationality/tags if front-desk requests them in practice.

## PII Hardening (Phase A+B)

Implemented migration:
- `sql/006_guest_pii_encryption_phase_ab.sql`

What it adds:
- Encrypted guest PII columns (`*_enc`) using `pgp_sym_encrypt`
- Lookup hash columns (`email_hash`, `phone_hash`)
- `key_version` and `encrypted_at` metadata
- Additive backfill flow with rollback-safe posture (plaintext columns retained)

Runbook:
- `db/PII_ENCRYPTION_RUNBOOK.md`
