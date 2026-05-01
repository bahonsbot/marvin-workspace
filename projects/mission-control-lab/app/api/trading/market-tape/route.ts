import { NextResponse } from 'next/server';
import { getMarketTape } from '@/lib/trading/market-tape';

export async function GET() {
  const tape = await getMarketTape();
  return NextResponse.json(tape, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
