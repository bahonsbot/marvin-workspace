'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { watchlistApi, type WatchlistWithItems } from '@/lib/convex/watchlist-api';

const DEMO_USER_KEY = 'lab-single-user';

type TickerWatchlistButtonProps = {
  convexEnabled: boolean;
  symbol: string;
  name: string;
  exchange?: string;
  currency?: string;
};

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function findContainingWatchlist(watchlists: WatchlistWithItems[], symbol: string) {
  const normalized = normalizeSymbol(symbol);
  return watchlists.find((watchlist) => watchlist.items.some((item) => item.symbol === normalized));
}

export function TickerWatchlistButton({ convexEnabled, symbol, name, exchange, currency }: TickerWatchlistButtonProps) {
  if (!convexEnabled) return <StaticTickerWatchlistButton />;
  return <LiveTickerWatchlistButton symbol={symbol} name={name} exchange={exchange} currency={currency} />;
}

function StaticTickerWatchlistButton() {
  return (
    <button type="button" className="trading-watchlist-toggle not-watched" disabled title="Connect Convex to save watchlists.">
      + Watchlist
    </button>
  );
}

function LiveTickerWatchlistButton({ symbol, name, exchange, currency }: Omit<TickerWatchlistButtonProps, 'convexEnabled'>) {
  const watchlists = useQuery(watchlistApi.listWatchlists, { userKey: DEMO_USER_KEY });
  const addItem = useMutation(watchlistApi.add);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const containingWatchlist = useMemo(() => watchlists ? findContainingWatchlist(watchlists, symbol) : undefined, [symbol, watchlists]);
  const selectedWatchlist = watchlists?.find((watchlist) => watchlist._id === selectedId) ?? containingWatchlist ?? watchlists?.[0];
  const isWatched = Boolean(containingWatchlist);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!watchlists?.length) return;
    setSelectedId((current) => current ?? containingWatchlist?._id ?? watchlists[0]._id);
  }, [containingWatchlist?._id, watchlists]);

  async function saveToWatchlist() {
    setSaving(true);
    setStatus(null);
    try {
      await addItem({
        userKey: DEMO_USER_KEY,
        watchlistId: selectedWatchlist?._id,
        symbol: normalizeSymbol(symbol),
        name,
        exchange,
        currency,
        priority: 'radar',
        alertLevel: 'watch',
        tags: [],
      });
      setStatus(selectedWatchlist ? `Saved to ${selectedWatchlist.name}.` : 'Saved to watchlist.');
      setOpen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save to watchlist.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="trading-ticker-watchlist-control" ref={menuRef}>
      <button
        type="button"
        className={`trading-watchlist-toggle ${isWatched ? 'in-watchlist' : 'not-watched'}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {isWatched ? '✓ Watchlist' : '+ Watchlist'}
      </button>
      {open ? (
        <div className="trading-ticker-watchlist-menu" role="dialog" aria-label="Add ticker to watchlist">
          <div>
            <strong>{isWatched ? 'Already tracked' : 'Add to watchlist'}</strong>
            <p>{isWatched && containingWatchlist ? `${symbol} is in ${containingWatchlist.name}.` : `Choose where to save ${symbol}.`}</p>
          </div>
          <label>
            <span>Watchlist</span>
            <select value={selectedWatchlist?._id ?? ''} onChange={(event) => setSelectedId(event.target.value)} disabled={!watchlists?.length || saving}>
              {(watchlists ?? []).map((watchlist) => (
                <option key={watchlist._id} value={watchlist._id}>{watchlist.name}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={saveToWatchlist} disabled={saving || !watchlists}>
            {saving ? 'Saving…' : isWatched ? 'Update saved list' : 'Add symbol'}
          </button>
          {status ? <p className="trading-ticker-watchlist-status">{status}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
