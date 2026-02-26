# Horizons PMS - Next Build Steps

## 1. API and data access
- Add typed data layer for units, guests, bookings, room types
- Add server actions / route handlers for CRUD
- Add validation with zod for request payloads

## 2. Auth and roles
- Enable Supabase Auth (email/password for staff)
- Link `auth.users` to `public.users`
- Enforce role checks (admin, manager, frontdesk)

## 3. Dashboard
- ✅ `/dashboard` route with starter KPI cards (today arrivals, today departures, occupancy rate, available units)
- Occupancy widgets (weekly, monthly trends)
- Arrivals/departures detailed list for today
- Availability by room type breakdown
- Basic revenue snapshot

## 4. Booking flow
- ✅ MVP skeleton: `/bookings` create form + latest list
- ✅ Availability overlap check before insert for active bookings (`confirmed`, `checked_in`)
- ✅ Extra-bed policy guardrails (deny for twin layouts or room types with `allow_extra_bed = false`)
- ✅ Booking row actions with server-side validated status transitions (`confirmed -> checked_in -> checked_out`, cancel from valid non-final states)
- Promote extra-bed request from note-tag to dedicated DB column
- ✅ Booking calendar view (`/calendar`) with month nav, occupancy grid by unit/day, status legend, room type+tower filters, and click-through booking summary panel
- Improve calendar UX: sticky month/week headers, mobile condensed mode, and quick jump to today

## 5. Guest and unit operations
- Guest profile + stay history
- Unit management CRUD + status updates
- Maintenance issue tracking UI
- Keep `unit_blueprints` seeded (sql/005_unit_blueprints.sql) whenever room inventory changes; unit creation now depends on blueprint lookup.

## 6. Nice-to-have after core
- CSV/PDF exports
- Basic reporting screens
- Audit logging for important actions

## Booking rules (bed / extra bed)
- Use `units.bed_layout` (not only `bed_setup`) when validating booking bed preference
- Any layout containing `twin` should default to no extra bed unless manually overridden by policy
- Room type with `allow_extra_bed = false` => no extra bed
