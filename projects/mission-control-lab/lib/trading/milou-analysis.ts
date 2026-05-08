export type MilouContextPayload = {
  question: string;
  selected: {
    symbol: string;
    name: string;
    exchange: string;
    country: string;
    currency: string;
    type: string;
  } | null;
  valuation: {
    status: string;
    message: string;
    decisionZone: string;
    confidence: string;
    baseValue: number | null;
    fairLow: number | null;
    fairHigh: number | null;
    currentPrice: number | null;
    impliedUpside: number | null;
    evidence: Array<[string, string]>;
    sensitivity?: Array<{ factor: string; note: string; bear: number | null; base: number | null; bull: number | null }>;
    methods: Array<{ name: string; range: string; weight: string; note: string }>;
  };
  benchmark: {
    selectedSymbol: string;
    resolvedSymbol: string;
    stats: {
      selectedReturnPct: number | null;
      spyReturnPct: number | null;
      qqqReturnPct: number | null;
      vsSpyPct: number | null;
      vsQqqPct: number | null;
    };
    note: string;
  } | null;
  webAccessRequested?: boolean;
};

function formatNumber(value: number | null | undefined, suffix = '') {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)}${suffix}`;
}

function evidenceLines(evidence: Array<[string, string]>) {
  return evidence.map(([label, value]) => `- ${label}: ${value}`).join('\n');
}

function methodLines(methods: MilouContextPayload['valuation']['methods']) {
  return methods.map((method) => `- ${method.name}: ${method.range} (${method.weight}). ${method.note}`).join('\n');
}

function sensitivityLines(rows: MilouContextPayload['valuation']['sensitivity']) {
  if (!rows?.length) return '- No sensitivity rows available.';
  return rows.map((row) => `- ${row.factor}: bear ${formatNumber(row.bear)}, base ${formatNumber(row.base)}, bull ${formatNumber(row.bull)}. ${row.note}`).join('\n');
}

function benchmarkLines(benchmark: MilouContextPayload['benchmark']) {
  if (!benchmark) return 'No benchmark overlay loaded yet.';
  return [
    `Ticker: ${benchmark.selectedSymbol}${benchmark.resolvedSymbol !== benchmark.selectedSymbol ? ` (resolved to ${benchmark.resolvedSymbol} in yfinance)` : ''}`,
    `1Y return: ${formatNumber(benchmark.stats.selectedReturnPct, '%')}`,
    `SPY return: ${formatNumber(benchmark.stats.spyReturnPct, '%')} · vs SPY: ${formatNumber(benchmark.stats.vsSpyPct, ' pp')}`,
    `QQQ return: ${formatNumber(benchmark.stats.qqqReturnPct, '%')} · vs QQQ: ${formatNumber(benchmark.stats.vsQqqPct, ' pp')}`,
    benchmark.note,
  ].join('\n');
}

export function buildMilouAnalysisPrompt(input: MilouContextPayload) {
  const selected = input.selected;
  const identity = selected
    ? `${selected.name} (${selected.symbol}, ${selected.exchange}, ${selected.country}, ${selected.currency}, ${selected.type})`
    : 'No ticker selected';

  return `You are Milou, Philippe's trading-advisor specialist inside Mission Control Lab Analytics.

Answer the user's question using only the supplied valuation/benchmark context unless web access is explicitly useful and available in your runtime. Be clear when data is missing. This is analysis and education, not financial advice. Do not invent current prices, fundamentals, or news.

User question:
${input.question}

Selected company:
${identity}

Quick valuation snapshot:
- Status: ${input.valuation.status}
- Message: ${input.valuation.message}
- Decision zone: ${input.valuation.decisionZone}
- Confidence: ${input.valuation.confidence}
- Current price: ${formatNumber(input.valuation.currentPrice)}
- Base value: ${formatNumber(input.valuation.baseValue)}
- Fair-value corridor: ${formatNumber(input.valuation.fairLow)} to ${formatNumber(input.valuation.fairHigh)}
- Implied upside: ${formatNumber(input.valuation.impliedUpside, '%')}

Valuation stack:
${methodLines(input.valuation.methods)}

Evidence map:
${evidenceLines(input.valuation.evidence)}

Risk sensitivity:
${sensitivityLines(input.valuation.sensitivity)}

Market comparison:
${benchmarkLines(input.benchmark)}

Web access requested by user/UI: ${input.webAccessRequested ? 'yes' : 'no'}

Respond in a compact analyst style:
1. Direct answer.
2. What supports it.
3. What could break the thesis.
4. What to check next.
Keep it practical and risk-first.`;
}
