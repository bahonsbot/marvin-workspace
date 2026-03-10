import { createClient } from "@/lib/supabase/server";

export type DashboardSummary = {
  today: string;
  arrivalsCount: number;
  departuresCount: number;
  occupancyRate: number;
  availableUnitsCount: number;
  totalUnitsCount: number;
};

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createClient();
  const today = getTodayDateString();

  const [{ count: totalUnitsCount, error: unitsError }, { data: unitsAvailableData, error: unitsAvailableError }] =
    await Promise.all([
      supabase.from("units").select("id", { count: "exact", head: true }),
      supabase.from("units").select("id").eq("status", "available"),
    ]);

  if (unitsError) {
    throw new Error(unitsError.message);
  }

  if (unitsAvailableError) {
    throw new Error(unitsAvailableError.message);
  }

  const [
    { count: arrivalsCount, error: arrivalsError },
    { count: departuresCount, error: departuresError },
    { count: occupiedCount, error: occupiedError },
    { data: reservedTodayData, error: reservedTodayError },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("check_in", today)
      .not("status", "in", '("cancelled","no_show")'),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("check_out", today)
      .not("status", "in", '("cancelled","no_show")'),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "checked_in")
      .lte("check_in", today)
      .gt("check_out", today),
    supabase
      .from("bookings")
      .select("unit_id")
      .in("status", ["confirmed", "checked_in"])
      .lte("check_in", today)
      .gt("check_out", today),
  ]);

  if (arrivalsError) throw new Error(arrivalsError.message);
  if (departuresError) throw new Error(departuresError.message);
  if (occupiedError) throw new Error(occupiedError.message);
  if (reservedTodayError) throw new Error(reservedTodayError.message);

  const availableUnits = new Set((unitsAvailableData ?? []).map((row) => row.id as string));
  const reservedToday = new Set((reservedTodayData ?? []).map((row) => row.unit_id as string));

  let availableUnitsCount = 0;
  for (const unitId of availableUnits) {
    if (!reservedToday.has(unitId)) {
      availableUnitsCount += 1;
    }
  }

  const safeTotalUnits = totalUnitsCount ?? 0;
  const occupancyRate = safeTotalUnits > 0 ? ((occupiedCount ?? 0) / safeTotalUnits) * 100 : 0;

  return {
    today,
    arrivalsCount: arrivalsCount ?? 0,
    departuresCount: departuresCount ?? 0,
    occupancyRate,
    availableUnitsCount,
    totalUnitsCount: safeTotalUnits,
  };
}
