import Link from 'next/link';
import type { HomeQuickAccessItem } from '@/lib/types/contracts';

type QuickAccessTileProps = {
  item: HomeQuickAccessItem;
};

export function QuickAccessTile({ item }: QuickAccessTileProps) {
  return (
    <Link
      href={item.href}
      className="general-home-quick-access-tile"
      aria-label={item.badge ? `${item.label}, ${item.badge} active items` : item.label}
    >
      <span className="general-home-quick-access-icon" aria-hidden="true">
        {item.icon}
      </span>
      <span className="general-home-quick-access-label">{item.label}</span>
      {typeof item.badge === 'number' && item.badge > 0 ? (
        <span className="general-home-quick-access-badge" aria-label={`${item.badge} active`}>
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}
