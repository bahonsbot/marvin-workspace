import { NextResponse } from 'next/server';
import { getDefeatBetaAnalyticsSummary } from '@/lib/trading/sources/defeatbeta';

type Params = { params: Promise<{ symbol: string }> };

export async function GET(_request: Request, context: Params) {
  const { symbol } = await context.params;
  const result = await getDefeatBetaAnalyticsSummary(symbol);
  return NextResponse.json(result, {
    status: result.ok ? 200 : result.status === 'error' ? 502 : 200,
  });
}
