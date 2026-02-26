import { getDashboardSummary } from "@/lib/data/dashboard";

function cardStyle() {
  return {
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: 16,
    background: "#fff",
  } as const;
}

export default async function DashboardPage() {
  let error = "";
  let summary: Awaited<ReturnType<typeof getDashboardSummary>> | null = null;

  try {
    summary = await getDashboardSummary();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load dashboard data";
  }

  return (
    <main style={{ maxWidth: 980, margin: "40px auto", padding: "0 16px" }}>
      <h1>Dashboard</h1>
      <p style={{ color: "#666", marginTop: 8 }}>Live snapshot for {summary?.today ?? "today"}</p>
      {error ? <p style={{ color: "#b00020", marginTop: 12 }}>Error: {error}</p> : null}

      <section
        style={{
          marginTop: 20,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        <article style={cardStyle()}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Today&apos;s arrivals</h2>
          <p style={{ margin: "10px 0 0", fontSize: 28, fontWeight: 600 }}>{summary?.arrivalsCount ?? "-"}</p>
        </article>

        <article style={cardStyle()}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Today&apos;s departures</h2>
          <p style={{ margin: "10px 0 0", fontSize: 28, fontWeight: 600 }}>{summary?.departuresCount ?? "-"}</p>
        </article>

        <article style={cardStyle()}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Current occupancy rate</h2>
          <p style={{ margin: "10px 0 0", fontSize: 28, fontWeight: 600 }}>
            {summary ? `${summary.occupancyRate.toFixed(1)}%` : "-"}
          </p>
          <p style={{ margin: "6px 0 0", color: "#666", fontSize: 13 }}>
            Based on checked-in bookings / total units ({summary?.totalUnitsCount ?? 0})
          </p>
        </article>

        <article style={cardStyle()}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Available units (today)</h2>
          <p style={{ margin: "10px 0 0", fontSize: 28, fontWeight: 600 }}>{summary?.availableUnitsCount ?? "-"}</p>
        </article>
      </section>
    </main>
  );
}
