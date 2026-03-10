import { createClient } from "@/lib/supabase/server";
import type { Booking, BookingStatus, CreateBookingInput } from "@/lib/models/booking";
import { ROOM_TYPE_LABELS, type RoomTypeName } from "@/lib/models/room-type";

type BookingRow = Omit<Booking, "unit" | "guest"> & {
  unit: Booking["unit"] | Booking["unit"][];
  guest: Booking["guest"] | Booking["guest"][];
};

export type UnitForBooking = {
  id: string;
  unit_code: string;
  room_number: string;
  floor: number;
  tower: number;
  bed_layout: string;
  base_rate: string;
  room_type: { id: string; name: RoomTypeName; allow_extra_bed: boolean } | null;
};

type UnitForBookingRow = Omit<UnitForBooking, "room_type"> & {
  room_type: UnitForBooking["room_type"] | UnitForBooking["room_type"][];
};

const ROOM_TYPE_ORDER: RoomTypeName[] = ["studio", "1bed", "2bed", "3bed"];

const NEXT_STATUS_BY_ACTION = {
  check_in: "checked_in",
  check_out: "checked_out",
  cancel: "cancelled",
} as const;

export type BookingStatusAction = keyof typeof NEXT_STATUS_BY_ACTION;

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  confirmed: ["checked_in", "cancelled"],
  checked_in: ["checked_out", "cancelled"],
  checked_out: [],
  cancelled: [],
  no_show: [],
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

function roomTypeOrder(name?: string): number {
  if (!name) return ROOM_TYPE_ORDER.length;
  const index = ROOM_TYPE_ORDER.indexOf(name as RoomTypeName);
  return index === -1 ? ROOM_TYPE_ORDER.length : index;
}

function compareUnits(a: UnitForBooking, b: UnitForBooking): number {
  const typeDiff = roomTypeOrder(normalizeJoin(a.room_type)?.name) - roomTypeOrder(normalizeJoin(b.room_type)?.name);
  if (typeDiff !== 0) {
    return typeDiff;
  }

  return a.unit_code.localeCompare(b.unit_code, undefined, { numeric: true, sensitivity: "base" });
}

function normalizeUnits(rows: UnitForBookingRow[]): UnitForBooking[] {
  return rows
    .map((row) => ({
      ...row,
      room_type: normalizeJoin(row.room_type),
    }))
    .sort(compareUnits);
}

export function formatUnitOptionLabel(unit: UnitForBooking): string {
  const roomType = normalizeJoin(unit.room_type);
  const roomTypeName = roomType?.name;
  const roomTypeTag = roomTypeName ? `[${ROOM_TYPE_LABELS[roomTypeName]}] ` : "";
  return `${roomTypeTag}${unit.unit_code} (Tower ${unit.tower}, Floor ${unit.floor}, Room ${unit.room_number})`;
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

export function canTransitionBookingStatus(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export async function updateBookingStatus(params: { bookingId: string; action: BookingStatusAction }): Promise<void> {
  const supabase = await createClient();
  const nextStatus = NEXT_STATUS_BY_ACTION[params.action];

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("id", params.bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    throw new Error("Booking not found.");
  }

  const currentStatus = booking.status as BookingStatus;

  if (!canTransitionBookingStatus(currentStatus, nextStatus)) {
    throw new Error(`Cannot change booking from ${currentStatus} to ${nextStatus}.`);
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ status: nextStatus })
    .eq("id", params.bookingId)
    .eq("status", currentStatus);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function listBookableUnits(): Promise<UnitForBooking[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("units")
    .select("id, unit_code, room_number, floor, tower, bed_layout, base_rate, room_type:room_types(id, name, allow_extra_bed)");

  if (error) {
    throw new Error(error.message);
  }

  return normalizeUnits((data ?? []) as UnitForBookingRow[]);
}

export async function listAvailableUnits(params: {
  checkIn: string;
  checkOut: string;
  roomTypeName?: RoomTypeName;
}): Promise<UnitForBooking[]> {
  const supabase = await createClient();

  let unitsQuery = supabase
    .from("units")
    .select("id, unit_code, room_number, floor, tower, bed_layout, base_rate, room_type:room_types!inner(id, name, allow_extra_bed)");

  if (params.roomTypeName) {
    unitsQuery = unitsQuery.eq("room_types.name", params.roomTypeName);
  }

  const { data: units, error: unitsError } = await unitsQuery;

  if (unitsError) {
    throw new Error(unitsError.message);
  }

  const candidateUnits = normalizeUnits((units ?? []) as UnitForBookingRow[]);
  if (candidateUnits.length === 0) {
    return [];
  }

  const unitIds = candidateUnits.map((unit) => unit.id);

  const { data: conflicts, error: conflictsError } = await supabase
    .from("bookings")
    .select("unit_id")
    .in("unit_id", unitIds)
    .in("status", ["confirmed", "checked_in"])
    .lt("check_in", params.checkOut)
    .gt("check_out", params.checkIn);

  if (conflictsError) {
    throw new Error(conflictsError.message);
  }

  const conflictUnitIds = new Set((conflicts ?? []).map((row) => row.unit_id as string));
  return candidateUnits.filter((unit) => !conflictUnitIds.has(unit.id));
}

export async function createBooking(input: CreateBookingInput): Promise<void> {
  const supabase = await createClient();

  const { data: unit, error: unitError } = await supabase
    .from("units")
    .select("id, unit_code, bed_layout, base_rate, room_type:room_types(id, name, allow_extra_bed)")
    .eq("id", input.unit_id)
    .maybeSingle();

  if (unitError || !unit) {
    throw new Error("Please select a valid unit.");
  }

  const roomType = normalizeJoin(unit.room_type as UnitForBookingRow["room_type"]);
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

  const normalizedBreakfastPax = input.breakfast_requested
    ? Math.min(Math.max(input.breakfast_pax ?? 1, 1), 8)
    : null;

  const combinedNotes = [
    input.notes?.trim(),
    `extra_bed_requested: ${input.extra_bed_requested ? "yes" : "no"}`,
    `breakfast_requested: ${input.breakfast_requested ? "yes" : "no"}`,
    input.breakfast_requested ? `breakfast_pax: ${normalizedBreakfastPax}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const { error: createError } = await supabase.from("bookings").insert({
    unit_id: input.unit_id,
    guest_id: guest.id,
    check_in: input.check_in,
    check_out: input.check_out,
    rate: Number(unit.base_rate ?? 0),
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
