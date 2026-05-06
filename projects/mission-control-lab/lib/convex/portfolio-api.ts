import { makeFunctionReference } from "convex/server";

export type PortfolioAssetType = "stock" | "etf" | "cash" | "other";

export type PortfolioHolding = {
  _id: string;
  _creationTime?: number;
  userKey: string;
  symbol: string;
  displaySymbol: string;
  name?: string;
  assetType: PortfolioAssetType;
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

export type PortfolioTransactionType =
  | "buy"
  | "sell"
  | "dividend"
  | "deposit"
  | "withdrawal"
  | "fee"
  | "adjustment";

export type PortfolioTransaction = {
  _id: string;
  _creationTime?: number;
  userKey: string;
  holdingId?: string;
  symbol: string;
  displaySymbol: string;
  assetType: PortfolioAssetType;
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

export const portfolioApi = {
  list: makeFunctionReference<
    "query",
    { userKey?: string },
    PortfolioHolding[]
  >("portfolio:list"),
  add: makeFunctionReference<
    "mutation",
    {
      userKey?: string;
      symbol: string;
      name?: string;
      assetType?: PortfolioAssetType;
      strategy?: string;
      sector?: string;
      industry?: string;
      country?: string;
      currency?: string;
      broker?: string;
      quantity: number;
      averageCost: number;
      transactionFee?: number;
      alertEnabled?: boolean;
      alertMinPrice?: number;
      alertMaxPrice?: number;
      notes?: string;
    },
    string
  >("portfolio:add"),
  update: makeFunctionReference<
    "mutation",
    {
      id: string;
      name?: string;
      assetType?: PortfolioAssetType;
      strategy?: string;
      sector?: string;
      industry?: string;
      country?: string;
      currency?: string;
      broker?: string;
      quantity?: number;
      averageCost?: number;
      transactionFee?: number;
      alertEnabled?: boolean;
      alertMinPrice?: number | null;
      alertMaxPrice?: number | null;
      notes?: string;
      sortOrder?: number;
    },
    void
  >("portfolio:update"),
  remove: makeFunctionReference<"mutation", { id: string }, void>(
    "portfolio:remove",
  ),
  listTransactions: makeFunctionReference<
    "query",
    { userKey?: string; limit?: number },
    PortfolioTransaction[]
  >("portfolio:listTransactions"),
  addTransaction: makeFunctionReference<
    "mutation",
    {
      userKey?: string;
      holdingId?: string;
      symbol: string;
      assetType?: PortfolioAssetType;
      transactionType: PortfolioTransactionType;
      executedAt?: number;
      quantity?: number;
      price?: number;
      fee?: number;
      grossAmount?: number;
      netAmount?: number;
      currency?: string;
      baseCurrency?: string;
      fxRateToBase?: number;
      broker?: string;
      strategy?: string;
      account?: string;
      notes?: string;
    },
    string
  >("portfolio:addTransaction"),
} as const;
