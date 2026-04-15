'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DOMAIN_TABS, getShellDomain } from './navigation';

export function TopTabBar() {
  const pathname = usePathname();
  const activeDomain = getShellDomain(pathname);

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 52,
        background: 'rgba(255, 253, 251, 0.88)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 20,
        zIndex: 100,
        backdropFilter: 'blur(12px)',
      }}
    >
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
        Marvin’s Room
      </div>
      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
      <nav style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 24 }}>
        {DOMAIN_TABS.map((tab) => {
          const isActive = tab.domain === activeDomain;
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
      <div style={{ flex: 1 }} />
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
    </header>
  );
}
