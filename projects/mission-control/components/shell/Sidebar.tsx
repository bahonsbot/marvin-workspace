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
  if (collapsed) return null;

  const date = new Date();
  const fullDateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);

  return (
    <div
      style={{
        display: 'grid',
        justifyItems: 'center',
        padding: '8px 2px 10px',
        minHeight: 26,
      }}
    >
      <div
        style={{
          fontSize: 10,
          lineHeight: 1.2,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(84, 74, 62, 0.88)',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          opacity: 1,
          textAlign: 'center',
        }}
      >
        {fullDateLabel}
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
        padding: '16px 10px 16px',
        gap: 6,
        overflowX: 'visible',
        overflowY: 'auto',
        transition: 'width 320ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div style={{ marginBottom: 8, height: 30, display: 'flex', alignItems: 'center' }}>
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
            transition: 'background 220ms ease, border-color 220ms ease, color 220ms ease',
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

      {navItems.map((item) => {
        const isActive = isItemActive(pathname, item);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            title={sidebarCollapsed ? item.label : undefined}
            className="sidebar-item"
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: sidebarCollapsed ? 0 : 10,
              height: 40,
              minHeight: 40,
              padding: sidebarCollapsed ? '0' : '0 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--accent-deep)' : 'var(--text-muted)',
              background: isActive ? 'var(--bg-sidebar-active)' : 'transparent',
              border: isActive ? '1px solid var(--border-accent)' : '1px solid transparent',
              textDecoration: 'none',
              transition: 'background 220ms ease, color 220ms ease, border-color 220ms ease, box-shadow 220ms ease',
              overflow: 'visible',
            }}
          >
            {!sidebarCollapsed ? (
              <span
                aria-hidden
                className="sidebar-active-rail"
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
              className="sidebar-icon"
              style={{
                width: 20,
                height: 20,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isActive ? 'var(--accent-deep)' : 'var(--text-muted)',
                transform: 'translateY(0px)',
                transition: 'color 220ms ease, opacity 220ms ease, border-color 220ms ease',
                boxShadow: sidebarCollapsed && isActive ? '0 0 0 1px rgba(93, 120, 106, 0.12), 0 6px 14px rgba(93, 120, 106, 0.08)' : 'none',
              }}
            >
              <Icon size={18} strokeWidth={1.9} />
            </span>

            {sidebarCollapsed ? null : (
              <span
                className="sidebar-label"
                style={{
                  color: isActive ? 'var(--accent-deep)' : 'var(--text-muted)',
                  fontWeight: isActive ? 600 : 500,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  opacity: 1,
                  transform: 'translateX(0px)',
                  transition: 'color 220ms ease, opacity 180ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                {item.label}
              </span>
            )}

            {sidebarCollapsed ? (
              <span
                role="tooltip"
                className="sidebar-collapsed-tooltip"
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
        .sidebar-item:hover {
          background: rgba(255, 255, 255, 0.74) !important;
          border-color: rgba(197, 138, 73, 0.22) !important;
          box-shadow: 0 10px 22px rgba(41, 61, 52, 0.08), inset 0 0 0 1px rgba(197, 138, 73, 0.08);
        }

        .sidebar-item:hover .sidebar-icon {
          color: #c58a49 !important;
          opacity: 1;
        }

        .sidebar-item:hover .sidebar-label {
          color: rgba(54, 86, 73, 0.98) !important;
          transform: translateX(1px);
        }

        .sidebar-item:hover .sidebar-collapsed-tooltip,
        .sidebar-item:focus-visible .sidebar-collapsed-tooltip {
          opacity: 1;
        }

        .sidebar-item:hover .sidebar-active-rail {
          transform: scaleY(1) !important;
        }

        button:hover {
          background: rgba(255, 255, 255, 0.58);
          border-color: rgba(93, 120, 106, 0.18);
        }
      `}</style>
    </aside>
  );
}
