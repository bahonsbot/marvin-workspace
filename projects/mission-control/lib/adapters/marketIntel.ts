import { promises as fs } from 'node:fs';
import type {
  MarketContextQuote,
  MarketIntelDashboardSummary,
  MarketIntelExecutionCandidate,
  MarketIntelManualWatchCandidate,
  MarketIntelResearchRadarItem,
  MarketIntelTrackedSignal,
  MarketIntelOutcome,
} from '@/lib/types/contracts';

// ── Market Context Fetcher ─────────────────────────────────────
// Uses real index symbols (not ETF proxies) from Yahoo Finance.
const INDEX_TICKERS = [
  { id: '^GSPC', symbol: 'SPX', label: 'S&P 500' },
  { id: '^NDX', symbol: 'NDX', label: 'Nasdaq 100' },
  { id: '^DJI', symbol: 'DJI', label: 'Dow Jones' },
  { id: '^RUT', symbol: 'RUT', label: 'Russell 2000' },
];

const COMMODITY_TICKERS = [
  { id: 'GLD', symbol: 'GLD', label: 'Gold' },
  { id: 'USO', symbol: 'USO', label: 'Oil (USO)' },
  { id: 'CORN', symbol: 'CORN', label: 'Corn' },
];

async function fetchQuoteFromYahoo(symbol: string): Promise<{ price: number | null; changePct: number | null }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      next: { revalidate: 900 },
    });
    if (!res.ok) return { price: null, changePct: null };
    const json = await res.json() as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; previousClose?: number } }> };
    };
    const result = json?.chart?.result?.[0];
    if (!result?.meta) return { price: null, changePct: null };
    const { regularMarketPrice, previousClose } = result.meta;
    if (typeof regularMarketPrice !== 'number') return { price: null, changePct: null };
    const changePct =
      typeof previousClose === 'number' && previousClose > 0
        ? ((regularMarketPrice - previousClose) / previousClose) * 100
        : null;
    return { price: regularMarketPrice, changePct };
  } catch {
    return { price: null, changePct: null };
  }
}

async function fetchMarketContext(): Promise<{ indices: MarketContextQuote[]; commodities: MarketContextQuote[]; note: string }> {
  const [indicesResults, commoditiesResults] = await Promise.all([
    Promise.all(INDEX_TICKERS.map(async (ticker) => {
      const { price, changePct } = await fetchQuoteFromYahoo(ticker.id);
      return {
        id: ticker.id,
        symbol: ticker.symbol,
        label: ticker.label,
        category: 'index' as const,
        price,
        change: null,
        changePct,
        currency: null,
        source: 'Yahoo Finance',
        freshness: price !== null ? 'delayed' as const : 'unavailable' as const,
        updatedAt: new Date().toISOString(),
        note: null,
      };
    })),
    Promise.all(COMMODITY_TICKERS.map(async (ticker) => {
      const { price, changePct } = await fetchQuoteFromYahoo(ticker.id);
      return {
        id: ticker.id,
        symbol: ticker.symbol,
        label: ticker.label,
        category: 'commodity' as const,
        price,
        change: null,
        changePct,
        currency: null,
        source: 'Yahoo Finance',
        freshness: price !== null ? 'delayed' as const : 'unavailable' as const,
        updatedAt: new Date().toISOString(),
        note: null,
      };
    })),
  ]);
  return {
    indices: indicesResults,
    commodities: commoditiesResults,
    note: 'Index and commodity quotes sourced from Yahoo Finance (15-min delayed). No ETF proxies used for indices.',
  };
}

const EXECUTION_CANDIDATES_PATH = '/data/.openclaw/workspace/projects/market-intel/data/execution_candidates.json';
const TRACKED_SIGNALS_PATH = '/data/.openclaw/workspace/projects/market-intel/data/tracked_signals.json';
const ACCURACY_HISTORY_PATH = '/data/.openclaw/workspace/projects/market-intel/data/signal_accuracy_history.json';
const VALUE_CHAIN_RESEARCH_PATH = '/data/.openclaw/workspace/projects/autonomous-trading-bot/data/value_chain_research.json';
const MANUAL_WATCH_CANDIDATES_PATH = '/data/.openclaw/workspace/projects/market-intel/data/manual_watch_candidates.json';

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function normalizeConviction(value: unknown): 'low' | 'medium' | 'high' {
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  if (raw === 'high') return 'high';
  if (raw === 'low') return 'low';
  return 'medium';
}

function normalizeReviewStatus(value: unknown): 'active' | 'paused' | 'archived' {
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  if (raw === 'paused') return 'paused';
  if (raw === 'archived') return 'archived';
  return 'active';
}

function confidenceFromCounts(sourceCount: number, pairTradeReady: boolean): 'high' | 'medium' | 'low' {
  if (sourceCount >= 3 || pairTradeReady) return 'high';
  if (sourceCount >= 2) return 'medium';
  return 'low';
}

function toIsoOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeOutcome(value: unknown, verified: boolean): MarketIntelOutcome {
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  if (!verified) return 'pending';
  if (raw.includes('correct')) return 'correct';
  if (raw.includes('duplicate')) return 'duplicate';
  if (raw.includes('incorrect') || raw.includes('miss')) return 'incorrect';
  return 'pending';
}

function parseExecutionCandidates(raw: unknown): MarketIntelExecutionCandidate[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const candidate = entry as Record<string, unknown>;
      const primary = (candidate.primary_instrument ?? null) as Record<string, unknown> | null;
      const dispatch = (candidate.dispatch_readiness ?? null) as Record<string, unknown> | null;
      const instrumentCandidates = Array.isArray(candidate.instrument_candidates)
        ? candidate.instrument_candidates
            .map((inst) => {
              if (!inst || typeof inst !== 'object') return null;
              const row = inst as Record<string, unknown>;
              return {
                symbol: typeof row.symbol === 'string' ? row.symbol : '—',
                instrumentType: typeof row.instrument_type === 'string' ? row.instrument_type : null,
                directionBias: typeof row.direction_bias === 'string' ? row.direction_bias : null,
                mappingConfidence: asNumber(row.mapping_confidence),
                relevanceScore: asNumber(row.relevance_score),
                reason: typeof row.reason === 'string' ? row.reason : null,
              };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
        : [];

      return {
        candidateId: typeof candidate.candidate_id === 'string' ? candidate.candidate_id : 'unknown-candidate',
        signalId: typeof candidate.signal_id === 'string' ? candidate.signal_id : null,
        sourceType: typeof candidate.source_type === 'string' ? candidate.source_type : 'unknown',
        sourceFeed: typeof candidate.source_feed === 'string' ? candidate.source_feed : 'unknown-feed',
        sourceTitle: typeof candidate.source_title === 'string' ? candidate.source_title : 'Untitled signal',
        sourceUrl: typeof candidate.source_url === 'string' ? candidate.source_url : null,
        generatedAt: toIsoOrNull(candidate.generated_at),
        sourceTimestamp: toIsoOrNull(candidate.source_timestamp),
        category: typeof candidate.category === 'string' ? candidate.category : 'unknown',
        patternName: typeof candidate.pattern_name === 'string' ? candidate.pattern_name : null,
        confidenceLevel: typeof candidate.confidence_level === 'string' ? candidate.confidence_level : null,
        recommendation: typeof candidate.recommendation === 'string' ? candidate.recommendation : null,
        expectedHorizon: typeof candidate.expected_horizon === 'string' ? candidate.expected_horizon : null,
        reasoning: typeof candidate.reasoning === 'string' ? candidate.reasoning : null,
        reasoningScore: asNumber(candidate.reasoning_score),
        evidenceStrength: asNumber(candidate.evidence_strength),
        signalScore: asNumber(candidate.signal_score),
        executionPriority: asNumber(candidate.execution_priority),
        executionBias: typeof candidate.execution_bias === 'string' ? candidate.execution_bias : null,
        riskOverlayHint: typeof candidate.risk_overlay_hint === 'string' ? candidate.risk_overlay_hint : null,
        theme: asString(candidate.theme),
        chainLayer: asString(candidate.chain_layer),
        chainSublayer: asString(candidate.chain_sublayer),
        beneficiaryClass: asString(candidate.beneficiary_class),
        loserClass: asString(candidate.loser_class),
        pairTradeCandidate: Boolean(candidate.pair_trade_candidate),
        pairTradeRationale: asString(candidate.pair_trade_rationale),
        valueChainNotes: asString(candidate.value_chain_notes),
        structuralInterpretationConfidence: asNumber(candidate.structural_interpretation_confidence),
        dispatchReady: Boolean(dispatch?.ready),
        dispatchReasons: Array.isArray(dispatch?.reasons)
          ? dispatch?.reasons.filter((reason): reason is string => typeof reason === 'string')
          : [],
        primaryInstrument: primary
          ? {
              symbol: typeof primary.symbol === 'string' ? primary.symbol : null,
              instrumentType: typeof primary.instrument_type === 'string' ? primary.instrument_type : null,
              directionBias: typeof primary.direction_bias === 'string' ? primary.direction_bias : null,
              mappingConfidence: asNumber(primary.mapping_confidence),
              relevanceScore: asNumber(primary.relevance_score),
            }
          : null,
        instrumentCandidates,
        predictedOutcomes: Array.isArray(candidate.predicted_outcomes)
          ? candidate.predicted_outcomes.filter((value): value is string => typeof value === 'string')
          : [],
        predictedCausalChain: Array.isArray(candidate.predicted_causal_chain)
          ? candidate.predicted_causal_chain.filter((value): value is string => typeof value === 'string')
          : [],
        signalBriefing: typeof candidate.signal_briefing === 'string' && candidate.signal_briefing.trim().length > 0 ? candidate.signal_briefing : null,
      };
    })
    .filter((entry): entry is MarketIntelExecutionCandidate => entry !== null)
    .sort((a, b) => {
      const prioA = a.executionPriority ?? -1;
      const prioB = b.executionPriority ?? -1;
      return prioB - prioA;
    });
}

function parseTrackedSignals(raw: unknown): MarketIntelTrackedSignal[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const signal = (row.signal ?? null) as Record<string, unknown> | null;
      if (!signal) return null;

      const verified = Boolean(row.verified);
      const evidencePack = (row.evidence_pack ?? null) as Record<string, unknown> | null;
      const outcome = normalizeOutcome(row.outcome ?? row.actual_outcome, verified);

      return {
        id: `tracked-${index}`,
        title: typeof signal.title === 'string' ? signal.title : 'Untitled tracked signal',
        url: typeof signal.url === 'string' ? signal.url : null,
        source: typeof signal.source === 'string' ? signal.source : 'unknown',
        feed: typeof signal.feed === 'string' ? signal.feed : 'unknown-feed',
        category: typeof signal.category === 'string' ? signal.category : 'unknown',
        pattern: typeof signal.pattern === 'string' ? signal.pattern : null,
        confidenceLevel: typeof signal.confidence_level === 'string' ? signal.confidence_level : null,
        recommendation: typeof signal.recommendation === 'string' ? signal.recommendation : null,
        reasoningScore: asNumber(signal.reasoning_score),
        signalScore: asNumber(signal.signal_score),
        predictedOutcomes: Array.isArray(signal.predicted_outcomes)
          ? signal.predicted_outcomes.filter((item): item is string => typeof item === 'string')
          : [],
        predictedCausalChain: Array.isArray(signal.predicted_causal_chain)
          ? signal.predicted_causal_chain.filter((item): item is string => typeof item === 'string')
          : [],
        addedAt: toIsoOrNull(row.added_at),
        signalTimestamp: toIsoOrNull(signal.timestamp),
        verified,
        outcome,
        verifiedAt: toIsoOrNull(row.verified_at),
        notes: typeof row.notes === 'string' && row.notes.trim().length > 0 ? row.notes : null,
        verificationNote:
          typeof row.verification_note === 'string' && row.verification_note.trim().length > 0
            ? row.verification_note
            : null,
        evidencePack: evidencePack
          ? {
              summary: typeof evidencePack.summary === 'string' ? evidencePack.summary : null,
              confidence: typeof evidencePack.confidence === 'string' ? evidencePack.confidence : null,
              causalVerdict: typeof evidencePack.causal_verdict === 'string' ? evidencePack.causal_verdict : null,
              assetExpressionVerdict:
                typeof evidencePack.asset_expression_verdict === 'string' ? evidencePack.asset_expression_verdict : null,
              duplicateOf: typeof evidencePack.duplicate_of === 'string' ? evidencePack.duplicate_of : null,
              drivers: Array.isArray(evidencePack.drivers)
                ? evidencePack.drivers.filter((item): item is string => typeof item === 'string')
                : [],
            }
          : null,
      };
    })
    .filter((entry): entry is MarketIntelTrackedSignal => entry !== null)
    .sort((a, b) => {
      const aTime = a.addedAt ? Date.parse(a.addedAt) : 0;
      const bTime = b.addedAt ? Date.parse(b.addedAt) : 0;
      return bTime - aTime;
    });
}

function parseManualWatchCandidates(raw: unknown): MarketIntelManualWatchCandidate[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const symbol = asString(row.symbol);
      const thesis = asString(row.thesis);
      if (!symbol || !thesis) return null;

      return {
        id: asString(row.id) ?? `manual-watch-${index + 1}`,
        symbol,
        company: asString(row.company),
        thesis,
        sourceOrigin: asString(row.source_origin) ?? 'manual',
        conviction: normalizeConviction(row.conviction),
        reviewStatus: normalizeReviewStatus(row.review_status),
        tags: Array.isArray(row.tags) ? row.tags.filter((item): item is string => typeof item === 'string') : [],
        notes: asString(row.notes),
        linkedTheme: asString(row.linked_theme),
        linkedChainLayer: asString(row.linked_chain_layer),
        linkedChainSublayer: asString(row.linked_chain_sublayer),
        addedAt: toIsoOrNull(row.added_at),
      };
    })
    .filter((entry): entry is MarketIntelManualWatchCandidate => entry !== null)
    .sort((a, b) => {
      const aTime = a.addedAt ? Date.parse(a.addedAt) : 0;
      const bTime = b.addedAt ? Date.parse(b.addedAt) : 0;
      return bTime - aTime;
    });
}

function parseResearchRadar(raw: unknown, executionCandidates: MarketIntelExecutionCandidate[], manualWatch: MarketIntelManualWatchCandidate[]): { items: MarketIntelResearchRadarItem[]; generatedAt: string | null } {
  const themeReports = Array.isArray((raw as Record<string, unknown> | null)?.theme_reports)
    ? ((raw as Record<string, unknown>).theme_reports as unknown[])
    : [];
  const generatedAt = toIsoOrNull((raw as Record<string, unknown> | null)?.generated_from_at ?? (raw as Record<string, unknown> | null)?.generated_at);

  const items: MarketIntelResearchRadarItem[] = [];

  for (const reportEntry of themeReports) {
    if (!reportEntry || typeof reportEntry !== 'object') continue;
    const report = reportEntry as Record<string, unknown>;
    const operatorSymbols = Array.isArray(report.operator_symbols)
      ? report.operator_symbols.filter((item): item is string => typeof item === 'string')
      : [];
    if (!operatorSymbols.length) continue;

    const sourceCount = typeof report.candidate_count === 'number' && Number.isFinite(report.candidate_count) ? report.candidate_count : 0;
    const bestLongOperator = asString((report.best_long_operator as Record<string, unknown> | null)?.symbol) ?? operatorSymbols[0] ?? null;
    const bestShortOperator = asString((report.best_short_operator as Record<string, unknown> | null)?.symbol) ?? null;
    const symbol = bestLongOperator ?? operatorSymbols[0];
    if (!symbol) continue;

    const relatedCandidates = executionCandidates.filter((candidate) => candidate.primaryInstrument?.symbol === symbol || candidate.instrumentCandidates.some((inst) => inst.symbol === symbol));
    const surfacedAt = deriveLastUpdated(relatedCandidates.flatMap((candidate) => [candidate.generatedAt, candidate.sourceTimestamp]));

    items.push({
      id: `system-${asString(report.theme) ?? 'theme'}-${asString(report.chain_sublayer) ?? 'lane'}-${symbol}`.toLowerCase(),
      symbol,
      origin: 'system',
      company: null,
      thesis: asString(report.pair_trade_rationale) ?? asString((report.strongest as Record<string, unknown> | null)?.value_chain_notes),
      whyNow: asString((report.strongest as Record<string, unknown> | null)?.source_title) ?? asString((report.strongest as Record<string, unknown> | null)?.signal_briefing),
      theme: asString(report.theme),
      chainLayer: asString(report.chain_layer),
      chainSublayer: asString(report.chain_sublayer),
      recurrence: sourceCount,
      surfacedAt,
      confidence: confidenceFromCounts(sourceCount, Boolean(report.pair_trade_ready)),
      sourceCount,
      pairTradeStyle: asString(report.pair_trade_style),
      pairTradeReady: Boolean(report.pair_trade_ready),
      bestLongOperator,
      bestShortOperator,
      operatorSymbols,
      notes: [
        asString(report.pair_trade_style) ? `pair style: ${report.pair_trade_style}` : null,
        relatedCandidates[0]?.pairTradeRationale ?? null,
      ].filter((item): item is string => Boolean(item)),
    });
  }

  for (const watch of manualWatch) {
    items.push({
      id: watch.id,
      symbol: watch.symbol,
      origin: 'manual',
      company: watch.company,
      thesis: watch.thesis,
      whyNow: watch.notes,
      theme: watch.linkedTheme,
      chainLayer: watch.linkedChainLayer,
      chainSublayer: watch.linkedChainSublayer,
      recurrence: 0,
      surfacedAt: watch.addedAt,
      confidence: watch.conviction,
      sourceCount: 0,
      pairTradeStyle: null,
      pairTradeReady: false,
      bestLongOperator: watch.symbol,
      bestShortOperator: null,
      operatorSymbols: [watch.symbol],
      notes: watch.tags,
    });
  }

  items.sort((a, b) => {
    const score = (item: MarketIntelResearchRadarItem) => {
      const originBoost = item.origin === 'manual' ? 1.25 : 1;
      const confidenceBoost = item.confidence === 'high' ? 3 : item.confidence === 'medium' ? 2 : 1;
      return (item.recurrence + confidenceBoost + (item.pairTradeReady ? 1 : 0)) * originBoost;
    };
    return score(b) - score(a);
  });

  return { items: items.slice(0, 12), generatedAt };
}

function deriveLastUpdated(values: Array<string | null | undefined>): string | null {
  const latest = values
    .map((value) => (value ? Date.parse(value) : NaN))
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => b - a)[0];

  return typeof latest === 'number' ? new Date(latest).toISOString() : null;
}

export async function getMarketIntelDashboard(): Promise<MarketIntelDashboardSummary> {
  try {
    const [executionRaw, trackedRaw, accuracyRawText, valueChainResearchRawText, manualWatchRawText] = await Promise.all([
      fs.readFile(EXECUTION_CANDIDATES_PATH, 'utf8'),
      fs.readFile(TRACKED_SIGNALS_PATH, 'utf8'),
      fs.readFile(ACCURACY_HISTORY_PATH, 'utf8'),
      fs.readFile(VALUE_CHAIN_RESEARCH_PATH, 'utf8').catch(() => '{"theme_reports": []}'),
      fs.readFile(MANUAL_WATCH_CANDIDATES_PATH, 'utf8').catch(() => '[]'),
    ]);

    const executionCandidates = parseExecutionCandidates(JSON.parse(executionRaw) as unknown);
    const trackedSignals = parseTrackedSignals(JSON.parse(trackedRaw) as unknown);
    const accuracyRaw = JSON.parse(accuracyRawText) as Record<string, unknown>;
    const manualWatch = parseManualWatchCandidates(JSON.parse(manualWatchRawText) as unknown);
    const researchRadar = parseResearchRadar(JSON.parse(valueChainResearchRawText) as unknown, executionCandidates, manualWatch);

    const verifiedSignals = trackedSignals.filter((signal) => signal.verified);
    const duplicateCountFromTracked = verifiedSignals.filter((signal) => signal.outcome === 'duplicate').length;
    const correctCount = verifiedSignals.filter((signal) => signal.outcome === 'correct').length;
    const incorrectCount = verifiedSignals.filter((signal) => signal.outcome === 'incorrect').length;
    const pendingCount = trackedSignals.filter((signal) => !signal.verified).length;
    const evidenceCovered = verifiedSignals.filter((signal) => signal.evidencePack !== null).length;

    const weightedAccuracy = asNumber(accuracyRaw.weighted_accuracy);
    const totalVerified = asNumber(accuracyRaw.total_verified) ?? verifiedSignals.length;
    const duplicateCount = asNumber(accuracyRaw.duplicate_count) ?? duplicateCountFromTracked;
    const evidenceCoverage = asNumber(accuracyRaw.evidence_coverage)
      ?? (verifiedSignals.length > 0 ? (evidenceCovered / verifiedSignals.length) * 100 : null);

    const lastUpdated = deriveLastUpdated([
      toIsoOrNull(accuracyRaw.last_updated),
      executionCandidates[0]?.generatedAt,
      trackedSignals[0]?.addedAt,
      trackedSignals[0]?.verifiedAt,
    ]);

    const marketContext = await fetchMarketContext();

    return {
      status: 'partial',
      kpis: {
        weightedAccuracy,
        totalVerified,
        duplicateCount,
        evidenceCoverage,
        candidateCount: executionCandidates.length,
        pendingCount,
        lastUpdated,
      },
      executionCandidates,
      trackedSignals,
      researchRadar: {
        items: researchRadar.items,
        generatedAt: researchRadar.generatedAt,
        note: 'System-surfaced ideas come from execution candidates plus value-chain research. Manual watch items share the same radar for later UI integration.',
      },
      manualWatch: {
        items: manualWatch,
        path: MANUAL_WATCH_CANDIDATES_PATH,
        note: 'Manual watch candidates are shared trading-research inputs, not Mission Control-only UI state.',
      },
      marketContext,
      accuracySnapshot: {
        totalReviewedRaw: asNumber(accuracyRaw.total_reviewed_raw),
        correctCount,
        incorrectCount,
        duplicateCount,
        pendingCount,
        weightedAccuracy,
      },
      refreshedAt: new Date().toISOString(),
    };
  } catch {
    // Files unreadable — still attempt market context fetch (it is file-independent)
    const marketContext = await fetchMarketContext();
    return {
      status: 'stub',
      kpis: {
        weightedAccuracy: null,
        totalVerified: 0,
        duplicateCount: 0,
        evidenceCoverage: null,
        candidateCount: 0,
        pendingCount: 0,
        lastUpdated: null,
      },
      executionCandidates: [],
      trackedSignals: [],
      researchRadar: { items: [], generatedAt: null, note: 'Research radar unavailable.' },
      manualWatch: { items: [], path: MANUAL_WATCH_CANDIDATES_PATH, note: 'Manual watch candidates unavailable.' },
      marketContext,
      accuracySnapshot: {
        totalReviewedRaw: null,
        correctCount: 0,
        incorrectCount: 0,
        duplicateCount: 0,
        pendingCount: 0,
        weightedAccuracy: null,
      },
      refreshedAt: new Date().toISOString(),
    };
  }
}
