export default function Home() {
  return (
    <main style={{ maxWidth: 760, margin: "48px auto", padding: "0 16px" }}>
      <h1>Horizons PMS</h1>
      <p>Phase 1 scaffold is ready.</p>
      <ul>
        <li>Next.js + TypeScript app initialized</li>
        <li>Supabase client/server helpers added</li>
        <li>Initial SQL schema prepared</li>
      </ul>

      <h2>Routes</h2>
      <ul>
        <li>
          <a href="/dashboard">/dashboard</a>
        </li>
        <li>
          <a href="/room-types">/room-types</a>
        </li>
        <li>
          <a href="/units">/units</a>
        </li>
        <li>
          <a href="/bookings">/bookings</a>
        </li>
        <li>
          <a href="/calendar">/calendar</a>
        </li>
      </ul>
      <p>
        Next step: copy <code>.env.example</code> to <code>.env.local</code> and
        connect to your Supabase project.
      </p>
    </main>
  );
}
