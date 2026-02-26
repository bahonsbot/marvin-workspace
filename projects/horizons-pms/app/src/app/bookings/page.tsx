import { createBooking, listBookableUnits, listBookings } from "@/lib/data/bookings";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

async function createBookingAction(formData: FormData) {
  "use server";

  const unitId = String(formData.get("unit_id") ?? "").trim();
  const guestName = String(formData.get("guest_name") ?? "").trim();
  const checkIn = String(formData.get("check_in") ?? "").trim();
  const checkOut = String(formData.get("check_out") ?? "").trim();
  const rateRaw = String(formData.get("rate") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const extraBedRequested = String(formData.get("extra_bed_requested") ?? "no") === "yes";

  const rate = Number(rateRaw);

  if (!unitId) {
    redirect("/bookings?error=Please+select+a+unit");
  }

  if (!guestName) {
    redirect("/bookings?error=Guest+name+is+required");
  }

  if (!checkIn || !checkOut) {
    redirect("/bookings?error=Check-in+and+check-out+dates+are+required");
  }

  if (checkIn >= checkOut) {
    redirect("/bookings?error=Check-out+must+be+after+check-in");
  }

  if (!Number.isFinite(rate) || rate < 0) {
    redirect("/bookings?error=Rate+must+be+a+number+greater+than+or+equal+to+0");
  }

  try {
    await createBooking({
      unit_id: unitId,
      guest_name: guestName,
      check_in: checkIn,
      check_out: checkOut,
      rate,
      source,
      notes,
      extra_bed_requested: extraBedRequested,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create booking";
    redirect(`/bookings?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/bookings");
  redirect("/bookings?success=Booking+created");
}

export default async function BookingsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};

  let bookings: Awaited<ReturnType<typeof listBookings>> = [];
  let units: Awaited<ReturnType<typeof listBookableUnits>> = [];
  let loadError = "";

  try {
    [bookings, units] = await Promise.all([listBookings(), listBookableUnits()]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Failed to load bookings data";
  }

  return (
    <main style={{ maxWidth: 980, margin: "40px auto", padding: "0 16px" }}>
      <h1>Bookings</h1>

      {params.error ? <p style={{ color: "#b00020", marginTop: 12 }}>Error: {params.error}</p> : null}
      {params.success ? <p style={{ color: "#0a7d28", marginTop: 12 }}>{params.success}</p> : null}
      {loadError ? <p style={{ color: "#b00020", marginTop: 12 }}>Error: {loadError}</p> : null}

      <section style={{ marginTop: 24 }}>
        <h2 style={{ marginBottom: 8 }}>Latest bookings</h2>
        {bookings.length === 0 ? (
          <p>No bookings yet.</p>
        ) : (
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Created</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Unit</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Guest</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Check-in</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Check-out</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Status</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Rate</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {new Date(booking.created_at).toLocaleString("en-GB")}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{booking.unit?.unit_code ?? "-"}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {booking.guest ? `${booking.guest.first_name} ${booking.guest.last_name}`.trim() : "-"}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{booking.check_in}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{booking.check_out}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{booking.status}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{booking.rate}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{booking.source || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ marginBottom: 8 }}>Create booking</h2>
        <form action={createBookingAction} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
          <label style={{ display: "grid", gap: 4 }}>
            Unit
            <select name="unit_id" required defaultValue="">
              <option value="" disabled>
                Select a unit
              </option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unit_code} (Tower {unit.tower}, Floor {unit.floor}, Room {unit.room_number})
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
            <input name="check_in" type="date" required />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Check-out
            <input name="check_out" type="date" required />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Rate
            <input name="rate" type="number" min={0} step="0.01" required />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Source
            <select name="source" defaultValue="direct">
              <option value="direct">Direct</option>
              <option value="walk_in">Walk-in</option>
              <option value="ota">OTA</option>
              <option value="agent">Agent</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Notes
            <textarea name="notes" rows={3} />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Extra bed request
            <select name="extra_bed_requested" defaultValue="no">
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>

          <button type="submit" style={{ width: "fit-content", padding: "8px 14px" }}>
            Create booking
          </button>
        </form>
      </section>
    </main>
  );
}
