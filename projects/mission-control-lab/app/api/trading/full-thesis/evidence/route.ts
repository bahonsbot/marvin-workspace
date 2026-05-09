import { NextResponse } from 'next/server';
import { getDefeatBetaEconomyContext, getDefeatBetaTranscriptCatalog } from '@/lib/trading/sources/defeatbeta';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function validSymbol(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z0-9._-]{1,24}$/i.test(value.trim());
}

export async function POST(request: Request) {
  let payload: { symbol?: unknown };
  try {
    payload = (await request.json()) as { symbol?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!validSymbol(payload.symbol)) {
    return NextResponse.json({ ok: false, error: 'A valid ticker symbol is required.' }, { status: 400 });
  }

  const symbol = payload.symbol.trim().toUpperCase();
  const [transcripts, economy] = await Promise.all([
    getDefeatBetaTranscriptCatalog(symbol, { timeoutMs: 45_000 }),
    getDefeatBetaEconomyContext({ timeoutMs: 45_000 }),
  ]);

  return NextResponse.json({
    ok: true,
    symbol,
    asOf: new Date().toISOString(),
    modules: {
      transcripts,
      economy,
      llmKeyData: {
        status: transcripts.status === 'available' ? 'ready-to-run' : 'unavailable',
        label: 'Key financial data extraction',
        note: transcripts.status === 'available'
          ? 'Milou/OpenClaw extraction can run from DefeatBeta transcript detail. DefeatBeta-native LLM extraction still requires OpenAI-compatible config.'
          : 'Transcript catalogue is unavailable, so key-data extraction cannot run yet.',
      },
      llmMetricChanges: {
        status: 'not-run',
        label: 'Financial metrics changes analysis',
        note: 'Next Milou/OpenClaw extraction module. DefeatBeta-native LLM extraction still requires OpenAI-compatible config.',
      },
      llmForecastDrivers: {
        status: 'not-run',
        label: 'Financial metrics forecast analysis',
        note: 'Next Milou/OpenClaw extraction module. DefeatBeta-native LLM extraction still requires OpenAI-compatible config.',
      },
    },
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
