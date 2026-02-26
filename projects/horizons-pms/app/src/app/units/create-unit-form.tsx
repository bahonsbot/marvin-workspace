"use client";

import { BED_LAYOUT_LABELS, ROOM_TYPE_LABELS, type BedLayout, type RoomTypeName } from "@/lib/models/room-type";
import { UNIT_STATUSES, UNIT_TOWERS } from "@/lib/models/unit";
import { useMemo, useState } from "react";

type UnitBlueprintOption = {
  tower: number;
  floor: number;
  room_number: string;
  room_type_id: string;
  room_type_name: RoomTypeName;
  bed_layout: BedLayout;
};

type CreateUnitFormProps = {
  blueprints: UnitBlueprintOption[];
  action: (formData: FormData) => void;
};

function normalizeRoomNumber(roomNumber: string): string {
  const digits = roomNumber.replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(2, "0");
}

export function CreateUnitForm({ blueprints, action }: CreateUnitFormProps) {
  const [tower, setTower] = useState("1");
  const [floor, setFloor] = useState("");
  const [roomNumber, setRoomNumber] = useState("");

  const normalizedRoomNumber = normalizeRoomNumber(roomNumber);
  const hasLookupInput = floor.trim() !== "" && normalizedRoomNumber !== "";

  const matchedBlueprint = useMemo(
    () =>
      blueprints.find(
        (blueprint) =>
          blueprint.tower === Number(tower) &&
          blueprint.floor === Number(floor) &&
          blueprint.room_number === normalizedRoomNumber
      ) ?? null,
    [blueprints, floor, normalizedRoomNumber, tower]
  );
  return (
    <form action={action} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
      <label style={{ display: "grid", gap: 4 }}>
        Tower
        <select name="tower" required value={tower} onChange={(event) => setTower(event.target.value)}>
          {UNIT_TOWERS.map((unitTower) => (
            <option key={unitTower} value={unitTower}>
              {unitTower}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: 4 }}>
        Floor
        <input
          name="floor"
          type="number"
          min={0}
          required
          value={floor}
          onChange={(event) => setFloor(event.target.value)}
        />
      </label>

      <label style={{ display: "grid", gap: 4 }}>
        Room number
        <input
          name="room_number"
          inputMode="numeric"
          placeholder="05"
          required
          value={roomNumber}
          onChange={(event) => setRoomNumber(event.target.value)}
        />
      </label>

      <label style={{ display: "grid", gap: 4 }}>
        Room type (from blueprint)
        <select value={matchedBlueprint?.room_type_id ?? ""} disabled>
          {!matchedBlueprint ? (
            <option value="">Select tower/floor/room first</option>
          ) : (
            <option value={matchedBlueprint.room_type_id}>
              {ROOM_TYPE_LABELS[matchedBlueprint.room_type_name]}
            </option>
          )}
        </select>
        <input type="hidden" name="room_type" value={matchedBlueprint?.room_type_id ?? ""} />
      </label>

      <label style={{ display: "grid", gap: 4 }}>
        Bed layout (from blueprint)
        <select value={matchedBlueprint?.bed_layout ?? ""} disabled>
          {!matchedBlueprint ? (
            <option value="">Select tower/floor/room first</option>
          ) : (
            <option value={matchedBlueprint.bed_layout}>{BED_LAYOUT_LABELS[matchedBlueprint.bed_layout]}</option>
          )}
        </select>
        <input type="hidden" name="bed_layout" value={matchedBlueprint?.bed_layout ?? ""} />
      </label>

      {hasLookupInput && !matchedBlueprint ? (
        <p style={{ margin: 0, color: "#b00020" }}>
          No unit blueprint found for this tower/floor/room combination.
        </p>
      ) : null}

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

      <button type="submit" disabled={!matchedBlueprint} style={{ width: "fit-content", padding: "8px 14px" }}>
        Create unit
      </button>
    </form>
  );
}
