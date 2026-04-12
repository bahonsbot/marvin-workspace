import { NextResponse } from 'next/server';
import { readOrchestratorIntegrationSummary } from '@/lib/adapters/orchestrator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const data = await readOrchestratorIntegrationSummary();

  return NextResponse.json(
    data,
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
