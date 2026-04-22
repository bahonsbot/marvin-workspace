import { NextRequest, NextResponse } from 'next/server';
import { readOrchestratorIntegrationSummary } from '@/lib/adapters/orchestrator';
import { resolveRuntimeBridgeLaneFromHeaders } from '@/lib/runtime-bridge-lane';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const data = await readOrchestratorIntegrationSummary(resolveRuntimeBridgeLaneFromHeaders(request.headers));

  return NextResponse.json(
    data,
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
