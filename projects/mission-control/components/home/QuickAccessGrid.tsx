import type { HomeQuickAccessItem } from '@/lib/types/contracts';
import { QuickAccessTile } from '@/components/home/QuickAccessTile';

type QuickAccessGridProps = {
  items: HomeQuickAccessItem[];
};

export function QuickAccessGrid({ items }: QuickAccessGridProps) {
  return (
    <section className="general-home-quick-access-section" aria-label="Quick access">
      <div className="general-home-section-heading-row">
        <h2 className="general-home-section-heading">Quick access</h2>
        <span className="general-home-section-kicker">One-click routes</span>
      </div>
      <div className="general-home-quick-access-grid">
        {items.map((item) => (
          <QuickAccessTile key={item.href} item={item} />
        ))}
      </div>
    </section>
  );
}
