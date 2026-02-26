import { getCalendarOccupancyData } from "@/lib/data/calendar";
import { ROOM_TYPE_LABELS, ROOM_TYPE_NAMES, type RoomTypeName } from "@/lib/models/room-type";
import Link from "next/link";
import styles from "./page.module.css";

type SearchParams = {
  month?: string;
  roomType?: string;
  tower?: string;
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

function buildQuery(params: { month: string; roomType?: string; tower?: string; focusBooking?: string }): string {
  const search = new URLSearchParams();
  search.set("month", params.month);
  if (params.roomType) search.set("roomType", params.roomType);
  if (params.tower) search.set("tower", params.tower);
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
  const selectedTower = params.tower ? Number.parseInt(params.tower, 10) : undefined;

  const data = await getCalendarOccupancyData({
    monthStartIso: isoDate(monthStart),
    monthEndExclusiveIso: isoDate(monthEndExclusive),
    filters: {
      roomTypeName: selectedRoomType,
      tower: Number.isFinite(selectedTower) ? selectedTower : undefined,
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
      <p className={styles.muted}>View month occupancy by unit. Click a marked day cell to open a booking summary.</p>

      <div className={styles.toolbar}>
        <div className={styles.navLinks}>
          <Link
            className={styles.button}
            href={`/calendar?${buildQuery({
              month: formatMonthParam(previousMonth),
              roomType: selectedRoomType,
              tower: selectedTower ? String(selectedTower) : undefined,
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
              tower: selectedTower ? String(selectedTower) : undefined,
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

          <label htmlFor="tower">Tower</label>
          <select className={styles.select} id="tower" name="tower" defaultValue={selectedTower ? String(selectedTower) : ""}>
            <option value="">All</option>
            {data.towers.map((tower) => (
              <option key={tower} value={tower}>
                Tower {tower}
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

      {focusBooking ? (
        <section className={styles.summary}>
          <strong>Booking summary:</strong> {focusBooking.guestName} · {focusBooking.unitCode} · {focusBooking.checkIn} → {focusBooking.checkOut} · {focusBooking.status}
        </section>
      ) : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.headerCell} style={{ left: 0, zIndex: 4, minWidth: 180 }}>
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
                    <div className={styles.muted} style={{ fontSize: 12 }}>
                      {unit.room_type ? ROOM_TYPE_LABELS[unit.room_type.name] : "No type"} · Tower {unit.tower}
                    </div>
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
                      tower: selectedTower ? String(selectedTower) : undefined,
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

      {data.units.length === 0 ? <p style={{ marginTop: 16 }}>No units match the selected filters.</p> : null}
    </main>
  );
}
