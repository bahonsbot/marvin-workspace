import { NextRequest, NextResponse } from 'next/server';
import { loadRuntimeBridgeSessionHistory } from '@/lib/runtime-bridge-history';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const sessionKey = request.nextUrl.searchParams.get('sessionKey');
  const history = await loadRuntimeBridgeSessionHistory(sessionKey);

  return NextResponse.json(history, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
