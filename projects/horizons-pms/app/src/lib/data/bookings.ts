import { createClient } from "@/lib/supabase/server";
import type { Booking, CreateBookingInput } from "@/lib/models/booking";

type BookingRow = Omit<Booking, "unit" | "guest"> & {
  unit: Booking["unit"] | Booking["unit"][];
  guest: Booking["guest"] | Booking["guest"][];
};

type UnitForBooking = {
  id: string;
  unit_code: string;
  room_number: string;
  floor: number;
  tower: number;
  bed_layout: string;
  room_type: { id: string; name: string; allow_extra_bed: boolean } | Array<{ id: string; name: string; allow_extra_bed: boolean }> | null;
};

function normalizeName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim().replace(/\s+/g, " ");
  const [firstName, ...rest] = trimmed.split(" ");
  return {
    firstName,
    lastName: rest.join(" ") || "-",
  };
}

function normalizeJoin<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export async function listBookings(): Promise<Booking[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, unit_id, guest_id, check_in, check_out, rate, status, source, notes, created_at, updated_at, unit:units(id, unit_code, room_number, floor, tower), guest:guests(id, first_name, last_name)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as BookingRow[];

  return rows.map((row) => ({
    ...row,
    unit: normalizeJoin(row.unit),
    guest: normalizeJoin(row.guest),
  }));
}

export async function listBookableUnits(): Promise<UnitForBooking[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("units")
    .select("id, unit_code, room_number, floor, tower, bed_layout, room_type:room_types(id, name, allow_extra_bed)")
    .order("tower", { ascending: true })
    .order("floor", { ascending: true })
    .order("room_number", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as UnitForBooking[];
  return rows.map((row) => ({
    ...row,
    room_type: normalizeJoin(row.room_type),
  }));
}

export async function createBooking(input: CreateBookingInput): Promise<void> {
  const supabase = await createClient();

  const { data: unit, error: unitError } = await supabase
    .from("units")
    .select("id, unit_code, bed_layout, room_type:room_types(id, name, allow_extra_bed)")
    .eq("id", input.unit_id)
    .maybeSingle();

  if (unitError || !unit) {
    throw new Error("Please select a valid unit.");
  }

  const roomType = normalizeJoin(unit.room_type as UnitForBooking["room_type"]);
  if (!roomType) {
    throw new Error("Selected unit has an invalid room type setup.");
  }

  if (input.extra_bed_requested) {
    if (String(unit.bed_layout).includes("twin")) {
      throw new Error("Extra bed is not allowed for twin bed layouts by current booking policy.");
    }

    if (!roomType.allow_extra_bed) {
      throw new Error("Extra bed is not allowed for this room type.");
    }
  }

  const { count, error: conflictError } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("unit_id", input.unit_id)
    .in("status", ["confirmed", "checked_in"])
    .lt("check_in", input.check_out)
    .gt("check_out", input.check_in);

  if (conflictError) {
    throw new Error(conflictError.message);
  }

  if ((count ?? 0) > 0) {
    throw new Error("Selected unit is not available for this date range (conflicting active booking found).");
  }

  const guestName = normalizeName(input.guest_name);
  if (!guestName.firstName) {
    throw new Error("Guest name is required.");
  }

  const { data: guest, error: guestError } = await supabase
    .from("guests")
    .insert({
      first_name: guestName.firstName,
      last_name: guestName.lastName,
    })
    .select("id")
    .single();

  if (guestError || !guest) {
    throw new Error(guestError?.message || "Failed to create guest record.");
  }

  const combinedNotes = [
    input.notes?.trim(),
    `extra_bed_requested: ${input.extra_bed_requested ? "yes" : "no"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const { error: createError } = await supabase.from("bookings").insert({
    unit_id: input.unit_id,
    guest_id: guest.id,
    check_in: input.check_in,
    check_out: input.check_out,
    rate: input.rate,
    status: "confirmed",
    source: input.source?.trim() || null,
    notes: combinedNotes || null,
  });

  if (createError) {
    if (createError.code === "23P01" || createError.message.includes("bookings_no_date_overlap")) {
      throw new Error("Selected unit is not available for this date range (conflicting active booking found).");
    }

    throw new Error(createError.message);
  }
}
