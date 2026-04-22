import { NextRequest, NextResponse } from 'next/server';
import { getOrchestratorIntegrationSummary } from '@/lib/adapters/orchestrator';
import { resolveRuntimeBridgeLaneFromHeaders } from '@/lib/runtime-bridge-lane';

export async function GET(request: NextRequest) {
  const data = await getOrchestratorIntegrationSummary(resolveRuntimeBridgeLaneFromHeaders(request.headers));
  return NextResponse.json(data);
}
