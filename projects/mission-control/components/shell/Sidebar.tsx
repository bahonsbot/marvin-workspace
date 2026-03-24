'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Home', href: '/', icon: '⌂' },
  { label: 'Chat', href: '/chat', icon: '◎' },
  { label: 'Tasks', href: '/tasks', icon: '☑' },
  { label: 'Agents', href: '/agents', icon: '◉' },
  { label: 'Cron', href: '/cron', icon: '⊚' },
  { label: 'Memory', href: '/memory', icon: '◈' },
  { label: 'Market Intel', href: '/market-intel', icon: '◫' },
  { label: 'Files', href: '/files', icon: '▣' },
  { label: 'Search', href: '/search', icon: '⌕' },
  { label: 'Logs', href: '/logs', icon: '☰' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        position: 'sticky',
        top: 52, // below top tab bar
        height: 'calc(100vh - 52px)',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 14px',
        gap: 4,
        overflowY: 'auto',
      }}
    >
      {/* Nav items */}
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--accent-deep)' : 'var(--text-muted)',
              background: isActive ? 'var(--accent-surface)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--accent-mid)' : '3px solid transparent',
              transition: 'all 0.15s ease',
              textDecoration: 'none',
            }}
          >
            <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Bottom widget — Ops Pulse */}
      <div
        style={{
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 16px',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            margin: '0 0 8px 0',
          }}
        >
          Ops Pulse
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sessions</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--accent-deep)',
              }}
            >
              3 active
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cron</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--accent-mid)',
              }}
            >
              12 ok
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
