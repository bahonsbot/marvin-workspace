import { createBooking, listAvailableUnits, listBookableUnits, listBookings } from "@/lib/data/bookings";
import type { RoomTypeName } from "@/lib/models/room-type";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BookingsForm } from "./bookings-form";

type SearchParams = {
  error?: string;
  success?: string;
  selected_unit_id?: string;
  availability_check_in?: string;
  availability_check_out?: string;
  availability_room_type?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

async function createBookingAction(formData: FormData) {
  "use server";

  const unitId = String(formData.get("unit_id") ?? "").trim();
  const guestName = String(formData.get("guest_name") ?? "").trim();
  const checkIn = String(formData.get("check_in") ?? "").trim();
  const checkOut = String(formData.get("check_out") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const extraBedRequested = String(formData.get("extra_bed_requested") ?? "no") === "yes";
  const breakfastRequested = String(formData.get("breakfast_requested") ?? "no") === "yes";
  const breakfastPaxRaw = String(formData.get("breakfast_pax") ?? "1").trim();
  const breakfastPax = Number.parseInt(breakfastPaxRaw, 10);

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

  if (breakfastRequested && (!Number.isFinite(breakfastPax) || breakfastPax < 1 || breakfastPax > 8)) {
    redirect("/bookings?error=Breakfast+pax+must+be+between+1+and+8");
  }

  try {
    await createBooking({
      unit_id: unitId,
      guest_name: guestName,
      check_in: checkIn,
      check_out: checkOut,
      source,
      notes,
      extra_bed_requested: extraBedRequested,
      breakfast_requested: breakfastRequested,
      breakfast_pax: breakfastRequested ? breakfastPax : null,
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

  const selectedUnitId = String(params.selected_unit_id ?? "");
  const availabilityCheckIn = String(params.availability_check_in ?? "");
  const availabilityCheckOut = String(params.availability_check_out ?? "");
  const availabilityRoomType = String(params.availability_room_type ?? "") as RoomTypeName | "";

  let availabilityResult: {
    checkIn: string;
    checkOut: string;
    roomTypeName: RoomTypeName | "";
    units: Awaited<ReturnType<typeof listAvailableUnits>>;
  } | null = null;

  if (availabilityCheckIn && availabilityCheckOut && availabilityCheckIn < availabilityCheckOut) {
    try {
      const availableUnits = await listAvailableUnits({
        checkIn: availabilityCheckIn,
        checkOut: availabilityCheckOut,
        roomTypeName: availabilityRoomType || undefined,
      });

      availabilityResult = {
        checkIn: availabilityCheckIn,
        checkOut: availabilityCheckOut,
        roomTypeName: availabilityRoomType,
        units: availableUnits,
      };
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Failed to load availability";
    }
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
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Notes</th>
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
                  <td style={{ borderBottom: "1px solid #eee", padding: 8, whiteSpace: "pre-wrap" }}>
                    {booking.notes || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <BookingsForm
        units={units}
        initialSelectedUnitId={selectedUnitId}
        initialCheckIn={availabilityCheckIn}
        initialCheckOut={availabilityCheckOut}
        initialRoomTypeName={availabilityRoomType}
        initialAvailability={availabilityResult}
        action={createBookingAction}
      />
    </main>
  );
}
