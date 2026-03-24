export function BottomSystemStrip() {
  return (
    <footer
      style={{
        position: 'sticky',
        bottom: 0,
        height: 36,
        background: 'var(--bg-elevated)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        fontSize: 10,
        color: 'var(--text-muted)',
        zIndex: 50,
      }}
    >
      {/* Left: status dot + metrics */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent-mid)',
              boxShadow: '0 0 8px rgba(60, 102, 88, 0.5)',
            }}
          />
          <span>VPS</span>
        </div>
        <span>CPU 4%</span>
        <span>RAM 31%</span>
        <span>Disk 19%</span>
        <span>Uptime 14d</span>
      </div>

      {/* Right: refresh time */}
      <div>
        <span>
          Refreshed {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
    </footer>
  );
}
