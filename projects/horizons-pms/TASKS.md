# Horizons PMS - Phase 1 Implementation Tasks

Source: `projects/horizons-pms/PRD.md` (Phase 1 core scope)

## Todo

- [ ] **[P1] Define and apply core database schema (room types, units, guests, bookings, profiles)**  
  **Estimate:** 60-90 min  
  **Completion criteria:** SQL migration(s) added and runnable; includes all Phase 1 core entities with primary/foreign keys and timestamps.

- [ ] **[P1] Seed initial operational data (4 room types + 76 units)**  
  **Estimate:** 30-45 min  
  **Completion criteria:** Seed script exists and inserts 4 room types (studio/1bed/2bed/3bed) and 76 units with unit number, floor, room type, status.

- [ ] **[P1] Implement role model and permission matrix (admin, manager, frontdesk)**  
  **Estimate:** 45-75 min  
  **Completion criteria:** Role definitions documented and enforced in app middleware/policies; each role has explicit allowed actions for units/bookings/guests/dashboard.

- [ ] **[P1] Build Units CRUD views (list + create/edit + status updates)**  
  **Estimate:** 60-90 min  
  **Completion criteria:** Staff can create, edit, and update unit status (available/occupied/maintenance/reserved) from UI with validation and persistence.

- [ ] **[P1] Add maintenance issue tracking to unit workflow**  
  **Estimate:** 45-60 min  
  **Completion criteria:** Staff can log maintenance issue description, reported date, issue status, and resolution notes per unit.

- [ ] **[P1] Build Guest profile module with searchable list/detail**  
  **Estimate:** 45-75 min  
  **Completion criteria:** Guest profile fields (name, email, phone, nationality, ID info, notes/tags) are creatable/editable and searchable.

- [ ] **[P1] Implement booking create/edit flow with status lifecycle**  
  **Estimate:** 60-90 min  
  **Completion criteria:** Booking can be created/updated with guest, unit, check-in/out, rate, source, remarks; status transitions include confirmed/checked-in/checked-out/cancelled/no-show.

- [ ] **[P1] Enforce booking conflict detection (double-booking prevention)**  
  **Estimate:** 45-75 min  
  **Completion criteria:** Overlapping bookings for same unit are blocked at data and API layer with clear UI error message.

- [ ] **[P1] Build quick availability search (date range + room type)**  
  **Estimate:** 30-60 min  
  **Completion criteria:** User can query date range + room type and receive available unit count and candidate units.

- [ ] **[P2] Build calendar view for all bookings with contextual edit actions**  
  **Estimate:** 60-90 min  
  **Completion criteria:** Calendar displays bookings by date; users can open contextual booking details and update remarks/status without full-page workflow.

- [ ] **[P2] Build front-desk dashboard (arrivals/departures, occupancy, revenue snapshot, available rooms)**  
  **Estimate:** 60-90 min  
  **Completion criteria:** Dashboard cards show today’s arrivals/departures, occupancy %, daily/weekly/monthly revenue snapshot, and available rooms by room type/day.

- [ ] **[P2] Verification checklist pass for Phase 1 acceptance criteria**  
  **Estimate:** 30-45 min  
  **Completion criteria:** Explicit test checklist completed for PRD verification section (76-unit CRUD, booking date range, no double-booking, multi-user behavior, calendar accuracy, dashboard accuracy).

## In Progress

- None.

## Blocked

- None.

## Done

- Initial Phase 1 implementation backlog drafted from PRD into scoped execution chunks.
