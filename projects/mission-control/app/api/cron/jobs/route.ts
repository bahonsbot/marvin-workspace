import { NextResponse } from 'next/server';
import { getCronJobs } from '@/lib/adapters/cron';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await getCronJobs();
  return NextResponse.json(data);
}
