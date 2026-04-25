import { NextRequest, NextResponse } from 'next/server';
import { getOrchestratorIntegrationSummary, readOrchestratorIntegrationSummary } from '@/lib/adapters/orchestrator';
import { resolveRuntimeBridgeLaneFromHeaders } from '@/lib/runtime-bridge-lane';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const lane = resolveRuntimeBridgeLaneFromHeaders(request.headers);
  const fresh = request.nextUrl.searchParams.get('fresh') === '1';
  const data = fresh
    ? await getOrchestratorIntegrationSummary(lane)
    : await readOrchestratorIntegrationSummary(lane);

  return NextResponse.json(
    data,
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
