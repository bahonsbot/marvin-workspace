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

type PortfolioTransactionType =
  | "buy"
  | "sell"
  | "dividend"
  | "deposit"
  | "withdrawal"
  | "fee"
  | "adjustment";

type PortfolioTransactionDocument = {
  _id: string;
  userKey: string;
  holdingId?: string;
  symbol: string;
  displaySymbol: string;
  assetType: "stock" | "etf" | "cash" | "other";
  transactionType: PortfolioTransactionType;
  executedAt: number;
  quantity?: number;
  price?: number;
  fee?: number;
  grossAmount?: number;
  netAmount?: number;
  currency: string;
  baseCurrency: string;
  fxRateToBase?: number;
  baseAmount?: number;
  broker?: string;
  strategy?: string;
  account?: string;
  notes?: string;
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
  query(tableName: "portfolioTransactions"): {
    withIndex(
      name: string,
      range: (q: IndexBuilder) => IndexBuilder,
    ): {
      order(direction: "asc" | "desc"): {
        collect(): Promise<PortfolioTransactionDocument[]>;
      };
    };
  };
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

function cleanCurrency(value: string | undefined, fallback = "USD") {
  const normalized = cleanOptionalText(value)?.toUpperCase();
  if (normalized === "NO") return "NOK";
  return normalized ?? fallback;
}

function cleanNonNegativeNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    return undefined;
  return Math.round(value * 10000) / 10000;
}

function cleanTimestamp(value: number | undefined) {
  if (!value || !Number.isFinite(value) || value <= 0) return Date.now();
  return Math.round(value);
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
      currency: cleanCurrency(args.currency),
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
        cleanCurrency(args.currency, existing.currency);
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

export const listTransactions = queryGeneric({
  args: { userKey: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userKey = args.userKey ?? DEMO_USER_KEY;
    const limit =
      typeof args.limit === "number" && Number.isFinite(args.limit)
        ? Math.max(1, Math.min(500, Math.round(args.limit)))
        : 150;
    const all = await ctx.db
      .query("portfolioTransactions")
      .withIndex("by_user_executed", (q) => q.eq("userKey", userKey))
      .order("desc")
      .collect();
    return all.slice(0, limit);
  },
});

export const addTransaction = mutationGeneric({
  args: {
    userKey: v.optional(v.string()),
    holdingId: v.optional(v.id("portfolioHoldings")),
    symbol: v.string(),
    assetType: v.optional(
      v.union(
        v.literal("stock"),
        v.literal("etf"),
        v.literal("cash"),
        v.literal("other"),
      ),
    ),
    transactionType: v.union(
      v.literal("buy"),
      v.literal("sell"),
      v.literal("dividend"),
      v.literal("deposit"),
      v.literal("withdrawal"),
      v.literal("fee"),
      v.literal("adjustment"),
    ),
    executedAt: v.optional(v.number()),
    quantity: v.optional(v.number()),
    price: v.optional(v.number()),
    fee: v.optional(v.number()),
    grossAmount: v.optional(v.number()),
    netAmount: v.optional(v.number()),
    currency: v.optional(v.string()),
    baseCurrency: v.optional(v.string()),
    fxRateToBase: v.optional(v.number()),
    broker: v.optional(v.string()),
    strategy: v.optional(v.string()),
    account: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userKey = args.userKey ?? DEMO_USER_KEY;
    const symbol = normalizeSymbol(args.symbol);
    if (!symbol) throw new Error("Transaction symbol is required");
    const quantity = cleanPositiveNumber(args.quantity);
    const price = cleanPositiveNumber(args.price);
    const fee = cleanNonNegativeNumber(args.fee);
    const grossAmount = cleanPositiveNumber(args.grossAmount);
    const netAmount = cleanNonNegativeNumber(args.netAmount);
    if ((args.transactionType === "buy" || args.transactionType === "sell") && !quantity)
      throw new Error("Quantity is required for buy/sell transactions");
    if ((args.transactionType === "buy" || args.transactionType === "sell") && !price)
      throw new Error("Price is required for buy/sell transactions");

    const fxRateToBase = cleanPositiveNumber(args.fxRateToBase) ?? 1;
    const resolvedNetAmount =
      netAmount ??
      (grossAmount !== undefined
        ? Math.round(
            ((args.transactionType === "buy" || args.transactionType === "withdrawal" || args.transactionType === "fee"
              ? grossAmount + (fee ?? 0)
              : grossAmount - (fee ?? 0)) + Number.EPSILON) * 100,
          ) / 100
        : undefined);

    const now = Date.now();
    const baseAmount =
      resolvedNetAmount !== undefined
        ? Math.round(resolvedNetAmount * fxRateToBase * 100) / 100
        : undefined;

    return await ctx.db.insert("portfolioTransactions", {
      userKey,
      holdingId: args.holdingId,
      symbol,
      displaySymbol: displaySymbol(symbol),
      assetType: cleanAssetType(args.assetType),
      transactionType: args.transactionType,
      executedAt: cleanTimestamp(args.executedAt),
      quantity,
      price,
      fee: fee != null ? Math.round(fee * 100) / 100 : undefined,
      grossAmount: grossAmount != null ? Math.round(grossAmount * 100) / 100 : undefined,
      netAmount: resolvedNetAmount,
      currency: cleanCurrency(args.currency),
      baseCurrency: cleanOptionalText(args.baseCurrency)?.toUpperCase() ?? "EUR",
      fxRateToBase,
      baseAmount,
      broker: cleanOptionalText(args.broker),
      strategy: cleanOptionalText(args.strategy),
      account: cleanOptionalText(args.account),
      notes: cleanOptionalText(args.notes),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateTransaction = mutationGeneric({
  args: {
    id: v.id("portfolioTransactions"),
    holdingId: v.optional(v.id("portfolioHoldings")),
    symbol: v.optional(v.string()),
    assetType: v.optional(
      v.union(
        v.literal("stock"),
        v.literal("etf"),
        v.literal("cash"),
        v.literal("other"),
      ),
    ),
    transactionType: v.optional(
      v.union(
        v.literal("buy"),
        v.literal("sell"),
        v.literal("dividend"),
        v.literal("deposit"),
        v.literal("withdrawal"),
        v.literal("fee"),
        v.literal("adjustment"),
      ),
    ),
    executedAt: v.optional(v.number()),
    quantity: v.optional(v.number()),
    price: v.optional(v.number()),
    fee: v.optional(v.number()),
    grossAmount: v.optional(v.number()),
    netAmount: v.optional(v.number()),
    currency: v.optional(v.string()),
    baseCurrency: v.optional(v.string()),
    fxRateToBase: v.optional(v.number()),
    broker: v.optional(v.string()),
    strategy: v.optional(v.string()),
    account: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = (await ctx.db.get(
      args.id,
    )) as PortfolioTransactionDocument | null;
    if (!existing) throw new Error("Portfolio transaction not found");
    const transactionType = args.transactionType ?? existing.transactionType;
    const symbol =
      args.symbol !== undefined ? normalizeSymbol(args.symbol) : existing.symbol;
    if (!symbol) throw new Error("Transaction symbol is required");
    const quantity =
      args.quantity !== undefined
        ? cleanPositiveNumber(args.quantity)
        : existing.quantity;
    const price =
      args.price !== undefined ? cleanPositiveNumber(args.price) : existing.price;
    const fee =
      args.fee !== undefined ? cleanNonNegativeNumber(args.fee) : existing.fee;
    const grossAmount =
      args.grossAmount !== undefined
        ? cleanPositiveNumber(args.grossAmount)
        : existing.grossAmount;
    const netAmount =
      args.netAmount !== undefined
        ? cleanNonNegativeNumber(args.netAmount)
        : existing.netAmount;
    if ((transactionType === "buy" || transactionType === "sell") && !quantity)
      throw new Error("Quantity is required for buy/sell transactions");
    if ((transactionType === "buy" || transactionType === "sell") && !price)
      throw new Error("Price is required for buy/sell transactions");

    const fxRateToBase =
      args.fxRateToBase !== undefined
        ? (cleanPositiveNumber(args.fxRateToBase) ?? 1)
        : (existing.fxRateToBase ?? 1);
    const resolvedNetAmount =
      netAmount ??
      (grossAmount !== undefined
        ? Math.round(
            ((transactionType === "buy" || transactionType === "withdrawal" || transactionType === "fee"
              ? grossAmount + (fee ?? 0)
              : grossAmount - (fee ?? 0)) + Number.EPSILON) * 100,
          ) / 100
        : undefined);
    const baseAmount =
      resolvedNetAmount !== undefined
        ? Math.round(resolvedNetAmount * fxRateToBase * 100) / 100
        : undefined;

    await ctx.db.patch(args.id, {
      holdingId: args.holdingId ?? existing.holdingId,
      symbol,
      displaySymbol: displaySymbol(symbol),
      assetType:
        args.assetType !== undefined
          ? cleanAssetType(args.assetType)
          : existing.assetType,
      transactionType,
      executedAt:
        args.executedAt !== undefined
          ? cleanTimestamp(args.executedAt)
          : existing.executedAt,
      quantity,
      price,
      fee: fee != null ? Math.round(fee * 100) / 100 : undefined,
      grossAmount:
        grossAmount != null ? Math.round(grossAmount * 100) / 100 : undefined,
      netAmount: resolvedNetAmount,
      currency:
        args.currency !== undefined
          ? cleanCurrency(args.currency, existing.currency)
          : existing.currency,
      baseCurrency:
        args.baseCurrency !== undefined
          ? (cleanOptionalText(args.baseCurrency)?.toUpperCase() ?? existing.baseCurrency)
          : existing.baseCurrency,
      fxRateToBase,
      baseAmount,
      broker:
        args.broker !== undefined
          ? cleanOptionalText(args.broker)
          : existing.broker,
      strategy:
        args.strategy !== undefined
          ? cleanOptionalText(args.strategy)
          : existing.strategy,
      account:
        args.account !== undefined
          ? cleanOptionalText(args.account)
          : existing.account,
      notes:
        args.notes !== undefined
          ? cleanOptionalText(args.notes)
          : existing.notes,
      updatedAt: Date.now(),
    });
  },
});

export const removeTransaction = mutationGeneric({
  args: { id: v.id("portfolioTransactions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
