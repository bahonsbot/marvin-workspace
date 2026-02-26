import { getUnitBlueprintByLocation, listUnitBlueprints } from "@/lib/data/unit-blueprints";
import { listRoomTypes } from "@/lib/data/room-types";
import { createUnit, listUnits } from "@/lib/data/units";
import { BED_LAYOUT_LABELS, ROOM_TYPE_LABELS, type BedLayout } from "@/lib/models/room-type";
import { BED_SETUPS, UNIT_STATUSES, UNIT_TOWERS } from "@/lib/models/unit";
import type { Unit } from "@/lib/models/unit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CreateUnitForm } from "./create-unit-form";

type PageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

function normalizeRoomNumber(roomNumber: string): string {
  const digits = roomNumber.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  return digits.padStart(2, "0");
}

async function createUnitAction(formData: FormData) {
  "use server";

  const floorRaw = String(formData.get("floor") ?? "").trim();
  const roomNumberRaw = String(formData.get("room_number") ?? "").trim();
  const towerRaw = String(formData.get("tower") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const baseRateRaw = String(formData.get("base_rate") ?? "").trim();

  const floor = Number(floorRaw);
  const tower = Number(towerRaw);
  const baseRate = Number(baseRateRaw);
  const roomNumber = normalizeRoomNumber(roomNumberRaw);

  if (!roomNumber) {
    redirect("/units?error=Room+number+is+required");
  }

  if (!Number.isInteger(floor) || floor < 0) {
    redirect("/units?error=Floor+must+be+an+integer+greater+than+or+equal+to+0");
  }

  if (!UNIT_TOWERS.includes(tower as (typeof UNIT_TOWERS)[number])) {
    redirect("/units?error=Please+select+a+valid+tower");
  }

  if (!UNIT_STATUSES.includes(status as (typeof UNIT_STATUSES)[number])) {
    redirect("/units?error=Please+select+a+valid+status");
  }

  if (!Number.isFinite(baseRate) || baseRate < 0) {
    redirect("/units?error=Base+rate+must+be+a+number+greater+than+or+equal+to+0");
  }

  const blueprint = await getUnitBlueprintByLocation({
    tower,
    floor,
    room_number: roomNumber,
  });

  if (!blueprint) {
    redirect("/units?error=Cannot+create+unit:+no+blueprint+found+for+that+tower%2Ffloor%2Froom");
  }

  const selectedRoomType = await listRoomTypes().then((roomTypes) =>
    roomTypes.find((roomType) => roomType.id === blueprint.room_type_id)
  );

  if (!selectedRoomType) {
    redirect("/units?error=Blueprint+references+an+invalid+room+type");
  }

  if (!selectedRoomType.allowed_bed_layouts.includes(blueprint.bed_layout as BedLayout)) {
    redirect("/units?error=Blueprint+bed+layout+is+not+allowed+for+its+room+type");
  }

  const normalizedBedSetup = blueprint.bed_layout.includes("twin") ? "twin" : "king";
  if (!BED_SETUPS.includes(normalizedBedSetup as (typeof BED_SETUPS)[number])) {
    redirect("/units?error=Invalid+bed+setup");
  }

  try {
    await createUnit({
      floor,
      room_number: roomNumber,
      room_type_id: blueprint.room_type_id,
      tower: tower as (typeof UNIT_TOWERS)[number],
      bed_setup: normalizedBedSetup as (typeof BED_SETUPS)[number],
      bed_layout: blueprint.bed_layout as BedLayout,
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
  let blueprints: Awaited<ReturnType<typeof listUnitBlueprints>> = [];
  let loadError = "";

  try {
    [units, blueprints] = await Promise.all([listUnits(), listUnitBlueprints()]);
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
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Tower</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Floor</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Room</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Display code</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Room type</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Bed layout</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Status</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Base rate</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{unit.tower}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{unit.floor}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{unit.room_number}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{unit.unit_code ?? unit.unit_number}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {unit.room_type?.name ? ROOM_TYPE_LABELS[unit.room_type.name as keyof typeof ROOM_TYPE_LABELS] : "-"}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {BED_LAYOUT_LABELS[unit.bed_layout] ?? unit.bed_layout}
                  </td>
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
        <CreateUnitForm
          action={createUnitAction}
          blueprints={blueprints
            .filter((blueprint) => blueprint.room_type)
            .map((blueprint) => ({
              tower: blueprint.tower,
              floor: blueprint.floor,
              room_number: blueprint.room_number,
              room_type_id: blueprint.room_type_id,
              room_type_name: blueprint.room_type!.name,
              bed_layout: blueprint.bed_layout,
            }))}
        />
      </section>
    </main>
  );
}
