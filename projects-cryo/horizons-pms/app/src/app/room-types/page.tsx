import { createRoomType, listRoomTypes } from "@/lib/data/room-types";
import { ROOM_TYPE_NAMES } from "@/lib/models/room-type";
import type { RoomType } from "@/lib/models/room-type";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

async function createRoomTypeAction(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  const baseCapacityRaw = String(formData.get("base_capacity") ?? "").trim();
  const maxCapacityRaw = String(formData.get("max_capacity") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  const baseCapacity = Number(baseCapacityRaw);
  const maxCapacity = Number(maxCapacityRaw);

  if (!ROOM_TYPE_NAMES.includes(name as (typeof ROOM_TYPE_NAMES)[number])) {
    redirect("/room-types?error=Please+select+a+valid+room+type+name");
  }

  if (!Number.isInteger(baseCapacity) || baseCapacity <= 0) {
    redirect("/room-types?error=Base+capacity+must+be+a+positive+integer");
  }

  if (!Number.isInteger(maxCapacity) || maxCapacity < baseCapacity) {
    redirect(
      "/room-types?error=Max+capacity+must+be+an+integer+greater+than+or+equal+to+base+capacity"
    );
  }

  try {
    await createRoomType({
      name: name as (typeof ROOM_TYPE_NAMES)[number],
      base_capacity: baseCapacity,
      max_capacity: maxCapacity,
      description,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create room type";
    redirect(`/room-types?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/room-types");
  redirect("/room-types?success=Room+type+created");
}

export default async function RoomTypesPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  let roomTypes: RoomType[] = [];
  let loadError = "";

  try {
    roomTypes = await listRoomTypes();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Failed to load room types";
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px" }}>
      <h1>Room Types</h1>

      {params.error ? (
        <p style={{ color: "#b00020", marginTop: 12 }}>Error: {params.error}</p>
      ) : null}
      {params.success ? (
        <p style={{ color: "#0a7d28", marginTop: 12 }}>{params.success}</p>
      ) : null}
      {loadError ? (
        <p style={{ color: "#b00020", marginTop: 12 }}>Error: {loadError}</p>
      ) : null}

      <section style={{ marginTop: 24 }}>
        <h2 style={{ marginBottom: 8 }}>Existing room types</h2>
        {roomTypes.length === 0 ? (
          <p>No room types yet.</p>
        ) : (
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Name</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Base capacity</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Max capacity</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Bedrooms</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Allowed bed layouts</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {roomTypes.map((roomType) => (
                <tr key={roomType.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{roomType.name}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{roomType.base_capacity}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{roomType.max_capacity}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{roomType.bedrooms_count}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {roomType.allowed_bed_layouts.join(", ")}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {roomType.description || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ marginBottom: 8 }}>Create room type</h2>
        <form action={createRoomTypeAction} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
          <label style={{ display: "grid", gap: 4 }}>
            Name
            <select name="name" required defaultValue="">
              <option value="" disabled>
                Select a room type
              </option>
              {ROOM_TYPE_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Base capacity
            <input name="base_capacity" type="number" min={1} required />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Max capacity
            <input name="max_capacity" type="number" min={1} required />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Description
            <textarea name="description" rows={3} />
          </label>

          <button type="submit" style={{ width: "fit-content", padding: "8px 14px" }}>
            Create room type
          </button>
        </form>
      </section>
    </main>
  );
}
