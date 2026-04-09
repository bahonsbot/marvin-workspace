'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function MarketWatchRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="general-home-v3-market-refresh"
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
      disabled={isPending}
      aria-label="Refresh market headlines"
    >
      {isPending ? 'Refreshing…' : 'Refresh'}
    </button>
  );
}
