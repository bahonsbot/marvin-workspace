import {
  createBooking,
  listAvailableUnits,
  listBookableUnits,
  listBookings,
  updateBookingStatus,
} from "@/lib/data/bookings";
import type { BookingStatus } from "@/lib/models/booking";
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

const STATUS_ACTIONS: Record<BookingStatus, Array<{ action: "check_in" | "check_out" | "cancel"; label: string }>> = {
  confirmed: [
    { action: "check_in", label: "Check in" },
    { action: "cancel", label: "Cancel" },
  ],
  checked_in: [
    { action: "check_out", label: "Check out" },
    { action: "cancel", label: "Cancel" },
  ],
  checked_out: [],
  cancelled: [],
  no_show: [],
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
  revalidatePath("/dashboard");
  redirect("/bookings?success=Booking+created");
}

async function updateBookingStatusAction(formData: FormData) {
  "use server";

  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();

  if (!bookingId) {
    redirect("/bookings?error=Booking+id+is+required");
  }

  if (action !== "check_in" && action !== "check_out" && action !== "cancel") {
    redirect("/bookings?error=Invalid+booking+action");
  }

  try {
    await updateBookingStatus({ bookingId, action });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update booking status";
    redirect(`/bookings?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/bookings");
  revalidatePath("/dashboard");
  redirect("/bookings?success=Booking+status+updated");
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
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Actions</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Rate</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Source</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => {
                const actions = STATUS_ACTIONS[booking.status] ?? [];

                return (
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
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                      {actions.length === 0 ? (
                        <span style={{ color: "#777" }}>—</span>
                      ) : (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {actions.map((item) => (
                            <form key={item.action} action={updateBookingStatusAction}>
                              <input type="hidden" name="booking_id" value={booking.id} />
                              <input type="hidden" name="action" value={item.action} />
                              <button
                                type="submit"
                                style={{
                                  padding: "4px 8px",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: 4,
                                  background: "#f8fafc",
                                  color: "#0f172a",
                                  cursor: "pointer",
                                }}
                              >
                                {item.label}
                              </button>
                            </form>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{booking.rate}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{booking.source || "-"}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8, whiteSpace: "pre-wrap" }}>
                      {booking.notes || "-"}
                    </td>
                  </tr>
                );
              })}
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
