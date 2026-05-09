import type { MilouContextPayload } from './milou-analysis';

export type FullThesisEvidencePack = {
  transcripts?: {
    status: string;
    latest?: { fiscalYear: number | null; fiscalQuarter: number | null; reportDate?: string | null; paragraphCount?: number | null; sampleSpeakers?: string[] } | null;
    recent?: Array<{ fiscalYear: number | null; fiscalQuarter: number | null; reportDate?: string | null; paragraphCount?: number | null }>;
    llmAnalysis?: { status: string; note: string; availableMethods?: string[] };
    notes?: string[];
  } | null;
  economy?: {
    status: string;
    sp500?: { latestAnnualReturn?: { date?: string | null; annualReturn: number | null } | null; cagr10Year?: number | null };
    yieldCurve?: { date?: string | null; bc3Month?: number | null; bc2Year?: number | null; bc10Year?: number | null; bc30Year?: number | null; twoTenSpread?: number | null } | null;
    notes?: string[];
  } | null;
  llmKeyData?: { status: string; note: string; analysis?: string | null } | null;
  llmMetricChanges?: { status: string; note: string; analysis?: string | null } | null;
  llmForecastDrivers?: { status: string; note: string; analysis?: string | null } | null;
};

export type FullThesisPayload = MilouContextPayload & {
  priorMilouAnswer?: string | null;
  evidencePack?: FullThesisEvidencePack | null;
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

function fullThesisEvidenceLines(evidencePack: FullThesisEvidencePack | null | undefined) {
  if (!evidencePack) return 'No Full Thesis evidence pipeline modules were loaded yet.';
  const transcript = evidencePack.transcripts;
  const latest = transcript?.latest;
  const economy = evidencePack.economy;
  const yieldCurve = economy?.yieldCurve;
  return [
    `Transcript catalogue: ${transcript?.status ?? 'not loaded'}${latest ? ` · latest FY${latest.fiscalYear} Q${latest.fiscalQuarter} (${latest.reportDate ?? 'no date'}, ${latest.paragraphCount ?? '—'} paragraphs)` : ''}`,
    `Transcript speakers: ${latest?.sampleSpeakers?.length ? latest.sampleSpeakers.slice(0, 6).join(', ') : '—'}`,
    `LLM key-data extraction: ${evidencePack.llmKeyData?.status ?? transcript?.llmAnalysis?.status ?? 'not loaded'} · ${evidencePack.llmKeyData?.note ?? transcript?.llmAnalysis?.note ?? 'No key-data extraction result supplied.'}${evidencePack.llmKeyData?.analysis ? `\n${evidencePack.llmKeyData.analysis}` : ''}`,
    `LLM metric-change analysis: ${evidencePack.llmMetricChanges?.status ?? 'not loaded'} · ${evidencePack.llmMetricChanges?.note ?? 'No metric-change analysis result supplied.'}${evidencePack.llmMetricChanges?.analysis ? `\n${evidencePack.llmMetricChanges.analysis}` : ''}`,
    `LLM forecast-driver analysis: ${evidencePack.llmForecastDrivers?.status ?? 'not loaded'} · ${evidencePack.llmForecastDrivers?.note ?? 'No forecast-driver analysis result supplied.'}${evidencePack.llmForecastDrivers?.analysis ? `\n${evidencePack.llmForecastDrivers.analysis}` : ''}`,
    `Economy context: ${economy?.status ?? 'not loaded'} · S&P latest annual return ${formatNumber(economy?.sp500?.latestAnnualReturn?.annualReturn != null ? economy.sp500.latestAnnualReturn.annualReturn * 100 : null, '%')} · S&P 10Y CAGR ${formatNumber(economy?.sp500?.cagr10Year != null ? economy.sp500.cagr10Year * 100 : null, '%')}`,
    `Yield curve: ${yieldCurve ? `${yieldCurve.date ?? 'latest'} · 3M ${formatNumber(yieldCurve.bc3Month != null ? yieldCurve.bc3Month * 100 : null, '%')} · 2Y ${formatNumber(yieldCurve.bc2Year != null ? yieldCurve.bc2Year * 100 : null, '%')} · 10Y ${formatNumber(yieldCurve.bc10Year != null ? yieldCurve.bc10Year * 100 : null, '%')} · 2s10s ${formatNumber(yieldCurve.twoTenSpread != null ? yieldCurve.twoTenSpread * 100 : null, ' pp')}` : 'not loaded'}`,
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

Full Thesis evidence pipeline:
${fullThesisEvidenceLines(input.evidencePack)}

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
- If valuation status is not ready, say the thesis is provisional and explain which inputs are missing.
- If transcript LLM modules are not configured or not loaded, do not hallucinate earnings-call analysis; list them under Data gaps.
- Use economy context only as backdrop, not as a ticker-specific conclusion.`;
}
