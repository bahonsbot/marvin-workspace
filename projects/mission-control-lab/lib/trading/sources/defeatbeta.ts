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

export type DefeatBetaTranscriptCatalog = {
  requestedSymbol: string;
  resolvedSymbol: string;
  status: 'available' | 'unavailable' | 'error';
  source: { id: 'defeatbeta'; label: string; note?: string };
  asOf: string;
  latest: {
    symbol?: string | null;
    fiscalYear: number | null;
    fiscalQuarter: number | null;
    reportDate?: string | null;
    transcriptId?: string | null;
    paragraphCount: number;
    sampleSpeakers: string[];
  } | null;
  recent: Array<NonNullable<DefeatBetaTranscriptCatalog['latest']>>;
  coverage: { transcripts: boolean; llmConfigured: boolean };
  llmAnalysis: { status: 'requires_config' | 'available_in_library' | 'unavailable' | 'error'; availableMethods: string[]; note: string };
  notes: string[];
};

export type DefeatBetaTranscriptDetail = {
  requestedSymbol: string;
  resolvedSymbol: string;
  status: 'available' | 'unavailable' | 'error';
  source: { id: 'defeatbeta'; label: string; note?: string };
  asOf: string;
  fiscalYear: number | null;
  fiscalQuarter: number | null;
  reportDate?: string | null;
  paragraphCount?: number;
  includedParagraphCount?: number;
  paragraphs: Array<{ paragraphNumber: number; speaker?: string | null; content: string }>;
  notes: string[];
};

export type DefeatBetaEconomyContext = {
  status: 'available' | 'unavailable' | 'error';
  source: { id: 'defeatbeta'; label: string; note?: string };
  asOf: string;
  sp500: { latestAnnualReturn: { date?: string | null; annualReturn: number | null } | null; cagr10Year: number | null };
  yieldCurve: { date?: string | null; bc3Month: number | null; bc2Year: number | null; bc10Year: number | null; bc30Year: number | null; twoTenSpread?: number | null } | null;
  notes: string[];
};

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

async function fetchSidecarJson<T>(path: string, options?: { timeoutMs?: number }): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${configuredBaseUrl()}${path}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`DefeatBeta sidecar returned HTTP ${response.status}.`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getDefeatBetaAnalyticsSummary(symbol: string, options?: { timeoutMs?: number }): Promise<DefeatBetaAdapterResult> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    return { ok: false, status: 'unavailable', reason: 'Symbol is required.', summary: emptySummary(symbol, 'unavailable', 'Symbol is required.') };
  }

  try {
    const summary = await fetchSidecarJson<DefeatBetaAnalyticsSummary>(`/v1/ticker/${encodeURIComponent(normalized)}/analytics-summary`, options);
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
  }
}

export async function getDefeatBetaTranscriptCatalog(symbol: string, options?: { timeoutMs?: number }): Promise<DefeatBetaTranscriptCatalog> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    return {
      requestedSymbol: normalized,
      resolvedSymbol: normalized,
      status: 'unavailable',
      source: { id: 'defeatbeta', label: 'DefeatBeta API', note: 'Transcript enrichment only.' },
      asOf: new Date().toISOString(),
      latest: null,
      recent: [],
      coverage: { transcripts: false, llmConfigured: false },
      llmAnalysis: { status: 'unavailable', availableMethods: ['keyFinancialData', 'metricChanges', 'forecastDrivers'], note: 'Symbol is required.' },
      notes: ['Symbol is required.'],
    };
  }
  try {
    return await fetchSidecarJson<DefeatBetaTranscriptCatalog>(`/v1/ticker/${encodeURIComponent(normalized)}/transcript-catalog`, options);
  } catch (error) {
    return {
      requestedSymbol: normalized,
      resolvedSymbol: normalized,
      status: 'error',
      source: { id: 'defeatbeta', label: 'DefeatBeta API', note: 'Transcript enrichment only.' },
      asOf: new Date().toISOString(),
      latest: null,
      recent: [],
      coverage: { transcripts: false, llmConfigured: false },
      llmAnalysis: { status: 'error', availableMethods: ['keyFinancialData', 'metricChanges', 'forecastDrivers'], note: error instanceof Error ? error.message : 'DefeatBeta transcript catalogue failed.' },
      notes: [error instanceof Error ? error.message : 'DefeatBeta transcript catalogue failed.'],
    };
  }
}

export async function getDefeatBetaTranscriptDetail(symbol: string, options?: { fiscalYear?: number | null; fiscalQuarter?: number | null; timeoutMs?: number }): Promise<DefeatBetaTranscriptDetail> {
  const normalized = symbol.trim().toUpperCase();
  const params = new URLSearchParams();
  if (options?.fiscalYear) params.set('fiscalYear', String(options.fiscalYear));
  if (options?.fiscalQuarter) params.set('fiscalQuarter', String(options.fiscalQuarter));
  const query = params.toString() ? `?${params.toString()}` : '';
  try {
    return await fetchSidecarJson<DefeatBetaTranscriptDetail>(`/v1/ticker/${encodeURIComponent(normalized)}/transcript${query}`, options);
  } catch (error) {
    return {
      requestedSymbol: normalized,
      resolvedSymbol: normalized,
      status: 'error',
      source: { id: 'defeatbeta', label: 'DefeatBeta API', note: 'Transcript detail only.' },
      asOf: new Date().toISOString(),
      fiscalYear: options?.fiscalYear ?? null,
      fiscalQuarter: options?.fiscalQuarter ?? null,
      paragraphs: [],
      notes: [error instanceof Error ? error.message : 'DefeatBeta transcript detail failed.'],
    };
  }
}

export async function getDefeatBetaEconomyContext(options?: { timeoutMs?: number }): Promise<DefeatBetaEconomyContext> {
  try {
    return await fetchSidecarJson<DefeatBetaEconomyContext>('/v1/economy/context', options);
  } catch (error) {
    return {
      status: 'error',
      source: { id: 'defeatbeta', label: 'DefeatBeta API', note: 'Economy context only.' },
      asOf: new Date().toISOString(),
      sp500: { latestAnnualReturn: null, cagr10Year: null },
      yieldCurve: null,
      notes: [error instanceof Error ? error.message : 'DefeatBeta economy context failed.'],
    };
  }
}
