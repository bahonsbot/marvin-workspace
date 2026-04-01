import { NextResponse } from 'next/server';
import { getCronRuns } from '@/lib/adapters/cron';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await getCronRuns();
  return NextResponse.json(data);
}
