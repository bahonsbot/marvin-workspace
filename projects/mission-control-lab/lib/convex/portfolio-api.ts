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
} as const;
