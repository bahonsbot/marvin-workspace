import { makeFunctionReference } from 'convex/server';

export type WatchlistPriority = 'core' | 'radar' | 'speculative';
export type WatchlistAlertLevel = 'none' | 'watch' | 'urgent';

export type WatchlistItem = {
  _id: string;
  _creationTime?: number;
  userKey: string;
  watchlistId: string;
  symbol: string;
  displaySymbol: string;
  name?: string;
  exchange?: string;
  currency?: string;
  tags: string[];
  thesis?: string;
  priority: WatchlistPriority;
  alertLevel: WatchlistAlertLevel;
  alertEnabled?: boolean;
  alertMinPrice?: number;
  alertMaxPrice?: number;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export type Watchlist = {
  _id: string;
  _creationTime?: number;
  userKey: string;
  name: string;
  description?: string;
  pinned: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export type WatchlistWithItems = Watchlist & { items: WatchlistItem[] };

export const watchlistApi = {
  listWatchlists: makeFunctionReference<'query', { userKey?: string }, WatchlistWithItems[]>('watchlist:listWatchlists'),
  list: makeFunctionReference<'query', { userKey?: string; watchlistId?: string }, WatchlistItem[]>('watchlist:list'),
  createWatchlist: makeFunctionReference<
    'mutation',
    { userKey?: string; name: string; description?: string; pinned?: boolean },
    string
  >('watchlist:createWatchlist'),
  updateWatchlist: makeFunctionReference<
    'mutation',
    { id: string; name?: string; description?: string; pinned?: boolean },
    void
  >('watchlist:updateWatchlist'),
  deleteWatchlist: makeFunctionReference<'mutation', { id: string; userKey?: string }, void>('watchlist:deleteWatchlist'),
  add: makeFunctionReference<
    'mutation',
    {
      userKey?: string;
      watchlistId?: string;
      symbol: string;
      name?: string;
      exchange?: string;
      currency?: string;
      tags?: string[];
      thesis?: string;
      priority?: WatchlistPriority;
      alertLevel?: WatchlistAlertLevel;
      alertEnabled?: boolean;
      alertMinPrice?: number;
      alertMaxPrice?: number;
    },
    string
  >('watchlist:add'),
  move: makeFunctionReference<'mutation', { id: string; targetWatchlistId: string; userKey?: string }, string>('watchlist:move'),
  update: makeFunctionReference<
    'mutation',
    {
      id: string;
      name?: string;
      exchange?: string;
      currency?: string;
      tags?: string[];
      thesis?: string;
      priority?: WatchlistPriority;
      alertLevel?: WatchlistAlertLevel;
      alertEnabled?: boolean;
      alertMinPrice?: number | null;
      alertMaxPrice?: number | null;
      sortOrder?: number;
    },
    void
  >('watchlist:update'),
  remove: makeFunctionReference<'mutation', { id: string }, void>('watchlist:remove'),
} as const;
