-- Phase A+B: Guest PII encryption prep + backfill (additive, reversible)
-- Requirements:
--   1) pgcrypto extension enabled
--   2) session key set before running backfill:
--        SET app.pii_encryption_key = '<32+ char strong key>';
--
-- Notes:
-- - This migration is additive only (plaintext columns remain for rollback safety).
-- - Encrypted columns store BYTEA ciphertext (pgp_sym_encrypt).
-- - Hash columns support exact-match lookup without decrypting.

create extension if not exists pgcrypto;

-- Phase A: schema extensions
alter table guests
  add column if not exists name_enc bytea,
  add column if not exists email_enc bytea,
  add column if not exists phone_enc bytea,
  add column if not exists id_type_enc bytea,
  add column if not exists id_number_enc bytea,
  add column if not exists key_version smallint not null default 1,
  add column if not exists encrypted_at timestamptz,
  add column if not exists email_hash text,
  add column if not exists phone_hash text;

create index if not exists idx_guests_email_hash on guests(email_hash);
create index if not exists idx_guests_phone_hash on guests(phone_hash);
create index if not exists idx_guests_encrypted_at on guests(encrypted_at);

-- Phase B: controlled backfill
-- Fail fast if encryption key is missing.
do $$
begin
  if coalesce(current_setting('app.pii_encryption_key', true), '') = '' then
    raise exception 'Missing app.pii_encryption_key. Run: SET app.pii_encryption_key = ''<strong-key>''; before backfill.';
  end if;
end $$;

update guests
set
  name_enc = case
    when name is not null and name_enc is null
      then pgp_sym_encrypt(name, current_setting('app.pii_encryption_key'))
    else name_enc
  end,
  email_enc = case
    when email is not null and email_enc is null
      then pgp_sym_encrypt(email, current_setting('app.pii_encryption_key'))
    else email_enc
  end,
  phone_enc = case
    when phone is not null and phone_enc is null
      then pgp_sym_encrypt(phone, current_setting('app.pii_encryption_key'))
    else phone_enc
  end,
  id_type_enc = case
    when id_type is not null and id_type_enc is null
      then pgp_sym_encrypt(id_type, current_setting('app.pii_encryption_key'))
    else id_type_enc
  end,
  id_number_enc = case
    when id_number is not null and id_number_enc is null
      then pgp_sym_encrypt(id_number, current_setting('app.pii_encryption_key'))
    else id_number_enc
  end,
  email_hash = case
    when email is not null and email_hash is null
      then encode(digest(lower(trim(email)), 'sha256'), 'hex')
    else email_hash
  end,
  phone_hash = case
    when phone is not null and phone_hash is null
      then encode(digest(regexp_replace(phone, '[^0-9+]', '', 'g'), 'sha256'), 'hex')
    else phone_hash
  end,
  encrypted_at = case
    when encrypted_at is null and (
      (name is not null and name_enc is not null) or
      (email is not null and email_enc is not null) or
      (phone is not null and phone_enc is not null) or
      (id_type is not null and id_type_enc is not null) or
      (id_number is not null and id_number_enc is not null)
    ) then now()
    else encrypted_at
  end;

-- Validation snapshot (run after migration; does not modify data)
-- select
--   count(*) as total_rows,
--   count(*) filter (where name is not null and name_enc is not null) as name_backfilled,
--   count(*) filter (where email is not null and email_enc is not null) as email_backfilled,
--   count(*) filter (where phone is not null and phone_enc is not null) as phone_backfilled,
--   count(*) filter (where id_type is not null and id_type_enc is not null) as id_type_backfilled,
--   count(*) filter (where id_number is not null and id_number_enc is not null) as id_number_backfilled,
--   count(*) filter (where email is not null and email_hash is not null) as email_hash_backfilled,
--   count(*) filter (where phone is not null and phone_hash is not null) as phone_hash_backfilled
-- from guests;
