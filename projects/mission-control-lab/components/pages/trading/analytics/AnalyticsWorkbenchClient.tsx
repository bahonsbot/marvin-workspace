'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { MiniLineChart, TabScaffold, tradingCardStyle } from '@/components/pages/trading/shared';
import type { DefeatBetaAnalyticsSummary } from '@/lib/trading/sources/defeatbeta';

type SearchResult = {
  symbol: string;
  code: string;
  exchange: string;
  name: string;
  type: string;
  country: string;
  currency: string;
  previousClose: number | null;
  previousCloseDate: string | null;
  isPrimary: boolean;
};

type SearchResponse = { query: string; results: SearchResult[] };
type QuickValuationRouteResult = { ok: boolean; valuation: QuickValuation };

type ValuationRunStatus = {
  id: string;
  state: 'ready' | 'unavailable' | 'error';
  mode: 'quick';
  generatedAt: string;
  elapsedMs: number | null;
  source: string;
  requestedSymbol: string;
  resolvedSymbol: string;
  modelVersion: string;
};

type ValuationModel = {
  name: string;
  key?: string;
  range: string;
  weight: string;
  note: string;
  value?: number | null;
  low?: number | null;
  high?: number | null;
};

type ValuationSubmodel = {
  key: string;
  label: string;
  weight: number;
  value: number | null;
  bear: number | null;
  base: number | null;
  bull: number | null;
  confidence: 'Low' | 'Medium' | 'High';
  driver: string;
  warning: string | null;
  notes: string[];
};

type ValuationSensitivity = {
  factor: string;
  bear: number | null;
  base: number | null;
  bull: number | null;
  note: string;
};

type QuickValuation = {
  status: 'idle' | 'validating' | 'validated' | 'generating' | 'ready' | 'unavailable' | 'error';
  message: string;
  selected: SearchResult | null;
  summary: DefeatBetaAnalyticsSummary | null;
  fairLow: number | null;
  fairHigh: number | null;
  baseValue: number | null;
  currentPrice: number | null;
  impliedUpside: number | null;
  confidence: 'Low' | 'Medium' | 'High';
  decisionZone: string;
  methods: ValuationModel[];
  submodels?: ValuationSubmodel[];
  sensitivity?: ValuationSensitivity[];
  evidence: Array<[string, string]>;
  valuationSeries: number[];
  benchmarkSeries: number[];
  riskSeries: number[];
  run?: ValuationRunStatus;
  assumptions?: {
    modelVersion: string;
    modelType: string;
    currency: string;
    revenueCagr: number | null;
    netIncomeCagr: number | null;
    latestPe: number | null;
    latestPs: number | null;
    latestPb: number | null;
    latestWacc: number | null;
    latestRoe: number | null;
    latestRoic: number | null;
    confidenceSpread: number;
  };
};

const tabs = ['Valuation', 'Performance', 'Fundamentals', 'Income & Events', 'Technical', 'Milou'];
const fallbackValuationSeries = [108, 112, 118, 115, 123, 132, 138, 146, 151, 158, 164, 161, 168, 176];
const fallbackBenchmarkSeries = [100, 104, 102, 109, 112, 118, 121, 127, 126, 132, 136, 139, 141, 145];
const fallbackRiskSeries = [64, 58, 61, 54, 49, 46, 51, 44, 41, 38, 36, 34];

const fallbackMethods: ValuationModel[] = [
  { name: 'DCF base case', range: '$148-$184', weight: '40%', note: 'FCF path, WACC, terminal growth' },
  { name: 'Multiples check', range: '$136-$171', weight: '25%', note: 'PE, EV/EBITDA, PS vs history and peers' },
  { name: 'Reverse DCF', range: '$128-$166', weight: '20%', note: 'Growth implied by current market price' },
  { name: 'Quality adjustment', range: '+6%', weight: '15%', note: 'ROIC-WACC spread, balance sheet, cyclicality' },
];

const fallbackEvidence: Array<[string, string]> = [
  ['Revenue trend', '5Y CAGR, quarterly slope, consensus stress'],
  ['Cash conversion', 'Operating cash flow, capex intensity, FCF margin'],
  ['Capital quality', 'ROE, ROIC, WACC, reinvestment runway'],
  ['Market context', 'Relative strength, sector momentum, rate sensitivity'],
];

const milouPrompts = [
  'Challenge the bull case',
  'What assumption moves fair value most?',
  'Explain this DCF simply',
  'Compare this against QQQ/SPY',
];

const explainers: Record<string, string> = {
  dcfProxy: "DCF proxy estimates intrinsic value from growth, cash conversion, WACC, and terminal assumptions. Useful because it tests whether fundamentals can justify today's price.",
  multiples: 'Multiples compare valuation ratios such as PE, PS, and PB against a growth-adjusted fair band. Useful as a market reality check.',
  reverseDcf: 'Reverse DCF asks what growth the current market price already implies. Useful for spotting when optimism is already priced in.',
  qualityRisk: 'Quality/risk overlay adjusts for capital efficiency, ROIC versus WACC, and missing coverage. Useful because better businesses deserve different valuation tolerance.',
  fairValue: 'The corridor shows bear, base, and bull valuation outputs across the model blend. It is uncertainty, not a price target.',
  decisionZone: 'Decision zone is a model interpretation, not advice. Watch / Buy weakness means the model sees fair value or mild upside, but prefers waiting for a better entry unless fundamentals improve.',
  sensitivity: 'Sensitivity shows which assumption moves fair value most. Wider bands mean the output is more fragile.',
};

function Explainer({ id }: { id: keyof typeof explainers }) {
  return <span className="trading-analytics-explainer" title={explainers[id]} aria-label={explainers[id]}>?</span>;
}

function formatCurrency(value: number | null | undefined, currency = 'USD') {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value);
}

function formatCurrencyRange(low: number | null | undefined, high: number | null | undefined, currency = 'USD') {
  return `${formatCurrency(low, currency)}–${formatCurrency(high, currency)}`;
}

function formatPercent(value: number | null | undefined, options: { signed?: boolean; decimals?: number } = {}) {
  if (value == null || !Number.isFinite(value)) return '—';
  const decimals = options.decimals ?? 1;
  const prefix = options.signed && value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(decimals)}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatElapsed(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value < 1000) return `${Math.round(value)}ms`;
  return `${(value / 1000).toFixed(1)}s`;
}

function coverageEntries(summary: DefeatBetaAnalyticsSummary | null) {
  const coverage = summary?.coverage ?? { prices: false, statements: false, ratios: false, quality: false, events: false };
  return Object.entries(coverage) as Array<[keyof typeof coverage, boolean]>;
}

function runStateLabel(status: QuickValuation['status']) {
  if (status === 'ready') return 'Complete';
  if (status === 'generating') return 'Running';
  if (status === 'unavailable') return 'Unavailable';
  if (status === 'error') return 'Failed';
  if (status === 'validated') return 'Validated';
  if (status === 'validating') return 'Validating';
  return 'Idle';
}

function exchangeSymbolForDefeatBeta(symbol: string) {
  const normalized = symbol.toUpperCase();
  if (normalized.endsWith('.US')) return normalized.replace(/\.US$/, '');
  return normalized;
}

function bestValidatedMatch(query: string, results: SearchResult[]) {
  const normalized = query.trim().toUpperCase();
  const exactSymbol = results.find((result) => result.symbol.toUpperCase() === normalized);
  if (exactSymbol) return exactSymbol;
  const exactCode = results.find((result) => result.code.toUpperCase() === normalized && result.isPrimary);
  if (exactCode) return exactCode;
  return results[0] ?? null;
}

function valuePoints(valuation: QuickValuation) {
  const submodels = valuation.submodels?.filter((model) => model.value != null) ?? [];
  if (!submodels.length) {
    return [
      { key: 'bear', label: 'Bear', value: valuation.fairLow },
      { key: 'base', label: 'Base', value: valuation.baseValue },
      { key: 'bull', label: 'Bull', value: valuation.fairHigh },
    ];
  }
  return submodels.map((model) => ({ key: model.key, label: model.label.replace(' check', '').replace(' overlay', ''), value: model.value }));
}

function rangeScale(values: Array<number | null | undefined>) {
  const usable = values.filter((value): value is number => value != null && Number.isFinite(value));
  const min = Math.min(...usable, 0);
  const max = Math.max(...usable, 1);
  return { min, max, span: Math.max(max - min, 1) };
}

function CorridorChart({ valuation, currency }: { valuation: QuickValuation; currency: string }) {
  const points = valuePoints(valuation);
  const values = [valuation.fairLow, valuation.baseValue, valuation.fairHigh, ...points.map((point) => point.value)];
  const scale = rangeScale(values);
  const low = valuation.fairLow;
  const base = valuation.baseValue;
  const high = valuation.fairHigh;
  const lowPct = low == null ? 0 : ((low - scale.min) / scale.span) * 100;
  const highPct = high == null ? 0 : ((high - scale.min) / scale.span) * 100;
  const basePct = base == null ? 0 : ((base - scale.min) / scale.span) * 100;
  return (
    <div className="trading-analytics-corridor" aria-label="Fair value corridor">
      <div className="trading-analytics-corridor-track">
        {low != null && high != null ? <span className="range" style={{ left: `${lowPct}%`, width: `${Math.max(highPct - lowPct, 2)}%` }} /> : null}
        {base != null ? <span className="base" style={{ left: `${basePct}%` }} /> : null}
      </div>
      <div className="trading-analytics-corridor-labels">
        {low != null ? <span style={{ left: `${lowPct}%` }}>Bear<br /><b>{formatCurrency(low, currency)}</b></span> : null}
        {base != null ? <strong style={{ left: `${basePct}%` }}>Base<br /><b>{formatCurrency(base, currency)}</b></strong> : null}
        {high != null ? <span style={{ left: `${highPct}%` }}>Bull<br /><b>{formatCurrency(high, currency)}</b></span> : null}
      </div>
      <div className="trading-analytics-contribution-bars">
        {points.map((point) => {
          const width = point.value == null ? 0 : Math.max(((point.value - scale.min) / scale.span) * 100, 4);
          return <div key={point.label} data-model={point.key}><span>{point.label}</span><i style={{ width: `${width}%` }} /><em>{formatCurrency(point.value, currency)}</em></div>;
        })}
      </div>
    </div>
  );
}

function SensitivityBands({ rows, currency }: { rows: ValuationSensitivity[] | undefined; currency: string }) {
  const usable = rows?.length ? rows : [];
  const scale = rangeScale(usable.flatMap((row) => [row.bear, row.base, row.bull]));
  return (
    <div className="trading-analytics-sensitivity-bands">
      {usable.map((row) => {
        const left = row.bear == null ? 0 : ((row.bear - scale.min) / scale.span) * 100;
        const right = row.bull == null ? 0 : ((row.bull - scale.min) / scale.span) * 100;
        const base = row.base == null ? 0 : ((row.base - scale.min) / scale.span) * 100;
        return (
          <div key={row.factor} className="trading-analytics-sensitivity-row">
            <span>{row.factor}</span>
            <div><i style={{ left: `${left}%`, width: `${Math.max(right - left, 2)}%` }} /><b style={{ left: `${base}%` }} /></div>
            <em>{formatCurrency(row.bear, currency)} / {formatCurrency(row.bull, currency)}</em>
          </div>
        );
      })}
    </div>
  );
}

const initialValuation: QuickValuation = {
  status: 'idle',
  message: 'Validate a ticker, then generate the first Quick Valuation.',
  selected: null,
  summary: null,
  fairLow: 142,
  fairHigh: 178,
  baseValue: 161,
  currentPrice: 149,
  impliedUpside: 8.1,
  confidence: 'Medium',
  decisionZone: 'Watch / Buy weakness',
  methods: fallbackMethods,
  submodels: [],
  sensitivity: [],
  evidence: fallbackEvidence,
  valuationSeries: fallbackValuationSeries,
  benchmarkSeries: fallbackBenchmarkSeries,
  riskSeries: fallbackRiskSeries,
};

export function AnalyticsWorkbenchClient() {
  const [query, setQuery] = useState('ASML.AS');
  const [mode, setMode] = useState<'quick' | 'full'>('quick');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [valuation, setValuation] = useState<QuickValuation>(initialValuation);
  const [error, setError] = useState<string | null>(null);

  const searchResultsId = useId();
  const trimmedQuery = query.trim();
  const selected = valuation.selected ?? null;
  const currency = selected?.currency && selected.currency !== '—' ? selected.currency : 'USD';
  const selectedResult = searchResults[Math.min(activeResultIndex, Math.max(searchResults.length - 1, 0))];
  const showSearchPanel = searchOpen && Boolean(trimmedQuery) && (searchLoading || searchError || searchResults.length > 0);
  const valuationReady = valuation.status === 'ready';

  const verdictLabel = useMemo(() => {
    if (valuation.status === 'generating') return 'Generating…';
    if (valuation.status === 'unavailable') return 'Unavailable';
    if (valuation.status === 'ready') return formatCurrencyRange(valuation.fairLow, valuation.fairHigh, currency);
    return '$142-$178';
  }, [currency, valuation.fairHigh, valuation.fairLow, valuation.status]);


  useEffect(() => {
    if (!trimmedQuery || valuation.selected?.symbol === trimmedQuery.toUpperCase()) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const response = await fetch(`/api/trading/search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const data = (await response.json()) as SearchResponse;
        setSearchResults(data.results ?? []);
        setActiveResultIndex(0);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setSearchResults([]);
        setSearchError(caught instanceof Error ? caught.message : 'Search failed');
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedQuery, valuation.selected?.symbol]);

  function selectTicker(result: SearchResult) {
    setQuery(result.symbol);
    setSearchOpen(false);
    setSearchResults([]);
    setSearchError(null);
    setActiveResultIndex(0);
    setError(null);
    setValuation((current) => ({ ...current, status: 'validated', selected: result, message: `Validated ${result.name} on ${result.exchange}.` }));
  }

  async function validateTicker() {
    const normalized = query.trim();
    if (!normalized) {
      setError('Enter a ticker first.');
      return null;
    }
    setError(null);
    setValuation((current) => ({ ...current, status: 'validating', message: `Validating ${normalized}…` }));
    try {
      const response = await fetch(`/api/trading/search?q=${encodeURIComponent(normalized)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Search returned HTTP ${response.status}`);
      const payload = (await response.json()) as SearchResponse;
      setSearchResults(payload.results);
      const lockedSelection = valuation.selected?.symbol === normalized.toUpperCase() ? valuation.selected : null;
      const best = lockedSelection ?? bestValidatedMatch(normalized, payload.results);
      if (!best) {
        setValuation((current) => ({ ...current, status: 'error', selected: null, message: `No validated match found for ${normalized}.` }));
        return null;
      }
      setQuery(best.symbol);
      setSearchOpen(false);
      setValuation((current) => ({ ...current, status: 'validated', selected: best, message: `Validated ${best.name} on ${best.exchange}.` }));
      return best;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Ticker validation failed.';
      setError(message);
      setValuation((current) => ({ ...current, status: 'error', message }));
      return null;
    }
  }

  async function generateQuickValuation() {
    const match = selected?.symbol === query.trim().toUpperCase() ? selected : await validateTicker();
    if (!match) return;
    setError(null);
    setValuation({ ...initialValuation, status: 'generating', selected: match, currentPrice: match.previousClose, message: `Generating Quick Valuation for ${match.symbol}…` });
    try {
      const response = await fetch('/api/trading/valuation/quick', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ selected: match, symbol: exchangeSymbolForDefeatBeta(match.symbol) }),
      });
      if (!response.ok) throw new Error(`Quick valuation route returned HTTP ${response.status}`);
      const payload = (await response.json()) as QuickValuationRouteResult;
      setValuation(payload.valuation);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Quick Valuation failed.';
      setError(message);
      setValuation((current) => ({ ...current, status: 'error', message }));
    }
  }

  return (
    <div className="trading-analytics-workbench">
      <section className="trading-analytics-command" style={tradingCardStyle({ minHeight: 0, maxHeight: 'none', overflow: 'visible' })}>
        <div>
          <div className="trading-section-label">Analyze a ticker</div>
          <h2>From symbol to fair-value range.</h2>
          <p>
            Validate the company, choose the depth, then generate a valuation pack. DefeatBeta supplies analytical depth; Milou turns the evidence into a clear thesis.
          </p>
        </div>
        <form className="trading-analytics-search" aria-label="Ticker analysis setup" onSubmit={(event) => { event.preventDefault(); void generateQuickValuation(); }}>
          <label className="trading-analytics-symbol-field">
            <span>Ticker</span>
            <div className="trading-analytics-symbol-search">
              <input
                placeholder="Search ticker or company"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value.toUpperCase());
                  setSearchOpen(true);
                  setValuation({ ...initialValuation, message: 'Choose a ticker result, then generate Quick Valuation.', selected: null });
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setSearchOpen(false);
                    return;
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setActiveResultIndex((index) => Math.min(index + 1, Math.max(searchResults.length - 1, 0)));
                    return;
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setActiveResultIndex((index) => Math.max(index - 1, 0));
                    return;
                  }
                  if (event.key === 'Enter' && searchOpen && selectedResult) {
                    event.preventDefault();
                    selectTicker(selectedResult);
                  }
                }}
                aria-autocomplete="list"
                aria-controls={showSearchPanel ? searchResultsId : undefined}
              />
              {showSearchPanel ? (
                <div id={searchResultsId} className="trading-analytics-symbol-results" role="listbox" aria-label="Ticker search results">
                  {searchLoading ? <div className="trading-analytics-symbol-state">Searching symbols…</div> : null}
                  {!searchLoading && searchError ? <div className="trading-analytics-symbol-state">{searchError}</div> : null}
                  {!searchLoading && !searchError && searchResults.map((result, index) => (
                    <button
                      key={`${result.symbol}-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeResultIndex}
                      data-active={index === activeResultIndex ? 'true' : undefined}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveResultIndex(index)}
                      onClick={() => selectTicker(result)}
                    >
                      <strong>{result.symbol}</strong>
                      <span>{result.name}</span>
                      <small>{[result.country, result.currency, result.type].filter(Boolean).join(' · ')}</small>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>
          <label>
            <span>Mode</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as 'quick' | 'full')}>
              <option value="quick">Quick valuation</option>
              <option value="full">Full thesis</option>
            </select>
          </label>
          <button type="submit" disabled={valuation.status === 'validating' || valuation.status === 'generating'}>{mode === 'full' ? 'Start thesis draft' : 'Generate analysis'}</button>
        </form>
        <div className="trading-analytics-validation" data-state={valuation.status}>
          <span>{selected ? 'Validated match' : 'Validation'}</span>
          <strong>{selected?.name ?? 'No company selected'}</strong>
          <em>{selected ? `${selected.exchange} · ${selected.currency} · DefeatBeta: ${exchangeSymbolForDefeatBeta(selected.symbol)}` : valuation.message}</em>
          {error ? <small>{error}</small> : null}
        </div>
      </section>

      <section className="trading-analytics-run-status" style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
        <div className="trading-analytics-run-head">
          <div>
            <div className="trading-section-label">Valuation run status</div>
            <h2>{runStateLabel(valuation.status)} · Quick model</h2>
          </div>
          <em>{valuation.run?.id ?? 'No run yet'}</em>
        </div>
        <dl className="trading-analytics-run-grid">
          <div><dt>Generated</dt><dd>{valuation.run ? formatDateTime(valuation.run.generatedAt) : '—'}</dd></div>
          <div><dt>Elapsed</dt><dd>{valuation.status === 'generating' ? 'Fetching…' : formatElapsed(valuation.run?.elapsedMs)}</dd></div>
          <div><dt>Source</dt><dd>{valuation.run?.source ?? 'DefeatBeta pending'}</dd></div>
          <div><dt>Symbol mapping</dt><dd>{valuation.run ? `${valuation.run.requestedSymbol} → ${valuation.run.resolvedSymbol}` : selected ? `${selected.symbol} → ${exchangeSymbolForDefeatBeta(selected.symbol)}` : '—'}</dd></div>
          <div><dt>Model</dt><dd>{valuation.run?.modelVersion ?? valuation.assumptions?.modelVersion ?? 'quick-valuation-submodels-v1'}</dd></div>
          <div><dt>Mode</dt><dd>Quick valuation · historical data only</dd></div>
        </dl>
        <div className="trading-analytics-coverage-row" aria-label="Data coverage">
          {coverageEntries(valuation.summary).map(([key, value]) => (
            <span key={key} data-state={value ? 'ok' : 'missing'}>{key}</span>
          ))}
        </div>
        <p className="trading-analytics-disclaimer">Model interpretation only, not investment advice. Quick valuation uses a simplified DCF proxy and available historical data; full thesis still requires assumption review.</p>
      </section>

      <TabScaffold tabs={tabs} />

      <section className="trading-analytics-hero" style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
        <div className="trading-analytics-verdict">
          <div className="trading-section-label">Valuation verdict</div>
          <div className="trading-analytics-base-case">
            <span>Base case</span>
            <strong>{formatCurrency(valuation.baseValue, currency)}</strong>
          </div>
          <p className="trading-analytics-range-copy">Fair value range: <strong>{verdictLabel}</strong></p>
          <div className="trading-analytics-verdict-row">
            <span>Current price</span><strong>{formatCurrency(valuation.currentPrice, currency)}</strong>
            <span>Implied upside</span><strong className={(valuation.impliedUpside ?? 0) >= 0 ? 'positive' : 'negative'}>{formatPercent(valuation.impliedUpside, { signed: true })}</strong>
            <span>Decision zone</span><strong className="trading-analytics-decision-chip">{valuation.decisionZone}<Explainer id="decisionZone" /></strong>
          </div>
          <p className="trading-analytics-verdict-meta">12–24 month horizon · {valuation.confidence} confidence · range reflects model uncertainty, not a price target.</p>
        </div>
        <div className="trading-analytics-chart-panel">
          <div className="trading-ticker-chart-head trading-analytics-corridor-head">
            <div className="trading-section-label">Fair value corridor <Explainer id="fairValue" /></div>
          </div>
          <CorridorChart valuation={valuation} currency={currency} />
        </div>
      </section>

      <div className="trading-analytics-grid">
        <section style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
          <div className="trading-ticker-head">
            <div>
              <span>Valuation stack</span>
              <h2>Four models, one blended range</h2>
            </div>
            <em>{valuation.summary?.source.label ?? 'Editable weights later'}</em>
          </div>
          <dl className="trading-analytics-methods">
            {valuation.methods.map((method) => (
              <div key={method.name}>
                <dt>{method.name} {method.key ? <Explainer id={method.key as keyof typeof explainers} /> : null}<span>{method.note}</span>{valuation.submodels?.find((model) => model.key === method.key)?.driver ? <small>{valuation.submodels.find((model) => model.key === method.key)?.driver}</small> : null}</dt>
                <dd><strong>{method.range}</strong><em>{method.weight}</em></dd>
              </div>
            ))}
          </dl>
        </section>

        <section style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
          <div className="trading-ticker-head">
            <div>
              <span>Market comparison</span>
              <h2>Relative performance</h2>
            </div>
            <em>SPY · QQQ · sector ETF</em>
          </div>
          <MiniLineChart values={valuation.benchmarkSeries} />
          <dl className="trading-ticker-chart-stats">
            <div><dt>Vs QQQ</dt><dd className="positive">Pending</dd></div>
            <div><dt>Vs SPY</dt><dd className="positive">Pending</dd></div>
            <div><dt>Momentum</dt><dd>{valuation.summary?.coverage.prices ? 'DefeatBeta-backed' : 'Pending'}</dd></div>
            <div><dt>Trend risk</dt><dd>{valuation.confidence === 'Low' ? 'High' : 'Medium'}</dd></div>
          </dl>
        </section>

        <section style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
          <div className="trading-ticker-head">
            <div>
              <span>Evidence map</span>
              <h2>What the model reads</h2>
            </div>
            <em>{valuation.summary ? `${valuation.summary.resolvedSymbol} · ${valuation.summary.status}` : 'DefeatBeta + providers'}</em>
          </div>
          <dl className="trading-profile-facts trading-analytics-evidence">
            {valuation.evidence.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        </section>

        <section style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
          <div className="trading-ticker-head">
            <div>
              <span>Risk sensitivity</span>
              <h2>Assumptions that matter <Explainer id="sensitivity" /></h2>
            </div>
            <em>Bear/base/bull</em>
          </div>
          <SensitivityBands rows={valuation.sensitivity} currency={currency} />
          <p className="trading-analytics-note">The final range should always show which variable changed the answer most: WACC, margin/cash conversion, revenue growth, or multiple compression. <Explainer id="sensitivity" /></p>
        </section>
      </div>

      <section className="trading-analytics-milou" style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
        <div className="trading-analytics-milou-copy">
          <div className="trading-section-label">Milou analysis panel</div>
          <h2>Ask the stock expert inside the context of this valuation.</h2>
          <p>
            Milou receives the selected ticker, valuation assumptions, DefeatBeta summary, benchmark context, and generated thesis. She answers against the evidence, not from a blank chat box.
          </p>
        </div>
        <div className="trading-analytics-chat-panel">
          <div className="trading-analytics-chat-message expert">
            <span>Milou</span>
            <p>{valuationReady && selected ? `${selected.name} has a first-pass valuation pack. I would challenge the revenue-growth path and WACC before treating the range as investable.` : 'Validate a ticker and generate a Quick Valuation, then I can challenge the assumptions in context.'}</p>
          </div>
          <div className="trading-analytics-prompt-grid">
            {milouPrompts.map((prompt) => <button key={prompt} type="button">{prompt}</button>)}
          </div>
        </div>
      </section>
    </div>
  );
}
