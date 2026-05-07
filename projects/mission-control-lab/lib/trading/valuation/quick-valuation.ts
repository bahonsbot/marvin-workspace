import type { DefeatBetaAnalyticsSummary } from '@/lib/trading/sources/defeatbeta';

export type AnalyticsTickerSelection = {
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

export type ValuationModel = {
  name: string;
  range: string;
  weight: string;
  note: string;
  low?: number;
  high?: number;
};

export type QuickValuationResult = {
  status: 'ready' | 'unavailable' | 'error';
  message: string;
  selected: AnalyticsTickerSelection;
  summary: DefeatBetaAnalyticsSummary;
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
  assumptions: {
    modelVersion: string;
    modelType: 'first-pass-proxy';
    currency: string;
    revenueCagr: number | null;
    netIncomeCagr: number | null;
    latestPe: number | null;
    latestPs: number | null;
    latestPb: number | null;
    latestWacc: number | null;
    latestRoe: number | null;
    latestRoic: number | null;
    growthAdjustment: number;
    qualityAdjustment: number;
    riskPenalty: number;
    valuationAdjustment: number;
    spread: number;
  };
};

export const fallbackValuationSeries = [108, 112, 118, 115, 123, 132, 138, 146, 151, 158, 164, 161, 168, 176];
export const fallbackBenchmarkSeries = [100, 104, 102, 109, 112, 118, 121, 127, 126, 132, 136, 139, 141, 145];
export const fallbackRiskSeries = [64, 58, 61, 54, 49, 46, 51, 44, 41, 38, 36, 34];

export const fallbackMethods: ValuationModel[] = [
  { name: 'DCF base case', range: '$148-$184', weight: '40%', note: 'FCF path, WACC, terminal growth' },
  { name: 'Multiples check', range: '$136-$171', weight: '25%', note: 'PE, EV/EBITDA, PS vs history and peers' },
  { name: 'Reverse DCF', range: '$128-$166', weight: '20%', note: 'Growth implied by current market price' },
  { name: 'Quality adjustment', range: '+6%', weight: '15%', note: 'ROIC-WACC spread, balance sheet, cyclicality' },
];

export const fallbackEvidence: Array<[string, string]> = [
  ['Revenue trend', '5Y CAGR, quarterly slope, consensus stress'],
  ['Cash conversion', 'Operating cash flow, capex intensity, FCF margin'],
  ['Capital quality', 'ROE, ROIC, WACC, reinvestment runway'],
  ['Market context', 'Relative strength, sector momentum, rate sensitivity'],
];

export function formatCurrency(value: number | null | undefined, currency = 'USD') {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value);
}

export function formatPercent(value: number | null | undefined, options: { signed?: boolean; decimals?: number } = {}) {
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

function average(values: Array<number | null>) {
  const usable = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (!usable.length) return 0;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function chartSeriesFromRange(low: number | null, base: number | null, high: number | null, current: number | null) {
  if (low == null || base == null || high == null) return fallbackValuationSeries;
  const spot = current ?? base;
  return [spot * 0.92, spot * 0.97, low, (low + base) / 2, base, (base + high) / 2, high].map((value) => Math.max(value, 1));
}

export function buildQuickValuation(input: {
  selected: AnalyticsTickerSelection;
  summary: DefeatBetaAnalyticsSummary;
  ok: boolean;
  reason?: string;
}): QuickValuationResult {
  const { selected, summary, ok, reason } = input;
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

  const qualityScore = average([roe, roic]);
  const growthScore = average([revenueCagr, netIncomeCagr]);
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
    status: ok ? 'ready' : 'unavailable',
    message: ok ? `Quick valuation generated from DefeatBeta ${summary.resolvedSymbol}.` : (reason || summary.notes[0] || 'DefeatBeta coverage unavailable.'),
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
    assumptions: {
      modelVersion: 'quick-valuation-proxy-v1',
      modelType: 'first-pass-proxy',
      currency,
      revenueCagr,
      netIncomeCagr,
      latestPe: pe,
      latestPs: ps,
      latestPb: pb,
      latestWacc: wacc,
      latestRoe: roe,
      latestRoic: roic,
      growthAdjustment,
      qualityAdjustment,
      riskPenalty,
      valuationAdjustment,
      spread,
    },
  };
}
