import { NextResponse } from "next/server";
import { getFxRates, PORTFOLIO_BASE_CURRENCY } from "@/lib/trading/fx";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const currencies = (searchParams.get("currencies") ?? "")
    .split(",")
    .map((currency) => currency.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 24);
  const base =
    searchParams.get("base")?.trim().toUpperCase() || PORTFOLIO_BASE_CURRENCY;
  if (!currencies.length)
    return NextResponse.json({ baseCurrency: base, rates: [] });
  const payload = await getFxRates(currencies, base);
  return NextResponse.json(payload);
}
