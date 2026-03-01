-- Horizons PMS - Phase 1 schema draft
-- PostgreSQL / Supabase compatible
--
-- Design notes:
-- 1) This draft uses four required core tables: rooms, bookings, guests, rates.
-- 2) A small room_types lookup table is included so rates.room_type_id can be a proper FK,
--    and so room type values stay consistent across rooms and pricing.
-- 3) Bookings enforce check-in < check-out and prevent overlapping active stays for the same room.
-- 4) Status fields use CHECK constraints to keep app logic simple in Phase 1.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- Optional helper table to normalize room types for rooms/rates
create table if not exists room_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    check (code in ('studio', '1bed', '2bed', '3bed')),
  display_name text not null,
  base_capacity int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  room_type uuid not null references room_types(id) on delete restrict,
  floor int not null check (floor >= 0),
  status text not null default 'available'
    check (status in ('available', 'occupied', 'maintenance', 'reserved')),
  amenities text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  id_type text,
  id_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guests_email_format check (
    email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete restrict,
  room_id uuid not null references rooms(id) on delete restrict,
  check_in date not null,
  check_out date not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
  total_rate numeric(12,2) not null default 0 check (total_rate >= 0),
  source text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_dates_valid check (check_in < check_out)
);

-- Prevent double-booking active stays in the same room
alter table bookings
  add constraint bookings_no_overlap
  exclude using gist (
    room_id with =,
    daterange(check_in, check_out, '[)') with &&
  )
  where (status in ('confirmed', 'checked_in'));

create table if not exists rates (
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid not null references room_types(id) on delete restrict,
  date date not null,
  rate numeric(12,2) not null check (rate >= 0),
  rate_type text not null default 'base'
    check (rate_type in ('base', 'promo', 'manual_override')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rates_unique_per_day unique (room_type_id, date, rate_type)
);

-- Helpful indexes for desk operations and calendar queries
create index if not exists idx_rooms_room_type on rooms(room_type);
create index if not exists idx_rooms_status on rooms(status);
create index if not exists idx_bookings_guest_id on bookings(guest_id);
create index if not exists idx_bookings_room_id on bookings(room_id);
create index if not exists idx_bookings_dates on bookings(check_in, check_out);
create index if not exists idx_bookings_status on bookings(status);
create index if not exists idx_guests_email on guests(email);
create index if not exists idx_guests_phone on guests(phone);
create index if not exists idx_rates_room_type_date on rates(room_type_id, date);
