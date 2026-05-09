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
        status: transcripts.coverage.llmConfigured ? 'ready-to-wire' : 'requires-config',
        label: 'Key financial data extraction',
        note: transcripts.coverage.llmConfigured
          ? 'DefeatBeta LLM methods are available in the library and can be wired next.'
          : 'Requires OpenAI-compatible API key/model config before extraction can run.',
      },
      llmMetricChanges: {
        status: transcripts.coverage.llmConfigured ? 'ready-to-wire' : 'requires-config',
        label: 'Financial metrics changes analysis',
        note: transcripts.coverage.llmConfigured
          ? 'DefeatBeta can analyze quarterly metric changes and drivers once route wiring is added.'
          : 'Requires OpenAI-compatible API key/model config before change analysis can run.',
      },
      llmForecastDrivers: {
        status: transcripts.coverage.llmConfigured ? 'ready-to-wire' : 'requires-config',
        label: 'Financial metrics forecast analysis',
        note: transcripts.coverage.llmConfigured
          ? 'DefeatBeta can analyze forecast/guidance drivers once route wiring is added.'
          : 'Requires OpenAI-compatible API key/model config before forecast analysis can run.',
      },
    },
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
