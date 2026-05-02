'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import {
  watchlistApi,
  type WatchlistAlertLevel,
  type WatchlistItem,
  type WatchlistPriority,
  type WatchlistWithItems,
} from '@/lib/convex/watchlist-api';
import { sampleWatchlistItems, sampleWatchlists } from './sample-watchlist';

const DEMO_USER_KEY = 'lab-single-user';
const priorityLabels: Record<WatchlistPriority, string> = {
  core: 'Core',
  radar: 'Radar',
  speculative: 'Speculative',
};
const alertLabels: Record<WatchlistAlertLevel, string> = {
  none: 'No alert',
  watch: 'Watch',
  urgent: 'Urgent',
};

function formatUpdatedAt(value: number) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

function symbolHref(symbol: string) {
  return `/trading/ticker/${encodeURIComponent(symbol)}`;
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function WatchlistAddForm({ enabled, watchlistId }: { enabled: boolean; watchlistId?: string }) {
  if (!enabled) return <DisabledWatchlistAddForm />;
  return <LiveWatchlistAddForm watchlistId={watchlistId} />;
}

function DisabledWatchlistAddForm() {
  return (
    <form className="trading-watchlist-add-form">
      <label>
        <span>Symbol</span>
        <input placeholder="ASML.AS" disabled />
      </label>
      <label>
        <span>Priority</span>
        <select disabled defaultValue="radar">
          <option value="core">Core</option>
          <option value="radar">Radar</option>
          <option value="speculative">Speculative</option>
        </select>
      </label>
      <label className="wide">
        <span>Thesis note</span>
        <input placeholder="What needs to be true?" disabled />
      </label>
      <button type="button" disabled>Add name</button>
      <p>Connect Convex to enable writes.</p>
    </form>
  );
}

function LiveWatchlistAddForm({ watchlistId }: { watchlistId?: string }) {
  const addItem = useMutation(watchlistApi.add);
  const [symbol, setSymbol] = useState('');
  const [thesis, setThesis] = useState('');
  const [priority, setPriority] = useState<WatchlistPriority>('radar');
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSymbol = normalizeSymbol(symbol);
    if (!nextSymbol) {
      setStatus('Add a symbol first.');
      return;
    }
    setIsSaving(true);
    setStatus(null);
    try {
      await addItem({
        userKey: DEMO_USER_KEY,
        watchlistId,
        symbol: nextSymbol,
        thesis: thesis.trim() || undefined,
        priority,
        alertLevel: 'watch',
        tags: priority === 'core' ? ['Core'] : ['Radar'],
      });
      setSymbol('');
      setThesis('');
      setPriority('radar');
      setStatus(`${nextSymbol} added to watchlist.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save watchlist item.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="trading-watchlist-add-form" onSubmit={handleSubmit}>
      <label>
        <span>Symbol</span>
        <input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="ASML.AS" disabled={isSaving} />
      </label>
      <label>
        <span>Priority</span>
        <select value={priority} onChange={(event) => setPriority(event.target.value as WatchlistPriority)} disabled={isSaving}>
          <option value="core">Core</option>
          <option value="radar">Radar</option>
          <option value="speculative">Speculative</option>
        </select>
      </label>
      <label className="wide">
        <span>Thesis note</span>
        <input value={thesis} onChange={(event) => setThesis(event.target.value)} placeholder="What needs to be true?" disabled={isSaving} />
      </label>
      <button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Add name'}</button>
      {status ? <p>{status}</p> : null}
    </form>
  );
}

function WatchlistTable({ items, canMutate, onRemove, removingId }: {
  items: WatchlistItem[];
  canMutate: boolean;
  onRemove?: (id: string) => void;
  removingId?: string | null;
}) {
  return (
    <div className="trading-table-shell trading-watchlist-page-table-shell">
      <table className="trading-table trading-watchlist-page-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Name</th>
            <th>Priority</th>
            <th>Alert</th>
            <th>Tags</th>
            <th>Thesis</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item._id}>
              <td><Link href={symbolHref(item.symbol)}>{item.displaySymbol || item.symbol}</Link></td>
              <td>{item.name || 'Provider pending'}<span>{[item.exchange || item.currency, formatUpdatedAt(item.updatedAt)].filter(Boolean).join(' · ')}</span></td>
              <td><em className={`trading-watchlist-priority ${item.priority}`}>{priorityLabels[item.priority]}</em></td>
              <td><em className={`trading-watchlist-alert ${item.alertLevel}`}>{alertLabels[item.alertLevel]}</em></td>
              <td><div className="trading-watchlist-tag-row">{item.tags.length ? item.tags.map((tag) => <span key={tag}>{tag}</span>) : <span>Untagged</span>}</div></td>
              <td title={item.thesis || undefined}>{item.thesis || 'No thesis note yet.'}</td>
              <td>
                <button type="button" onClick={() => onRemove?.(item._id)} disabled={!canMutate || item._id.startsWith('sample-') || removingId === item._id}>
                  {removingId === item._id ? '…' : 'Remove'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LiveWatchlistTable({ items }: { items: WatchlistItem[] }) {
  const removeItem = useMutation(watchlistApi.remove);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function remove(id: string) {
    if (id.startsWith('sample-')) return;
    setRemovingId(id);
    try {
      await removeItem({ id });
    } finally {
      setRemovingId(null);
    }
  }

  return <WatchlistTable items={items} canMutate onRemove={remove} removingId={removingId} />;
}

function WatchlistStats({ items, watchlists, live, isLoading }: { items: WatchlistItem[]; watchlists: WatchlistWithItems[]; live: boolean; isLoading?: boolean }) {
  const coreCount = items.filter((item) => item.priority === 'core').length;
  const urgentCount = items.filter((item) => item.alertLevel === 'urgent' || item.alertLevel === 'watch').length;
  const markets = new Set(items.map((item) => item.exchange || item.currency || 'Unknown'));
  const metricValue = (value: number) => (isLoading ? '—' : value);

  return (
    <div className="trading-watchlist-stat-grid">
      <article><span>Tracked names</span><strong>{metricValue(items.length)}</strong><p>{isLoading ? 'Loading Convex' : live ? 'Live Convex list' : 'Sample fallback'}</p></article>
      <article><span>Watchlists</span><strong>{metricValue(watchlists.length)}</strong><p>Multi-list schema ready</p></article>
      <article><span>Active alerts</span><strong>{metricValue(urgentCount)}</strong><p>Watch or urgent flags</p></article>
      <article><span>Markets</span><strong>{metricValue(markets.size)}</strong><p>{isLoading ? 'Awaiting live state' : `${coreCount} core candidate${coreCount === 1 ? '' : 's'}`}</p></article>
    </div>
  );
}

function WatchlistRail({
  watchlists,
  activeId,
  onSelect,
  children,
}: {
  watchlists: WatchlistWithItems[];
  activeId?: string;
  onSelect: (id: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <nav className="trading-watchlist-rail" aria-label="Watchlists">
      {watchlists.map((watchlist) => (
        <button key={watchlist._id} type="button" className={watchlist._id === activeId ? 'active' : ''} onClick={() => onSelect(watchlist._id)}>
          <span>{watchlist.name}</span>
          <em>{watchlist.items.length} names{watchlist.pinned ? ' · pinned' : ''}</em>
        </button>
      ))}
      {children}
    </nav>
  );
}

function WatchlistLoadingState() {
  return (
    <div className="trading-watchlist-loading-state" aria-live="polite">
      <div>
        <span>Loading live watchlists…</span>
        <p>Checking Convex before showing any rows.</p>
      </div>
      <div className="trading-watchlist-loading-lines" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

function StaticWatchlistManager() {
  return (
    <div className="trading-watchlist-manager" aria-label="Watchlist management unavailable">
      <input value="Main Watchlist" disabled aria-label="Watchlist name" />
      <button type="button" disabled>Rename</button>
      <button type="button" disabled>New list</button>
    </div>
  );
}

function LiveWatchlistManager({ activeWatchlist, canDelete, onCreated }: {
  activeWatchlist?: WatchlistWithItems;
  canDelete: boolean;
  onCreated: (id: string) => void;
}) {
  const createWatchlist = useMutation(watchlistApi.createWatchlist);
  const updateWatchlist = useMutation(watchlistApi.updateWatchlist);
  const deleteWatchlist = useMutation(watchlistApi.deleteWatchlist);
  const [name, setName] = useState(activeWatchlist?.name ?? '');
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(activeWatchlist?.name ?? '');
  }, [activeWatchlist?._id, activeWatchlist?.name]);

  async function renameActive() {
    if (!activeWatchlist) return;
    const nextName = name.trim();
    if (!nextName) {
      setStatus('Name the watchlist first.');
      return;
    }
    setIsSaving(true);
    setStatus(null);
    try {
      await updateWatchlist({ id: activeWatchlist._id, name: nextName });
      setStatus('Watchlist renamed.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not rename watchlist.');
    } finally {
      setIsSaving(false);
    }
  }

  async function createNew() {
    setIsSaving(true);
    setStatus(null);
    try {
      const id = await createWatchlist({ userKey: DEMO_USER_KEY, name: 'New Watchlist' });
      onCreated(id);
      setStatus('New watchlist created.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not create watchlist.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteActive() {
    if (!activeWatchlist || !canDelete) return;
    setIsSaving(true);
    setStatus(null);
    try {
      await deleteWatchlist({ id: activeWatchlist._id, userKey: DEMO_USER_KEY });
      setStatus('Watchlist deleted.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not delete watchlist.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="trading-watchlist-manager" aria-label="Manage watchlists">
      <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Watchlist name" disabled={isSaving || !activeWatchlist} />
      <button type="button" onClick={renameActive} disabled={isSaving || !activeWatchlist}>Rename</button>
      <button type="button" onClick={createNew} disabled={isSaving}>New list</button>
      <button type="button" onClick={deleteActive} disabled={isSaving || !canDelete || !activeWatchlist}>Delete</button>
      {status ? <p>{status}</p> : null}
    </div>
  );
}

function WatchlistLayout({ watchlists, isLive, isLoading }: { watchlists: WatchlistWithItems[]; isLive: boolean; isLoading?: boolean }) {
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | undefined>();
  const activeWatchlist = useMemo(() => {
    if (!watchlists.length) return undefined;
    return watchlists.find((watchlist) => watchlist._id === selectedWatchlistId) ?? watchlists[0];
  }, [selectedWatchlistId, watchlists]);
  const items = activeWatchlist?.items ?? (isLive ? [] : sampleWatchlistItems);

  return (
    <>
      <section className="trading-watchlist-surface-note">
        <div>
          <div className="trading-section-label">Planned surface</div>
          <h2>Static shell first</h2>
        </div>
        <p>
          Watchlists use the same market ribbon entry point as Overview and ticker pages. Convex owns the live lists; sample rows appear only when Convex is not configured.
        </p>
      </section>

      <WatchlistStats items={items} watchlists={watchlists} live={isLive} isLoading={isLoading} />

      <section className="trading-watchlist-grid">
        <article className="trading-watchlist-main-panel">
          <div className="trading-section-head">
            <div>
              <div className="trading-section-label">Tracked names</div>
              <h2>{isLoading ? 'Loading Convex…' : activeWatchlist?.name ?? (isLive ? 'No watchlist yet' : 'Local preview data')}</h2>
            </div>
            <span className={isLive ? 'trading-watchlist-live-badge live' : 'trading-watchlist-live-badge'}>{isLive ? 'Convex live' : 'Convex not connected'}</span>
          </div>
          {isLoading ? (
            <WatchlistLoadingState />
          ) : (
            <>
              <WatchlistRail watchlists={watchlists} activeId={activeWatchlist?._id} onSelect={setSelectedWatchlistId}>
                {isLive ? (
                  <LiveWatchlistManager activeWatchlist={activeWatchlist} canDelete={watchlists.length > 1} onCreated={setSelectedWatchlistId} />
                ) : (
                  <StaticWatchlistManager />
                )}
              </WatchlistRail>
              {items.length ? (
                isLive ? <LiveWatchlistTable items={items} /> : <WatchlistTable items={items} canMutate={false} />
              ) : (
                <div className="trading-watchlist-empty-state">
                  <span>No tracked names yet</span>
                  <p>Add a symbol from the side panel to start building this watchlist.</p>
                </div>
              )}
            </>
          )}
        </article>

        <aside className="trading-watchlist-side-panel">
          <div>
            <div className="trading-section-label">Add symbol</div>
            <h2>Capture the thesis first.</h2>
            <p>Writes target the selected watchlist, or create the first list automatically. Later, the ticker page can expose this same picker.</p>
          </div>
          <WatchlistAddForm enabled={isLive} watchlistId={isLive ? activeWatchlist?._id : undefined} />
          <div className="trading-watchlist-next-card">
            <span>Next layer</span>
            <strong>Portfolio can reuse the same user-owned symbol foundation.</strong>
            <p>The schema now supports multiple watchlists, while the first page stays focused enough to finish cleanly.</p>
          </div>
        </aside>
      </section>
    </>
  );
}

function LiveWatchlistContent() {
  const liveWatchlists = useQuery(watchlistApi.listWatchlists, { userKey: DEMO_USER_KEY });
  const isLoading = liveWatchlists === undefined;
  return <WatchlistLayout watchlists={isLoading ? [] : liveWatchlists} isLive isLoading={isLoading} />;
}

export function WatchlistClient({ convexEnabled }: { convexEnabled: boolean }) {
  if (!convexEnabled) return <WatchlistLayout watchlists={sampleWatchlists} isLive={false} />;
  return <LiveWatchlistContent />;
}
