import { createClient } from "@/lib/supabase/server";
import type { BedLayout, RoomTypeName } from "@/lib/models/room-type";

export type UnitBlueprint = {
  id: string;
  tower: number;
  floor: number;
  room_number: string;
  room_type_id: string;
  bed_layout: BedLayout;
  room_type: {
    id: string;
    name: RoomTypeName;
  } | null;
};

type UnitBlueprintRow = Omit<UnitBlueprint, "room_type"> & {
  room_type: { id: string; name: RoomTypeName } | Array<{ id: string; name: RoomTypeName }> | null;
};

export async function listUnitBlueprints(): Promise<UnitBlueprint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_blueprints")
    .select("id, tower, floor, room_number, room_type_id, bed_layout, room_type:room_types(id, name)")
    .order("tower", { ascending: true })
    .order("floor", { ascending: true })
    .order("room_number", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as UnitBlueprintRow[];
  return rows.map((row) => ({
    ...row,
    room_type: Array.isArray(row.room_type) ? row.room_type[0] ?? null : row.room_type,
  }));
}

export async function getUnitBlueprintByLocation(params: {
  tower: number;
  floor: number;
  room_number: string;
}): Promise<UnitBlueprint | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_blueprints")
    .select("id, tower, floor, room_number, room_type_id, bed_layout, room_type:room_types(id, name)")
    .eq("tower", params.tower)
    .eq("floor", params.floor)
    .eq("room_number", params.room_number)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as UnitBlueprintRow;
  return {
    ...row,
    room_type: Array.isArray(row.room_type) ? row.room_type[0] ?? null : row.room_type,
  };
}
