import { mutationGeneric, queryGeneric } from 'convex/server';
import { v } from 'convex/values';

const DEMO_USER_KEY = 'lab-single-user';
const DEFAULT_WATCHLIST_NAME = 'Main Watchlist';

type WatchlistDocument = {
  _id: string;
  userKey: string;
  name: string;
  description?: string;
  pinned: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

type IndexBuilder = { eq(field: string, value: unknown): IndexBuilder };
type WatchlistQuery = {
  withIndex(name: string, range: (q: IndexBuilder) => IndexBuilder): WatchlistQuery;
  order(direction: 'asc' | 'desc'): WatchlistQuery;
  first(): Promise<WatchlistDocument | null>;
};
type WatchlistDb = {
  query(tableName: 'watchlists'): WatchlistQuery;
  insert(tableName: 'watchlists', value: Omit<WatchlistDocument, '_id'>): Promise<string>;
};
type WatchlistCtx = { db: WatchlistDb };

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase().replace(/\s+/g, '');
}

function displaySymbol(symbol: string) {
  return normalizeSymbol(symbol).replace(/\.US$/, '');
}

function cleanTags(tags: string[] = []) {
  return tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 8);
}

async function getDefaultWatchlist(ctx: WatchlistCtx, userKey: string): Promise<WatchlistDocument | null> {
  const pinned = await ctx.db
    .query('watchlists')
    .withIndex('by_user_pinned', (q) => q.eq('userKey', userKey).eq('pinned', true))
    .order('asc')
    .first();
  if (pinned) return pinned;
  return await ctx.db
    .query('watchlists')
    .withIndex('by_user_sort', (q) => q.eq('userKey', userKey))
    .order('asc')
    .first();
}

async function ensureDefaultWatchlist(ctx: WatchlistCtx, userKey: string) {
  const existing = await getDefaultWatchlist(ctx, userKey);
  if (existing) return existing._id;
  const now = Date.now();
  return await ctx.db.insert('watchlists', {
    userKey,
    name: DEFAULT_WATCHLIST_NAME,
    description: 'Default research list for BOILER ROOM ticker notes.',
    pinned: true,
    sortOrder: 1000,
    createdAt: now,
    updatedAt: now,
  });
}

export const listWatchlists = queryGeneric({
  args: { userKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userKey = args.userKey ?? DEMO_USER_KEY;
    const watchlists = await ctx.db
      .query('watchlists')
      .withIndex('by_user_sort', (q) => q.eq('userKey', userKey))
      .order('asc')
      .collect();

    return await Promise.all(watchlists.map(async (watchlist) => {
      const items = await ctx.db
        .query('watchlistItems')
        .withIndex('by_watchlist_sort', (q) => q.eq('watchlistId', watchlist._id))
        .order('asc')
        .collect();
      return { ...watchlist, items };
    }));
  },
});

export const list = queryGeneric({
  args: { userKey: v.optional(v.string()), watchlistId: v.optional(v.id('watchlists')) },
  handler: async (ctx, args) => {
    const userKey = args.userKey ?? DEMO_USER_KEY;
    const watchlistId = args.watchlistId ?? (await getDefaultWatchlist(ctx as unknown as WatchlistCtx, userKey))?._id;
    if (!watchlistId) return [];
    return await ctx.db
      .query('watchlistItems')
      .withIndex('by_watchlist_sort', (q) => q.eq('watchlistId', watchlistId))
      .order('asc')
      .collect();
  },
});

export const createWatchlist = mutationGeneric({
  args: {
    userKey: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userKey = args.userKey ?? DEMO_USER_KEY;
    const now = Date.now();
    const latest = await ctx.db
      .query('watchlists')
      .withIndex('by_user_sort', (q) => q.eq('userKey', userKey))
      .order('desc')
      .first();
    return await ctx.db.insert('watchlists', {
      userKey,
      name: args.name.trim() || DEFAULT_WATCHLIST_NAME,
      description: args.description?.trim() || undefined,
      pinned: args.pinned ?? false,
      sortOrder: latest ? latest.sortOrder + 1000 : 1000,
      createdAt: now,
      updatedAt: now,
    });
  },
});


export const updateWatchlist = mutationGeneric({
  args: {
    id: v.id('watchlists'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const patch: { name?: string; description?: string; pinned?: boolean; updatedAt: number } = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error('Watchlist name is required');
      patch.name = name;
    }
    if (args.description !== undefined) patch.description = args.description.trim() || undefined;
    if (args.pinned !== undefined) patch.pinned = args.pinned;
    await ctx.db.patch(args.id, patch);
  },
});

export const deleteWatchlist = mutationGeneric({
  args: { id: v.id('watchlists'), userKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userKey = args.userKey ?? DEMO_USER_KEY;
    const watchlist = await ctx.db.get(args.id);
    if (!watchlist || watchlist.userKey !== userKey) throw new Error('Watchlist not found');

    const watchlists = await ctx.db
      .query('watchlists')
      .withIndex('by_user_sort', (q) => q.eq('userKey', userKey))
      .collect();
    if (watchlists.length <= 1) throw new Error('Keep at least one watchlist. Rename this one instead.');

    const items = await ctx.db
      .query('watchlistItems')
      .withIndex('by_watchlist_sort', (q) => q.eq('watchlistId', args.id))
      .collect();
    for (const item of items) await ctx.db.delete(item._id);
    await ctx.db.delete(args.id);
  },
});

export const add = mutationGeneric({
  args: {
    userKey: v.optional(v.string()),
    watchlistId: v.optional(v.id('watchlists')),
    symbol: v.string(),
    name: v.optional(v.string()),
    exchange: v.optional(v.string()),
    currency: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    thesis: v.optional(v.string()),
    priority: v.optional(v.union(v.literal('core'), v.literal('radar'), v.literal('speculative'))),
    alertLevel: v.optional(v.union(v.literal('none'), v.literal('watch'), v.literal('urgent'))),
  },
  handler: async (ctx, args) => {
    const userKey = args.userKey ?? DEMO_USER_KEY;
    const watchlistId = String(args.watchlistId ?? (await ensureDefaultWatchlist(ctx as unknown as WatchlistCtx, userKey)));
    const symbol = normalizeSymbol(args.symbol);
    if (!symbol) throw new Error('Symbol is required');

    const existing = (await ctx.db
      .query('watchlistItems')
      .withIndex('by_watchlist_sort', (q) => q.eq('watchlistId', watchlistId))
      .collect())
      .find((item) => item.symbol === symbol);

    const now = Date.now();
    const tags = cleanTags(args.tags);

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name?.trim() || existing.name,
        exchange: args.exchange?.trim() || existing.exchange,
        currency: args.currency?.trim() || existing.currency,
        tags: tags.length ? tags : existing.tags,
        thesis: args.thesis?.trim() || existing.thesis,
        priority: args.priority ?? existing.priority,
        alertLevel: args.alertLevel ?? existing.alertLevel,
        updatedAt: now,
      });
      return existing._id;
    }

    const latest = await ctx.db
      .query('watchlistItems')
      .withIndex('by_watchlist_sort', (q) => q.eq('watchlistId', watchlistId))
      .order('desc')
      .first();

    return await ctx.db.insert('watchlistItems', {
      userKey,
      watchlistId,
      symbol,
      displaySymbol: displaySymbol(symbol),
      name: args.name?.trim() || undefined,
      exchange: args.exchange?.trim() || undefined,
      currency: args.currency?.trim() || undefined,
      tags,
      thesis: args.thesis?.trim() || undefined,
      priority: args.priority ?? 'radar',
      alertLevel: args.alertLevel ?? 'none',
      sortOrder: latest ? latest.sortOrder + 1000 : 1000,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutationGeneric({
  args: {
    id: v.id('watchlistItems'),
    name: v.optional(v.string()),
    exchange: v.optional(v.string()),
    currency: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    thesis: v.optional(v.string()),
    priority: v.optional(v.union(v.literal('core'), v.literal('radar'), v.literal('speculative'))),
    alertLevel: v.optional(v.union(v.literal('none'), v.literal('watch'), v.literal('urgent'))),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const patch: {
      name?: string;
      exchange?: string;
      currency?: string;
      tags?: string[];
      thesis?: string;
      priority?: 'core' | 'radar' | 'speculative';
      alertLevel?: 'none' | 'watch' | 'urgent';
      sortOrder?: number;
      updatedAt: number;
    } = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim() || undefined;
    if (args.exchange !== undefined) patch.exchange = args.exchange.trim() || undefined;
    if (args.currency !== undefined) patch.currency = args.currency.trim() || undefined;
    if (args.tags !== undefined) patch.tags = cleanTags(args.tags);
    if (args.thesis !== undefined) patch.thesis = args.thesis.trim() || undefined;
    if (args.priority !== undefined) patch.priority = args.priority;
    if (args.alertLevel !== undefined) patch.alertLevel = args.alertLevel;
    if (args.sortOrder !== undefined) patch.sortOrder = args.sortOrder;
    await ctx.db.patch(args.id, patch);
  },
});

export const remove = mutationGeneric({
  args: { id: v.id('watchlistItems') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
