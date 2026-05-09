'use client';

import { Fragment, useEffect, useId, useState } from 'react';
import { tradingCardStyle } from '@/components/pages/trading/shared';
import type { DefeatBetaAnalyticsSummary } from '@/lib/trading/sources/defeatbeta';

type SearchResult = {
  symbol: string;
  code: string;
  exchange: string;
  name: string;
  type: string;
  sector?: string | null;
  industry?: string | null;
  country: string;
  currency: string;
  previousClose: number | null;
  previousCloseDate: string | null;
  isPrimary: boolean;
};

type SearchResponse = { query: string; results: SearchResult[] };
type QuickValuationRouteResult = { ok: boolean; valuation: QuickValuation };
type TickerMetadata = { symbol: string; name: string; logoUrl: string | null; logoAlt: string };

type BenchmarkSeriesKey = 'selected' | 'spy' | 'qqq';
type BenchmarkComparisonSeries = {
  key: BenchmarkSeriesKey;
  label: string;
  symbol: string;
  returnPct: number | null;
  points: Array<{ date: string; value: number }>;
};
type BenchmarkComparison = {
  ok: boolean;
  range: string;
  source: 'yfinance';
  asOf: string;
  selectedSymbol: string;
  resolvedSymbol: string;
  attemptedSymbols: string[];
  benchmarks: string[];
  series: BenchmarkComparisonSeries[];
  stats: {
    selectedReturnPct: number | null;
    spyReturnPct: number | null;
    qqqReturnPct: number | null;
    vsSpyPct: number | null;
    vsQqqPct: number | null;
  };
  missing: string[];
  note: string;
};
type BenchmarkComparisonRouteResult = { ok: boolean; comparison: BenchmarkComparison };
type BenchmarkState = {
  status: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
  message: string;
  comparison: BenchmarkComparison | null;
};

type MilouState = {
  status: 'idle' | 'sending' | 'ready' | 'error';
  message: string;
  answer: string | null;
};
type FullThesisEvidenceRouteResult = {
  ok: boolean;
  symbol: string;
  asOf: string;
  modules: {
    transcripts: {
      status: 'available' | 'unavailable' | 'error';
      latest: { fiscalYear: number | null; fiscalQuarter: number | null; reportDate?: string | null; paragraphCount: number; sampleSpeakers: string[] } | null;
      recent: Array<{ fiscalYear: number | null; fiscalQuarter: number | null; reportDate?: string | null; paragraphCount: number }>;
      coverage: { transcripts: boolean; llmConfigured: boolean };
      llmAnalysis: { status: string; note: string; availableMethods: string[] };
      notes: string[];
    };
    economy: {
      status: 'available' | 'unavailable' | 'error';
      sp500: { latestAnnualReturn: { date?: string | null; annualReturn: number | null } | null; cagr10Year: number | null };
      yieldCurve: { date?: string | null; bc3Month: number | null; bc2Year: number | null; bc10Year: number | null; bc30Year: number | null; twoTenSpread?: number | null } | null;
      notes: string[];
    };
    llmKeyData: { status: string; label: string; note: string; analysis?: string | null };
    llmMetricChanges: { status: string; label: string; note: string; analysis?: string | null };
    llmForecastDrivers: { status: string; label: string; note: string; analysis?: string | null };
  };
  error?: string;
};
type FullThesisState = {
  status: 'idle' | 'loading-evidence' | 'generating' | 'ready' | 'error';
  message: string;
  thesis: string | null;
  evidence: FullThesisEvidenceRouteResult | null;
  sessionKey?: string;
};
type MilouRichSegment = { kind: 'text' | 'bold' | 'italic'; text: string };
type MilouRichBlock = { kind: 'paragraph' | 'bullet' | 'numbered'; index?: string; segments: MilouRichSegment[] };

type MilouAnalysisRouteResult = {
  ok: boolean;
  sessionKey?: string;
  answer?: string;
  error?: string;
};
type FullThesisRouteResult = {
  ok: boolean;
  sessionKey?: string;
  thesis?: string;
  error?: string;
};
type FullThesisExtractionRouteResult = {
  ok: boolean;
  kind: 'key-data' | 'metric-changes' | 'forecast-drivers';
  analysis?: string;
  error?: string;
};

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

const defaultMilouPrompts = [
  'Challenge the bull case',
  'What assumption moves fair value most?',
  'Explain this DCF simply',
  'Compare this against QQQ/SPY',
];

function promptContextForSelection(selected: SearchResult | null) {
  const context = [selected?.sector, selected?.industry, selected?.type, selected?.name].filter(Boolean).join(' ').toLowerCase();
  if (!context.trim()) return 'default';
  if (/etf|fund|trust|index|ucits/.test(context)) return 'fund';
  if (/semiconductor|chip|foundry|equipment|software|cloud|technology|internet|ai|digital/.test(context)) return 'technology';
  if (/bank|insurance|broker|financial|asset manager|capital market|fintech/.test(context)) return 'financials';
  if (/pharma|biotech|health|medical|drug|therapeutic|hospital/.test(context)) return 'healthcare';
  if (/energy|oil|gas|renewable|utility|utilities|power/.test(context)) return 'energy';
  if (/retail|consumer|restaurant|apparel|luxury|auto|travel|discretionary|staples/.test(context)) return 'consumer';
  if (/industrial|aerospace|defense|machinery|logistics|transport|construction/.test(context)) return 'industrial';
  return 'default';
}

function milouPromptsForSelection(selected: SearchResult | null) {
  switch (promptContextForSelection(selected)) {
    case 'fund':
      return ['What drives this ETF versus SPY/QQQ?', 'Where can tracking or currency risk show up?', 'What holdings risk matters most?', 'Is this fund useful for portfolio balance?'];
    case 'technology':
      return ['Is growth already priced in?', 'Which margin assumption matters most?', 'Challenge the moat durability', 'Compare this against QQQ/SPY'];
    case 'financials':
      return ['What does the market doubt here?', 'Check rate and credit sensitivity', 'Challenge the capital return story', 'Which metric fits this business best?'];
    case 'healthcare':
      return ['What pipeline or patent risk matters?', 'Challenge the earnings quality', 'Which catalyst could change fair value?', 'Explain the downside case simply'];
    case 'energy':
      return ['How sensitive is this to commodity prices?', 'Challenge the cash-flow durability', 'What balance-sheet risk matters?', 'Compare this against the market cycle'];
    case 'consumer':
      return ['What demand risk matters most?', 'Challenge pricing power', 'Which margin assumption moves value?', 'What would prove the bull case wrong?'];
    case 'industrial':
      return ['Where is cycle risk hiding?', 'Challenge backlog and margin durability', 'What assumption moves fair value most?', 'Compare this against SPY/QQQ'];
    default:
      return defaultMilouPrompts;
  }
}

const initialMilou: MilouState = {
  status: 'idle',
  message: 'Generate Quick Analysis, then ask Milou to challenge it in context.',
  answer: null,
};

const initialFullThesis: FullThesisState = {
  status: 'idle',
  message: 'Generate Quick Analysis first, then load transcript and economy evidence for the Full Thesis.',
  thesis: null,
  evidence: null,
};

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

function formatBenchmarkDate(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(parsed);
}

function formatIndexedValue(value: number) {
  return value.toFixed(0);
}

function parseInlineMarkdown(input: string): MilouRichSegment[] {
  const segments: MilouRichSegment[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let cursor = 0;
  for (const match of input.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ kind: 'text', text: input.slice(cursor, start) });
    const token = match[0];
    if (token.startsWith('**')) {
      segments.push({ kind: 'bold', text: token.slice(2, -2) });
    } else {
      segments.push({ kind: 'italic', text: token.slice(1, -1) });
    }
    cursor = start + token.length;
  }
  if (cursor < input.length) segments.push({ kind: 'text', text: input.slice(cursor) });
  return segments.length ? segments : [{ kind: 'text', text: input }];
}

function parseMilouMarkdown(input: string | null): MilouRichBlock[] {
  if (!input?.trim()) return [];
  const blocks: MilouRichBlock[] = [];
  for (const rawLine of input.split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const bullet = line.match(/^[-•]\s+(.+)$/);
    if (bullet) {
      blocks.push({ kind: 'bullet', segments: parseInlineMarkdown(bullet[1]) });
      continue;
    }
    const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      blocks.push({ kind: 'numbered', index: numbered[1], segments: parseInlineMarkdown(numbered[2]) });
      continue;
    }
    blocks.push({ kind: 'paragraph', segments: parseInlineMarkdown(line) });
  }
  return blocks;
}

function MilouMarkdown({ text }: { text: string | null }) {
  const blocks = parseMilouMarkdown(text);
  if (!blocks.length) return null;
  return (
    <div className="trading-analytics-milou-answer">
      {blocks.map((block, blockIndex) => (
        <p key={`${block.kind}-${blockIndex}`} data-kind={block.kind}>
          {block.kind === 'bullet' ? <span className="trading-analytics-milou-marker">•</span> : null}
          {block.kind === 'numbered' ? <span className="trading-analytics-milou-marker">{block.index}.</span> : null}
          <span>
            {block.segments.map((segment, segmentIndex) => (
              <Fragment key={`${segment.kind}-${segmentIndex}`}>
                {segment.kind === 'bold' ? <strong>{segment.text}</strong> : null}
                {segment.kind === 'italic' ? <em>{segment.text}</em> : null}
                {segment.kind === 'text' ? segment.text : null}
              </Fragment>
            ))}
          </span>
        </p>
      ))}
    </div>
  );
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

function BenchmarkOverlayChart({ comparison }: { comparison: BenchmarkComparison }) {
  const width = 720;
  const height = 220;
  const plotTop = 18;
  const plotBottom = 34;
  const plotHeight = height - plotTop - plotBottom;
  const colors: Record<BenchmarkSeriesKey, string> = {
    selected: '#17241e',
    spy: '#16B45F',
    qqq: '#B56A3A',
  };
  const usableSeries = comparison.series.filter((series) => series.points.length >= 2);
  const values = usableSeries.flatMap((series) => series.points.map((point) => point.value));
  const min = Math.min(...values, 100);
  const max = Math.max(...values, 100);
  const span = Math.max(max - min, 1);
  const maxPoints = Math.max(...usableSeries.map((series) => series.points.length), 1);
  const axisValues = [max, (max + min) / 2, min];
  const firstDate = usableSeries[0]?.points[0]?.date;
  const lastDate = usableSeries[0]?.points.at(-1)?.date;
  const pathFor = (series: BenchmarkComparisonSeries) => series.points
    .map((point, index) => {
      const x = 12 + (index / Math.max(maxPoints - 1, 1)) * (width - 44);
      const y = plotTop + (1 - (point.value - min) / span) * plotHeight;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="trading-analytics-benchmark-chart-shell">
      <div className="trading-analytics-benchmark-axis-title">Indexed performance · start = 100</div>
      <svg className="trading-mini-chart trading-analytics-benchmark-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Indexed benchmark comparison chart">
        {[0, 1, 2, 3].map((line) => {
          const y = plotTop + (line / 3) * plotHeight;
          return <line key={line} x1="12" y1={y} x2={width - 22} y2={y} stroke="rgba(28,37,32,0.08)" strokeWidth="1" />;
        })}
        <line x1="12" y1={plotTop + (1 - (100 - min) / span) * plotHeight} x2={width - 22} y2={plotTop + (1 - (100 - min) / span) * plotHeight} stroke="rgba(28,37,32,0.16)" strokeDasharray="4 5" />
        {usableSeries.map((series) => <path key={series.key} d={pathFor(series)} fill="none" stroke={colors[series.key]} strokeWidth={series.key === 'selected' ? 2.8 : 2} strokeLinecap="round" strokeLinejoin="round" />)}
        {axisValues.map((value, index) => <text key={`${value}-${index}`} x={width - 20} y={plotTop + (1 - (value - min) / span) * plotHeight + 4} textAnchor="end" fill="rgba(34,48,41,0.46)" fontSize="10">{formatIndexedValue(value)}</text>)}
        <text x="12" y={height - 12} fill="rgba(34,48,41,0.46)" fontSize="10">{formatBenchmarkDate(firstDate)}</text>
        <text x={width - 22} y={height - 12} textAnchor="end" fill="rgba(34,48,41,0.46)" fontSize="10">{formatBenchmarkDate(lastDate)}</text>
        <line x1="12" y1={height - plotBottom} x2={width - 22} y2={height - plotBottom} stroke="rgba(28,37,32,0.14)" />
      </svg>
      <div className="trading-analytics-benchmark-legend">
        {usableSeries.map((series) => <span key={series.key} data-series={series.key}><i />{series.label} {formatPercent(series.returnPct, { signed: true })}</span>)}
      </div>
      <p className="trading-analytics-benchmark-note">{comparison.note} Source: yfinance · Updated {formatBenchmarkDate(comparison.asOf)}</p>
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
  const [benchmark, setBenchmark] = useState<BenchmarkState>({ status: 'idle', message: 'Select a ticker to compare against SPY and QQQ.', comparison: null });
  const [milou, setMilou] = useState<MilouState>(initialMilou);
  const [fullThesis, setFullThesis] = useState<FullThesisState>(initialFullThesis);
  const [milouQuestion, setMilouQuestion] = useState('');
  const [milouUseWeb, setMilouUseWeb] = useState(false);
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
  const milouPrompts = milouPromptsForSelection(selected);

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
    setBenchmark({ status: 'idle', message: 'Run Quick analysis to compare this ticker against SPY and QQQ.', comparison: null });
    setMilou(initialMilou);
    setFullThesis(initialFullThesis);
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

  function milouContextPayload(question: string) {
    return {
      question,
      selected: selected ? {
        symbol: selected.symbol,
        name: selected.name,
        exchange: selected.exchange,
        country: selected.country,
        currency: selected.currency,
        type: selected.type,
        sector: selected.sector ?? null,
        industry: selected.industry ?? null,
      } : null,
      valuation: {
        status: valuation.status,
        message: valuation.message,
        decisionZone: valuation.decisionZone,
        confidence: valuation.confidence,
        baseValue: valuation.baseValue,
        fairLow: valuation.fairLow,
        fairHigh: valuation.fairHigh,
        currentPrice: valuation.currentPrice,
        impliedUpside: valuation.impliedUpside,
        evidence: valuation.evidence,
        sensitivity: valuation.sensitivity,
        methods: valuation.methods,
      },
      benchmark: benchmark.comparison ? {
        selectedSymbol: benchmark.comparison.selectedSymbol,
        resolvedSymbol: benchmark.comparison.resolvedSymbol,
        stats: benchmark.comparison.stats,
        note: benchmark.comparison.note,
      } : null,
      webAccessRequested: milouUseWeb || /web|news|latest|recent|current/i.test(question),
    };
  }

  function openFullThesis() {
    setActiveAnalysisTab('full');
  }

  async function loadFullThesisEvidence() {
    if (!selected) throw new Error('Select a ticker before loading Full Thesis evidence.');
    const response = await fetch('/api/trading/full-thesis/evidence', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ symbol: selected.symbol }),
    });
    const payload = (await response.json()) as FullThesisEvidenceRouteResult;
    if (!response.ok || !payload.ok) throw new Error(payload.error || `Full Thesis evidence route failed (${response.status})`);
    return payload;
  }

  async function runFullThesisExtraction(kind: FullThesisExtractionRouteResult['kind']) {
    if (!selected) throw new Error('Select a ticker before running Full Thesis extraction.');
    const response = await fetch('/api/trading/full-thesis/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ symbol: selected.symbol, companyName: selected.name, kind }),
    });
    const payload = (await response.json()) as FullThesisExtractionRouteResult;
    if (!response.ok || !payload.ok) throw new Error(payload.error || `Full Thesis extraction route failed (${response.status})`);
    return payload.analysis?.trim() || 'Milou finished extraction, but no analysis was returned to Analytics yet.';
  }

  async function generateFullThesis() {
    if (!valuationReady || !selected) {
      setFullThesis({ status: 'error', message: 'Generate Quick Analysis before drafting a Full Thesis.', thesis: null, evidence: fullThesis.evidence });
      return;
    }
    setActiveAnalysisTab('full');
    setFullThesis((current) => ({ ...current, status: 'loading-evidence', message: 'Loading transcript catalogue and economy context from DefeatBeta…', thesis: null }));
    try {
      const evidence = await loadFullThesisEvidence();
      let enrichedEvidence = evidence;
      if (evidence.modules.llmKeyData.status === 'ready-to-run') {
        setFullThesis({ status: 'generating', message: 'Milou is extracting key financial data from the latest DefeatBeta transcript…', thesis: null, evidence: enrichedEvidence });
        const keyData = await runFullThesisExtraction('key-data');
        enrichedEvidence = {
          ...enrichedEvidence,
          modules: {
            ...enrichedEvidence.modules,
            llmKeyData: { ...enrichedEvidence.modules.llmKeyData, status: 'ready', note: 'Milou/OpenClaw key-data extraction completed from DefeatBeta transcript detail.', analysis: keyData },
          },
        };
      }
      if (evidence.modules.transcripts.status === 'available') {
        setFullThesis({ status: 'generating', message: 'Milou is analyzing quarterly metric changes and stated causes from the transcript…', thesis: null, evidence: enrichedEvidence });
        const metricChanges = await runFullThesisExtraction('metric-changes');
        enrichedEvidence = {
          ...enrichedEvidence,
          modules: {
            ...enrichedEvidence.modules,
            llmMetricChanges: { ...enrichedEvidence.modules.llmMetricChanges, status: 'ready', note: 'Milou/OpenClaw metric-change extraction completed from DefeatBeta transcript detail.', analysis: metricChanges },
          },
        };
      }
      if (evidence.modules.transcripts.status === 'available') {
        setFullThesis({ status: 'generating', message: 'Milou is extracting forecast and guidance drivers from the transcript…', thesis: null, evidence: enrichedEvidence });
        const forecastDrivers = await runFullThesisExtraction('forecast-drivers');
        enrichedEvidence = {
          ...enrichedEvidence,
          modules: {
            ...enrichedEvidence.modules,
            llmForecastDrivers: { ...enrichedEvidence.modules.llmForecastDrivers, status: 'ready', note: 'Milou/OpenClaw forecast-driver extraction completed from DefeatBeta transcript detail.', analysis: forecastDrivers },
          },
        };
      }
      setFullThesis({ status: 'generating', message: 'Milou is drafting the Full Thesis from valuation, extracted transcript evidence, economy context, risks, and benchmarks…', thesis: null, evidence: enrichedEvidence });
      const response = await fetch('/api/trading/full-thesis', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          ...milouContextPayload('Generate a Full Thesis from this Analytics pack.'),
          priorMilouAnswer: milou.answer,
          evidencePack: enrichedEvidence.modules,
        }),
      });
      const payload = (await response.json()) as FullThesisRouteResult;
      if (!response.ok || !payload.ok) throw new Error(payload.error || `Full Thesis route failed (${response.status})`);
      setFullThesis({
        status: 'ready',
        message: payload.sessionKey ? `Full Thesis drafted by Milou in ${payload.sessionKey}.` : 'Full Thesis drafted by Milou.',
        thesis: payload.thesis?.trim() || 'Milou finished the run, but the Full Thesis was not returned to Analytics yet. Open the Milou session history if this repeats.',
        evidence: enrichedEvidence,
        sessionKey: payload.sessionKey,
      });
    } catch (cause) {
      setFullThesis((current) => ({ ...current, status: 'error', message: cause instanceof Error ? cause.message : 'Full Thesis generation failed.', thesis: null }));
    }
  }

  async function askMilou(question: string) {
    const trimmed = question.trim();
    if (!trimmed || !selected) return;
    setMilou({ status: 'sending', message: 'Milou is reading the valuation context…', answer: null });
    try {
      const response = await fetch('/api/trading/milou-analysis', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(milouContextPayload(trimmed)),
      });
      const payload = (await response.json()) as MilouAnalysisRouteResult;
      if (!response.ok || !payload.ok) throw new Error(payload.error || `Milou route failed (${response.status})`);
      setMilou({ status: 'ready', message: payload.sessionKey ? `Milou answered in ${payload.sessionKey}.` : 'Milou answered.', answer: payload.answer?.trim() || 'Milou finished the run, but the answer was not returned to Analytics yet. Open the Milou session history if this repeats.' });
    } catch (cause) {
      setMilou({ status: 'error', message: cause instanceof Error ? cause.message : 'Milou analysis failed.', answer: null });
    }
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
      setBenchmark({ status: 'loading', message: `Loading yfinance benchmark history for ${match.symbol}, SPY, and QQQ…`, comparison: null });
      try {
        const benchmarkResponse = await fetch('/api/trading/benchmark-comparison', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ symbol: match.symbol, range: '1y' }),
        });
        if (!benchmarkResponse.ok) throw new Error(`Benchmark route returned HTTP ${benchmarkResponse.status}`);
        const benchmarkPayload = (await benchmarkResponse.json()) as BenchmarkComparisonRouteResult;
        setBenchmark({
          status: benchmarkPayload.comparison.ok ? 'ready' : 'unavailable',
          message: benchmarkPayload.comparison.ok ? 'Benchmark comparison loaded from yfinance.' : benchmarkPayload.comparison.note,
          comparison: benchmarkPayload.comparison,
        });
      } catch (benchmarkError) {
        setBenchmark({ status: 'error', message: benchmarkError instanceof Error ? benchmarkError.message : 'Benchmark comparison failed.', comparison: null });
      }
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
                  setBenchmark({ status: 'idle', message: 'Select a ticker to compare against SPY and QQQ.', comparison: null });
                  setMilou(initialMilou);
                  setFullThesis(initialFullThesis);
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
            <button type="button" className="secondary" onClick={() => { if (valuationReady) { void generateFullThesis(); } else { openFullThesis(); } }} disabled={fullThesis.status === 'generating' || fullThesis.status === 'loading-evidence'}>{fullThesis.status === 'loading-evidence' ? 'Loading evidence…' : fullThesis.status === 'generating' ? 'Drafting thesis…' : 'Full thesis'}</button>
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
        <section className="trading-analytics-full-thesis" data-state={fullThesis.status} style={tradingCardStyle({ minHeight: 0, maxHeight: 'none' })}>
          <div className="trading-analytics-thesis-intro">
            <div className="trading-section-label">Full thesis</div>
            <h2>Draft the investment case.</h2>
            <p>Milou turns the selected ticker, Quick Analysis, evidence map, risk sensitivity, market comparison, and optional web context into a structured thesis draft.</p>
            <div className="trading-analytics-thesis-actions">
              <button type="button" onClick={() => { void generateFullThesis(); }} disabled={!valuationReady || !selected || fullThesis.status === 'generating' || fullThesis.status === 'loading-evidence'}>{fullThesis.status === 'loading-evidence' ? 'Loading evidence…' : fullThesis.status === 'generating' ? 'Drafting thesis…' : fullThesis.thesis ? 'Regenerate thesis' : 'Generate Full Thesis'}</button>
              <label className="trading-analytics-web-toggle">
                <input type="checkbox" checked={milouUseWeb} onChange={(event) => setMilouUseWeb(event.target.checked)} />
                <span>Use web search</span>
              </label>
            </div>
            <p className="trading-analytics-thesis-status" data-state={fullThesis.status}>{fullThesis.message}</p>
          </div>
          <div className="trading-analytics-thesis-output">
            <div className="trading-analytics-evidence-pipeline">
              <div data-state={valuationReady ? 'ready' : 'pending'}><span>Valuation pack</span><strong>{valuationReady ? 'Ready' : 'Needs Quick Analysis'}</strong></div>
              <div data-state={fullThesis.evidence?.modules.transcripts.status === 'available' ? 'ready' : 'pending'}><span>Transcript catalogue</span><strong>{fullThesis.evidence?.modules.transcripts.latest ? `FY${fullThesis.evidence.modules.transcripts.latest.fiscalYear} Q${fullThesis.evidence.modules.transcripts.latest.fiscalQuarter}` : 'Pending'}</strong></div>
              <div data-state={fullThesis.evidence?.modules.llmKeyData.status === 'ready' ? 'ready' : 'pending'}><span>LLM key data</span><strong>{fullThesis.evidence?.modules.llmKeyData.status ?? 'Pending'}</strong></div>
              <div data-state={fullThesis.evidence?.modules.llmMetricChanges.status === 'ready' ? 'ready' : 'pending'}><span>Metric changes</span><strong>{fullThesis.evidence?.modules.llmMetricChanges.status ?? 'Pending'}</strong></div>
              <div data-state={fullThesis.evidence?.modules.llmForecastDrivers.status === 'ready' ? 'ready' : 'pending'}><span>Forecast drivers</span><strong>{fullThesis.evidence?.modules.llmForecastDrivers.status ?? 'Pending'}</strong></div>
              <div data-state={fullThesis.evidence?.modules.economy.status === 'available' ? 'ready' : 'pending'}><span>Economy context</span><strong>{fullThesis.evidence?.modules.economy.yieldCurve ? `10Y ${formatPercent((fullThesis.evidence.modules.economy.yieldCurve.bc10Year ?? 0) * 100)}` : 'Pending'}</strong></div>
            </div>
            {fullThesis.evidence?.modules.llmKeyData.analysis ? (
              <div className="trading-analytics-extraction-preview">
                <span>Key-data extraction</span>
                <MilouMarkdown text={fullThesis.evidence.modules.llmKeyData.analysis} />
              </div>
            ) : null}
            {fullThesis.evidence?.modules.llmMetricChanges.analysis ? (
              <div className="trading-analytics-extraction-preview">
                <span>Metric-change extraction</span>
                <MilouMarkdown text={fullThesis.evidence.modules.llmMetricChanges.analysis} />
              </div>
            ) : null}
            {fullThesis.evidence?.modules.llmForecastDrivers.analysis ? (
              <div className="trading-analytics-extraction-preview">
                <span>Forecast-driver extraction</span>
                <MilouMarkdown text={fullThesis.evidence.modules.llmForecastDrivers.analysis} />
              </div>
            ) : null}
            {fullThesis.thesis ? <MilouMarkdown text={fullThesis.thesis} /> : (
              <dl className="trading-profile-facts trading-analytics-thesis-outline">
                <div><dt>Company</dt><dd>{selected?.name ?? 'Select a ticker first'}</dd></div>
                <div><dt>Inputs</dt><dd>Quick valuation · transcript catalogue · LLM extraction readiness · economy context · risk sensitivity · SPY/QQQ comparison</dd></div>
                <div><dt>Output</dt><dd>Business quality · valuation case · earnings-call data gaps · forecast drivers · macro backdrop · watchlist plan</dd></div>
                <div><dt>Status</dt><dd>{valuationReady ? 'Ready to load Full Thesis evidence' : 'Needs Quick Analysis first'}</dd></div>
              </dl>
            )}
          </div>
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
          {benchmark.comparison?.ok ? <BenchmarkOverlayChart comparison={benchmark.comparison} /> : <div className="trading-analytics-empty-chart">{benchmark.status === 'loading' ? benchmark.message : benchmark.comparison?.missing.length ? `Missing yfinance history for ${benchmark.comparison.missing.join(', ')}.` : benchmark.message}</div>}
          <dl className="trading-ticker-chart-stats">
            <div><dt>Vs QQQ</dt><dd>{benchmark.comparison ? formatPercent(benchmark.comparison.stats.vsQqqPct, { signed: true }) : '—'}</dd></div>
            <div><dt>Vs SPY</dt><dd>{benchmark.comparison ? formatPercent(benchmark.comparison.stats.vsSpyPct, { signed: true }) : '—'}</dd></div>
            <div><dt>{selected?.symbol ?? 'Ticker'}</dt><dd>{benchmark.comparison ? formatPercent(benchmark.comparison.stats.selectedReturnPct, { signed: true }) : '—'}</dd></div>
            <div><dt>Overlay source</dt><dd>{benchmark.comparison ? 'yfinance · 1Y indexed' : '—'}</dd></div>
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
            Milou checks valuation work like a trading analyst: she can stress-test the bull and bear case, explain DCF and multiples in plain English, compare relative performance against SPY/QQQ, surface risk drivers, and use web search for fresh news or filings when you allow it.
          </p>
        </div>
        <div className="trading-analytics-chat-panel">
          <div className="trading-analytics-chat-message expert" data-state={milou.status}>
            <div className="trading-analytics-chat-message-head">
              <span>Milou</span>
              {milou.status === 'ready' ? <em>Live answer</em> : null}
            </div>
            {milou.answer ? <MilouMarkdown text={milou.answer} /> : <p>{valuationReady && selected ? `${selected.name} has a first-pass valuation pack. Ask me to challenge the assumptions, compare it with SPY/QQQ, or explain the valuation in plain English.` : 'Validate a ticker and generate a Quick Analysis, then I can challenge the assumptions in context.'}</p>}
            <small>{milou.message}</small>
          </div>
          <form className="trading-analytics-milou-form" onSubmit={(event) => { event.preventDefault(); void askMilou(milouQuestion); }}>
            <label>
              <span>Your question</span>
              <textarea value={milouQuestion} onChange={(event) => setMilouQuestion(event.target.value)} placeholder="Ask Milou about the valuation, risks, benchmark comparison, or what to check next." rows={5} />
            </label>
            <label className="trading-analytics-web-toggle">
              <input type="checkbox" checked={milouUseWeb} onChange={(event) => setMilouUseWeb(event.target.checked)} />
              <span>Use web search</span>
            </label>
            <button type="submit" disabled={!valuationReady || !selected || milou.status === 'sending' || !milouQuestion.trim()}>{milou.status === 'sending' ? 'Asking Milou…' : 'Ask Milou'}</button>
          </form>
          <div className="trading-analytics-prompt-grid">
            {milouPrompts.map((prompt) => <button key={prompt} type="button" disabled={!valuationReady || milou.status === 'sending'} onClick={() => { setMilouQuestion(prompt); void askMilou(prompt); }}>{prompt}</button>)}
          </div>
        </div>
      </section>
    </div>
  );
}
