# Horizons PMS - Local Setup (Phase 1)

This guide is for first-time setup.

## 1) Prerequisites

Install these first:
- Node.js 20+ (LTS recommended)
- npm (comes with Node.js)
- A Supabase account

## 2) Install and run the app

From project root:

```bash
cd app
npm install
cp .env.example .env.local
```

Then open `.env.local` and set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Start dev server:

```bash
npm run dev
```

Open: http://localhost:3000

## 3) Supabase setup checklist

1. Create a new Supabase project.
2. In Supabase Dashboard, go to **Project Settings > API**.
3. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Go to **SQL Editor**.
5. Run SQL migrations in order:
   - `../sql/001_initial_schema.sql`
   - `../sql/002_units_tower_bedsetup.sql`
   - `../sql/003_bed_layouts.sql`
   - `../sql/004_unit_number_normalization.sql`
   - `../sql/005_unit_blueprints.sql`
6. Ensure `room_types` contains base names (`studio`, `1bed`, `2bed`, `3bed`) before running `005_unit_blueprints.sql` because it seeds by room type name lookup.
7. Confirm tables exist:
   - `room_types`
   - `units`
   - `guests`
   - `bookings`
   - `users`

## 4) Verify everything works

In `app/` run:

```bash
npm run lint
npm run build
```

If both pass, scaffold is ready.
