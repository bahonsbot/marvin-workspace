'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'General', href: '/' },
  { label: 'Trading', href: '/trading' },
];

export function TopTabBar() {
  const pathname = usePathname();
  const activeTab = TABS.find(t => t.href === pathname) ?? TABS[0];

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 52,
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 20,
        zIndex: 100,
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* App name */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--accent-mid)',
          marginRight: 8,
          whiteSpace: 'nowrap',
        }}
      >
        Mission Control
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

      {/* Mode tabs */}
      <nav style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {TABS.map((tab) => {
          const isActive = tab.href === activeTab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: '5px 16px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#fff' : 'var(--text-muted)',
                background: isActive ? 'var(--accent-deep)' : 'transparent',
                transition: 'all 0.15s ease',
                textDecoration: 'none',
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right side — search icon */}
      <button
        style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
        }}
        aria-label="Search"
      >
        ⌕
      </button>

      {/* Profile avatar */}
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 'var(--radius-full)',
          background: 'var(--accent-surface)',
          border: '2px solid var(--accent-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--accent-deep)',
          cursor: 'pointer',
        }}
      >
        P
      </div>
    </header>
  );
}
