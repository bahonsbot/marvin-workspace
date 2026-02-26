import { createClient } from "@/lib/supabase/server";
import type { CreateUnitInput, Unit } from "@/lib/models/unit";

export async function listUnits(): Promise<Unit[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("units")
    .select(
      "id, unit_number, floor, room_type_id, status, amenities, base_rate, maintenance_issue_description, maintenance_reported_at, maintenance_status, maintenance_resolution_notes, created_at, updated_at, room_type:room_types(id, name)"
    )
    .order("floor", { ascending: true })
    .order("unit_number", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<
    Omit<Unit, "room_type"> & { room_type: Array<{ id: string; name: string }> }
  >;

  return rows.map((row) => ({
    ...row,
    room_type: row.room_type[0] ?? null,
  }));
}

export async function createUnit(input: CreateUnitInput): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("units").insert({
    unit_number: input.unit_number,
    floor: input.floor,
    room_type_id: input.room_type_id,
    status: input.status,
    base_rate: input.base_rate,
  });

  if (error) {
    throw new Error(error.message);
  }
}
