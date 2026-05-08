'use client';

import { useEffect, useId, useState } from 'react';
import { MiniLineChart, tradingCardStyle } from '@/components/pages/trading/shared';
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
type TickerMetadata = { symbol: string; name: string; logoUrl: string | null; logoAlt: string };

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

const emptyMethods: ValuationModel[] = [
  { name: 'DCF base case', range: '—', weight: '—', note: 'Select a ticker to load assumptions' },
  { name: 'Multiples check', range: '—', weight: '—', note: 'Select a ticker to load ratios' },
  { name: 'Reverse DCF', range: '—', weight: '—', note: 'Select a ticker to compare price and fundamentals' },
  { name: 'Quality adjustment', range: '—', weight: '—', note: 'Select a ticker to load ROE/ROIC context' },
];

const emptyEvidence: Array<[string, string]> = [
  ['Coverage', 'Select a ticker to load source coverage'],
  ['Ratios', '—'],
  ['Statements', '—'],
  ['Quality & events', '—'],
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
  decisionZone: 'Decision zone is a model interpretation, not advice.',
  sensitivity: 'Read the bars like this: wider bar means that assumption can move fair value more. The marker shows the current base estimate.',
};

function Explainer({ id, text }: { id: keyof typeof explainers; text?: string }) {
  const label = text ?? explainers[id];
  return <span className="trading-analytics-explainer" title={label} aria-label={label}>?</span>;
}

function decisionZoneExplainerText(zone: string) {
  switch (zone) {
    case 'Needs analytics data':
      return 'Needs analytics data: coverage is missing, so this read is incomplete. Wait for statements, ratios, and quality coverage.';
    case 'Needs quote':
      return 'Needs quote: valuation exists but there is no current price anchor, so upside/downside cannot be computed yet.';
    case 'Undervalued watch':
      return 'Undervalued watch: base fair value sits above current price. Watch setup quality and wait for confirmation before acting.';
    case 'Overvalued':
      return 'Overvalued: base fair value sits below current price. Treat this as downside risk context, not a trade signal.';
    case 'Watch / Buy weakness':
      return 'Watch / Buy weakness: price is near model fair value. Favor patience and add only on better risk/reward entries.';
    default:
      return 'Decision zone is unavailable or still loading. It updates when valuation and quote inputs are present.';
  }
}

function formatCurrency(value: number | null | undefined, currency = 'USD') {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value);
}

function formatPercent(value: number | null | undefined, options: { signed?: boolean; decimals?: number } = {}) {
  if (value == null || !Number.isFinite(value)) return '—';
  const decimals = options.decimals ?? 1;
  const prefix = options.signed && value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(decimals)}%`;
}

function analysisStatusPill(status: QuickValuation['status']) {
  if (status === 'generating' || status === 'validating') return { label: 'Analyzing', state: 'running' };
  if (status === 'ready') return { label: 'Ready', state: 'ready' };
  if (status === 'unavailable' || status === 'error') return { label: 'Unavailable', state: 'unavailable' };
  return { label: 'Idle', state: 'idle' };
}

function AnalyticsTabRow({ active, onSelect, status }: { active: 'quick' | 'full'; onSelect: (tab: 'quick' | 'full') => void; status: QuickValuation['status'] }) {
  return (
    <div className="trading-tab-row" role="tablist" aria-label="Analytics sections">
      {tabs.map((tab) => {
        const target = tab === 'Milou' ? 'full' : 'quick';
        const isActive = active === target && (target === 'full' ? tab === 'Milou' : tab === 'Valuation');
        return (
          <button key={tab} type="button" className={isActive ? 'active' : ''} role="tab" aria-selected={isActive} onClick={() => onSelect(target)}>
            {tab}
          </button>
        );
      })}
      <div className="trading-tab-row-trailing">
        <span className="trading-analytics-tab-status" data-state={analysisStatusPill(status).state}>{active === 'full' ? 'Thesis draft' : analysisStatusPill(status).label}</span>
      </div>
    </div>
  );
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

function initialsForSelection(selection: SearchResult | null) {
  return (selection?.code || selection?.symbol || '•').replace(/\W/g, '').slice(0, 2) || '•';
}

function CompanyLogo({ selection, metadata }: { selection: SearchResult | null; metadata: TickerMetadata | null }) {
  const logoUrl = metadata?.logoUrl ?? null;
  const alt = metadata?.logoAlt ?? `${selection?.name ?? selection?.symbol ?? 'Company'} logo`;
  return (
    <span className={`trading-analytics-company-logo ${logoUrl ? 'has-logo' : 'initials-only'}`} aria-hidden={logoUrl ? undefined : true}>
      {logoUrl ? <img src={logoUrl} alt={alt} loading="lazy" decoding="async" /> : <span>{initialsForSelection(selection)}</span>}
    </span>
  );
}

function valuePoints(valuation: QuickValuation) {
  if (valuation.status === 'idle' || valuation.status === 'validated') return [];
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
  const isEmpty = valuation.status === 'idle' || valuation.status === 'validated' || low == null || base == null || high == null;
  if (isEmpty) {
    return (
      <div className="trading-analytics-corridor is-empty" aria-label="Fair value corridor placeholder">
        <div className="trading-analytics-corridor-track" />
        <div className="trading-analytics-corridor-empty">Select a ticker to generate the fair-value corridor.</div>
      </div>
    );
  }
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
        const factorSlug = row.factor.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return (
          <div key={row.factor} className="trading-analytics-sensitivity-row" data-factor={factorSlug}>
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
  message: 'Choose a ticker result, then generate Quick Analysis.',
  selected: null,
  summary: null,
  fairLow: null,
  fairHigh: null,
  baseValue: null,
  currentPrice: null,
  impliedUpside: null,
  confidence: 'Low',
  decisionZone: '—',
  methods: emptyMethods,
  submodels: [],
  sensitivity: [],
  evidence: emptyEvidence,
  valuationSeries: [],
  benchmarkSeries: [],
  riskSeries: [],
};

export function AnalyticsWorkbenchClient() {
  const [query, setQuery] = useState('');
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'quick' | 'full'>('quick');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [valuation, setValuation] = useState<QuickValuation>(initialValuation);
  const [selectedMetadata, setSelectedMetadata] = useState<TickerMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchResultsId = useId();
  const trimmedQuery = query.trim();
  const selected = valuation.selected ?? null;
  const currency = selected?.currency && selected.currency !== '—' ? selected.currency : 'USD';
  const selectedResult = searchResults[Math.min(activeResultIndex, Math.max(searchResults.length - 1, 0))];
  const showSearchPanel = searchOpen && Boolean(trimmedQuery) && (searchLoading || searchError || searchResults.length > 0);
  const valuationReady = valuation.status === 'ready';
  const hasAnalysis = valuation.status === 'ready' || valuation.status === 'unavailable' || valuation.status === 'error';

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

  useEffect(() => {
    if (!selected?.symbol) {
      setSelectedMetadata(null);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/trading/watchlist-metadata?symbols=${encodeURIComponent(selected.symbol)}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { items?: TickerMetadata[] } | null) => {
        if (!controller.signal.aborted) setSelectedMetadata(payload?.items?.[0] ?? null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSelectedMetadata(null);
      });
    return () => controller.abort();
  }, [selected?.symbol]);

  function selectTicker(result: SearchResult) {
    setQuery(result.symbol);
    setSearchOpen(false);
    setSearchResults([]);
    setSearchError(null);
    setActiveResultIndex(0);
    setError(null);
    setSelectedMetadata(null);
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

  function openFullThesis() {
    setActiveAnalysisTab('full');
  }

  async function generateQuickValuation() {
    setActiveAnalysisTab('quick');
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
          <div className="trading-section-label">Analytics</div>
          <h2>Read between the rows.</h2>
          <p>
            Generate a quick analysis or full thesis to get proper valuations and insights. Chat with stock expert Milou to get the answers to all your questions.
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
                  setSelectedMetadata(null);
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
          <div className="trading-analytics-action-group" aria-label="Analysis actions">
            <button type="submit" disabled={valuation.status === 'validating' || valuation.status === 'generating'}>Quick analysis</button>
            <button type="button" className="secondary" onClick={openFullThesis}>Full thesis</button>
          </div>
        </form>
        <div className="trading-analytics-validation" data-state={valuation.status}>
          <CompanyLogo selection={selected} metadata={selectedMetadata} />
          <strong>{selected?.name ?? 'No company selected'}</strong>
          {!selected ? <em>{valuation.message}</em> : null}
          {valuation.status === 'unavailable' ? <small>Analytics data unavailable for this ticker.</small> : null}
          {error ? <small>{error}</small> : null}
        </div>
      </section>

      <AnalyticsTabRow active={activeAnalysisTab} onSelect={setActiveAnalysisTab} status={valuation.status} />

      {activeAnalysisTab === 'full' ? (
        <section className="trading-analytics-full-thesis" style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
          <div>
            <div className="trading-section-label">Full thesis</div>
            <h2>Thesis workspace placeholder.</h2>
            <p>Later this tab will turn the selected ticker, valuation assumptions, evidence map, risks, and Milou context into a structured investment thesis.</p>
          </div>
          <dl className="trading-profile-facts trading-analytics-thesis-outline">
            <div><dt>Company</dt><dd>{selected?.name ?? 'Select a ticker first'}</dd></div>
            <div><dt>Inputs</dt><dd>Quick valuation · evidence map · assumptions · risks</dd></div>
            <div><dt>Output</dt><dd>Business quality, valuation argument, risks, watch triggers</dd></div>
            <div><dt>Status</dt><dd>Placeholder only · generation not wired yet</dd></div>
          </dl>
        </section>
      ) : (
      <>
      <section className="trading-analytics-hero" style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
        <div className="trading-analytics-verdict">
          <div className="trading-section-label">Valuation verdict</div>
          <div className="trading-analytics-base-case">
            <span>Base case</span>
            <strong>{formatCurrency(valuation.baseValue, currency)}</strong>
          </div>
          <div className="trading-analytics-verdict-row">
            <span>Current price</span><strong>{formatCurrency(valuation.currentPrice, currency)}</strong>
            <span>Implied upside</span><strong className={(valuation.impliedUpside ?? 0) >= 0 ? 'positive' : 'negative'}>{formatPercent(valuation.impliedUpside, { signed: true })}</strong>
            <span>Decision zone</span><strong className="trading-analytics-decision-chip">{valuation.decisionZone}<Explainer id="decisionZone" text={decisionZoneExplainerText(valuation.decisionZone)} /></strong>
          </div>
          <p className="trading-analytics-verdict-meta">{hasAnalysis ? `12 – 24 month horizon · ${valuation.confidence} confidence` : 'Select a ticker to generate valuation context'}</p>
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
            </div>
          </div>
          <dl className="trading-analytics-methods">
            {valuation.methods.map((method) => (
              <div key={method.name}>
                <dt><div className="trading-analytics-method-title"><span>{method.name}</span>{method.key ? <Explainer id={method.key as keyof typeof explainers} /> : null}</div><span>{method.note}</span>{valuation.submodels?.find((model) => model.key === method.key)?.driver ? <small>{valuation.submodels.find((model) => model.key === method.key)?.driver}</small> : null}</dt>
                <dd><strong>{method.range}</strong><em>{method.weight}</em></dd>
              </div>
            ))}
          </dl>
        </section>

        <section style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
          <div className="trading-ticker-head">
            <div>
              <span>Market comparison</span>
            </div>
          </div>
          {valuation.benchmarkSeries.length ? <MiniLineChart values={valuation.benchmarkSeries} /> : <div className="trading-analytics-empty-chart">Needs benchmark price series (for example SPY/QQQ and sector ETF) to render true relative performance overlays.</div>}
          <dl className="trading-ticker-chart-stats">
            <div><dt>Vs QQQ</dt><dd>{hasAnalysis ? 'Needs benchmark series' : '—'}</dd></div>
            <div><dt>Vs SPY</dt><dd>{hasAnalysis ? 'Needs benchmark series' : '—'}</dd></div>
            <div><dt>Overlay status</dt><dd>{valuation.summary?.coverage.prices ? 'Price history available' : 'Missing price history'}</dd></div>
            <div><dt>Trend risk</dt><dd>{hasAnalysis ? (valuation.confidence === 'Low' ? 'Higher uncertainty' : 'Moderate uncertainty') : '—'}</dd></div>
          </dl>
        </section>

        <section style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
          <div className="trading-ticker-head">
            <div>
              <span>Evidence map</span>
            </div>
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
            </div>
          </div>
          <SensitivityBands rows={valuation.sensitivity} currency={currency} />
          <p className="trading-analytics-note">How to read this: a wider bar means that assumption can move fair value more. The marker is the current base estimate. <Explainer id="sensitivity" /></p>
        </section>
      </div>

      <section className="trading-finance-glossary" style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
        <div className="trading-section-label">Finance glossary</div>
        <dl className="trading-glossary-grid">
          <div><dt>P/E</dt><dd>Price-to-earnings. How much the market pays for each dollar of earnings.</dd></div>
          <div><dt>P/S</dt><dd>Price-to-sales. Useful when profits are volatile but revenue is more stable.</dd></div>
          <div><dt>P/B</dt><dd>Price-to-book. Compares market value with net assets on the balance sheet.</dd></div>
          <div><dt>ROIC</dt><dd>Return on invested capital. Measures how efficiently capital turns into profit.</dd></div>
          <div><dt>WACC</dt><dd>Weighted average cost of capital. The hurdle rate used to discount future cash flows.</dd></div>
          <div><dt>DCF</dt><dd>Discounted cash flow. Values a business from expected future cash generation.</dd></div>
          <div><dt>Reverse DCF</dt><dd>Starts from today&apos;s price and solves for the growth expectations implied by that price.</dd></div>
          <div><dt>FCF</dt><dd>Free cash flow. Cash left after operating costs and capital spending.</dd></div>
          <div><dt>Fair-value corridor</dt><dd>Bear/base/bull range from model uncertainty, not a guaranteed price target.</dd></div>
          <div><dt>Decision zone</dt><dd>A model read of valuation context, used for watchlist discipline, not financial advice.</dd></div>
        </dl>
      </section>

      </>
      )}

      <section className="trading-analytics-milou" style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
        <div className="trading-analytics-milou-copy">
          <div className="trading-section-label">Milou analysis</div>
          <h2>Ask the stock expert</h2>
          <p>
            Milou can answer all your questions and provide additional insights in the provided analysis. She answers against the evidence provided or can access the web for additional information.
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
