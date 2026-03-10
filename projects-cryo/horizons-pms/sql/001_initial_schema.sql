-- Horizons PMS - Initial schema (Phase 1)
-- Run in Supabase SQL editor

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type room_type_name as enum ('studio', '1bed', '2bed', '3bed');
create type unit_status as enum ('available', 'occupied', 'maintenance', 'reserved');
create type booking_status as enum (
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show'
);
create type user_role as enum ('admin', 'manager', 'frontdesk');

create table if not exists room_types (
  id uuid primary key default gen_random_uuid(),
  name room_type_name not null unique,
  base_capacity int not null check (base_capacity > 0),
  max_capacity int not null check (max_capacity >= base_capacity),
  amenities text[] not null default '{}',
  base_rate numeric(12,2) not null check (base_rate >= 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  unit_number text not null unique,
  floor int not null check (floor >= 0),
  room_type_id uuid not null references room_types(id) on delete restrict,
  status unit_status not null default 'available',
  amenities text[] not null default '{}',
  base_rate numeric(12,2) not null check (base_rate >= 0),
  maintenance_issue_description text,
  maintenance_reported_at timestamptz,
  maintenance_status text,
  maintenance_resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  nationality text,
  id_number text,
  notes text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guests_email_format check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text not null unique,
  name text not null,
  role user_role not null default 'frontdesk',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete restrict,
  guest_id uuid not null references guests(id) on delete restrict,
  check_in date not null,
  check_out date not null,
  rate numeric(12,2) not null check (rate >= 0),
  status booking_status not null default 'confirmed',
  source text,
  notes text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_in < check_out)
);

-- Prevent overlapping active bookings for the same unit
alter table bookings
  add constraint bookings_no_date_overlap
  exclude using gist (
    unit_id with =,
    daterange(check_in, check_out, '[)') with &&
  )
  where (status in ('confirmed', 'checked_in'));

create index if not exists idx_units_room_type_id on units(room_type_id);
create index if not exists idx_units_status on units(status);
create index if not exists idx_bookings_unit_id on bookings(unit_id);
create index if not exists idx_bookings_guest_id on bookings(guest_id);
create index if not exists idx_bookings_dates on bookings(check_in, check_out);
create index if not exists idx_bookings_status on bookings(status);
create index if not exists idx_guests_email on guests(email);
