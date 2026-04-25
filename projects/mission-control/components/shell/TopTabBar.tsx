'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DOMAIN_TABS, getShellDomain } from './navigation';
import styles from './shell.module.css';

export function TopTabBar() {
  const pathname = usePathname();
  const activeDomain = getShellDomain(pathname);

  return (
    <header className={styles.topTabBar}>
      <div className={styles.topTabBrand}>Marvin’s Room</div>
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
    </header>
  );
}
