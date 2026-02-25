# PRD: Horizons PMS - Phase 1 (Core)

## Overview
Property Management System (PMS) for Horizons - managing 76 self-owned rental units in a resort building. Core multi-user operations platform.

## Context
- Horizons manages 76 units on behalf of individual investors
- Units are self-owned but rented out like a hotel
- Currently using manual Excel-based processes
- Need cloud-based system with real-time multi-user access

## Requirements

### Must Have

#### UX/UI
- [ ] Fast, clean UI for front-desk operations (low training overhead)
- [ ] Availability should be visible at a glance by room type and date
- [ ] Booking, unit status, and remarks should be editable from contextual views (calendar/list/detail) without friction

#### Unit Management
- [ ] CRUD operations for 76 units
- [ ] Unit attributes: unit number, floor, room type (studio/1bed/2bed/3bed), status
- [ ] Unit status tracking: available, occupied, maintenance, reserved
- [ ] Maintenance tracking: issue description, reported date, status, resolution notes

#### Room Types (4 types)
- [ ] Studios
- [ ] 1 Bedroom
- [ ] 2 Bedroom
- [ ] 3 Bedroom
- [ ] Each room type has: base capacity, amenities list, base rate

#### Guest Management
- [ ] Guest profiles: name, email, phone, nationality, ID info
- [ ] Stay history per guest
- [ ] Notes/tags for special requests

#### Booking Management
- [ ] Create booking: guest, unit, check-in, check-out, rate, source
- [ ] Booking statuses: confirmed, checked-in, checked-out, cancelled, no-show
- [ ] Calendar view of all bookings
- [ ] Conflict detection (prevent double-booking)
- [ ] Special requests/remarks: late check-in/out, early check-in, extra bed, etc.
- [ ] Quick availability search by date range and room type

#### User Management
- [ ] Multi-user support with roles
- [ ] Roles: admin, manager, frontdesk
- [ ] Role-based permissions

#### Dashboard
- [ ] Occupancy rate (current/target)
- [ ] Today's arrivals/departures
- [ ] Revenue snapshot (daily/weekly/monthly)
- [ ] Available rooms count per day (by room type)
- [ ] Quick availability check for any date range

### Nice to Have
- [ ] Basic reporting (occupancy, revenue by room type)
- [ ] Monthly report export (CSV/PDF) - bookings, revenue, occupancy
- [ ] Maintenance history export

## Technical Approach

### Stack Recommendation
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Frontend**: Next.js or similar
- **Hosting**: Vercel or similar

### Data Model (v1)
```
units
- id, unit_number, floor, room_type, status, amenities, base_rate

room_types  
- id, name, base_capacity, max_capacity, description

bookings
- id, unit_id, guest_id, check_in, check_out, rate, status, source, notes

guests
- id, first_name, last_name, email, phone, nationality, id_number, notes

users
- id, email, name, role, created_at
```

## Verification
- [ ] All 76 units can be created/edited
- [ ] Bookings can be made for any date range
- [ ] Double-booking is prevented
- [ ] Multiple users can work simultaneously
- [ ] Calendar shows correct occupancy
- [ ] Dashboard displays accurate stats

## Constraints
- Phase 1: No payment processing
- Phase 1: No booking engine (internal use only)
- Initial users: ~5-10 staff members

## Out of Scope (Phase 1)
- Guest-facing booking engine
- Dynamic pricing
- Payment processing
- Channel manager integration
- Automated communications
