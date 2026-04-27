'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import {
  DOMAIN_META,
  DOMAIN_TABS,
  GENERAL_NAV_ITEMS,
  TRADING_NAV_ITEMS,
  getShellDomain,
  isItemActive,
} from './navigation';
import styles from './shell.module.css';

export function TopTabBar() {
  const pathname = usePathname();
  const activeDomain = getShellDomain(pathname);
  const navItems = activeDomain === 'trading' ? TRADING_NAV_ITEMS : GENERAL_NAV_ITEMS;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <header className={styles.topTabBar}>
      <div className={styles.topTabBrand}>{DOMAIN_META[activeDomain].roomLabel}</div>
      <div className={styles.topTabDivider} />
      <nav className={styles.topTabNav}>
        {DOMAIN_TABS.map((tab) => {
          const isActive = tab.domain === activeDomain;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={false}
              className={`${styles.topTabLink} ${isActive ? styles.topTabLinkActive : ''}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div aria-hidden="true" style={{ flex: 1, minWidth: 12 }} />
      <button className={styles.topTabSearchButton} aria-label="Search">
        ⌕
      </button>
      <button
        type="button"
        className={styles.mobileMenuButton}
        aria-label="Open section menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <Menu size={18} strokeWidth={2.2} />
      </button>
      {menuOpen ? (
        <div className={styles.mobileMenuLayer} role="presentation" onClick={() => setMenuOpen(false)}>
          <nav className={styles.mobileMenuPanel} aria-label={`${activeDomain} navigation`} onClick={(event) => event.stopPropagation()}>
            <div className={styles.mobileMenuHead}>
              <button type="button" className={styles.mobileMenuClose} aria-label="Close section menu" onClick={() => setMenuOpen(false)}>
                <X size={16} strokeWidth={2.2} />
              </button>
              <div className={styles.mobileMenuKicker}>{activeDomain}</div>
            </div>
            <div className={styles.mobileMenuLinks}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(pathname, item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    className={`${styles.mobileMenuLink} ${active ? styles.mobileMenuLinkActive : ''}`}
                  >
                    <span>{item.label}</span>
                    <Icon size={18} strokeWidth={1.9} />
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
