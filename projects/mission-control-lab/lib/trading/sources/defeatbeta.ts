import 'server-only';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8791';
const DEFAULT_TIMEOUT_MS = 12_000;

export type DefeatBetaCoverage = {
  prices: boolean;
  statements: boolean;
  ratios: boolean;
  quality: boolean;
  events: boolean;
};

export type DefeatBetaPoint = {
  date?: string | null;
  period?: string | null;
  value: number;
};

export type DefeatBetaStatementTrend = {
  metric: string;
  points: Array<{ period: string; value: number }>;
};

export type DefeatBetaAnalyticsSummary = {
  requestedSymbol: string;
  resolvedSymbol: string;
  status: 'available' | 'partial' | 'unavailable' | 'error';
  source: { id: 'defeatbeta'; label: string; note?: string };
  asOf: string;
  defeatbetaVersion?: string | null;
  elapsedMs?: number;
  coverage: DefeatBetaCoverage;
  ratios: {
    pe: DefeatBetaPoint[];
    ps: DefeatBetaPoint[];
    pb: DefeatBetaPoint[];
    wacc: DefeatBetaPoint[];
  };
  quality: {
    roe: DefeatBetaPoint[];
    roic: DefeatBetaPoint[];
  };
  statements: {
    annualIncome: DefeatBetaStatementTrend[];
    quarterlyIncome: DefeatBetaStatementTrend[];
    quarterlyCashFlow: DefeatBetaStatementTrend[];
  };
  events: {
    dividends: DefeatBetaPoint[];
    splits: Array<{ date?: string | null; splitFactor?: string | null }>;
  };
  notes: string[];
};

export type DefeatBetaAdapterResult =
  | { ok: true; summary: DefeatBetaAnalyticsSummary }
  | { ok: false; status: 'unavailable' | 'error'; reason: string; summary: DefeatBetaAnalyticsSummary };

function configuredBaseUrl() {
  return (process.env.DEFEATBETA_SIDECAR_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function emptySummary(symbol: string, status: 'unavailable' | 'error', reason: string): DefeatBetaAnalyticsSummary {
  const normalized = symbol.trim().toUpperCase();
  return {
    requestedSymbol: normalized,
    resolvedSymbol: normalized,
    status,
    source: {
      id: 'defeatbeta',
      label: 'DefeatBeta API',
      note: 'Analytics enrichment only; unavailable data must not replace quote truth.',
    },
    asOf: new Date().toISOString(),
    coverage: { prices: false, statements: false, ratios: false, quality: false, events: false },
    ratios: { pe: [], ps: [], pb: [], wacc: [] },
    quality: { roe: [], roic: [] },
    statements: { annualIncome: [], quarterlyIncome: [], quarterlyCashFlow: [] },
    events: { dividends: [], splits: [] },
    notes: [reason],
  };
}

function hasUsableCoverage(summary: DefeatBetaAnalyticsSummary) {
  return summary.status === 'available' || summary.status === 'partial';
}

export async function getDefeatBetaAnalyticsSummary(symbol: string, options?: { timeoutMs?: number }): Promise<DefeatBetaAdapterResult> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    return { ok: false, status: 'unavailable', reason: 'Symbol is required.', summary: emptySummary(symbol, 'unavailable', 'Symbol is required.') };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const url = `${configuredBaseUrl()}/v1/ticker/${encodeURIComponent(normalized)}/analytics-summary`;

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      const reason = `DefeatBeta sidecar returned HTTP ${response.status}.`;
      return { ok: false, status: 'error', reason, summary: emptySummary(normalized, 'error', reason) };
    }
    const summary = (await response.json()) as DefeatBetaAnalyticsSummary;
    if (!hasUsableCoverage(summary)) {
      const reason = summary.notes?.[0] || 'DefeatBeta has no usable analytics coverage for this symbol.';
      return { ok: false, status: 'unavailable', reason, summary };
    }
    return { ok: true, summary };
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError'
      ? 'DefeatBeta sidecar request timed out.'
      : 'DefeatBeta sidecar is not reachable.';
    return { ok: false, status: 'unavailable', reason, summary: emptySummary(normalized, 'unavailable', reason) };
  } finally {
    clearTimeout(timeout);
  }
}
