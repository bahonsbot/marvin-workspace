import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  watchlists: defineTable({
    userKey: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    pinned: v.boolean(),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_sort', ['userKey', 'sortOrder'])
    .index('by_user_pinned', ['userKey', 'pinned', 'sortOrder']),

  watchlistItems: defineTable({
    userKey: v.string(),
    watchlistId: v.id('watchlists'),
    symbol: v.string(),
    displaySymbol: v.string(),
    name: v.optional(v.string()),
    exchange: v.optional(v.string()),
    currency: v.optional(v.string()),
    tags: v.array(v.string()),
    thesis: v.optional(v.string()),
    priority: v.union(v.literal('core'), v.literal('radar'), v.literal('speculative')),
    alertLevel: v.union(v.literal('none'), v.literal('watch'), v.literal('urgent')),
    alertEnabled: v.optional(v.boolean()),
    alertMinPrice: v.optional(v.number()),
    alertMaxPrice: v.optional(v.number()),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_watchlist_sort', ['watchlistId', 'sortOrder'])
    .index('by_watchlist_symbol', ['watchlistId', 'symbol'])
    .index('by_user_symbol', ['userKey', 'symbol']),

  portfolioHoldings: defineTable({
    userKey: v.string(),
    symbol: v.string(),
    displaySymbol: v.string(),
    name: v.optional(v.string()),
    assetType: v.union(v.literal('stock'), v.literal('etf'), v.literal('cash'), v.literal('other')),
    strategy: v.optional(v.string()),
    sector: v.optional(v.string()),
    industry: v.optional(v.string()),
    country: v.optional(v.string()),
    currency: v.string(),
    broker: v.optional(v.string()),
    quantity: v.number(),
    averageCost: v.number(),
    costBasis: v.number(),
    alertEnabled: v.optional(v.boolean()),
    alertMinPrice: v.optional(v.number()),
    alertMaxPrice: v.optional(v.number()),
    notes: v.optional(v.string()),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_sort', ['userKey', 'sortOrder'])
    .index('by_user_symbol', ['userKey', 'symbol']),
});
