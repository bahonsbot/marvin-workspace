'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import {
  GENERAL_NAV_ITEMS,
  TRADING_NAV_ITEMS,
  getShellDomain,
  isItemActive,
} from './navigation';
import { useShellContext } from './ShellContext';

function SidebarAmbientWidget({ collapsed }: { collapsed: boolean }) {
  const date = new Date();
  const fullDateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
  const compactDateLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);

  return (
    <div
      style={{
        display: 'grid',
        justifyItems: 'center',
        padding: collapsed ? '6px 0 8px' : '8px 2px 10px',
        minHeight: 26,
      }}
    >
      <div
        style={{
          fontSize: 10,
          lineHeight: 1.2,
          letterSpacing: collapsed ? '0.08em' : '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(84, 74, 62, 0.88)',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          opacity: 1,
          textAlign: 'center',
        }}
      >
        {collapsed ? compactDateLabel : fullDateLabel}
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const domain = getShellDomain(pathname);
  const navItems = domain === 'trading' ? TRADING_NAV_ITEMS : GENERAL_NAV_ITEMS;
  const { sidebarCollapsed, toggleSidebarCollapsed } = useShellContext();

  return (
    <aside
      style={{
        position: 'sticky',
        top: 52,
        height: 'calc(100vh - 52px)',
        width: sidebarCollapsed ? 56 : 200,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: sidebarCollapsed ? '14px 8px 16px' : '20px 14px',
        gap: 6,
        overflowX: 'visible',
        overflowY: 'auto',
        transition: 'width 280ms cubic-bezier(0.4, 0, 0.2, 1), padding 280ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <button
          type="button"
          onClick={toggleSidebarCollapsed}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            width: '100%',
            height: 30,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.38)',
            color: 'var(--text-muted)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-end',
            padding: sidebarCollapsed ? 0 : '0 8px',
            cursor: 'pointer',
            transition: 'all 180ms ease',
          }}
        >
          <ChevronLeft
            size={14}
            strokeWidth={2.2}
            style={{
              transform: sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 280ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </button>
      </div>

      <div style={{ marginBottom: 8, minHeight: 18 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            opacity: sidebarCollapsed ? 0 : 1,
            transform: sidebarCollapsed ? 'translateX(-8px)' : 'translateX(0px)',
            width: sidebarCollapsed ? 0 : 'auto',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            transition: 'opacity 180ms ease, transform 180ms ease, width 180ms ease',
          }}
        >
          {domain === 'trading' ? 'Trading Domain' : 'General Domain'}
        </div>
      </div>

      {navItems.map((item) => {
        const isActive = isItemActive(pathname, item);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            title={sidebarCollapsed ? item.label : undefined}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: sidebarCollapsed ? 0 : 10,
              minHeight: 40,
              padding: sidebarCollapsed ? '8px 0' : '9px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--accent-deep)' : 'var(--text-muted)',
              background: isActive ? 'var(--bg-sidebar-active)' : 'transparent',
              border: isActive ? '1px solid var(--border-accent)' : '1px solid transparent',
              textDecoration: 'none',
              transition: 'background 180ms ease, color 180ms ease, border-color 180ms ease',
              overflow: 'visible',
            }}
          >
            {!sidebarCollapsed ? (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: -1,
                  top: 6,
                  bottom: 6,
                  width: 2,
                  borderRadius: 2,
                  background: isActive ? 'var(--accent-mid)' : 'var(--accent-warm)',
                  transformOrigin: 'top',
                  transform: isActive ? 'scaleY(1)' : 'scaleY(0)',
                  opacity: isActive ? 1 : 0.72,
                  transition: 'transform 180ms ease, opacity 180ms ease, background 180ms ease',
                }}
              />
            ) : null}

            <span
              style={{
                width: 20,
                height: 20,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isActive ? 'var(--accent-deep)' : 'var(--text-muted)',
                transform: isActive ? 'translateY(-1px)' : 'translateY(0px)',
                transition: 'transform 180ms ease, color 180ms ease',
                borderBottom: sidebarCollapsed && isActive ? '2px solid var(--accent-mid)' : '2px solid transparent',
              }}
            >
              <Icon size={18} strokeWidth={1.9} />
            </span>

            <span
              style={{
                color: isActive ? 'var(--accent-deep)' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 500,
                opacity: sidebarCollapsed ? 0 : 1,
                transform: sidebarCollapsed ? 'translateX(-8px)' : 'translateX(0px)',
                width: sidebarCollapsed ? 0 : 'auto',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                transition: 'opacity 180ms ease, transform 180ms ease, width 180ms ease, color 180ms ease',
                pointerEvents: sidebarCollapsed ? 'none' : 'auto',
              }}
            >
              {item.label}
            </span>

            {sidebarCollapsed ? (
              <span
                role="tooltip"
                style={{
                  position: 'absolute',
                  left: 'calc(100% + 10px)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(17, 30, 25, 0.9)',
                  color: 'var(--text-sidebar-label)',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  whiteSpace: 'nowrap',
                  padding: '6px 9px',
                  opacity: 0,
                  pointerEvents: 'none',
                  transition: 'opacity 140ms ease',
                  boxShadow: '0 8px 22px rgba(0,0,0,0.22)',
                  zIndex: 20,
                }}
                className="sidebar-collapsed-tooltip"
              >
                {item.label}
              </span>
            ) : null}
          </Link>
        );
      })}
      <div style={{ flex: 1 }} />
      <SidebarAmbientWidget collapsed={sidebarCollapsed} />

      <style jsx>{`
        a:hover {
          background: var(--bg-sidebar-hover) !important;
        }

        a:hover span:first-of-type {
          color: var(--accent-warm) !important;
          transform: translateY(-1px);
        }

        a:hover .sidebar-collapsed-tooltip,
        a:focus-visible .sidebar-collapsed-tooltip {
          opacity: 1;
        }

        a:hover [aria-hidden='true'] {
          transform: scaleY(1) !important;
        }
      `}</style>
    </aside>
  );
}
