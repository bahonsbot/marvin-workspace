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

export type ValuationModelName = 'dcfProxy' | 'multiples' | 'reverseDcf' | 'qualityRisk';

export type ValuationModel = {
  name: string;
  key?: ValuationModelName;
  range: string;
  weight: string;
  note: string;
  value?: number | null;
  low?: number;
  high?: number;
};

export type ValuationSubmodel = {
  key: ValuationModelName;
  label: string;
  weight: number;
  value: number | null;
  low: number | null;
  high: number | null;
  confidence: 'Low' | 'Medium' | 'High';
  assumptions: Record<string, number | string | null>;
  notes: string[];
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
  submodels: ValuationSubmodel[];
  assumptions: {
    modelVersion: string;
    modelType: 'submodel-proxy';
    currency: string;
    revenueCagr: number | null;
    netIncomeCagr: number | null;
    latestPe: number | null;
    latestPs: number | null;
    latestPb: number | null;
    latestWacc: number | null;
    latestRoe: number | null;
    latestRoic: number | null;
    dcfValue: number | null;
    multiplesValue: number | null;
    reverseDcfValue: number | null;
    qualityRiskValue: number | null;
    qualityAdjustment: number;
    riskPenalty: number;
    confidenceSpread: number;
  };
};

export const fallbackValuationSeries = [108, 112, 118, 115, 123, 132, 138, 146, 151, 158, 164, 161, 168, 176];
export const fallbackBenchmarkSeries = [100, 104, 102, 109, 112, 118, 121, 127, 126, 132, 136, 139, 141, 145];
export const fallbackRiskSeries = [64, 58, 61, 54, 49, 46, 51, 44, 41, 38, 36, 34];

export const fallbackMethods: ValuationModel[] = [
  { name: 'DCF base case', key: 'dcfProxy', range: '$148-$184', weight: '40%', note: 'FCF path, WACC, terminal growth' },
  { name: 'Multiples check', key: 'multiples', range: '$136-$171', weight: '25%', note: 'PE, EV/EBITDA, PS vs history and peers' },
  { name: 'Reverse DCF', key: 'reverseDcf', range: '$128-$166', weight: '20%', note: 'Growth implied by current market price' },
  { name: 'Quality/risk overlay', key: 'qualityRisk', range: '+6%', weight: '15%', note: 'ROIC-WACC spread, balance sheet, cyclicality' },
];

export const fallbackEvidence: Array<[string, string]> = [
  ['Revenue trend', '5Y CAGR, quarterly slope, consensus stress'],
  ['Cash conversion', 'Operating cash flow, capex intensity, FCF margin'],
  ['Capital quality', 'ROE, ROIC, WACC, reinvestment runway'],
  ['Market context', 'Relative strength, sector momentum, rate sensitivity'],
];

const SUBMODEL_WEIGHTS: Record<ValuationModelName, number> = {
  dcfProxy: 0.4,
  multiples: 0.25,
  reverseDcf: 0.2,
  qualityRisk: 0.15,
};

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

function clamp(value: number, low: number, high: number) {
  return Math.min(Math.max(value, low), high);
}

function rangeAround(value: number | null, spread: number) {
  if (value == null || !Number.isFinite(value)) return { low: null, high: null };
  return { low: value * (1 - spread), high: value * (1 + spread) };
}

function chartSeriesFromRange(low: number | null, base: number | null, high: number | null, current: number | null) {
  if (low == null || base == null || high == null) return fallbackValuationSeries;
  const spot = current ?? base;
  return [spot * 0.92, spot * 0.97, low, (low + base) / 2, base, (base + high) / 2, high].map((value) => Math.max(value, 1));
}

function weightedBlend(submodels: ValuationSubmodel[]) {
  const usable = submodels.filter((model) => model.value != null && Number.isFinite(model.value));
  const totalWeight = usable.reduce((sum, model) => sum + model.weight, 0);
  if (!usable.length || totalWeight <= 0) return null;
  return usable.reduce((sum, model) => sum + model.value! * model.weight, 0) / totalWeight;
}

function buildDcfProxy(input: {
  currentPrice: number | null;
  revenueCagr: number | null;
  netIncomeCagr: number | null;
  wacc: number | null;
  coverage: boolean;
}): ValuationSubmodel {
  const anchor = input.currentPrice ?? 100;
  const growthScore = average([input.revenueCagr, input.netIncomeCagr]);
  const normalizedWacc = input.wacc != null ? input.wacc * 100 : 10;
  const forecastGrowth = clamp(growthScore, -8, 16);
  const terminalGrowth = clamp(forecastGrowth * 0.28, 0, 4);
  const discountSpread = clamp((normalizedWacc - terminalGrowth) / 100, 0.045, 0.16);
  const growthLift = clamp(forecastGrowth / 100, -0.08, 0.18);
  const discountDrag = clamp((normalizedWacc - 9) / 100, -0.04, 0.08);
  const value = anchor * (1 + growthLift - discountDrag + (input.coverage ? 0.02 : -0.04));
  const range = rangeAround(value, input.coverage ? 0.16 : 0.24);

  return {
    key: 'dcfProxy',
    label: 'DCF proxy',
    weight: SUBMODEL_WEIGHTS.dcfProxy,
    value,
    ...range,
    confidence: input.coverage ? 'Medium' : 'Low',
    assumptions: {
      anchor,
      forecastGrowth,
      terminalGrowth,
      normalizedWacc,
      discountSpread,
    },
    notes: ['Uses price as anchor until share count / FCF-per-share normalization is wired.', 'Penalizes high WACC and low statement coverage.'],
  };
}

function buildMultiplesModel(input: {
  currentPrice: number | null;
  pe: number | null;
  ps: number | null;
  pb: number | null;
  revenueCagr: number | null;
  coverage: boolean;
}): ValuationSubmodel {
  const anchor = input.currentPrice ?? 100;
  const growth = clamp(input.revenueCagr ?? 4, -8, 18);
  const fairPe = clamp(18 + growth * 0.55, 10, 32);
  const fairPs = clamp(3.2 + growth * 0.12, 1.2, 8.5);
  const fairPb = clamp(4 + growth * 0.16, 1.4, 12);
  const peSignal = input.pe ? clamp(fairPe / input.pe, 0.72, 1.32) : 1;
  const psSignal = input.ps ? clamp(fairPs / input.ps, 0.75, 1.28) : 1;
  const pbSignal = input.pb ? clamp(fairPb / input.pb, 0.75, 1.24) : 1;
  const multipleSignal = average([peSignal, psSignal, pbSignal]);
  const value = anchor * multipleSignal;
  const range = rangeAround(value, input.coverage ? 0.18 : 0.26);

  return {
    key: 'multiples',
    label: 'Multiples check',
    weight: SUBMODEL_WEIGHTS.multiples,
    value,
    ...range,
    confidence: input.coverage ? 'Medium' : 'Low',
    assumptions: {
      anchor,
      fairPe,
      fairPs,
      fairPb,
      observedPe: input.pe,
      observedPs: input.ps,
      observedPb: input.pb,
      multipleSignal,
    },
    notes: ['Normalizes PE/PS/PB against a growth-adjusted fair multiple band.', 'Still needs sector-specific peer bands later.'],
  };
}

function buildReverseDcfModel(input: {
  currentPrice: number | null;
  revenueCagr: number | null;
  netIncomeCagr: number | null;
  wacc: number | null;
}): ValuationSubmodel {
  const anchor = input.currentPrice ?? 100;
  const observedGrowth = average([input.revenueCagr, input.netIncomeCagr]);
  const normalizedWacc = input.wacc != null ? input.wacc * 100 : 10;
  const impliedGrowth = clamp(normalizedWacc - 6, -2, 9);
  const growthGap = clamp((observedGrowth - impliedGrowth) / 100, -0.12, 0.14);
  const value = anchor * (1 + growthGap * 0.65);
  const range = rangeAround(value, 0.2);

  return {
    key: 'reverseDcf',
    label: 'Reverse DCF',
    weight: SUBMODEL_WEIGHTS.reverseDcf,
    value,
    ...range,
    confidence: input.currentPrice != null ? 'Medium' : 'Low',
    assumptions: {
      anchor,
      observedGrowth,
      impliedGrowth,
      growthGap,
      normalizedWacc,
    },
    notes: ['Estimates whether current market price implies more or less growth than recent fundamentals support.'],
  };
}

function buildQualityRiskOverlay(input: {
  currentPrice: number | null;
  roe: number | null;
  roic: number | null;
  wacc: number | null;
  coverage: boolean;
}): ValuationSubmodel {
  const anchor = input.currentPrice ?? 100;
  const roePct = input.roe != null ? input.roe * 100 : null;
  const roicPct = input.roic != null ? input.roic * 100 : null;
  const waccPct = input.wacc != null ? input.wacc * 100 : null;
  const capitalQuality = average([roePct, roicPct]);
  const spreadOverWacc = roicPct != null && waccPct != null ? roicPct - waccPct : null;
  const qualityAdjustment = clamp(capitalQuality / 100, -0.08, 0.18);
  const spreadAdjustment = spreadOverWacc != null ? clamp(spreadOverWacc / 100, -0.08, 0.14) : 0;
  const missingCoveragePenalty = input.coverage ? 0 : -0.06;
  const value = anchor * (1 + qualityAdjustment * 0.55 + spreadAdjustment * 0.45 + missingCoveragePenalty);
  const range = rangeAround(value, input.coverage ? 0.15 : 0.24);

  return {
    key: 'qualityRisk',
    label: 'Quality/risk overlay',
    weight: SUBMODEL_WEIGHTS.qualityRisk,
    value,
    ...range,
    confidence: input.coverage ? 'Medium' : 'Low',
    assumptions: {
      anchor,
      roePct,
      roicPct,
      waccPct,
      capitalQuality,
      spreadOverWacc,
      qualityAdjustment,
      spreadAdjustment,
      missingCoveragePenalty,
    },
    notes: ['Rewards ROIC/WACC spread and high capital quality, penalizes missing quality coverage.'],
  };
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

  const dcfModel = buildDcfProxy({ currentPrice, revenueCagr, netIncomeCagr, wacc, coverage: summary.coverage.statements });
  const multiplesModel = buildMultiplesModel({ currentPrice, pe, ps, pb, revenueCagr, coverage: summary.coverage.ratios });
  const reverseDcfModel = buildReverseDcfModel({ currentPrice, revenueCagr, netIncomeCagr, wacc });
  const qualityRiskModel = buildQualityRiskOverlay({ currentPrice, roe, roic, wacc, coverage: summary.coverage.quality });
  const submodels = [dcfModel, multiplesModel, reverseDcfModel, qualityRiskModel];

  const baseValue = weightedBlend(submodels);
  const confidenceSpread = Math.max(0.14, 0.28 - Math.min(Math.max((summary.coverage.statements ? 0.05 : 0) + (summary.coverage.ratios ? 0.04 : 0) + (summary.coverage.quality ? 0.04 : 0), 0), 0.12));
  const fairLow = baseValue != null ? baseValue * (1 - confidenceSpread) : null;
  const fairHigh = baseValue != null ? baseValue * (1 + confidenceSpread) : null;
  const impliedUpside = currentPrice && baseValue != null ? ((baseValue - currentPrice) / currentPrice) * 100 : null;
  const confidence = summary.coverage.statements && summary.coverage.ratios && summary.coverage.quality ? 'Medium' : 'Low';
  const decisionZone = impliedUpside == null ? 'Needs quote' : impliedUpside > 15 ? 'Undervalued watch' : impliedUpside < -10 ? 'Overvalued' : 'Watch / Buy weakness';
  const qualityAdjustment = Number(qualityRiskModel.assumptions.qualityAdjustment ?? 0);
  const riskPenalty = wacc != null ? clamp(wacc * 100 - 8, -3, 8) : 2;

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
      { name: dcfModel.label, key: dcfModel.key, value: dcfModel.value, range: `${formatCurrency(dcfModel.low, currency)}-${formatCurrency(dcfModel.high, currency)}`, weight: '40%', note: `WACC ${wacc != null ? formatPercent(wacc * 100, { decimals: 1 }) : 'pending'}, growth ${formatPercent(Number(dcfModel.assumptions.forecastGrowth ?? 0))}`, low: dcfModel.low ?? undefined, high: dcfModel.high ?? undefined },
      { name: multiplesModel.label, key: multiplesModel.key, value: multiplesModel.value, range: multiplesModel.value != null ? formatCurrency(multiplesModel.value, currency) : 'Pending', weight: '25%', note: `PE ${pe != null ? pe.toFixed(1) : '—'} · PS ${ps != null ? ps.toFixed(1) : '—'} · PB ${pb != null ? pb.toFixed(1) : '—'}` },
      { name: reverseDcfModel.label, key: reverseDcfModel.key, value: reverseDcfModel.value, range: reverseDcfModel.value != null ? formatCurrency(reverseDcfModel.value, currency) : 'Needs quote', weight: '20%', note: `Implied growth ${formatPercent(Number(reverseDcfModel.assumptions.impliedGrowth ?? 0))}` },
      { name: qualityRiskModel.label, key: qualityRiskModel.key, value: qualityRiskModel.value, range: `${formatPercent(qualityAdjustment * 100, { signed: true })}`, weight: '15%', note: `ROE ${roe != null ? formatPercent(roe * 100) : '—'} · ROIC ${roic != null ? formatPercent(roic * 100) : '—'}` },
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
    submodels,
    assumptions: {
      modelVersion: 'quick-valuation-submodels-v1',
      modelType: 'submodel-proxy',
      currency,
      revenueCagr,
      netIncomeCagr,
      latestPe: pe,
      latestPs: ps,
      latestPb: pb,
      latestWacc: wacc,
      latestRoe: roe,
      latestRoic: roic,
      dcfValue: dcfModel.value,
      multiplesValue: multiplesModel.value,
      reverseDcfValue: reverseDcfModel.value,
      qualityRiskValue: qualityRiskModel.value,
      qualityAdjustment,
      riskPenalty,
      confidenceSpread,
    },
  };
}
