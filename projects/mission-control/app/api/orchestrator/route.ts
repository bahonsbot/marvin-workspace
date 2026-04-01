import { NextResponse } from 'next/server';
import { getOrchestratorIntegrationSummary } from '@/lib/adapters/orchestrator';

export async function GET() {
  const data = await getOrchestratorIntegrationSummary();
  return NextResponse.json(data);
}
