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
type DefeatBetaRouteResult = { ok: boolean; status?: string; reason?: string; summary: DefeatBetaAnalyticsSummary };

type ValuationModel = { name: string; range: string; weight: string; note: string; low?: number; high?: number };
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
  evidence: Array<[string, string]>;
  valuationSeries: number[];
  benchmarkSeries: number[];
  riskSeries: number[];
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

function latestValue(points?: Array<{ value: number }>) {
  return points?.find((point) => Number.isFinite(point.value))?.value ?? null;
}

function trendCagr(points?: Array<{ value: number }>) {
  const usable = (points ?? []).filter((point) => Number.isFinite(point.value) && point.value > 0);
  if (usable.length < 2) return null;
  const latest = usable[0].value;
  const earliest = usable.at(-1)?.value;
  if (!earliest) return null;
  return (Math.pow(latest / earliest, 1 / Math.max(usable.length - 1, 1)) - 1) * 100;
}

function statementMetric(summary: DefeatBetaAnalyticsSummary, metric: string) {
  return summary.statements.annualIncome.find((item) => item.metric === metric)?.points ?? [];
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

function chartSeriesFromRange(low: number | null, base: number | null, high: number | null, current: number | null) {
  if (low == null || base == null || high == null) return fallbackValuationSeries;
  const spot = current ?? base;
  return [spot * 0.92, spot * 0.97, low, (low + base) / 2, base, (base + high) / 2, high].map((value) => Math.max(value, 1));
}

function buildQuickValuation(selected: SearchResult, result: DefeatBetaRouteResult): QuickValuation {
  const summary = result.summary;
  const currency = selected.currency && selected.currency !== '—' ? selected.currency : 'USD';
  const currentPrice = selected.previousClose ?? null;
  const pe = latestValue(summary.ratios.pe);
  const ps = latestValue(summary.ratios.ps);
  const pb = latestValue(summary.ratios.pb);
  const wacc = latestValue(summary.ratios.wacc);
  const roe = latestValue(summary.quality.roe);
  const roic = latestValue(summary.quality.roic);
  const revenueCagr = trendCagr(statementMetric(summary, 'Total Revenue'));
  const netIncomeCagr = trendCagr(statementMetric(summary, 'Net Income Common Stockholders'));

  const qualityScore = [roe, roic].filter((value): value is number => value != null).reduce((sum, value) => sum + value, 0) / Math.max([roe, roic].filter((value) => value != null).length, 1);
  const growthScore = [revenueCagr, netIncomeCagr].filter((value): value is number => value != null).reduce((sum, value) => sum + value, 0) / Math.max([revenueCagr, netIncomeCagr].filter((value) => value != null).length, 1);
  const riskPenalty = wacc != null ? Math.min(Math.max(wacc * 100 - 8, -3), 8) : 2;
  const modelAnchor = currentPrice ?? 100;
  const growthAdjustment = Math.min(Math.max(growthScore / 100, -0.12), 0.22);
  const qualityAdjustment = Math.min(Math.max(qualityScore / 100, -0.08), 0.18);
  const valuationAdjustment = Math.min(Math.max(((pe ?? 22) - 22) / 220, -0.12), 0.1);
  const baseValue = modelAnchor * (1 + growthAdjustment + qualityAdjustment - riskPenalty / 100 - valuationAdjustment);
  const spread = Math.max(0.14, 0.28 - Math.min(Math.max((summary.coverage.statements ? 0.05 : 0) + (summary.coverage.ratios ? 0.04 : 0) + (summary.coverage.quality ? 0.04 : 0), 0), 0.12));
  const fairLow = baseValue * (1 - spread);
  const fairHigh = baseValue * (1 + spread);
  const impliedUpside = currentPrice ? ((baseValue - currentPrice) / currentPrice) * 100 : null;
  const confidence = summary.coverage.statements && summary.coverage.ratios && summary.coverage.quality ? 'Medium' : 'Low';
  const decisionZone = impliedUpside == null ? 'Needs quote' : impliedUpside > 15 ? 'Undervalued watch' : impliedUpside < -10 ? 'Overvalued' : 'Watch / Buy weakness';

  return {
    status: result.ok ? 'ready' : 'unavailable',
    message: result.ok ? `Quick valuation generated from DefeatBeta ${summary.resolvedSymbol}.` : (result.reason || summary.notes[0] || 'DefeatBeta coverage unavailable.'),
    selected,
    summary,
    fairLow,
    fairHigh,
    baseValue,
    currentPrice,
    impliedUpside,
    confidence,
    decisionZone,
    methods: [
      { name: 'DCF proxy', range: `${formatCurrency(fairLow, currency)}-${formatCurrency(fairHigh, currency)}`, weight: '40%', note: `WACC ${wacc != null ? formatPercent(wacc * 100, { decimals: 1 }) : 'pending'}, FCF/growth proxy from statements`, low: fairLow, high: fairHigh },
      { name: 'Multiples check', range: pe != null ? `${pe.toFixed(1)}x PE` : 'Pending', weight: '25%', note: `PS ${ps != null ? ps.toFixed(1) : '—'} · PB ${pb != null ? pb.toFixed(1) : '—'}` },
      { name: 'Reverse DCF', range: currentPrice ? formatCurrency(currentPrice, currency) : 'Needs quote', weight: '20%', note: 'Uses current price as the market-implied anchor for the next hardening pass' },
      { name: 'Quality adjustment', range: `${formatPercent(qualityAdjustment * 100, { signed: true })}`, weight: '15%', note: `ROE ${roe != null ? formatPercent(roe * 100) : '—'} · ROIC ${roic != null ? formatPercent(roic * 100) : '—'}` },
    ],
    evidence: [
      ['Revenue trend', revenueCagr != null ? `${formatPercent(revenueCagr, { signed: true })} annualized across available annual points` : 'Annual revenue trend unavailable'],
      ['Net income trend', netIncomeCagr != null ? `${formatPercent(netIncomeCagr, { signed: true })} annualized across available annual points` : 'Net income trend unavailable'],
      ['Capital quality', `ROE ${roe != null ? formatPercent(roe * 100) : '—'} · ROIC ${roic != null ? formatPercent(roic * 100) : '—'} · WACC ${wacc != null ? formatPercent(wacc * 100) : '—'}`],
      ['Coverage', Object.entries(summary.coverage).filter(([, value]) => value).map(([key]) => key).join(', ') || 'Unavailable'],
    ],
    valuationSeries: chartSeriesFromRange(fairLow, baseValue, fairHigh, currentPrice),
    benchmarkSeries: summary.ratios.pe.map((point) => point.value).slice(0, 12).reverse().map((value) => Math.max(value, 1)).concat(fallbackBenchmarkSeries).slice(0, 12),
    riskSeries: summary.ratios.wacc.map((point) => point.value * 1000).slice(0, 12).reverse().map((value) => Math.max(value, 1)).concat(fallbackRiskSeries).slice(0, 12),
  };
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
  const valuationReady = valuation.status === 'ready' || valuation.status === 'unavailable';

  const verdictLabel = useMemo(() => {
    if (valuation.status === 'generating') return 'Generating…';
    if (valuation.status === 'unavailable') return 'Unavailable';
    if (valuation.status === 'ready') return `${formatCurrency(valuation.fairLow, currency)}-${formatCurrency(valuation.fairHigh, currency)}`;
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
    setValuation((current) => ({ ...current, status: 'generating', selected: match, message: `Generating Quick Valuation for ${match.symbol}…` }));
    try {
      const defeatBetaSymbol = exchangeSymbolForDefeatBeta(match.symbol);
      const response = await fetch(`/api/trading/defeatbeta/${encodeURIComponent(defeatBetaSymbol)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`DefeatBeta route returned HTTP ${response.status}`);
      const payload = (await response.json()) as DefeatBetaRouteResult;
      setValuation(buildQuickValuation(match, payload));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Quick Valuation failed.';
      setError(message);
      setValuation((current) => ({ ...current, status: 'error', message }));
    }
  }

  return (
    <div className="trading-analytics-workbench">
      <section className="trading-analytics-command" style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
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
                  setValuation((current) => ({ ...current, selected: null }));
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

      <TabScaffold tabs={tabs} />

      <section className="trading-analytics-hero" style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
        <div className="trading-analytics-verdict">
          <div className="trading-section-label">Valuation verdict</div>
          <h2>{verdictLabel}</h2>
          <p>Base case: <strong>{formatCurrency(valuation.baseValue, currency)}</strong> · 12-24 month horizon · confidence {valuation.confidence.toLowerCase()}</p>
          <div className="trading-analytics-verdict-row">
            <span>Current price</span><strong>{formatCurrency(valuation.currentPrice, currency)}</strong>
            <span>Implied upside</span><strong className={(valuation.impliedUpside ?? 0) >= 0 ? 'positive' : 'negative'}>{formatPercent(valuation.impliedUpside, { signed: true })}</strong>
            <span>Decision zone</span><strong>{valuation.decisionZone}</strong>
          </div>
          <p className="trading-analytics-status-copy">{valuation.message}</p>
        </div>
        <div className="trading-analytics-chart-panel">
          <div className="trading-ticker-chart-head">
            <div>
              <div className="trading-section-label">Fair value corridor</div>
              <h3>{valuationReady ? 'Quick model generated. Next hardening pass improves DCF assumptions.' : 'Base case sits above spot, but the margin is assumption-sensitive.'}</h3>
            </div>
            <div className="trading-ticker-range-tabs" role="tablist" aria-label="Analysis ranges">
              {['Bear', 'Base', 'Bull'].map((range, index) => (
                <button key={range} type="button" className={index === 1 ? 'active' : ''}>{range}</button>
              ))}
            </div>
          </div>
          <MiniLineChart values={valuation.valuationSeries} />
          <div className="trading-ticker-chart-axis"><span>DCF</span><span>Multiples</span><span>Reverse DCF</span><span>Quality</span><span>Blend</span><span>Risk</span><span>Verdict</span></div>
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
                <dt>{method.name}<span>{method.note}</span></dt>
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
            <div><dt>Momentum</dt><dd>{valuation.summary?.coverage.prices ? 'Provider-backed' : 'Pending'}</dd></div>
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
              <h2>Assumptions that matter</h2>
            </div>
            <em>Bear/base/bull</em>
          </div>
          <MiniLineChart values={valuation.riskSeries} />
          <p className="trading-analytics-note">The final range should always show which variable changed the answer most: WACC, terminal margin, revenue growth, or multiple compression.</p>
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
