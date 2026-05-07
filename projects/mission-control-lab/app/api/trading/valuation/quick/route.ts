import { NextResponse } from 'next/server';
import { getDefeatBetaAnalyticsSummary } from '@/lib/trading/sources/defeatbeta';
import { buildQuickValuation, type AnalyticsTickerSelection } from '@/lib/trading/valuation/quick-valuation';

type QuickValuationRequest = {
  selected?: AnalyticsTickerSelection;
  symbol?: string;
};

function exchangeSymbolForDefeatBeta(symbol: string) {
  const normalized = symbol.toUpperCase();
  if (normalized.endsWith('.US')) return normalized.replace(/\.US$/, '');
  return normalized;
}

function validSelection(value: unknown): value is AnalyticsTickerSelection {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AnalyticsTickerSelection>;
  return typeof candidate.symbol === 'string'
    && typeof candidate.code === 'string'
    && typeof candidate.exchange === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.type === 'string'
    && typeof candidate.country === 'string'
    && typeof candidate.currency === 'string';
}

export async function POST(request: Request) {
  let payload: QuickValuationRequest;
  try {
    payload = (await request.json()) as QuickValuationRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!validSelection(payload.selected)) {
    return NextResponse.json({ ok: false, error: 'A validated ticker selection is required.' }, { status: 400 });
  }

  const defeatBetaSymbol = exchangeSymbolForDefeatBeta(payload.symbol || payload.selected.symbol);
  const enrichment = await getDefeatBetaAnalyticsSummary(defeatBetaSymbol, { timeoutMs: 30_000 });
  const valuation = buildQuickValuation({
    selected: payload.selected,
    summary: enrichment.summary,
    ok: enrichment.ok,
    reason: enrichment.ok ? undefined : enrichment.reason,
  });

  return NextResponse.json({ ok: enrichment.ok, valuation });
}
