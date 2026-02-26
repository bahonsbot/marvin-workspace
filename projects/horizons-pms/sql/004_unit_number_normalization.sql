-- Horizons PMS - Unit number normalization and ordering
-- Run after 001_initial_schema.sql, 002_units_tower_bedsetup.sql, 003_bed_layouts.sql

alter table units
  add column if not exists room_number text;

-- Backfill room_number from existing values/unit_number and resolve conflicts safely.
with prepared as (
  select
    u.id,
    coalesce(nullif(trim(u.room_number), ''), substring(u.unit_number from '([0-9]+)$')) as raw_room,
    u.tower,
    u.floor,
    u.created_at
  from units u
), canonical as (
  select
    p.id,
    p.tower,
    p.floor,
    coalesce(
      nullif(lpad(regexp_replace(coalesce(p.raw_room, ''), '\\D', '', 'g'), 2, '0'), '00'),
      lpad((row_number() over (partition by p.tower, p.floor order by p.created_at, p.id))::text, 2, '0')
    ) as base_room
  from prepared p
), deduped as (
  select
    c.id,
    c.base_room,
    row_number() over (
      partition by c.tower, c.floor, c.base_room
      order by c.id
    ) as duplicate_rank
  from canonical c
)
update units u
set room_number = case
  when d.duplicate_rank = 1 then d.base_room
  else lpad(((d.base_room)::int + d.duplicate_rank - 1)::text, 2, '0')
end
from deduped d
where u.id = d.id;

alter table units
  alter column room_number set not null;

alter table units
  drop constraint if exists units_tower_floor_room_number_key;

create unique index if not exists idx_units_tower_floor_room_number_unique
  on units (tower, floor, room_number);

alter table units
  add constraint units_tower_floor_room_number_key
  unique using index idx_units_tower_floor_room_number_unique;

-- Keep legacy unit_number flexible to avoid confusing duplicate errors on the wrong field.
alter table units
  drop constraint if exists units_unit_number_key;

-- Canonical display code (tower + 2-digit floor + 2-digit room_number), e.g. 10710.
alter table units
  drop column if exists unit_code;

alter table units
  add column unit_code text generated always as (
    tower::text || lpad(floor::text, 2, '0') || lpad(room_number, 2, '0')
  ) stored;

create index if not exists idx_units_tower_floor_room on units (tower, floor, room_number);
create index if not exists idx_units_unit_code on units (unit_code);

-- Keep backward compatibility: if unit_number is blank, auto-fill with canonical code.
create or replace function sync_unit_number_from_components()
returns trigger
language plpgsql
as $$
begin
  if new.room_number is not null then
    new.room_number := lpad(regexp_replace(new.room_number, '\\D', '', 'g'), 2, '0');
  end if;

  if coalesce(trim(new.unit_number), '') = '' then
    new.unit_number := new.tower::text || lpad(new.floor::text, 2, '0') || lpad(new.room_number, 2, '0');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_units_sync_unit_number_from_components on units;
create trigger trg_units_sync_unit_number_from_components
before insert or update on units
for each row
execute function sync_unit_number_from_components();
