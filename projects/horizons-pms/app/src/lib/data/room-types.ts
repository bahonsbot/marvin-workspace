import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_LAYOUTS_BY_ROOM_TYPE,
  type CreateRoomTypeInput,
  type RoomType,
} from "@/lib/models/room-type";

export async function listRoomTypes(): Promise<RoomType[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("room_types")
    .select("id, name, base_capacity, max_capacity, amenities, base_rate, description, allow_extra_bed, bedrooms_count, allowed_bed_layouts, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createRoomType(input: CreateRoomTypeInput): Promise<void> {
  const supabase = await createClient();

  const allowedLayouts = DEFAULT_LAYOUTS_BY_ROOM_TYPE[input.name];
  const { error } = await supabase.from("room_types").insert({
    name: input.name,
    base_capacity: input.base_capacity,
    max_capacity: input.max_capacity,
    description: input.description?.trim() || null,
    base_rate: 0,
    bedrooms_count: allowedLayouts[0].split("+").length,
    allowed_bed_layouts: allowedLayouts,
  });

  if (error) {
    throw new Error(error.message);
  }
}
