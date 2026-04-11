'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

type MarketWatchRefreshButtonProps = {
  ariaLabel?: string;
  className?: string;
};

export function MarketWatchRefreshButton({
  ariaLabel = 'Refresh market headlines',
  className = 'general-home-v3-market-refresh',
}: MarketWatchRefreshButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
      disabled={isPending}
      aria-label={ariaLabel}
    >
      {isPending ? 'Refreshing…' : 'Refresh'}
    </button>
  );
}
