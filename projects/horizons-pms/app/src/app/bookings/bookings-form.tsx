"use client";

import { useMemo, useState } from "react";
import type { RoomTypeName } from "@/lib/models/room-type";
import { ROOM_TYPE_LABELS } from "@/lib/models/room-type";
import { BOOKING_SOURCES } from "@/lib/models/booking";

type UnitForBooking = {
  id: string;
  unit_code: string;
  room_number: string;
  floor: number;
  tower: number;
  bed_layout: string;
  base_rate: string;
  room_type: { id: string; name: RoomTypeName; allow_extra_bed: boolean } | null;
};

function formatUnitOptionLabel(unit: UnitForBooking): string {
  const roomTypeName = unit.room_type?.name;
  const roomTypeTag = roomTypeName ? `[${ROOM_TYPE_LABELS[roomTypeName]}] ` : "";
  return `${roomTypeTag}${unit.unit_code} (Tower ${unit.tower}, Floor ${unit.floor}, Room ${unit.room_number})`;
}

type AvailabilityResult = {
  checkIn: string;
  checkOut: string;
  roomTypeName: RoomTypeName | "";
  units: UnitForBooking[];
};

type Props = {
  units: UnitForBooking[];
  initialSelectedUnitId: string;
  initialCheckIn: string;
  initialCheckOut: string;
  initialRoomTypeName: RoomTypeName | "";
  initialAvailability: AvailabilityResult | null;
  action: (formData: FormData) => void;
};

export function BookingsForm({
  units,
  initialSelectedUnitId,
  initialCheckIn,
  initialCheckOut,
  initialRoomTypeName,
  initialAvailability,
  action,
}: Props) {
  const [selectedUnitId, setSelectedUnitId] = useState(initialSelectedUnitId);
  const [breakfastRequested, setBreakfastRequested] = useState(false);

  const selectedUnit = useMemo(() => units.find((unit) => unit.id === selectedUnitId) ?? null, [units, selectedUnitId]);
  const sourceOptions = BOOKING_SOURCES;

  return (
    <>
      <section style={{ marginTop: 32, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ marginBottom: 8 }}>Availability search</h2>
        <form method="get" style={{ display: "grid", gap: 12, maxWidth: 520 }}>
          <label style={{ display: "grid", gap: 4 }}>
            Check-in
            <input name="availability_check_in" type="date" defaultValue={initialCheckIn} required />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Check-out
            <input name="availability_check_out" type="date" defaultValue={initialCheckOut} required />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Room type (optional)
            <select name="availability_room_type" defaultValue={initialRoomTypeName}>
              <option value="">All room types</option>
              <option value="studio">{ROOM_TYPE_LABELS.studio}</option>
              <option value="1bed">{ROOM_TYPE_LABELS["1bed"]}</option>
              <option value="2bed">{ROOM_TYPE_LABELS["2bed"]}</option>
              <option value="3bed">{ROOM_TYPE_LABELS["3bed"]}</option>
            </select>
          </label>

          <button type="submit" style={{ width: "fit-content", padding: "8px 14px" }}>
            Search availability
          </button>
        </form>

        {initialAvailability ? (
          <div style={{ marginTop: 12 }}>
            <p style={{ marginBottom: 8 }}>
              Available units for {initialAvailability.checkIn} → {initialAvailability.checkOut}: {initialAvailability.units.length}
            </p>
            {initialAvailability.units.length === 0 ? (
              <p>No available units found for selected criteria.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {initialAvailability.units.map((unit) => (
                  <li key={unit.id} style={{ marginBottom: 8 }}>
                    {formatUnitOptionLabel(unit)}{" "}
                    <a
                      href={`/bookings?availability_check_in=${encodeURIComponent(initialAvailability.checkIn)}&availability_check_out=${encodeURIComponent(initialAvailability.checkOut)}&availability_room_type=${encodeURIComponent(initialAvailability.roomTypeName)}&selected_unit_id=${encodeURIComponent(unit.id)}`}
                    >
                      Select
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ marginBottom: 8 }}>Create booking</h2>
        <form action={action} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
          <label style={{ display: "grid", gap: 4 }}>
            Unit
            <select name="unit_id" required value={selectedUnitId} onChange={(event) => setSelectedUnitId(event.target.value)}>
              <option value="" disabled>
                Select a unit
              </option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {formatUnitOptionLabel(unit)}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Guest name
            <input name="guest_name" type="text" required placeholder="e.g. John Doe" />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Check-in
            <input name="check_in" type="date" required defaultValue={initialCheckIn} />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Check-out
            <input name="check_out" type="date" required defaultValue={initialCheckOut} />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Rate (auto from selected unit)
            <input value={selectedUnit?.base_rate ?? "0"} readOnly disabled />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Source
            <select name="source" defaultValue="direct">
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Notes
            <textarea name="notes" rows={3} />
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              name="breakfast_requested"
              type="checkbox"
              value="yes"
              checked={breakfastRequested}
              onChange={(event) => setBreakfastRequested(event.target.checked)}
            />
            Breakfast requested
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Breakfast pax
            <select name="breakfast_pax" defaultValue="1" disabled={!breakfastRequested}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input name="extra_bed_requested" type="checkbox" value="yes" />
            Extra bed request
          </label>

          <button type="submit" style={{ width: "fit-content", padding: "8px 14px" }}>
            Create booking
          </button>
        </form>
      </section>
    </>
  );
}
