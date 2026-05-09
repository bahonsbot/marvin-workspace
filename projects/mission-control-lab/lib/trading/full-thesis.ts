import type { MilouContextPayload } from './milou-analysis';

export type FullThesisPayload = MilouContextPayload & {
  priorMilouAnswer?: string | null;
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
  return rows.map((row, index) => {
    const factor = row.factor?.trim() || `Sensitivity factor ${index + 1}`;
    return `- ${factor}: bear ${formatNumber(row.bear)}, base ${formatNumber(row.base)}, bull ${formatNumber(row.bull)}. ${row.note}`;
  }).join('\n');
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

function webAccessInstruction(enabled: boolean) {
  if (!enabled) {
    return 'No. Do not use web search. If fresh news, filings, competitors, or live market context would materially change the thesis, say web search is off and list the external checks needed.';
  }

  return 'Yes. Web search was explicitly enabled by the user. First try available web/search tooling or current-source capability for recent news, filings, competitors, peer sets, and missing current context. If web/search tooling is unavailable in this runtime, say that plainly and continue from supplied context. Do not pretend you searched if you did not.';
}

export function buildFullThesisPrompt(input: FullThesisPayload) {
  const selected = input.selected;
  const identity = selected
    ? `${selected.name} (${selected.symbol}, ${selected.exchange}, ${selected.country}, ${selected.currency}, ${selected.type}${selected.sector ? `, sector: ${selected.sector}` : ''}${selected.industry ? `, industry: ${selected.industry}` : ''})`
    : 'No ticker selected';

  return `You are Milou, Philippe's trading-advisor specialist inside Mission Control Lab Analytics.

Generate a structured Full Thesis draft from the supplied Quick Analysis pack. This is analysis and education, not financial advice. Do not invent current prices, fundamentals, news, filings, peers, or catalysts. Be explicit about missing data and what should be checked next.

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

Prior Milou answer from this Analytics session, if any:
${input.priorMilouAnswer?.trim() || 'No prior Milou answer supplied.'}

Web/search instruction:
${webAccessInstruction(Boolean(input.webAccessRequested))}

Write the Full Thesis with these exact section headings:
1. Thesis verdict
2. Business quality
3. Valuation case
4. Market comparison
5. Key risks
6. What would change my mind
7. Watchlist plan
8. Data gaps

Style rules:
- Start with the answer in 2-3 sentences.
- Keep it practical, risk-first, and concise enough to read in the Analytics page.
- Use bullets where helpful.
- Avoid heavy Markdown emphasis. Do not bold full sentences, labels, numbers, or section bodies.
- Include a clear line that this is not financial advice.
- If valuation status is not ready, say the thesis is provisional and explain which inputs are missing.`;
}
