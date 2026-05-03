'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import {
  watchlistApi,
  type WatchlistAlertLevel,
  type WatchlistItem,
  type WatchlistPriority,
  type WatchlistWithItems,
} from '@/lib/convex/watchlist-api';
import { sampleWatchlists } from './sample-watchlist';

interface TickerSearchResult {
  symbol: string;
  code: string;
  exchange: string;
  name: string;
  type: string;
  country: string;
  currency: string;
  previousClose: number | null;
  previousCloseDate: string | null;
  isPrimary: boolean;
}

interface TickerSearchResponse {
  query: string;
  results: TickerSearchResult[];
}

function tickerResultMeta(result: TickerSearchResult) {
  return [result.country, result.currency, result.type].filter(Boolean).join(' · ');
}

const DEMO_USER_KEY = 'lab-single-user';
const priorityLabels: Record<WatchlistPriority, string> = {
  core: 'High',
  radar: 'Medium',
  speculative: 'Low',
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

function displayMarket(item: WatchlistItem) {
  return [item.exchange, item.currency].filter(Boolean).join(' · ') || 'Market pending';
}

function quoteSeed(symbol: string) {
  return symbol.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function estimateQuote(item: WatchlistItem) {
  const seed = quoteSeed(item.symbol);
  const price = 18 + (seed % 420) + ((seed % 91) / 100);
  const change = ((seed % 900) - 420) / 100;
  return { price, change };
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function WatchlistAddForm({ enabled, watchlistId, onSaved }: { enabled: boolean; watchlistId?: string; onSaved?: () => void }) {
  if (!enabled) return <DisabledWatchlistAddForm />;
  return <LiveWatchlistAddForm watchlistId={watchlistId} onSaved={onSaved} />;
}

function DisabledWatchlistAddForm() {
  return (
    <form className="trading-watchlist-add-form">
      <label className="trading-watchlist-symbol-field">
        <span>Symbol</span>
        <input placeholder="Search ticker or company" disabled />
      </label>
      <label>
        <span>Priority</span>
        <select disabled defaultValue="radar">
          <option value="core">High</option>
          <option value="radar">Medium</option>
          <option value="speculative">Low</option>
        </select>
      </label>
      <label>
        <span>Alert</span>
        <select disabled defaultValue="watch">
          <option value="none">No alert</option>
          <option value="watch">Watch</option>
          <option value="urgent">Urgent</option>
        </select>
      </label>
      <label className="wide">
        <span>Watch note</span>
        <input placeholder="Why is this worth watching?" disabled />
      </label>
      <button type="button" disabled>Add symbol</button>
      <p>Connect Convex to save watchlists.</p>
    </form>
  );
}

function LiveWatchlistAddForm({ watchlistId, onSaved }: { watchlistId?: string; onSaved?: () => void }) {
  const addItem = useMutation(watchlistApi.add);
  const [symbol, setSymbol] = useState('');
  const [selectedTicker, setSelectedTicker] = useState<TickerSearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<TickerSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [thesis, setThesis] = useState('');
  const [priority, setPriority] = useState<WatchlistPriority>('radar');
  const [alertLevel, setAlertLevel] = useState<WatchlistAlertLevel>('watch');
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const trimmedSymbol = symbol.trim();
  const searchResultsId = useId();
  const selectedResult = searchResults[Math.min(activeResultIndex, Math.max(searchResults.length - 1, 0))];
  const showSearchPanel = searchOpen && Boolean(trimmedSymbol) && (searchLoading || searchError || searchResults.length > 0);

  useEffect(() => {
    if (!trimmedSymbol || selectedTicker?.symbol === normalizeSymbol(trimmedSymbol)) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const response = await fetch(`/api/trading/search?q=${encodeURIComponent(trimmedSymbol)}`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const data = (await response.json()) as TickerSearchResponse;
        setSearchResults(data.results ?? []);
        setActiveResultIndex(0);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearchResults([]);
        setSearchError(error instanceof Error ? error.message : 'Search failed');
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [selectedTicker?.symbol, trimmedSymbol]);

  function selectTicker(result: TickerSearchResult) {
    setSymbol(result.symbol);
    setSelectedTicker(result);
    setSearchOpen(false);
    setSearchResults([]);
    setSearchError(null);
    setStatus(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSymbol = normalizeSymbol(symbol);
    if (!nextSymbol) {
      setStatus('Add a symbol first.');
      return;
    }
    const lockedTicker = selectedTicker?.symbol === nextSymbol ? selectedTicker : null;
    setIsSaving(true);
    setStatus(null);
    try {
      await addItem({
        userKey: DEMO_USER_KEY,
        watchlistId,
        symbol: nextSymbol,
        name: lockedTicker?.name,
        exchange: lockedTicker?.exchange,
        currency: lockedTicker?.currency,
        thesis: thesis.trim() || undefined,
        priority,
        alertLevel,
        tags: [],
      });
      setSymbol('');
      setSelectedTicker(null);
      setSearchResults([]);
      setThesis('');
      setPriority('radar');
      setAlertLevel('watch');
      setStatus(`${nextSymbol} added to watchlist.`);
      onSaved?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save watchlist item.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="trading-watchlist-add-form" onSubmit={handleSubmit}>
      <label className="trading-watchlist-symbol-field">
        <span>Symbol</span>
        <div className="trading-watchlist-symbol-search">
          <input
            value={symbol}
            onChange={(event) => {
              setSymbol(event.target.value);
              setSelectedTicker(null);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setSearchOpen(false);
                return;
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveResultIndex((index) => Math.min(index + 1, Math.max(searchResults.length - 1, 0)));
                return;
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveResultIndex((index) => Math.max(index - 1, 0));
                return;
              }
              if (event.key === 'Enter' && searchOpen && selectedResult) {
                event.preventDefault();
                selectTicker(selectedResult);
              }
            }}
            placeholder="Search ticker or company"
            aria-label="Search ticker or company"
            aria-autocomplete="list"
            aria-controls={showSearchPanel ? searchResultsId : undefined}
            disabled={isSaving}
          />
          {showSearchPanel ? (
            <div id={searchResultsId} className="trading-watchlist-symbol-results" role="listbox" aria-label="Symbol search results">
              {searchLoading ? <div className="trading-watchlist-symbol-state">Searching symbols…</div> : null}
              {!searchLoading && searchError ? <div className="trading-watchlist-symbol-state">{searchError}</div> : null}
              {!searchLoading && !searchError && searchResults.map((result, index) => (
                <button
                  key={result.symbol}
                  type="button"
                  role="option"
                  aria-selected={index === activeResultIndex}
                  data-active={index === activeResultIndex ? 'true' : undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveResultIndex(index)}
                  onClick={() => selectTicker(result)}
                >
                  <strong>{result.symbol}</strong>
                  <span>{result.name}</span>
                  <small>{tickerResultMeta(result)}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {selectedTicker ? <em className="trading-watchlist-symbol-selected">Selected {selectedTicker.symbol} · {selectedTicker.name}</em> : null}
      </label>
      <label>
        <span>Priority</span>
        <select value={priority} onChange={(event) => setPriority(event.target.value as WatchlistPriority)} disabled={isSaving}>
          <option value="core">High</option>
          <option value="radar">Medium</option>
          <option value="speculative">Low</option>
        </select>
      </label>
      <label>
        <span>Alert</span>
        <select value={alertLevel} onChange={(event) => setAlertLevel(event.target.value as WatchlistAlertLevel)} disabled={isSaving}>
          <option value="none">No alert</option>
          <option value="watch">Watch</option>
          <option value="urgent">Urgent</option>
        </select>
      </label>
      <label className="wide">
        <span>Watch note</span>
        <input value={thesis} onChange={(event) => setThesis(event.target.value)} placeholder="Why is this worth watching?" disabled={isSaving} />
      </label>
      <button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Add symbol'}</button>
      <p>{status ?? 'Search by ticker or company, then choose a result to lock in the listing.'}</p>
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
            <th>Company</th>
            <th>Price</th>
            <th>1D</th>
            <th>Priority</th>
            <th>Alert</th>
            <th>Watch note</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const quote = estimateQuote(item);
            const isPositive = quote.change >= 0;
            return (
              <tr key={item._id}>
                <td>
                  <Link href={symbolHref(item.symbol)}>{item.displaySymbol || item.symbol}</Link>
                  <span>{item.symbol}</span>
                </td>
                <td>
                  {item.name || 'Provider pending'}
                  <span>{displayMarket(item)} · updated {formatUpdatedAt(item.updatedAt)}</span>
                </td>
                <td>
                  ${formatPrice(quote.price)}
                  <span className={isPositive ? 'trading-watchlist-change positive' : 'trading-watchlist-change negative'}>
                    {isPositive ? '+' : ''}{quote.change.toFixed(2)}%
                  </span>
                </td>
                <td>
                  <span className={isPositive ? 'trading-watchlist-spark positive' : 'trading-watchlist-spark negative'} aria-label="Indicative intraday movement" />
                </td>
                <td><em className={`trading-watchlist-priority ${item.priority}`}>{priorityLabels[item.priority]}</em></td>
                <td><em className={`trading-watchlist-alert ${item.alertLevel}`}>{alertLabels[item.alertLevel]}</em></td>
                <td title={item.thesis || undefined}>{item.thesis || 'No watch note yet.'}</td>
                <td>
                  <button type="button" onClick={() => onRemove?.(item._id)} disabled={!canMutate || item._id.startsWith('sample-') || removingId === item._id}>
                    {removingId === item._id ? '…' : 'Remove'}
                  </button>
                </td>
              </tr>
            );
          })}
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

function WatchlistTabs({
  watchlists,
  activeId,
  onSelect,
}: {
  watchlists: WatchlistWithItems[];
  activeId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="trading-watchlist-tabs" aria-label="Watchlists">
      {watchlists.map((watchlist) => (
        <button key={watchlist._id} type="button" className={watchlist._id === activeId ? 'active' : ''} onClick={() => onSelect(watchlist._id)}>
          <strong>{watchlist.name}</strong>
          <span>{watchlist.items.length} symbols{watchlist.pinned ? ' · pinned' : ''}</span>
        </button>
      ))}
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
    <div className="trading-watchlist-menu-panel" aria-label="Watchlist management unavailable">
      <div>
        <h3>Manage watchlist</h3>
        <p>Connect Convex to create lists, add symbols, and pin watchlists to Overview.</p>
      </div>
      <DisabledWatchlistAddForm />
      <button type="button" disabled>Pin to Overview</button>
      <button type="button" disabled>Rename watchlist</button>
      <button type="button" disabled>New list</button>
    </div>
  );
}

function LiveWatchlistManager({ activeWatchlist, canDelete, onCreated, onClose }: {
  activeWatchlist?: WatchlistWithItems;
  canDelete: boolean;
  onCreated: (id: string) => void;
  onClose: () => void;
}) {
  const createWatchlist = useMutation(watchlistApi.createWatchlist);
  const updateWatchlist = useMutation(watchlistApi.updateWatchlist);
  const deleteWatchlist = useMutation(watchlistApi.deleteWatchlist);
  const [name, setName] = useState(activeWatchlist?.name ?? '');
  const [description, setDescription] = useState(activeWatchlist?.description ?? '');
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(activeWatchlist?.name ?? '');
    setDescription(activeWatchlist?.description ?? '');
    setStatus(null);
  }, [activeWatchlist?._id, activeWatchlist?.name, activeWatchlist?.description]);

  async function updateActive(patch: { name?: string; description?: string; pinned?: boolean }, success: string) {
    if (!activeWatchlist) return;
    setIsSaving(true);
    setStatus(null);
    try {
      await updateWatchlist({ id: activeWatchlist._id, ...patch });
      setStatus(success);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not update watchlist.');
    } finally {
      setIsSaving(false);
    }
  }

  async function renameActive() {
    const nextName = name.trim();
    if (!nextName) {
      setStatus('Name the watchlist first.');
      return;
    }
    await updateActive({ name: nextName, description: description.trim() || undefined }, 'Watchlist details saved.');
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
      onClose();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not delete watchlist.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="trading-watchlist-menu-panel" aria-label="Manage watchlist">
      <div>
        <h3>Manage watchlist</h3>
        <p>Add symbols, save list details, and choose whether this list appears on Overview later.</p>
      </div>
      <WatchlistAddForm enabled watchlistId={activeWatchlist?._id} onSaved={onClose} />
      <div className="trading-watchlist-menu-fields">
        <label>
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} disabled={isSaving || !activeWatchlist} />
        </label>
        <label>
          <span>Description</span>
          <input value={description} onChange={(event) => setDescription(event.target.value)} disabled={isSaving || !activeWatchlist} placeholder="Optional list context" />
        </label>
      </div>
      <div className="trading-watchlist-menu-actions">
        <button type="button" onClick={() => updateActive({ pinned: !activeWatchlist?.pinned }, activeWatchlist?.pinned ? 'Removed from Overview.' : 'Pinned to Overview.')} disabled={isSaving || !activeWatchlist}>
          {activeWatchlist?.pinned ? 'Unpin from Overview' : 'Pin to Overview'}
        </button>
        <button type="button" onClick={renameActive} disabled={isSaving || !activeWatchlist}>Save details</button>
        <button type="button" onClick={createNew} disabled={isSaving}>New list</button>
        <button type="button" onClick={deleteActive} disabled={isSaving || !canDelete || !activeWatchlist}>Delete list</button>
      </div>
      {status ? <p className="trading-watchlist-menu-status">{status}</p> : null}
    </div>
  );
}

function WatchlistNews({ items, isLoading }: { items: WatchlistItem[]; isLoading?: boolean }) {
  const symbols = items.slice(0, 6).map((item) => item.displaySymbol || item.symbol);

  return (
    <section className="trading-watchlist-news-panel">
      <div className="trading-section-head">
        <div>
          <div className="trading-section-label">Watchlist news</div>
          <h2>Headlines for this list</h2>
        </div>
        <span>{items.length} symbols</span>
      </div>
      {isLoading ? (
        <p>Loading watchlist headlines…</p>
      ) : items.length ? (
        <div className="trading-watchlist-news-placeholder">
          <span>{symbols.join(' · ')}</span>
          <p>News will scope to the active watchlist here. The current slice reserves the section without showing fabricated headlines.</p>
        </div>
      ) : (
        <p>Add symbols to see related headlines for the selected watchlist.</p>
      )}
    </section>
  );
}

function WatchlistLayout({ watchlists, isLive, isLoading }: { watchlists: WatchlistWithItems[]; isLive: boolean; isLoading?: boolean }) {
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | undefined>();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const activeWatchlist = useMemo(() => {
    if (!watchlists.length) return undefined;
    return watchlists.find((watchlist) => watchlist._id === selectedWatchlistId) ?? watchlists[0];
  }, [selectedWatchlistId, watchlists]);
  const items = activeWatchlist?.items ?? [];

  useEffect(() => {
    setMenuOpen(false);
  }, [activeWatchlist?._id]);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  return (
    <>
      <section className="trading-watchlist-command-bar">
        <div>
          <div className="trading-section-label">Watchlist</div>
          <h1>{activeWatchlist?.name ?? (isLive ? 'No watchlist yet' : 'Local preview data')}</h1>
          <p>{activeWatchlist?.description || 'Track ideas before they become positions.'}</p>
        </div>
        <div className="trading-watchlist-command-actions" ref={menuRef}>
          <span className={isLive ? 'trading-watchlist-live-badge live' : 'trading-watchlist-live-badge'}>{isLive ? 'Convex live' : 'Convex not connected'}</span>
          <button type="button" className="trading-watchlist-manage-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
            Manage watchlist
          </button>
          {menuOpen ? (
            isLive ? (
              <LiveWatchlistManager activeWatchlist={activeWatchlist} canDelete={watchlists.length > 1} onCreated={setSelectedWatchlistId} onClose={() => setMenuOpen(false)} />
            ) : (
              <StaticWatchlistManager />
            )
          ) : null}
        </div>
      </section>

      <section className="trading-watchlist-workspace">
        <WatchlistTabs watchlists={watchlists} activeId={activeWatchlist?._id} onSelect={setSelectedWatchlistId} />
        <article className="trading-watchlist-main-panel">
          <div className="trading-section-head">
            <div>
              <div className="trading-section-label">Tracked names</div>
              <h2>{isLoading ? 'Loading Convex…' : activeWatchlist?.name ?? (isLive ? 'No watchlist yet' : 'Local preview data')}</h2>
            </div>
            <span>{activeWatchlist?.pinned ? 'Pinned to Overview' : 'Not pinned'}</span>
          </div>
          {isLoading ? (
            <WatchlistLoadingState />
          ) : items.length ? (
            isLive ? <LiveWatchlistTable items={items} /> : <WatchlistTable items={items} canMutate={false} />
          ) : (
            <div className="trading-watchlist-empty-state">
              <span>No tracked names yet</span>
              <p>Open Manage watchlist to add symbols to this list.</p>
            </div>
          )}
        </article>
      </section>

      <WatchlistNews items={items} isLoading={isLoading} />
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
