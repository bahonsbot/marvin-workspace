import { createClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/lib/models/booking";
import type { RoomTypeName } from "@/lib/models/room-type";

type CalendarUnit = {
  id: string;
  unit_code: string;
  room_number: string;
  floor: number;
  tower: number;
  room_type: { id: string; name: RoomTypeName } | null;
};

type CalendarUnitRow = Omit<CalendarUnit, "room_type"> & {
  room_type: CalendarUnit["room_type"] | CalendarUnit["room_type"][];
};

type CalendarBooking = {
  id: string;
  unit_id: string;
  check_in: string;
  check_out: string;
  status: BookingStatus;
  guest: { id: string; first_name: string; last_name: string } | null;
};

type CalendarBookingRow = Omit<CalendarBooking, "guest"> & {
  guest: CalendarBooking["guest"] | CalendarBooking["guest"][];
};

export type CalendarFilters = {
  roomTypeName?: RoomTypeName;
  tower?: number;
};

export type CalendarOccupancyData = {
  units: CalendarUnit[];
  bookings: CalendarBooking[];
  towers: number[];
};

function normalizeJoin<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export async function getCalendarOccupancyData(params: {
  monthStartIso: string;
  monthEndExclusiveIso: string;
  filters?: CalendarFilters;
}): Promise<CalendarOccupancyData> {
  const supabase = await createClient();
  const filters = params.filters ?? {};

  let unitsQuery = supabase
    .from("units")
    .select("id, unit_code, room_number, floor, tower, room_type:room_types(id, name)")
    .order("tower", { ascending: true })
    .order("floor", { ascending: true })
    .order("room_number", { ascending: true });

  if (filters.roomTypeName) {
    unitsQuery = unitsQuery.eq("room_types.name", filters.roomTypeName);
  }

  if (typeof filters.tower === "number") {
    unitsQuery = unitsQuery.eq("tower", filters.tower);
  }

  const { data: unitsData, error: unitsError } = await unitsQuery;

  if (unitsError) {
    throw new Error(unitsError.message);
  }

  const units = ((unitsData ?? []) as CalendarUnitRow[]).map((unit) => ({
    ...unit,
    room_type: normalizeJoin(unit.room_type),
  }));

  const towers = Array.from(new Set(units.map((unit) => unit.tower))).sort((a, b) => a - b);

  if (units.length === 0) {
    return { units: [], bookings: [], towers };
  }

  const unitIds = units.map((unit) => unit.id);

  const { data: bookingsData, error: bookingsError } = await supabase
    .from("bookings")
    .select("id, unit_id, check_in, check_out, status, guest:guests(id, first_name, last_name)")
    .in("unit_id", unitIds)
    .lt("check_in", params.monthEndExclusiveIso)
    .gt("check_out", params.monthStartIso)
    .in("status", ["confirmed", "checked_in", "checked_out", "cancelled", "no_show"])
    .order("check_in", { ascending: true });

  if (bookingsError) {
    throw new Error(bookingsError.message);
  }

  const bookings = ((bookingsData ?? []) as CalendarBookingRow[]).map((booking) => ({
    ...booking,
    guest: normalizeJoin(booking.guest),
  }));

  return { units, bookings, towers };
}
