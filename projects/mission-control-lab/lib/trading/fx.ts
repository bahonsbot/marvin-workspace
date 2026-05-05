export const PORTFOLIO_BASE_CURRENCY = "EUR";

export type FxRate = {
  from: string;
  to: string;
  rate: number;
  asOf: string;
  source: "frankfurter" | "static" | "identity";
  freshness: "fresh" | "fallback" | "identity" | "missing";
};

export type FxRatesResponse = {
  baseCurrency: string;
  rates: FxRate[];
};

const STATIC_TO_EUR: Record<string, number> = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.17,
  CHF: 1.07,
  CAD: 0.67,
  AUD: 0.61,
  JPY: 0.0059,
  HKD: 0.118,
  TWD: 0.028,
  VND: 0.000036,
};

function normalizeCurrency(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function fallbackRate(
  from: string,
  to = PORTFOLIO_BASE_CURRENCY,
): FxRate | null {
  const normalizedFrom = normalizeCurrency(from);
  const normalizedTo = normalizeCurrency(to) || PORTFOLIO_BASE_CURRENCY;
  const asOf = new Date().toISOString();
  if (!normalizedFrom || !normalizedTo) return null;
  if (normalizedFrom === normalizedTo) {
    return {
      from: normalizedFrom,
      to: normalizedTo,
      rate: 1,
      asOf,
      source: "identity",
      freshness: "identity",
    };
  }
  if (
    normalizedTo === PORTFOLIO_BASE_CURRENCY &&
    STATIC_TO_EUR[normalizedFrom]
  ) {
    return {
      from: normalizedFrom,
      to: normalizedTo,
      rate: STATIC_TO_EUR[normalizedFrom],
      asOf,
      source: "static",
      freshness: "fallback",
    };
  }
  if (
    normalizedFrom === PORTFOLIO_BASE_CURRENCY &&
    STATIC_TO_EUR[normalizedTo]
  ) {
    return {
      from: normalizedFrom,
      to: normalizedTo,
      rate: 1 / STATIC_TO_EUR[normalizedTo],
      asOf,
      source: "static",
      freshness: "fallback",
    };
  }
  return null;
}

async function fetchFrankfurterRate(
  from: string,
  to: string,
): Promise<FxRate | null> {
  const normalizedFrom = normalizeCurrency(from);
  const normalizedTo = normalizeCurrency(to) || PORTFOLIO_BASE_CURRENCY;
  if (!normalizedFrom || !normalizedTo) return null;
  if (normalizedFrom === normalizedTo)
    return fallbackRate(normalizedFrom, normalizedTo);
  try {
    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(normalizedFrom)}&to=${encodeURIComponent(normalizedTo)}`;
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 * 60 * 6 },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      date?: string;
      rates?: Record<string, number>;
    };
    const rate = data.rates?.[normalizedTo];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0)
      return null;
    return {
      from: normalizedFrom,
      to: normalizedTo,
      rate,
      asOf: data.date
        ? new Date(`${data.date}T00:00:00Z`).toISOString()
        : new Date().toISOString(),
      source: "frankfurter",
      freshness: "fresh",
    };
  } catch {
    return null;
  }
}

export async function getFxRates(
  currencies: string[],
  to = PORTFOLIO_BASE_CURRENCY,
): Promise<FxRatesResponse> {
  const baseCurrency = normalizeCurrency(to) || PORTFOLIO_BASE_CURRENCY;
  const unique = Array.from(
    new Set(currencies.map(normalizeCurrency).filter(Boolean)),
  );
  const rates = await Promise.all(
    unique.map(async (currency) => {
      const live = await fetchFrankfurterRate(currency, baseCurrency);
      return (
        live ??
        fallbackRate(currency, baseCurrency) ?? {
          from: currency,
          to: baseCurrency,
          rate: 1,
          asOf: new Date().toISOString(),
          source: "static" as const,
          freshness: "missing" as const,
        }
      );
    }),
  );
  return { baseCurrency, rates };
}
