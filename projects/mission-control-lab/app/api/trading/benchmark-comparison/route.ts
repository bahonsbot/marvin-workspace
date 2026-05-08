import { NextResponse } from 'next/server';
import { buildBenchmarkComparison } from '@/lib/trading/benchmark-comparison';

export const dynamic = 'force-dynamic';

function validSymbol(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z0-9._-]{1,24}$/i.test(value.trim());
}

export async function POST(request: Request) {
  let payload: { symbol?: unknown; range?: unknown };
  try {
    payload = (await request.json()) as { symbol?: unknown; range?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!validSymbol(payload.symbol)) {
    return NextResponse.json({ ok: false, error: 'A valid ticker symbol is required.' }, { status: 400 });
  }

  const range = typeof payload.range === 'string' && payload.range.trim() ? payload.range.trim().toLowerCase() : '1y';
  const comparison = await buildBenchmarkComparison({ symbol: payload.symbol.trim().toUpperCase(), range });
  return NextResponse.json({ ok: comparison.ok, comparison });
}
