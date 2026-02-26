-- Horizons PMS - Unit blueprints source of truth for unit combinations
-- Run after 001_initial_schema.sql, 002_units_tower_bedsetup.sql, 003_bed_layouts.sql, 004_unit_number_normalization.sql

create table if not exists unit_blueprints (
  id uuid primary key default gen_random_uuid(),
  tower int not null,
  floor int not null,
  room_number text not null,
  room_type_id uuid not null references room_types(id) on delete restrict,
  bed_layout text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unit_blueprints_tower_check check (tower in (1, 2)),
  constraint unit_blueprints_floor_check check (floor >= 0),
  constraint unit_blueprints_room_number_check check (room_number ~ '^[0-9]{2}$'),
  constraint unit_blueprints_bed_layout_values_check check (
    bed_layout in ('king', 'twin', 'king+king', 'twin+twin', 'king+twin', 'king+king+twin')
  ),
  constraint unit_blueprints_tower_floor_room_number_key unique (tower, floor, room_number)
);

create index if not exists idx_unit_blueprints_room_type_id on unit_blueprints (room_type_id);
create index if not exists idx_unit_blueprints_tower_floor_room on unit_blueprints (tower, floor, room_number);

insert into unit_blueprints (tower, floor, room_number, room_type_id, bed_layout)
select
  seeded.tower,
  seeded.floor,
  seeded.room_number,
  rt.id,
  seeded.bed_layout
from (
values
  (1, 1, '03', 'studio', 'king'),
  (1, 1, '08', 'studio', 'king'),
  (1, 1, '11', 'studio', 'twin'),
  (1, 2, '07', 'studio', 'twin'),
  (1, 6, '10', 'studio', 'king'),
  (1, 7, '10', 'studio', 'king'),
  (1, 8, '03', 'studio', 'king'),
  (1, 9, '03', 'studio', 'twin'),
  (1, 10, '03', 'studio', 'twin'),
  (1, 10, '11', 'studio', 'twin'),
  (1, 11, '07', 'studio', 'king'),
  (1, 11, '08', 'studio', 'twin'),
  (1, 12, '03', 'studio', 'king'),
  (1, 12, '07', 'studio', 'twin'),
  (1, 13, '03', 'studio', 'twin'),
  (1, 13, '11', 'studio', 'king'),
  (1, 15, '07', 'studio', 'king'),
  (1, 15, '08', 'studio', 'king'),
  (1, 15, '11', 'studio', 'king'),
  (1, 2, '05', '1bed', 'king'),
  (1, 2, '09', '1bed', 'king'),
  (1, 3, '05', '1bed', 'king'),
  (1, 3, '09', '1bed', 'king'),
  (1, 6, '09', '1bed', 'king'),
  (1, 7, '09', '1bed', 'king'),
  (1, 8, '05', '1bed', 'king'),
  (1, 10, '05', '1bed', 'twin'),
  (1, 12, '05', '1bed', 'king'),
  (1, 13, '05', '1bed', 'king'),
  (2, 7, '03', '1bed', 'king'),
  (2, 7, '05', '1bed', 'king'),
  (2, 8, '03', '1bed', 'king'),
  (2, 8, '06', '1bed', 'king'),
  (2, 9, '03', '1bed', 'king'),
  (2, 9, '05', '1bed', 'king'),
  (2, 9, '09', '1bed', 'king'),
  (2, 10, '03', '1bed', 'twin'),
  (2, 10, '05', '1bed', 'twin'),
  (2, 10, '07', '1bed', 'king'),
  (2, 10, '09', '1bed', 'twin'),
  (2, 11, '06', '1bed', 'king'),
  (2, 12, '06', '1bed', 'king'),
  (2, 12, '09', '1bed', 'king'),
  (1, 6, '12', '2bed', 'king+king'),
  (1, 6, '13', '2bed', 'twin+twin'),
  (1, 7, '02', '2bed', 'king+king'),
  (1, 7, '13', '2bed', 'twin+twin'),
  (1, 8, '12', '2bed', 'king+twin'),
  (1, 9, '02', '2bed', 'king+king'),
  (1, 10, '12', '2bed', 'king+king'),
  (1, 11, '02', '2bed', 'king+king'),
  (1, 13, '02', '2bed', 'king+twin'),
  (1, 13, '12', '2bed', 'king+twin'),
  (1, 15, '13', '2bed', 'king+twin'),
  (2, 7, '02', '2bed', 'king+twin'),
  (2, 8, '01', '2bed', 'king+twin'),
  (2, 9, '01', '2bed', 'twin+twin'),
  (2, 9, '12', '2bed', 'twin+twin'),
  (2, 10, '11', '2bed', 'king+twin'),
  (2, 10, '12', '2bed', 'king+twin'),
  (2, 11, '02', '2bed', 'king+twin'),
  (2, 12, '01', '2bed', 'king+twin'),
  (2, 12, '11', '2bed', 'king+king'),
  (2, 12, '12', '2bed', 'king+king'),
  (2, 15, '03', '2bed', 'king+twin'),
  (2, 15, '05', '2bed', 'king+king'),
  (2, 15, '08', '2bed', 'king+king'),
  (2, 17, '03', '2bed', 'king+twin'),
  (2, 17, '05', '2bed', 'king+twin'),
  (1, 1, '01', '3bed', 'king+king+twin'),
  (1, 10, '01', '3bed', 'king+king+twin'),
  (1, 11, '01', '3bed', 'king+king+twin'),
  (1, 13, '01', '3bed', 'king+king+twin'),
  (1, 15, '01', '3bed', 'king+king+twin'),
  (2, 15, '07', '3bed', 'king+king+twin'),
  (2, 17, '01', '3bed', 'king+king+twin')
) as seeded(tower, floor, room_number, room_type_name, bed_layout)
join room_types rt on rt.name::text = seeded.room_type_name
on conflict (tower, floor, room_number)
do update set
  room_type_id = excluded.room_type_id,
  bed_layout = excluded.bed_layout,
  updated_at = now();

-- Safety validation to catch missing room type seeds early.
do $$
declare
  expected_count int := 76;
  seeded_count int;
begin
  select count(*) into seeded_count from unit_blueprints;

  if seeded_count < expected_count then
    raise exception 'unit_blueprints seed incomplete: expected at least %, got %', expected_count, seeded_count;
  end if;
end;
$$;
