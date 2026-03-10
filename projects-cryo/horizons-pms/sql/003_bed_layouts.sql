-- Horizons PMS - Bed layout enhancements
-- Run after 001_initial_schema.sql and 002_units_tower_bedsetup.sql

alter table room_types
  add column if not exists bedrooms_count int,
  add column if not exists allowed_bed_layouts text[];

alter table units
  add column if not exists bed_layout text;

-- Backfill room type bed metadata from room type name.
update room_types
set
  bedrooms_count = case name::text
    when 'studio' then 1
    when '1bed' then 1
    when '2bed' then 2
    when '3bed' then 3
    else coalesce(bedrooms_count, 1)
  end,
  allowed_bed_layouts = case name::text
    when 'studio' then array['king', 'twin']::text[]
    when '1bed' then array['king', 'twin']::text[]
    when '2bed' then array['king+king', 'twin+twin', 'king+twin']::text[]
    when '3bed' then array['king+king+twin']::text[]
    else coalesce(allowed_bed_layouts, array['king']::text[])
  end
where bedrooms_count is null
   or allowed_bed_layouts is null
   or cardinality(allowed_bed_layouts) = 0;

-- Backfill unit bed_layout using room type + legacy bed_setup where possible.
update units u
set bed_layout = case rt.name::text
  when 'studio' then coalesce(u.bed_setup, 'king')
  when '1bed' then coalesce(u.bed_setup, 'king')
  when '2bed' then case coalesce(u.bed_setup, 'king')
    when 'twin' then 'twin+twin'
    else 'king+king'
  end
  when '3bed' then 'king+king+twin'
  else coalesce(u.bed_layout, 'king')
end
from room_types rt
where rt.id = u.room_type_id
  and u.bed_layout is null;

-- Safety fallback for any remaining nulls.
update units
set bed_layout = coalesce(bed_layout, case coalesce(bed_setup, 'king')
  when 'twin' then 'twin'
  else 'king'
end)
where bed_layout is null;

alter table room_types
  alter column bedrooms_count set not null,
  alter column allowed_bed_layouts set not null,
  alter column allowed_bed_layouts set default array['king']::text[];

alter table units
  alter column bed_layout set not null,
  alter column bed_layout set default 'king';

alter table room_types
  drop constraint if exists room_types_bedrooms_count_check,
  add constraint room_types_bedrooms_count_check check (bedrooms_count between 1 and 3),
  drop constraint if exists room_types_allowed_bed_layouts_nonempty_check,
  add constraint room_types_allowed_bed_layouts_nonempty_check check (cardinality(allowed_bed_layouts) > 0),
  drop constraint if exists room_types_allowed_bed_layouts_values_check,
  add constraint room_types_allowed_bed_layouts_values_check check (
    allowed_bed_layouts <@ array['king', 'twin', 'king+king', 'twin+twin', 'king+twin', 'king+king+twin']::text[]
  );

alter table units
  drop constraint if exists units_bed_layout_values_check,
  add constraint units_bed_layout_values_check check (
    bed_layout in ('king', 'twin', 'king+king', 'twin+twin', 'king+twin', 'king+king+twin')
  );

create or replace function sync_units_bed_setup_from_layout()
returns trigger
language plpgsql
as $$
begin
  if new.bed_layout is not null then
    new.bed_setup := case
      when position('twin' in new.bed_layout) > 0 then 'twin'
      else 'king'
    end;
  elsif new.bed_setup is not null then
    new.bed_layout := case new.bed_setup
      when 'twin' then 'twin'
      else 'king'
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_units_sync_bed_setup_from_layout on units;
create trigger trg_units_sync_bed_setup_from_layout
before insert or update on units
for each row
execute function sync_units_bed_setup_from_layout();

create or replace function enforce_unit_bed_layout_by_room_type()
returns trigger
language plpgsql
as $$
declare
  allowed_layouts text[];
begin
  select allowed_bed_layouts
  into allowed_layouts
  from room_types
  where id = new.room_type_id;

  if allowed_layouts is null then
    raise exception 'Invalid room_type_id % for unit', new.room_type_id;
  end if;

  if not (new.bed_layout = any(allowed_layouts)) then
    raise exception 'bed_layout % is not allowed for room_type_id %', new.bed_layout, new.room_type_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_units_enforce_bed_layout_by_room_type on units;
create trigger trg_units_enforce_bed_layout_by_room_type
before insert or update on units
for each row
execute function enforce_unit_bed_layout_by_room_type();

-- Ensure existing rows satisfy enforcement trigger expectation.
update units
set bed_layout = bed_layout;
