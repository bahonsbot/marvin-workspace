import { getCalendarOccupancyData } from "@/lib/data/calendar";
import { ROOM_TYPE_LABELS, ROOM_TYPE_NAMES, type RoomTypeName } from "@/lib/models/room-type";
import Link from "next/link";
import styles from "./page.module.css";

type SearchParams = {
  month?: string;
  roomType?: string;
  focusBooking?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

type BookingSummary = {
  id: string;
  unitCode: string;
  status: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
};

const STATUS_ORDER = ["checked_in", "confirmed", "checked_out", "cancelled", "no_show"];
const STATUS_SHORT: Record<string, string> = {
  checked_in: "I",
  confirmed: "C",
  checked_out: "O",
  cancelled: "X",
  no_show: "N",
};

function monthBounds(monthParam?: string): { monthStart: Date; monthEndExclusive: Date } {
  const now = new Date();
  const fallback = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    return { monthStart: fallback, monthEndExclusive: new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth() + 1, 1)) };
  }

  const [year, month] = monthParam.split("-").map((value) => Number.parseInt(value, 10));

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return { monthStart: fallback, monthEndExclusive: new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth() + 1, 1)) };
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEndExclusive = new Date(Date.UTC(year, month, 1));
  return { monthStart, monthEndExclusive };
}

function formatMonthParam(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildQuery(params: { month: string; roomType?: string; focusBooking?: string }): string {
  const search = new URLSearchParams();
  search.set("month", params.month);
  if (params.roomType) search.set("roomType", params.roomType);
  if (params.focusBooking) search.set("focusBooking", params.focusBooking);
  return search.toString();
}

function displayGuestName(firstName?: string, lastName?: string): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || "-";
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const { monthStart, monthEndExclusive } = monthBounds(params.month);
  const selectedRoomType = ROOM_TYPE_NAMES.includes(params.roomType as RoomTypeName)
    ? (params.roomType as RoomTypeName)
    : undefined;

  const data = await getCalendarOccupancyData({
    monthStartIso: isoDate(monthStart),
    monthEndExclusiveIso: isoDate(monthEndExclusive),
    filters: {
      roomTypeName: selectedRoomType,
    },
  });

  const days = Array.from({ length: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate() }, (_, i) => {
    return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), i + 1));
  });

  const bookingsByUnit = new Map<string, typeof data.bookings>();
  const bookingLookup = new Map<string, BookingSummary>();

  for (const booking of data.bookings) {
    const current = bookingsByUnit.get(booking.unit_id) ?? [];
    current.push(booking);
    bookingsByUnit.set(booking.unit_id, current);

    const unitCode = data.units.find((unit) => unit.id === booking.unit_id)?.unit_code ?? booking.unit_id;
    bookingLookup.set(booking.id, {
      id: booking.id,
      unitCode,
      status: booking.status,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      guestName: displayGuestName(booking.guest?.first_name, booking.guest?.last_name),
    });
  }

  const focusBooking = params.focusBooking ? bookingLookup.get(params.focusBooking) : null;
  const currentMonthParam = formatMonthParam(monthStart);
  const previousMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1));
  const nextMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));

  return (
    <main className={styles.page}>
      <h1>Occupancy calendar</h1>
      <p className={styles.muted}>View month occupancy by unit. Click a marked day cell to inspect booking details in the side panel.</p>

      <div className={styles.toolbar}>
        <div className={styles.navLinks}>
          <Link
            className={styles.button}
            href={`/calendar?${buildQuery({
              month: formatMonthParam(previousMonth),
              roomType: selectedRoomType,
            })}`}
          >
            ← Prev month
          </Link>
          <span className={styles.button}>{monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</span>
          <Link
            className={styles.button}
            href={`/calendar?${buildQuery({
              month: formatMonthParam(nextMonth),
              roomType: selectedRoomType,
            })}`}
          >
            Next month →
          </Link>
        </div>

        <form className={styles.filters} action="/calendar" method="get">
          <input type="hidden" name="month" value={currentMonthParam} />
          <label htmlFor="roomType">Room type</label>
          <select className={styles.select} id="roomType" name="roomType" defaultValue={selectedRoomType ?? ""}>
            <option value="">All</option>
            {ROOM_TYPE_NAMES.map((name) => (
              <option key={name} value={name}>
                {ROOM_TYPE_LABELS[name]}
              </option>
            ))}
          </select>

          <button className={styles.button} type="submit">
            Apply
          </button>
        </form>
      </div>

      <div className={styles.legend}>
        {[
          { status: "confirmed", label: "Confirmed" },
          { status: "checked_in", label: "Checked in" },
          { status: "checked_out", label: "Checked out" },
          { status: "cancelled", label: "Cancelled / No-show" },
        ].map((item) => (
          <div key={item.status} className={styles.legendItem}>
            <span className={`${styles.swatch} ${item.status}`} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.gridLayout}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.headerCell} style={{ left: 0, zIndex: 4 }}>
                  Unit
                </th>
                {days.map((day) => (
                  <th key={day.toISOString()} className={styles.headerCell}>
                    {day.getUTCDate()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.units.map((unit) => {
                const unitBookings = bookingsByUnit.get(unit.id) ?? [];

                return (
                  <tr key={unit.id}>
                    <td className={styles.unitCell}>
                      <strong>{unit.unit_code}</strong>
                      <div className={styles.unitMeta}>{unit.room_type ? ROOM_TYPE_LABELS[unit.room_type.name] : "No type"}</div>
                    </td>

                    {days.map((day) => {
                      const dayIso = isoDate(day);
                      const activeBookings = unitBookings.filter((booking) => booking.check_in <= dayIso && booking.check_out > dayIso);
                      if (activeBookings.length === 0) {
                        return (
                          <td key={`${unit.id}-${dayIso}`} className={styles.dayCell}>
                            <span className={styles.mark}>·</span>
                          </td>
                        );
                      }

                      const booking = [...activeBookings].sort(
                        (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
                      )[0];

                      const bookingQuery = buildQuery({
                        month: currentMonthParam,
                        roomType: selectedRoomType,
                        focusBooking: booking.id,
                      });

                      return (
                        <td key={`${unit.id}-${dayIso}`} className={styles.dayCell}>
                          <Link
                            className={`${styles.markLink} ${booking.status}`}
                            title={`${displayGuestName(booking.guest?.first_name, booking.guest?.last_name)} (${booking.check_in} → ${booking.check_out}, ${booking.status})`}
                            href={`/calendar?${bookingQuery}`}
                          >
                            {STATUS_SHORT[booking.status] ?? "●"}
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <aside className={styles.sidePanel}>
          <h2>Booking details</h2>
          {focusBooking ? (
            <div className={styles.summaryCard}>
              <p>
                <strong>Guest:</strong> {focusBooking.guestName}
              </p>
              <p>
                <strong>Unit:</strong> {focusBooking.unitCode}
              </p>
              <p>
                <strong>Stay:</strong> {focusBooking.checkIn} → {focusBooking.checkOut}
              </p>
              <p>
                <strong>Status:</strong> {focusBooking.status}
              </p>
            </div>
          ) : (
            <p className={styles.muted}>Select a booking cell in the calendar to show details here.</p>
          )}
        </aside>
      </div>

      {data.units.length === 0 ? <p style={{ marginTop: 16 }}>No units match the selected room type.</p> : null}
    </main>
  );
}
