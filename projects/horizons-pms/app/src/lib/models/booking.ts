export const BOOKING_ACTIVE_STATUSES = ["confirmed", "checked_in"] as const;
export const BOOKING_STATUSES = [
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;

export const BOOKING_SOURCES = ["walk_in", "direct", "ota", "agent", "other"] as const;

export type BookingActiveStatus = (typeof BOOKING_ACTIVE_STATUSES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export type Booking = {
  id: string;
  unit_id: string;
  guest_id: string;
  check_in: string;
  check_out: string;
  rate: string;
  status: BookingStatus;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  unit?: {
    id: string;
    unit_code: string;
    room_number: string;
    floor: number;
    tower: number;
  } | null;
  guest?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
};

export type CreateBookingInput = {
  unit_id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  rate: number;
  source?: string;
  notes?: string;
  extra_bed_requested: boolean;
};
