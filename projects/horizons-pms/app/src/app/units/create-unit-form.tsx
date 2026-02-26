"use client";

import { BED_LAYOUT_LABELS, type BedLayout } from "@/lib/models/room-type";
import { UNIT_STATUSES, UNIT_TOWERS } from "@/lib/models/unit";
import { useMemo, useState } from "react";

type RoomTypeOption = {
  id: string;
  name: string;
  allowed_bed_layouts: BedLayout[];
};

type CreateUnitFormProps = {
  roomTypes: RoomTypeOption[];
  action: (formData: FormData) => void;
};

export function CreateUnitForm({ roomTypes, action }: CreateUnitFormProps) {
  const [roomTypeId, setRoomTypeId] = useState("");
  const [bedLayout, setBedLayout] = useState("");

  const selectedRoomType = useMemo(
    () => roomTypes.find((roomType) => roomType.id === roomTypeId),
    [roomTypeId, roomTypes]
  );

  const allowedLayouts = selectedRoomType?.allowed_bed_layouts ?? [];

  return (
    <form action={action} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
      <label style={{ display: "grid", gap: 4 }}>
        Floor
        <input name="floor" type="number" min={0} required />
      </label>

      <label style={{ display: "grid", gap: 4 }}>
        Room number
        <input name="room_number" inputMode="numeric" placeholder="05" required />
      </label>

      <label style={{ display: "grid", gap: 4 }}>
        Tower
        <select name="tower" required defaultValue="1">
          {UNIT_TOWERS.map((unitTower) => (
            <option key={unitTower} value={unitTower}>
              {unitTower}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: 4 }}>
        Room type
        <select
          name="room_type"
          required
          defaultValue=""
          onChange={(event) => {
            const nextRoomTypeId = event.target.value;
            setRoomTypeId(nextRoomTypeId);

            const nextRoomType = roomTypes.find((roomType) => roomType.id === nextRoomTypeId);
            setBedLayout(nextRoomType?.allowed_bed_layouts[0] ?? "");
          }}
        >
          <option value="" disabled>
            Select a room type
          </option>
          {roomTypes.map((roomType) => (
            <option key={roomType.id} value={roomType.id}>
              {roomType.name}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: 4 }}>
        Bed layout
        <select
          name="bed_layout"
          required
          disabled={!selectedRoomType}
          value={bedLayout}
          onChange={(event) => setBedLayout(event.target.value)}
        >
          {!selectedRoomType ? (
            <option value="">Select room type first</option>
          ) : (
            allowedLayouts.map((layout) => (
              <option key={layout} value={layout}>
                {BED_LAYOUT_LABELS[layout]}
              </option>
            ))
          )}
        </select>
      </label>

      <label style={{ display: "grid", gap: 4 }}>
        Status
        <select name="status" required defaultValue="available">
          {UNIT_STATUSES.map((unitStatus) => (
            <option key={unitStatus} value={unitStatus}>
              {unitStatus}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: 4 }}>
        Base rate
        <input name="base_rate" type="number" min={0} step="0.01" required />
      </label>

      <button type="submit" style={{ width: "fit-content", padding: "8px 14px" }}>
        Create unit
      </button>
    </form>
  );
}
