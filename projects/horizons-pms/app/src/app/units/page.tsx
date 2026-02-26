import { listRoomTypes } from "@/lib/data/room-types";
import { createUnit, listUnits } from "@/lib/data/units";
import { BED_SETUPS, UNIT_STATUSES, UNIT_TOWERS } from "@/lib/models/unit";
import type { RoomType } from "@/lib/models/room-type";
import type { Unit } from "@/lib/models/unit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

async function createUnitAction(formData: FormData) {
  "use server";

  const unitNumber = String(formData.get("unit_number") ?? "").trim();
  const floorRaw = String(formData.get("floor") ?? "").trim();
  const roomTypeId = String(formData.get("room_type") ?? "").trim();
  const towerRaw = String(formData.get("tower") ?? "").trim();
  const bedSetup = String(formData.get("bed_setup") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const baseRateRaw = String(formData.get("base_rate") ?? "").trim();

  const floor = Number(floorRaw);
  const tower = Number(towerRaw);
  const baseRate = Number(baseRateRaw);

  if (!unitNumber) {
    redirect("/units?error=Unit+number+is+required");
  }

  if (!Number.isInteger(floor) || floor < 0) {
    redirect("/units?error=Floor+must+be+an+integer+greater+than+or+equal+to+0");
  }

  if (!UNIT_TOWERS.includes(tower as (typeof UNIT_TOWERS)[number])) {
    redirect("/units?error=Please+select+a+valid+tower");
  }

  if (!BED_SETUPS.includes(bedSetup as (typeof BED_SETUPS)[number])) {
    redirect("/units?error=Please+select+a+valid+bed+setup");
  }

  if (!UNIT_STATUSES.includes(status as (typeof UNIT_STATUSES)[number])) {
    redirect("/units?error=Please+select+a+valid+status");
  }

  if (!Number.isFinite(baseRate) || baseRate < 0) {
    redirect("/units?error=Base+rate+must+be+a+number+greater+than+or+equal+to+0");
  }

  const roomTypes = await listRoomTypes();
  if (!roomTypes.some((roomType) => roomType.id === roomTypeId)) {
    redirect("/units?error=Please+select+a+valid+room+type");
  }

  try {
    await createUnit({
      unit_number: unitNumber,
      floor,
      room_type_id: roomTypeId,
      tower: tower as (typeof UNIT_TOWERS)[number],
      bed_setup: bedSetup as (typeof BED_SETUPS)[number],
      status: status as (typeof UNIT_STATUSES)[number],
      base_rate: baseRate,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create unit";
    redirect(`/units?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/units");
  redirect("/units?success=Unit+created");
}

export default async function UnitsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  let units: Unit[] = [];
  let roomTypes: RoomType[] = [];
  let loadError = "";

  try {
    [units, roomTypes] = await Promise.all([listUnits(), listRoomTypes()]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Failed to load units";
  }

  return (
    <main style={{ maxWidth: 980, margin: "40px auto", padding: "0 16px" }}>
      <h1>Units</h1>

      {params.error ? <p style={{ color: "#b00020", marginTop: 12 }}>Error: {params.error}</p> : null}
      {params.success ? <p style={{ color: "#0a7d28", marginTop: 12 }}>{params.success}</p> : null}
      {loadError ? <p style={{ color: "#b00020", marginTop: 12 }}>Error: {loadError}</p> : null}

      <section style={{ marginTop: 24 }}>
        <h2 style={{ marginBottom: 8 }}>Existing units</h2>
        {units.length === 0 ? (
          <p>No units yet.</p>
        ) : (
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Unit number</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Floor</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Tower</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Room type</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Bed setup</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Status</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Base rate</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{unit.unit_number}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{unit.floor}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{unit.tower}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{unit.room_type?.name ?? "-"}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{unit.bed_setup}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{unit.status}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{unit.base_rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ marginBottom: 8 }}>Create unit</h2>
        <form action={createUnitAction} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
          <label style={{ display: "grid", gap: 4 }}>
            Unit number
            <input name="unit_number" required />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Floor
            <input name="floor" type="number" min={0} required />
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
            <select name="room_type" required defaultValue="">
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
            Bed setup
            <select name="bed_setup" required defaultValue="king">
              {BED_SETUPS.map((setup) => (
                <option key={setup} value={setup}>
                  {setup}
                </option>
              ))}
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
      </section>
    </main>
  );
}
