import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const DEMO_USER_KEY = "lab-single-user";

type PortfolioHoldingDocument = {
  _id: string;
  userKey: string;
  symbol: string;
  displaySymbol: string;
  name?: string;
  assetType: "stock" | "etf" | "cash" | "other";
  strategy?: string;
  sector?: string;
  industry?: string;
  country?: string;
  currency: string;
  broker?: string;
  quantity: number;
  averageCost: number;
  costBasis: number;
  transactionFee?: number;
  alertEnabled?: boolean;
  alertMinPrice?: number;
  alertMaxPrice?: number;
  notes?: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

type IndexBuilder = { eq(field: string, value: unknown): IndexBuilder };
type PortfolioHoldingQuery = {
  withIndex(
    name: string,
    range: (q: IndexBuilder) => IndexBuilder,
  ): PortfolioHoldingQuery;
  order(direction: "asc" | "desc"): PortfolioHoldingQuery;
  first(): Promise<PortfolioHoldingDocument | null>;
  collect(): Promise<PortfolioHoldingDocument[]>;
};
type PortfolioDb = {
  query(tableName: "portfolioHoldings"): PortfolioHoldingQuery;
};
type PortfolioCtx = { db: PortfolioDb };

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase().replace(/\s+/g, "");
}

function displaySymbol(symbol: string) {
  return normalizeSymbol(symbol).replace(/\.US$/, "");
}

function cleanPositiveNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    return undefined;
  return Math.round(value * 10000) / 10000;
}

function cleanOptionalText(value: string | undefined) {
  return value?.trim() || undefined;
}

function cleanAssetType(
  value: string | undefined,
): PortfolioHoldingDocument["assetType"] {
  if (
    value === "stock" ||
    value === "etf" ||
    value === "cash" ||
    value === "other"
  )
    return value;
  return "stock";
}

async function latestSortOrder(ctx: PortfolioCtx, userKey: string) {
  const latest = await ctx.db
    .query("portfolioHoldings")
    .withIndex("by_user_sort", (q) => q.eq("userKey", userKey))
    .order("desc")
    .first();
  return latest ? latest.sortOrder + 1000 : 1000;
}

export const list = queryGeneric({
  args: { userKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userKey = args.userKey ?? DEMO_USER_KEY;
    return await ctx.db
      .query("portfolioHoldings")
      .withIndex("by_user_sort", (q) => q.eq("userKey", userKey))
      .order("asc")
      .collect();
  },
});

export const add = mutationGeneric({
  args: {
    userKey: v.optional(v.string()),
    symbol: v.string(),
    name: v.optional(v.string()),
    assetType: v.optional(
      v.union(
        v.literal("stock"),
        v.literal("etf"),
        v.literal("cash"),
        v.literal("other"),
      ),
    ),
    strategy: v.optional(v.string()),
    sector: v.optional(v.string()),
    industry: v.optional(v.string()),
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    broker: v.optional(v.string()),
    quantity: v.number(),
    averageCost: v.number(),
    transactionFee: v.optional(v.number()),
    alertEnabled: v.optional(v.boolean()),
    alertMinPrice: v.optional(v.number()),
    alertMaxPrice: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userKey = args.userKey ?? DEMO_USER_KEY;
    const symbol = normalizeSymbol(args.symbol);
    if (!symbol) throw new Error("Symbol is required");
    const quantity = cleanPositiveNumber(args.quantity);
    const averageCost = cleanPositiveNumber(args.averageCost);
    if (quantity === undefined)
      throw new Error("Quantity must be greater than zero");
    if (averageCost === undefined)
      throw new Error("Average cost must be greater than zero");

    const existing = (
      await ctx.db
        .query("portfolioHoldings")
        .withIndex("by_user_sort", (q) => q.eq("userKey", userKey))
        .collect()
    ).find((holding) => holding.symbol === symbol);
    if (existing)
      throw new Error(
        `${displaySymbol(symbol)} is already in the portfolio. Edit the existing row instead.`,
      );

    const now = Date.now();
    const transactionFee =
      args.transactionFee != null &&
      Number.isFinite(args.transactionFee) &&
      args.transactionFee > 0
        ? Math.round(args.transactionFee * 100) / 100
        : undefined;
    const alertMinPrice = cleanPositiveNumber(args.alertMinPrice);
    const alertMaxPrice = cleanPositiveNumber(args.alertMaxPrice);
    const hasAlertRule =
      alertMinPrice !== undefined || alertMaxPrice !== undefined;

    return await ctx.db.insert("portfolioHoldings", {
      userKey,
      symbol,
      displaySymbol: displaySymbol(symbol),
      name: cleanOptionalText(args.name),
      assetType: cleanAssetType(args.assetType),
      strategy: cleanOptionalText(args.strategy),
      sector: cleanOptionalText(args.sector),
      industry: cleanOptionalText(args.industry),
      country: cleanOptionalText(args.country),
      currency: cleanOptionalText(args.currency)?.toUpperCase() ?? "USD",
      broker: cleanOptionalText(args.broker),
      quantity,
      averageCost,
      costBasis:
        Math.round((quantity * averageCost + (transactionFee ?? 0)) * 100) /
        100,
      transactionFee,
      alertEnabled: args.alertEnabled ?? (hasAlertRule || undefined),
      alertMinPrice,
      alertMaxPrice,
      notes: cleanOptionalText(args.notes),
      sortOrder: await latestSortOrder(ctx as unknown as PortfolioCtx, userKey),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutationGeneric({
  args: {
    id: v.id("portfolioHoldings"),
    name: v.optional(v.string()),
    assetType: v.optional(
      v.union(
        v.literal("stock"),
        v.literal("etf"),
        v.literal("cash"),
        v.literal("other"),
      ),
    ),
    strategy: v.optional(v.string()),
    sector: v.optional(v.string()),
    industry: v.optional(v.string()),
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    broker: v.optional(v.string()),
    quantity: v.optional(v.number()),
    averageCost: v.optional(v.number()),
    transactionFee: v.optional(v.number()),
    alertEnabled: v.optional(v.boolean()),
    alertMinPrice: v.optional(v.union(v.number(), v.null())),
    alertMaxPrice: v.optional(v.union(v.number(), v.null())),
    notes: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = (await ctx.db.get(
      args.id,
    )) as PortfolioHoldingDocument | null;
    if (!existing) throw new Error("Portfolio holding not found");
    const quantity =
      args.quantity !== undefined
        ? cleanPositiveNumber(args.quantity)
        : existing.quantity;
    const averageCost =
      args.averageCost !== undefined
        ? cleanPositiveNumber(args.averageCost)
        : existing.averageCost;
    if (quantity === undefined)
      throw new Error("Quantity must be greater than zero");
    if (averageCost === undefined)
      throw new Error("Average cost must be greater than zero");

    const patch: {
      name?: string;
      assetType?: PortfolioHoldingDocument["assetType"];
      strategy?: string;
      sector?: string;
      industry?: string;
      country?: string;
      currency?: string;
      broker?: string;
      quantity?: number;
      averageCost?: number;
      costBasis?: number;
      transactionFee?: number;
      alertEnabled?: boolean;
      alertMinPrice?: number;
      alertMaxPrice?: number;
      notes?: string;
      sortOrder?: number;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.name !== undefined) patch.name = cleanOptionalText(args.name);
    if (args.assetType !== undefined)
      patch.assetType = cleanAssetType(args.assetType);
    if (args.strategy !== undefined)
      patch.strategy = cleanOptionalText(args.strategy);
    if (args.sector !== undefined)
      patch.sector = cleanOptionalText(args.sector);
    if (args.industry !== undefined)
      patch.industry = cleanOptionalText(args.industry);
    if (args.country !== undefined)
      patch.country = cleanOptionalText(args.country);
    if (args.currency !== undefined)
      patch.currency =
        cleanOptionalText(args.currency)?.toUpperCase() ?? existing.currency;
    if (args.broker !== undefined)
      patch.broker = cleanOptionalText(args.broker);
    if (args.quantity !== undefined) patch.quantity = quantity;
    if (args.averageCost !== undefined) patch.averageCost = averageCost;
    if (args.transactionFee !== undefined) {
      patch.transactionFee =
        args.transactionFee != null &&
        Number.isFinite(args.transactionFee) &&
        args.transactionFee > 0
          ? Math.round(args.transactionFee * 100) / 100
          : undefined;
    }
    if (
      args.quantity !== undefined ||
      args.averageCost !== undefined ||
      args.transactionFee !== undefined
    ) {
      const fee =
        args.transactionFee !== undefined
          ? (patch.transactionFee ?? 0)
          : (existing.transactionFee ?? 0);
      patch.costBasis = Math.round((quantity * averageCost + fee) * 100) / 100;
    }
    if (args.alertEnabled !== undefined) patch.alertEnabled = args.alertEnabled;
    if (args.alertMinPrice !== undefined) {
      const alertMinPrice = cleanPositiveNumber(args.alertMinPrice);
      if (alertMinPrice === undefined) patch.alertMinPrice = undefined;
      else patch.alertMinPrice = alertMinPrice;
    }
    if (args.alertMaxPrice !== undefined) {
      const alertMaxPrice = cleanPositiveNumber(args.alertMaxPrice);
      if (alertMaxPrice === undefined) patch.alertMaxPrice = undefined;
      else patch.alertMaxPrice = alertMaxPrice;
    }
    if (args.notes !== undefined) patch.notes = cleanOptionalText(args.notes);
    if (args.sortOrder !== undefined) patch.sortOrder = args.sortOrder;

    await ctx.db.patch(args.id, patch);
  },
});

export const remove = mutationGeneric({
  args: { id: v.id("portfolioHoldings") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
