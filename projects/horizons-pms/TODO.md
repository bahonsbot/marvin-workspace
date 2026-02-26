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
- Occupancy widgets (today, weekly, monthly)
- Arrivals/departures list for today
- Availability by room type
- Basic revenue snapshot

## 4. Booking flow
- Availability search (date range + room type)
- Booking create/edit/cancel
- Conflict handling with friendly UI messages
- Booking calendar view

## 5. Guest and unit operations
- Guest profile + stay history
- Unit management CRUD + status updates
- Maintenance issue tracking UI

## 6. Nice-to-have after core
- CSV/PDF exports
- Basic reporting screens
- Audit logging for important actions

## Booking rules (bed / extra bed)
- Use `units.bed_layout` (not only `bed_setup`) when validating booking bed preference
- Any layout containing `twin` should default to no extra bed unless manually overridden by policy
- Room type with `allow_extra_bed = false` => no extra bed
