-- Horizons PMS - Units tower/bed setup updates
-- Run in Supabase SQL editor after 001_initial_schema.sql

alter table units
  add column if not exists tower int,
  add column if not exists bed_setup text;

update units
set tower = coalesce(tower, 1),
    bed_setup = coalesce(bed_setup, 'king')
where tower is null
   or bed_setup is null;

alter table units
  alter column tower set default 1,
  alter column tower set not null,
  add constraint units_tower_check check (tower in (1, 2));

alter table units
  alter column bed_setup set default 'king',
  alter column bed_setup set not null,
  add constraint units_bed_setup_check check (bed_setup in ('king', 'twin'));

alter table room_types
  add column if not exists allow_extra_bed boolean;

update room_types
set allow_extra_bed = coalesce(allow_extra_bed, true)
where allow_extra_bed is null;

alter table room_types
  alter column allow_extra_bed set default true,
  alter column allow_extra_bed set not null;
